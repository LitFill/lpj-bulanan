import sqlite3 from "sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sqlite3Verbose = sqlite3.verbose();

/**
 * Path ke file database SQLite
 * @type {string}
 */
const dbPath = join(__dirname, "database.sqlite");

/**
 * Instansi database SQLite untuk aplikasi LPJ
 * @type {import('sqlite3').Database}
 */
const db = new sqlite3Verbose.Database(dbPath, (err) => {
  if (err) console.error("Error opening database:", err.message);
  else console.log("Connected to SQLite database.");
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

  // Reports table
  db.run(`CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        divisi TEXT NOT NULL,
        bulan TEXT NOT NULL,
        nama_pelapor TEXT NOT NULL,
        program_kerja TEXT,
        pemasukan REAL DEFAULT 0,
        pengeluaran REAL DEFAULT 0,
        evaluasi TEXT,
        rencana TEXT,
        attachment_filename TEXT,
        attachment_path TEXT,
        pdf_filename TEXT,
        pdf_path TEXT,
        status TEXT DEFAULT 'submitted',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

  // Audit logs table
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

  // System logs table
  db.run(`CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        meta TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

export const get = db.get.bind(db);
export const all = db.all.bind(db);
export const run = db.run.bind(db);
export const serialize = db.serialize.bind(db);
export const prepare = db.prepare.bind(db);

export default db;

