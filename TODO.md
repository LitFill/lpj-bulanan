# TODO List - Pengembangan Sistem LPJ Digital

Daftar perbaikan dan pengembangan untuk meningkatkan keamanan, integritas data,
dan struktur kode.

## 🔴 PRIORITAS TINGGI (Keamanan & Bug Kritis)

- [x] **Integritas Rincian Keuangan**: Ubah skema database untuk menyimpan
      rincian item pemasukan/pengeluaran dalam format JSON.
  - Saat ini hanya total yang disimpan, menyebabkan data rincian hilang saat
    proses _Edit_.
  - Simpan `pemasukan_ket`, `pemasukan_val`, dll ke kolom baru (misal:
    `financial_details` tipe TEXT/JSON).
- [x] **Validasi Aset PDF**: Tambahkan pengecekan `existsSync()` untuk file
      `ttd.png` dan `stempel.jpg` di fungsi generator PDF.
  - Mencegah server _crash_ jika file gambar tidak sengaja terhapus.

- [x] **Perubahan Sistem PDF**: Gunakan compiler 'typst compile' untuk membuat
      dokumen PDF alih-alih menggunakan library langsung. Gunakan file template.typ
      yang sudah dijadikan template beneran untuk generate dokumen PDF.

- [x] **Error Handling Bulan Laporan**: ada kesalahan di handling yang
      mengakibatkan form di frontend bisa diisi data arbritary, tapi ketika diisi
      semisal "Januari 2026" atau "2026 Januari" server mengirim error bahwa bulan
      laporan tidak boleh berada di masa depan, padahal harusnya tidak.

## 🟡 PRIORITAS MENENGAH (Refactoring & Struktur)

- [x] **Ekstraksi PDF Service**: Pindahkan logika `generatePDF` dari
      `server.js` ke folder khusus (misal: `services/pdfService.js`).
  - Menjaga agar `server.js` tetap ringkas dan hanya fokus pada _routing_.
- [x] **Manajemen Environment Variable**: Gunakan library `dotenv` untuk
      menyimpan `SESSION_SECRET` dan `PORT`.
  - Buat file `.env` dan tambahkan ke `.gitignore`.
- [x] **Peningkatan Logika Update**: Pastikan penghapusan file lama
      (PDF/Lampiran) hanya terjadi jika proses regenerasi file baru berhasil
      sepenuhnya.

- [x] **Masalah Layout PDF**: Ada masalah dalam penataan layout dokumen PDF
      dimana ada bagian yang terlalu ke kanan.

## 🟢 PRIORITAS RENDAH (Optimasi & UX)

- [x] **Migrasi Async/Await**: Pertimbangkan menggunakan library `sqlite`
      (wrapper) daripada `sqlite3` mentah untuk menghindari _callback hell_ dan
      membuat kode lebih modern.
- [x] **UI Dynamic Rows pada Edit**: Perbaiki tampilan `edit.ejs` agar bisa
      menampilkan kembali rincian baris keuangan yang sebelumnya diinput (setelah
      poin integritas data diperbaiki).
- [x] **Validasi Sisi Klien**: Tambahkan konfirmasi ulang (sweetalert atau
      native) sebelum pengguna menekan tombol "Kirim" atau "Hapus".

## 🛠 Maintenance

- [x] Tambahkan folder `reports/` dan `uploads/` ke `.gitignore` agar file
      dummy tidak masuk ke repositori.
- [x] Dokumentasikan struktur JSON rincian keuangan di `README.md`.
