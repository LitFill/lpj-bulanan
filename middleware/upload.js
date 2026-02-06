import multer from "multer";
const { diskStorage, MulterError } = multer;
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validasi tipe file yang diunggah.
 * @param {import('express').Request} _req
 * @param {import('multer').File} file
 * @param {function(Error|null, boolean): void} cb
 */
const fileFilter = (_req, file, cb) => {
  /** @type {Object.<string, string>} */
  const allowedTypes = {
    "application/pdf": "PDF",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "Word",
    "application/vnd.ms-excel": "Excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "Excel",
    "image/jpeg": "Image",
    "image/jpg": "Image",
    "image/png": "Image",
    "image/gif": "Image",
  };

  if (allowedTypes[file.mimetype]) {
    logger.info("File type validation passed", {
      filename: file.originalname,
      mimetype: file.mimetype,
      type: allowedTypes[file.mimetype],
    });
    cb(null, true);
  } else {
    logger.warn("File type validation failed", {
      filename: file.originalname,
      mimetype: file.mimetype,
    });
    cb(
      new Error(
        `Tipe file tidak valid. Tipe yang diizinkan: PDF, Word, Excel, dan Gambar (JPEG, PNG, GIF)`,
      ),
      false,
    );
  }
};

/**
 * Konfigurasi penyimpanan file.
 * @type {import('multer').StorageEngine}
 */
const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = join(__dirname, "..", "uploads");
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    // Sanitize filename
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + sanitizedName);
  },
});

/**
 * Instance Multer untuk mengelola unggahan file.
 * @type {import('multer').Multer}
 */
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Maximum 1 file per upload
  },
});

/**
 * Middleware untuk menangani error saat proses unggah file.
 * @param {Error} err
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const handleUploadError = (err, _req, res, next) => {
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Ukuran file terlalu besar. Maksimal 10MB.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Terlalu banyak file. Maksimal 1 file yang diizinkan.",
      });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

export default {
  upload,
  handleUploadError,
};

