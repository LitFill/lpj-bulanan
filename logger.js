import winston from "winston";
const { format: _format, createLogger, transports: _transports } = winston;
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import db from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, "logs");
if (!existsSync(logsDir))
  mkdirSync(logsDir, { recursive: true });

// Custom format for logs
const logFormat = _format.combine(
  _format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  _format.errors({ stack: true }),
  _format.json(),
  _format.prettyPrint(),
);

/**
 * Logger utama aplikasi menggunakan Winston.
 * @type {import('winston').Logger}
 */
export const logger = createLogger({
  level: "info",
  format: logFormat,
  defaultMeta: { service: "lpj-system" },
  transports: [
    // Error log file
    new _transports.File({
      filename: join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new _transports.File({
      filename: join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Audit log file
    new _transports.File({
      filename: join(logsDir, "audit.log"),
      level: "info",
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

// Console logging for development
if (process.env.NODE_ENV !== "production")
  logger.add(
    new _transports.Console({
      format: _format.combine(_format.colorize(), _format.simple()),
    }),
  );

/**
 * Objek helper untuk pencatatan log ke database.
 * @namespace
 */
export const dbLogger = {
  /**
   * Mencatat pesan log ke tabel system_logs di database.
   * @param {string} level - Level keparahan log (info, error, warn).
   * @param {string} message - Pesan log yang akan disimpan.
   * @param {Object} [meta={}] - Data tambahan dalam format objek.
   */
  log: (level, message, meta = {}) => {
    const logData = {
      level,
      message,
      meta: JSON.stringify(meta),
      timestamp: new Date().toISOString(),
    };

    db.run(
      "INSERT INTO system_logs (level, message, meta, timestamp) VALUES (?, ?, ?, ?)",
      [logData.level, logData.message, logData.meta, logData.timestamp],
      (err) => {
        if (err) logger.error("Failed to log to database:", err);
      },
    );
  },
};

/**
 * Objek helper untuk pencatatan jejak audit (audit trail).
 * @namespace
 */
export const auditLogger = {
  /**
   * Mencatat aktivitas audit ke tabel audit_logs.
   * @param {number|string} userId - ID pengguna yang melakukan aktivitas.
   * @param {string} action - Deskripsi aksi yang dilakukan (misal: CREATE_REPORT).
   * @param {string} resourceType - Tipe sumber daya yang diakses.
   * @param {number|string} resourceId - ID sumber daya yang terkait.
   * @param {Object} [details={}] - Detail tambahan mengenai aktivitas.
   */
  log: (userId, action, resourceType, resourceId, details = {}) => {
    const auditData = {
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: JSON.stringify(details),
      created_at: new Date().toISOString(),
    };

    db.run(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        auditData.user_id,
        auditData.action,
        auditData.resource_type,
        auditData.resource_id,
        auditData.details,
        auditData.created_at,
      ],
      (err) => {
        if (err) logger.error("Failed to log audit:", err);
      },
    );

    // Also log to Winston
    logger.info(`AUDIT: ${action}`, {
      userId,
      resourceType,
      resourceId,
      details,
    });
  },
};

export default {
  logger,
  dbLogger,
  auditLogger,
};

