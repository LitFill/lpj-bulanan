# TODO List - Pengembangan Sistem LPJ Digital

Daftar perbaikan dan pengembangan untuk meningkatkan keamanan, integritas data,
dan struktur kode.

## 🔴 PRIORITAS TINGGI (Keamanan & Bug Kritis)

- [ ] **Integritas Rincian Keuangan**: Ubah skema database untuk menyimpan
      rincian item pemasukan/pengeluaran dalam format JSON.
  - Saat ini hanya total yang disimpan, menyebabkan data rincian hilang saat
    proses _Edit_.
  - Simpan `pemasukan_ket`, `pemasukan_val`, dll ke kolom baru (misal:
    `financial_details` tipe TEXT/JSON).
- [ ] **Validasi Aset PDF**: Tambahkan pengecekan `existsSync()` untuk file
      `ttd.png` dan `stempel.jpg` di fungsi generator PDF.
  - Mencegah server _crash_ jika file gambar tidak sengaja terhapus.

## 🟡 PRIORITAS MENENGAH (Refactoring & Struktur)

- [ ] **Ekstraksi PDF Service**: Pindahkan logika `generatePDF` dari
      `server.js` ke folder khusus (misal: `services/pdfService.js`).
  - Menjaga agar `server.js` tetap ringkas dan hanya fokus pada _routing_.
- [ ] **Manajemen Environment Variable**: Gunakan library `dotenv` untuk
      menyimpan `SESSION_SECRET` dan `PORT`.
  - Buat file `.env` dan tambahkan ke `.gitignore`.
- [ ] **Peningkatan Logika Update**: Pastikan penghapusan file lama
      (PDF/Lampiran) hanya terjadi jika proses regenerasi file baru berhasil
      sepenuhnya.

## 🟢 PRIORITAS RENDAH (Optimasi & UX)

- [ ] **Migrasi Async/Await**: Pertimbangkan menggunakan library `sqlite`
      (wrapper) daripada `sqlite3` mentah untuk menghindari _callback hell_ dan
      membuat kode lebih modern.
- [ ] **UI Dynamic Rows pada Edit**: Perbaiki tampilan `edit.ejs` agar bisa
      menampilkan kembali rincian baris keuangan yang sebelumnya diinput (setelah
      poin integritas data diperbaiki).
- [ ] **Validasi Sisi Klien**: Tambahkan konfirmasi ulang (sweetalert atau
      native) sebelum pengguna menekan tombol "Kirim" atau "Hapus".

## 🛠 Maintenance

- [ ] Tambahkan folder `reports/` dan `uploads/` ke `.gitignore` agar file
      dummy tidak masuk ke repositori.
- [ ] Dokumentasikan struktur JSON rincian keuangan di `README.md`.
