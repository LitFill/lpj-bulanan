# Sistem LPJ Digital - Pengurus Andalusia

Sistem digitalisasi Laporan Pertanggungjawaban (LPJ) bulanan untuk pengurus
Pondok Pesantren At-Taujieh Al-Islamy 2. Sistem ini memungkinkan pengurus
mengirim laporan, menghitung keuangan secara otomatis, dan menghasilkan dokumen
PDF siap cetak.

## Fitur Utama

- **Formulir Digital**: Input realisasi program, keuangan, evaluasi, dan
  rencana bulan depan.
- **Auto-Generate PDF**: Menghasilkan dokumen PDF resmi dengan logo, tanda
  tangan, dan stempel otomatis.
- **Manajemen Arsip**: Admin dapat melihat, mengedit, dan menghapus laporan
  yang telah masuk.
- **Statistik & Export**: Dashboard statistik keuangan dan ekspor data ke CSV.
- **Dukungan Koordinator Asrama**: Pilihan khusus untuk berbagai asrama (Deza,
  Nahwu, Hadits, Fiqih, Selatan, Pdf).

## Teknologi yang Digunakan

- **Backend**: Node.js, Express.js
- **Database**: SQLite (Ringan & Tanpa Server)
- **PDF Engine**: PDFKit
- **Styling**: Tailwind CSS
- **Template Engine**: EJS

## Cara Penggunaan Lokal

1. Install dependensi:

   ```bash
   npm install
   ```

2. Inisialisasi database (pertama kali):

   ```bash
   node init_db.js
   ```

3. Jalankan server:

   ```bash
   node server.js
   ```

4. Buka di browser: `http://localhost:3000`

## Struktur Folder

- `views/`: Template tampilan (EJS)
- `public/`: Aset statis (Logo, Stempel, TTD)
- `middleware/`: Logika upload file
- `reports/`: (Dibuat otomatis) Penyimpanan output PDF
- `uploads/`: (Dibuat otomatis) Penyimpanan lampiran user
