import express, { static as _static } from "express";
import { urlencoded } from "body-parser";
import session from "express-session";
import PDFDocument from "pdfkit";
import { existsSync, mkdirSync, createWriteStream, unlinkSync } from "fs";
import { join } from "path";
import { Parser } from "json2csv";
import { upload, handleUploadError } from "./middleware/upload";
import { logger, dbLogger, auditLogger } from "./logger";
import { get, all, run } from "./database";

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(urlencoded({ extended: true }));
app.use(
  session({
    secret: "lpj-secret-key-12345",
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

/**
 * Fungsi untuk menghasilkan file PDF LPJ.
 * @param {Object} data - Data laporan
 * @param {string} filePath - Path tempat menyimpan file PDF
 * @param {string} finalDivisi - Nama divisi yang sudah diproses
 */
const generatePDF = (data, filePath, finalDivisi) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      // Header dengan Logo
      const logoPath = join(__dirname, "public", "logo.jpg");
      if (existsSync(logoPath)) doc.image(logoPath, 50, 45, { width: 60 });

      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("PONDOK PESANTREN AT-TAUJIEH AL-ISLAMY 2", { align: "center" });
      doc
        .fontSize(10)
        .font("Helvetica")
        .text("Leler, Randegan, Kebasen, Banyumas, Jawa Tengah", {
          align: "center",
        });
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .moveDown()
        .text("LAPORAN PERTANGGUNGJAWABAN (LPJ) BULANAN", { align: "center" });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(12).font("Helvetica");
      doc
        .text(`Divisi/Bagian:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` ${finalDivisi}`)
        .font("Helvetica");

      // Format tampilan bulan (YYYY-MM ke Nama Bulan Tahun)
      const [year, month] = data.bulan.split("-");
      const dateObj = new Date(year, month - 1);
      const bulanIndo = dateObj.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });

      doc.text(`Bulan: ${bulanIndo}`);
      doc.text(`Pelapor: ${data.nama || data.nama_pelapor}`);
      doc.moveDown();

      doc
        .fontSize(13)
        .fillColor("#1e40af")
        .font("Helvetica-Bold")
        .text("1. Realisasi Program Kerja");
      doc
        .fontSize(11)
        .fillColor("black")
        .font("Helvetica")
        .text(data.program_kerja);
      doc.moveDown();

      doc
        .fontSize(13)
        .fillColor("#1e40af")
        .font("Helvetica-Bold")
        .text("2. Laporan Keuangan");

      doc.fontSize(10).fillColor("black").font("Helvetica");

      // Tabel Pemasukan
      doc.moveDown(0.5);
      doc
        .font("Helvetica-Bold")
        .text("Rincian Pemasukan:", { underline: true });
      doc.font("Helvetica");

      if (Array.isArray(data.pemasukan_ket))
        data.pemasukan_ket.forEach((ket, i) => {
          const val = Number(data.pemasukan_val[i] || 0);
          if (ket || val > 0) {
            const currentY = doc.y;
            doc.text(`- ${ket || "Tanpa Keterangan"}`);
            doc.text(`Rp ${val.toLocaleString("id-ID")}`, 450, currentY, {
              align: "right",
              width: 100,
            });
          }
        });
      else doc.text("- Lihat total di bawah -");

      // Tabel Pengeluaran
      doc.moveDown(0.5);
      doc
        .font("Helvetica-Bold")
        .text("Rincian Pengeluaran:", { underline: true });
      doc.font("Helvetica");

      if (Array.isArray(data.pengeluaran_ket))
        data.pengeluaran_ket.forEach((ket, i) => {
          const val = Number(data.pengeluaran_val[i] || 0);
          if (ket || val > 0) {
            const currentY = doc.y;
            doc.text(`- ${ket || "Tanpa Keterangan"}`);
            doc.text(`Rp ${val.toLocaleString("id-ID")}`, 450, currentY, {
              align: "right",
              width: 100,
            });
          }
        });
      else doc.text("- Lihat total di bawah -");

      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(11);
      doc.text(
        `Total Pemasukan: Rp ${Number(data.pemasukan).toLocaleString("id-ID")}`,
      );
      doc.text(
        `Total Pengeluaran: Rp ${Number(data.pengeluaran).toLocaleString("id-ID")}`,
      );
      const saldo = Number(data.pemasukan) - Number(data.pengeluaran);
      doc
        .fillColor(saldo >= 0 ? "green" : "red")
        .text(`Saldo Akhir: Rp ${saldo.toLocaleString("id-ID")}`);
      doc.fillColor("black").moveDown();

      doc
        .fontSize(13)
        .fillColor("#1e40af")
        .font("Helvetica-Bold")
        .text("3. Evaluasi & Kendala");
      doc.fontSize(11).fillColor("black").font("Helvetica").text(data.evaluasi);
      doc.moveDown();

      doc
        .fontSize(13)
        .fillColor("#1e40af")
        .font("Helvetica-Bold")
        .text("4. Rencana Bulan Depan");
      doc.fontSize(11).fillColor("black").font("Helvetica").text(data.rencana);
      doc.moveDown();

      // Tanda Tangan & Stempel
      doc.moveDown(2);
      const currentY = doc.y;
      doc.fontSize(11).text("Mengetahui,", 400, currentY);
      doc.text("Kepala Divisi,", 400, currentY + 15);

      const ttdPath = join(__dirname, "public", "ttd.png");
      const stempelPath = join(__dirname, "public", "stempel.jpg");

      if (existsSync(ttdPath))
        doc.image(ttdPath, 400, currentY + 35, { width: 80 });

      if (existsSync(stempelPath))
        doc.image(stempelPath, 370, currentY + 30, { width: 100 });

      doc.text(`( ${data.nama || data.nama_pelapor} )`, 400, currentY + 110);

      // Footer
      doc.moveDown(4);
      doc
        .fontSize(10)
        .fillColor("grey")
        .text("Dicetak secara otomatis melalui Sistem LPJ Digital", {
          align: "center",
        });
      doc.text(`Generated: ${new Date().toLocaleString("id-ID")}`, {
        align: "center",
      });

      doc.end();
      stream.on("finish", () => resolve());
      stream.on("error", (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
};

// Routes
app.get("/", (req, res) => {
  logger.info("Rendering index page");
  res.render("index", { user: req.session.user, error: null });
});

app.get("/dashboard", isAuthenticated, (req, res) => {
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

  get(statsQuery, (err, stats) => {
    if (err) return res.status(500).send("Error fetching stats");
    all(monthlyQuery, (err, monthlyData) => {
      if (err) return res.status(500).send("Error fetching monthly data");
      res.render("dashboard", {
        stats: stats || {},
        monthlyData: monthlyData || [],
        user: req.session.user,
      });
    });
  });
});

app.get("/export-csv", isAuthenticated, (_req, res) => {
  all(
    "SELECT divisi, bulan, nama_pelapor, pemasukan, pengeluaran, created_at FROM reports ORDER BY created_at DESC",
    (err, rows) => {
      if (err) return res.status(500).send("Error exporting data");

      try {
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
      } catch (error) {
        logger.error("Export error:", error);
        res.status(500).send("Error generating CSV");
      }
    },
  );
});

/**
 * Rute untuk menghapus laporan beserta file fisik terkait (PDF & Lampiran).
 */
app.post("/delete-report/:id", isAuthenticated, (req, res) => {
  const reportId = req.params.id;

  get(
    "SELECT pdf_path, attachment_path, divisi, bulan FROM reports WHERE id = ?",
    [reportId],
    (err, report) => {
      if (err || !report) {
        logger.error("Error finding report to delete:", err);
        return res.status(404).send("Laporan tidak ditemukan");
      }

      run("DELETE FROM reports WHERE id = ?", [reportId], (err) => {
        if (err) {
          logger.error("Error deleting report from DB:", err);
          return res.status(500).send("Gagal menghapus data");
        }

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

        auditLogger.log(
          req.session.user.id,
          "DELETE_REPORT",
          "report",
          reportId,
          {
            divisi: report.divisi,
            bulan: report.bulan,
          },
        );

        res.redirect("/reports");
      });
    },
  );
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/reports");
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  get(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password],
    (err, user) => {
      if (err || !user)
        return res.render("login", { error: "Username atau password salah" });

      req.session.user = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      };
      logger.info(`User logged in: ${user.username}`);
      res.redirect("/reports");
    },
  );
});

app.get("/logout", (req, res) => {
  const username = req.session.user ? req.session.user.username : "unknown";
  req.session.destroy();
  logger.info(`User logged out: ${username}`);
  res.redirect("/login");
});

app.get("/reports", isAuthenticated, (req, res) => {
  all("SELECT * FROM reports ORDER BY created_at DESC", (err, reports) => {
    if (err) {
      logger.error("Error fetching reports:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    logger.info(
      `Fetched ${reports.length} reports for rendering by user ${req.session.user.username}`,
    );
    res.render("reports", { reports, user: req.session.user });
  });
});

app.post(
  "/submit",
  upload.single("attachment"),
  handleUploadError,
  (req, res) => {
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

    generatePDF(data, filePath, finalDivisi)
      .then(() => {
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
          status: "submitted",
        };

        run(
          `INSERT INTO reports (
                    user_id, divisi, bulan, nama_pelapor, program_kerja,
                    pemasukan, pengeluaran, evaluasi, rencana,
                    attachment_filename, attachment_path, pdf_filename, pdf_path, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            reportData.status,
          ],
          function (err) {
            if (err) {
              logger.error("Error saving report to database:", err);
              return res.status(500).json({ error: "Failed to save report" });
            }

            const reportId = this.lastID;
            const processingTime = Date.now() - startTime;

            // Log audit trail
            auditLogger.log(
              reportData.user_id,
              "CREATE_REPORT",
              "report",
              reportId,
              {
                divisi: finalDivisi,
                bulan: data.bulan,
                processingTime: `${processingTime}ms`,
                hasAttachment: !!attachment,
              },
            );

            logger.info("Report created successfully", {
              reportId,
              fileName,
              processingTime: `${processingTime}ms`,
            });

            res.render("success", { fileName, user: req.session.user });
          },
        );
      })
      .catch((err) => {
        logger.error("PDF Generation error:", err);
        res.status(500).send("Error generating PDF");
      });
  },
);

/**
 * Rute untuk menampilkan halaman edit laporan.
 */
app.get("/edit-report/:id", isAuthenticated, (req, res) => {
  const reportId = req.params.id;
  get("SELECT * FROM reports WHERE id = ?", [reportId], (err, report) => {
    if (err || !report) {
      logger.error("Error finding report for edit:", err);
      return res.status(404).send("Laporan tidak ditemukan");
    }
    res.render("edit", { report, user: req.session.user, error: null });
  });
});

/**
 * Rute untuk memproses pembaruan laporan.
 */
app.post(
  "/update-report/:id",
  isAuthenticated,
  upload.single("attachment"),
  handleUploadError,
  (req, res) => {
    const reportId = req.params.id;
    const data = req.body;
    const attachment = req.file;

    get("SELECT * FROM reports WHERE id = ?", [reportId], (err, oldReport) => {
      if (err || !oldReport)
        return res.status(404).send("Laporan tidak ditemukan");

      let finalDivisi = data.divisi;
      if (finalDivisi === "Ko'or Asrama" && data.nama_asrama)
        finalDivisi = data.nama_asrama;

      // Hapus PDF lama
      if (existsSync(oldReport.pdf_path))
        try {
          unlinkSync(oldReport.pdf_path);
        } catch (e) {
          logger.error("Old PDF delete error:", e);
        }

      // Generate PDF baru
      const fileName = `LPJ_${finalDivisi.replace(/\s+/g, "_")}_${data.bulan}_${Date.now()}.pdf`;
      const filePath = join(__dirname, "reports", fileName);

      generatePDF(data, filePath, finalDivisi)
        .then(() => {
          let attachment_filename = oldReport.attachment_filename;
          let attachment_path = oldReport.attachment_path;

          if (attachment) {
            // Hapus lampiran lama jika ada yang baru
            if (
              oldReport.attachment_path &&
              existsSync(oldReport.attachment_path)
            )
              try {
                unlinkSync(oldReport.attachment_path);
              } catch (e) {
                logger.error("Old attachment delete error:", e);
              }

            attachment_filename = attachment.filename;
            attachment_path = attachment.path;
          }

          run(
            `UPDATE reports SET
                            divisi = ?, bulan = ?, nama_pelapor = ?, program_kerja = ?,
                            pemasukan = ?, pengeluaran = ?, evaluasi = ?, rencana = ?,
                            attachment_filename = ?, attachment_path = ?,
                            pdf_filename = ?, pdf_path = ?
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
              reportId,
            ],
            (err) => {
              if (err) {
                logger.error("Update DB error:", err);
                return res.status(500).send("Gagal memperbarui database");
              }

              auditLogger.log(
                req.session.user.id,
                "UPDATE_REPORT",
                "report",
                reportId,
                { divisi: finalDivisi, bulan: data.bulan },
              );

              res.redirect("/reports");
            },
          );
        })
        .catch((err) => {
          logger.error("PDF Regeneration error:", err);
          res.status(500).send("Gagal regenerasi PDF");
        });
    });
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
