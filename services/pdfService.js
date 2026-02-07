import { writeFileSync, existsSync, unlinkSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

/**
 * Fungsi untuk menghasilkan file PDF LPJ menggunakan Typst.
 */
export const generatePDF = async (data, filePath, finalDivisi) => {
  const typFilePath = filePath.replace(".pdf", ".typ");
  const reportDir = dirname(filePath);

  // Format Bulan
  const [year, month] = data.bulan.split("-");
  const dateObj = new Date(year, month - 1);
  const bulanIndo = dateObj.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  // Helper untuk membersihkan teks dari karakter yang merusak Typst
  const escapeTypst = (text) => {
    if (!text) return "";
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\$/g, "\\$")
      .replace(/#/g, "\\#")
      .replace(/_/g, "\\_")
      .replace(/&/g, "\\&")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/\n/g, " \n ");
  };

  // Gunakan relative path agar Typst tidak bingung dengan root directory
  const getTypstPath = (fullPath) => {
    if (!existsSync(fullPath)) return null;
    return relative(reportDir, fullPath).replace(/\\/g, "/");
  };

  const logoPath = getTypstPath(join(projectRoot, "public", "logo.jpg"));
  const ttdPath = getTypstPath(join(projectRoot, "public", "ttd.png"));
  const stempelPath = getTypstPath(join(projectRoot, "public", "stempel.jpg"));

  // Build rows for finance table
  let pemasukanRows = [];
  if (Array.isArray(data.pemasukan_ket)) {
    data.pemasukan_ket.forEach((ket, i) => {
      const val = Number(data.pemasukan_val?.[i] || 0);
      if (ket || val > 0)
        pemasukanRows.push(
          `[${escapeTypst(ket || "Tanpa Keterangan")}]`,
          `[Rp ${val.toLocaleString("id-ID")}]`,
        );
    });
  }
  if (pemasukanRows.length === 0)
    pemasukanRows.push("[Tidak ada data pemasukan]", "[Rp 0]");

  let pengeluaranRows = [];
  if (Array.isArray(data.pengeluaran_ket))
    data.pengeluaran_ket.forEach((ket, i) => {
      const val = Number(data.pengeluaran_val?.[i] || 0);
      if (ket || val > 0)
        pengeluaranRows.push(
          `[${escapeTypst(ket || "Tanpa Keterangan")}]`,
          `[Rp ${val.toLocaleString("id-ID")}]`,
        );
    });

  if (pengeluaranRows.length === 0)
    pengeluaranRows.push("[Tidak ada data pengeluaran]", "[Rp 0]");

  const templatePath = getTypstPath(
    join(projectRoot, "reports", "template.typ"),
  );

  const typContent = `
#import "${templatePath}": lpj-report

#lpj-report(
  divisi: [${escapeTypst(finalDivisi)}],
  bulan: [${escapeTypst(bulanIndo)}],
  pelapor: [${escapeTypst(data.nama || data.nama_pelapor)}],
  logo-path: ${logoPath ? `"${logoPath}"` : "none"},
  stempel-path: ${stempelPath ? `"${stempelPath}"` : "none"},
  ttd-path: ${ttdPath ? `"${ttdPath}"` : "none"},
  program-kerja: [${escapeTypst(data.program_kerja)}],
  pemasukan-rows: (${pemasukanRows.join(", ")}),
  pengeluaran-rows: (${pengeluaranRows.join(", ")}),
  total-pemasukan: ${Number(data.pemasukan || 0)},
  total-pengeluaran: ${Number(data.pengeluaran || 0)},
  evaluasi: [${escapeTypst(data.evaluasi)}],
  rencana: [${escapeTypst(data.rencana)}],
  generated-at: "${new Date().toLocaleString("id-ID")}",
  "",
)
`;

  try {
    writeFileSync(typFilePath, typContent);
    // Tambahkan flag --root agar Typst bisa mengakses aset di folder public
    await execPromise(
      `typst compile --root "${projectRoot}" "${typFilePath}" "${filePath}"`,
    );
    if (existsSync(typFilePath)) unlinkSync(typFilePath);
  } catch (error) {
    console.error("Typst Compilation Error:", error);
    throw error;
  }
};
