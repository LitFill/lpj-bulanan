import express from "express";
const { static: _static } = express;
import bodyParser from "body-parser";
const { urlencoded } = bodyParser;
import session from "express-session";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import json2csv from "json2csv";
const { Parser } = json2csv;
import { upload, handleUploadError } from "./middleware/upload.js";
import { logger, dbLogger, auditLogger } from "./logger.js";
import { getDb } from "./database.js";
import { generatePDF } from "./services/pdfService.js";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inisialisasi DB Instance
const db = await getDb();

/**
 * Helper untuk memparsing input bulan ke format YYYY-MM.
 * Mendukung format ISO (2024-01), "Januari 2024", atau "2024 Januari".
 */
const parseBulan = (bulanStr) => {
  if (!bulanStr) return null;
  
  // 1. Cek format ISO YYYY-MM (Standar input type="month")
  if (/^\d{4}-\d{2}$/.test(bulanStr)) return bulanStr;

  // 2. Mapping bulan Indonesia
  const monthsIndo = {
    januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06",
    juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12"
  };

  let normalized = bulanStr.toLowerCase();
  Object.keys(monthsIndo).forEach(name => {
    normalized = normalized.replace(name, monthsIndo[name]);
  });

  // 3. Ekstrak Tahun (4 digit) dan Bulan (1-2 digit)
  const parts = normalized.match(/(\d{4})|(\d{1,2})/g);
  if (parts) {
    const year = parts.find(p => p.length === 4);
    const month = parts.find(p => p.length <= 2 && p !== year);
    if (year && month) {
      return `${year}-${month.padStart(2, "0")}`;
    }
  }

  // 4. Fallback ke Date.parse (Untuk format Inggris)
  const d = new Date(bulanStr);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  return null;
};

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "lpj-secret-key-12345",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  }),
);
app.use(_static("public"));
app.use("/reports", _static("reports"));
app.use("/uploads", _static("uploads"));
app.set("view engine", "ejs");

// Auth Middleware
/**
 * Middleware untuk mengecek apakah pengguna sudah login.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const isAuthenticated = (req, res, next) => {
  if (req.session.user) next();
  else res.redirect("/login");
};

// Request logging middleware
/**
 * Middleware untuk mencatat log setiap permintaan HTTP.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.session.user ? req.session.user.id : "guest",
    };

    if (res.statusCode >= 400) logger.warn("HTTP Request", logData);
    else logger.info("HTTP Request", logData);
  });

  next();
});

// Ensure directories exist
["./reports", "./uploads", "./logs"].forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// Routes
app.get("/", (req, res) => {
  logger.info("Rendering index page");
  res.render("index", { user: req.session.user, error: null });
});

app.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const statsQuery = `
          SELECT
              COUNT(*) as total_reports,
              SUM(pemasukan) as total_pemasukan,
              SUM(pengeluaran) as total_pengeluaran,
              (SUM(pemasukan) - SUM(pengeluaran)) as total_saldo
          FROM reports
      `;

    const monthlyQuery = `
          SELECT bulan, SUM(pemasukan) as masuk, SUM(pengeluaran) as keluar
          FROM reports
          GROUP BY bulan
          ORDER BY bulan DESC
          LIMIT 6
      `;

    const stats = await db.get(statsQuery);
    const monthlyData = await db.all(monthlyQuery);

    res.render("dashboard", {
      stats: stats || {},
      monthlyData: monthlyData || [],
      user: req.session.user,
    });
  } catch (err) {
    logger.error("Dashboard error:", err);
    res.status(500).send("Error fetching stats");
  }
});

app.get("/export-csv", isAuthenticated, async (_req, res) => {
  try {
    const rows = await db.all(
      /* sql */
      "SELECT divisi, bulan, nama_pelapor, pemasukan, pengeluaran, created_at FROM reports ORDER BY created_at DESC",
    );

    const fields = [
      "divisi",
      "bulan",
      "nama_pelapor",
      "pemasukan",
      "pengeluaran",
      "created_at",
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);

    res.header("Content-Type", "text/csv");
    res.attachment(`Rekap_LPJ_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    logger.error("Export error:", err);
    res.status(500).send("Error exporting data");
  }
});

/**
 * Rute untuk menghapus laporan beserta file fisik terkait (PDF & Lampiran).
 */
app.post("/delete-report/:id", isAuthenticated, async (req, res) => {
  const reportId = req.params.id;

  try {
    const report = await db.get(
      "SELECT pdf_path, attachment_path, divisi, bulan FROM reports WHERE id = ?",
      [reportId],
    );

    if (!report) return res.status(404).send("Laporan tidak ditemukan");

    await db.run("DELETE FROM reports WHERE id = ?", [reportId]);

    if (report.pdf_path && existsSync(report.pdf_path))
      try {
        unlinkSync(report.pdf_path);
      } catch (e) {
        logger.error("File delete error:", e);
      }

    if (report.attachment_path && existsSync(report.attachment_path))
      try {
        unlinkSync(report.attachment_path);
      } catch (e) {
        logger.error("Attachment delete error:", e);
      }

    await auditLogger.log(req.session.user.id, "DELETE_REPORT", "report", reportId, {
      divisi: report.divisi,
      bulan: report.bulan,
    });

    res.redirect("/reports");
  } catch (err) {
    logger.error("Error deleting report:", {
      message: err.message,
      stack: err.stack,
      reportId,
    });
          await dbLogger.log("error", "Gagal menghapus laporan", {
            error: err.message,
            reportId,
            userId: req.session.user ? req.session.user.id : "unknown",
          });    res.status(500).send(`Gagal menghapus data: ${err.message}`);
  }
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/reports");
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password],
    );

    if (!user)
      return res.render("login", { error: "Username atau password salah" });

    req.session.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };
    logger.info(`User logged in: ${user.username}`);
    res.redirect("/reports");
  } catch (err) {
    logger.error("Login error:", err);
    res.render("login", { error: "Terjadi kesalahan sistem" });
  }
});

app.get("/logout", (req, res) => {
  const username = req.session.user ? req.session.user.username : "unknown";
  req.session.destroy();
  logger.info(`User logged out: ${username}`);
  res.redirect("/login");
});

app.get("/reports", isAuthenticated, async (req, res) => {
  try {
    const reports = await db.all(
      "SELECT * FROM reports ORDER BY created_at DESC",
    );
    logger.info(
      `Fetched ${reports.length} reports for rendering by user ${req.session.user.username}`,
    );
    res.render("reports", { reports, user: req.session.user });
  } catch (err) {
    logger.error("Error fetching reports:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post(
  "/submit",
  upload.single("attachment"),
  handleUploadError,
  async (req, res) => {
    const startTime = Date.now();
    const data = req.body;
    const attachment = req.file;
    const userId = req.session.user ? req.session.user.id : 1;

    // Validasi Server-side Dasar
    if (!data.nama || !data.divisi || !data.bulan || !data.program_kerja)
      return res.status(400).render("index", {
        error: "Semua field wajib diisi!",
        user: req.session.user,
        oldData: data,
      });

    // Validasi Bulan
    const normalizedBulan = parseBulan(data.bulan);
    if (!normalizedBulan)
      return res.status(400).render("index", {
        error: "Format bulan tidak valid! Gunakan format 'Januari 2024' atau gunakan pemilih tanggal.",
        user: req.session.user,
        oldData: data,
      });

    data.bulan = normalizedBulan;

    // Validasi Bulan (Tidak boleh bulan masa depan)
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (data.bulan > currentMonth)
      return res.status(400).render("index", {
        error: "Bulan laporan tidak boleh di masa depan!",
        user: req.session.user,
        oldData: data,
      });

    let finalDivisi = data.divisi;
    if (finalDivisi === "Ko'or Asrama" && data.nama_asrama)
      finalDivisi = data.nama_asrama;

    logger.info("Processing new report submission", {
      divisi: finalDivisi,
      bulan: data.bulan,
      hasAttachment: !!attachment,
      userId: userId,
    });

    // Generate unique filename
    const fileName = `LPJ_${finalDivisi.replace(/\s+/g, "_")}_${data.bulan}_${Date.now()}.pdf`;
    const filePath = join(__dirname, "reports", fileName);

    try {
      await generatePDF(data, filePath, finalDivisi);

      // Collect financial details
      /** @type {Object.<string, number[]>} */
      const financialDetails = {
        pemasukan: [],
        pengeluaran: [],
      };

      if (Array.isArray(data.pemasukan_ket))
        data.pemasukan_ket.forEach((ket, i) => {
          const val = Number(data.pemasukan_val[i] || 0);
          if (ket || val > 0) financialDetails.pemasukan.push({ ket, val });
        });

      if (Array.isArray(data.pengeluaran_ket))
        data.pengeluaran_ket.forEach((ket, i) => {
          const val = Number(data.pengeluaran_val[i] || 0);
          if (ket || val > 0) financialDetails.pengeluaran.push({ ket, val });
        });

      // Save to database
      const reportData = {
        user_id: userId,
        divisi: finalDivisi,
        bulan: data.bulan,
        nama_pelapor: data.nama,
        program_kerja: data.program_kerja,
        pemasukan: Number(data.pemasukan),
        pengeluaran: Number(data.pengeluaran),
        evaluasi: data.evaluasi,
        rencana: data.rencana,
        attachment_filename: attachment ? attachment.filename : null,
        attachment_path: attachment ? attachment.path : null,
        pdf_filename: fileName,
        pdf_path: filePath,
        financial_details: JSON.stringify(financialDetails),
        status: "submitted",
      };

      const result = await db.run(
        `INSERT INTO reports (
                  user_id, divisi, bulan, nama_pelapor, program_kerja,
                  pemasukan, pengeluaran, evaluasi, rencana,
                  attachment_filename, attachment_path, pdf_filename, pdf_path,
                  financial_details, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportData.user_id,
          reportData.divisi,
          reportData.bulan,
          reportData.nama_pelapor,
          reportData.program_kerja,
          reportData.pemasukan,
          reportData.pengeluaran,
          reportData.evaluasi,
          reportData.rencana,
          reportData.attachment_filename,
          reportData.attachment_path,
          reportData.pdf_filename,
          reportData.pdf_path,
          reportData.financial_details,
          reportData.status,
        ],
      );

      const reportId = result.lastID;
      const processingTime = Date.now() - startTime;

      // Log audit trail
      await auditLogger.log(reportData.user_id, "CREATE_REPORT", "report", reportId, {
        divisi: finalDivisi,
        bulan: data.bulan,
        processingTime: `${processingTime}ms`,
        hasAttachment: !!attachment,
      });

      logger.info("Report created successfully", {
        reportId,
        fileName,
        processingTime: `${processingTime}ms`,
      });

      res.render("success", { fileName, user: req.session.user });
    } catch (err) {
      logger.error("Error processing submission:", {
        message: err.message,
        stack: err.stack,
        userId,
        data: req.body,
      });

      await dbLogger.log("error", "Gagal menyimpan laporan baru", {
        error: err.message,
        userId,
      });

      res.status(500).send(`Gagal memproses laporan: ${err.message}`);
    }
  },
);

/**
 * Rute untuk menampilkan halaman edit laporan.
 */
app.get("/edit-report/:id", isAuthenticated, async (req, res) => {
  const reportId = req.params.id;
  try {
    const report = await db.get("SELECT * FROM reports WHERE id = ?", [
      reportId,
    ]);
    if (!report) return res.status(404).send("Laporan tidak ditemukan");

    res.render("edit", { report, user: req.session.user, error: null });
  } catch (err) {
    logger.error("Error finding report for edit:", {
      message: err.message,
      stack: err.stack,
      reportId,
    });
    await dbLogger.log("error", "Gagal memuat halaman edit laporan", {
      error: err.message,
      reportId,
    });
    res.status(500).send(`Terjadi kesalahan sistem: ${err.message}`);
  }
});

/**
 * Rute untuk memproses pembaruan laporan.
 */
app.post(
  "/update-report/:id",
  isAuthenticated,
  upload.single("attachment"),
  handleUploadError,
  async (req, res) => {
    const reportId = req.params.id;
    const data = req.body;
    const attachment = req.file;

    try {
      const oldReport = await db.get("SELECT * FROM reports WHERE id = ?", [
        reportId,
      ]);

      if (!oldReport) return res.status(404).send("Laporan tidak ditemukan");

      let finalDivisi = data.divisi;
      if (finalDivisi === "Ko'or Asrama" && data.nama_asrama)
        finalDivisi = data.nama_asrama;

      // Validasi Bulan
      const normalizedBulan = parseBulan(data.bulan);
      if (!normalizedBulan)
        return res.status(400).render("edit", {
          report: { ...oldReport, ...data },
          user: req.session.user,
          error: "Format bulan tidak valid!",
        });

      data.bulan = normalizedBulan;

      // Validasi Bulan (Tidak boleh bulan masa depan)
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (data.bulan > currentMonth)
        return res.status(400).render("edit", {
          report: { ...oldReport, ...data },
          user: req.session.user,
          error: "Bulan laporan tidak boleh di masa depan!",
        });

      // Generate PDF baru
      const fileName = `LPJ_${finalDivisi.replace(/\s+/g, "_")}_${data.bulan}_${Date.now()}.pdf`;
      const filePath = join(__dirname, "reports", fileName);

      await generatePDF(data, filePath, finalDivisi);

      // Hapus PDF lama setelah PDF baru berhasil di-generate
      if (oldReport.pdf_path && existsSync(oldReport.pdf_path))
        try {
          unlinkSync(oldReport.pdf_path);
        } catch (e) {
          logger.error("Old PDF delete error:", e);
        }

      let attachment_filename = oldReport.attachment_filename;
      let attachment_path = oldReport.attachment_path;
      let oldAttachmentPathToDelete = null;

      if (attachment) {
        // Simpan path lampiran lama untuk dihapus nanti
        if (oldReport.attachment_path && existsSync(oldReport.attachment_path))
          oldAttachmentPathToDelete = oldReport.attachment_path;

        attachment_filename = attachment.filename;
        attachment_path = attachment.path;
      }

      // Collect financial details
      const financialDetails = {
        pemasukan: [],
        pengeluaran: [],
      };

      if (Array.isArray(data.pemasukan_ket))
        data.pemasukan_ket.forEach((ket, i) => {
          const val = Number(data.pemasukan_val[i] || 0);
          if (ket || val > 0) financialDetails.pemasukan.push({ ket, val });
        });

      if (Array.isArray(data.pengeluaran_ket))
        data.pengeluaran_ket.forEach((ket, i) => {
          const val = Number(data.pengeluaran_val[i] || 0);
          if (ket || val > 0) financialDetails.pengeluaran.push({ ket, val });
        });

      await db.run(
        `UPDATE reports SET
                        divisi = ?, bulan = ?, nama_pelapor = ?, program_kerja = ?,
                        pemasukan = ?, pengeluaran = ?, evaluasi = ?, rencana = ?,
                        attachment_filename = ?, attachment_path = ?,
                        pdf_filename = ?, pdf_path = ?, financial_details = ?
                    WHERE id = ?`,
        [
          finalDivisi,
          data.bulan,
          data.nama,
          data.program_kerja,
          Number(data.pemasukan),
          Number(data.pengeluaran),
          data.evaluasi,
          data.rencana,
          attachment_filename,
          attachment_path,
          fileName,
          filePath,
          JSON.stringify(financialDetails),
          reportId,
        ],
      );

      // Hapus lampiran lama hanya jika update DB berhasil
      if (oldAttachmentPathToDelete)
        try {
          unlinkSync(oldAttachmentPathToDelete);
        } catch (e) {
          logger.error("Old attachment delete error:", e);
        }

      await auditLogger.log(
        req.session.user.id,
        "UPDATE_REPORT",
        "report",
        reportId,
        {
          divisi: finalDivisi,
          bulan: data.bulan,
        },
      );

      res.redirect("/reports");
    } catch (err) {
      logger.error("Update error:", {
        message: err.message,
        stack: err.stack,
        reportId,
        data: req.body,
      });

      await dbLogger.log("error", "Gagal memperbarui laporan", {
        error: err.message,
        reportId,
        userId: req.session.user ? req.session.user.id : "unknown",
      });

      res.status(500).send(`Gagal memperbarui laporan: ${err.message}`);
    }
  },
);

// Error handling middleware
app.use((err, req, res, _next) => {
  logger.error("Unhandled error:", {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start server
app.listen(port, () => {
  logger.info(`LPJ System started on port ${port}`, {
    port,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "development",
  });
});

export default app;
