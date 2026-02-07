import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, "database.sqlite");

/**
 * Membuka koneksi database SQLite secara asynchronous.
 */
export const openDb = async () =>
  open({ filename: dbPath, driver: sqlite3.Database });

// Inisialisasi Database (Hanya dijalankan saat aplikasi pertama kali butuh koneksi)
export const initDb = async () => {
  const db = await openDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
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
        financial_details TEXT,
        status TEXT DEFAULT 'submitted',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
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
    );

    CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        meta TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
};

// Instance DB global yang akan diisi setelah inisialisasi
let dbInstance = null;

/** @type {Database<sqlite3.Database, sqlite3.Statement>} */
export const getDb = async () => {
  if (!dbInstance) dbInstance = await initDb();

  return dbInstance;
};

export default getDb;

