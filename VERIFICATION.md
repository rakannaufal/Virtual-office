# Verifikasi RN GROUP

Tanggal: 9 Oktober 2026. Proyek: `/Users/rakan/Documents/office`.

## Pemeriksaan otomatis

- TypeScript / vue-tsc: lulus.
- Vitest: 17 pengujian lulus; workflow, validasi data, tanggal/zona waktu, ZIP, navigasi, reservasi rutinitas, ringkasan role, migrasi layout lama.
- Build produksi Vite: lulus. Output tersedia di `dist`.
- Build produksi dibuka melalui preview terpisah: kantor dan fullscreen tampil; tidak ada error/warning console saat verifikasi.
- Prettier: seluruh source, tests, dan konfigurasi Vite lulus pemeriksaan format.
- Migrasi tidak memindahkan meja atau mengganti ID role/pesanan; dijalankan satu kali untuk data lokal, impor ZIP, dan snapshot cloud lama.

## Pemeriksaan aplikasi

- Enam chibi terlihat, duduk menghadap depan, rambut/wajah terbaca; warna dan preset mengikuti profil role.
- Interior kayu terang, lantai krem, bingkai kaca hitam, laptop; ruang CEO terpisah dengan meja/laci, sofa tamu, panel kayu, dan rak buku.
- Fullscreen browser: masuk/keluar, zoom, komputer Editor tetap tampil di dalam elemen fullscreen.
- Fullscreen cadangan: diuji dengan kebijakan iframe yang menolak Fullscreen API, ukuran 390 x 844. Seluruh lantai muat; dialog tetap di dalam kantor. Escape menutup dialog dahulu, lalu keluar fullscreen.
- Enam kartu di bawah kantor: tiga kolom desktop; satu kolom pada lebar 390 px. Lebar dokumen 390 px, tanpa gulir horizontal.
- Komputer CEO dapat dibuka melalui kartu. Antrean tindakan dihitung dari fase pesanan; pesanan selesai/arsip tidak ikut antrean QC/CEO.
- Impor ZIP nyata dan pemulihan dijalankan melalui store aplikasi pada origin QA terpisah (`127.0.0.1:5174`). Enam role, lima pesanan, dua CSV masing-masing 44 byte, isi byte utuh; pemulihan mengembalikan seluruh metadata semula. Halaman QA sementara sudah dihapus.
- Pada sesi sebelumnya: keenam komputer, unggah sumber/hasil, checklist, QC/CEO, penyelesaian pesanan fiktif, edit nama/reload, dan ekspor ZIP browser diuji.

## Cloud dan batas verifikasi

- Migrasi Supabase sudah diterapkan pada project `kviucybtwdinsdbbqvnc`. Uji SQL RLS/owner isolation/RPC konflik dan bucket privat telah lulus pada sesi sebelumnya; transaksi uji di-rollback.
- Login dan sinkronisasi memakai akun pemilik nyata belum diuji. Aplikasi siap dipakai dalam mode lokal; cloud membutuhkan login/konfirmasi akun.
- Pemilih file native untuk impor belum diverifikasi: API pemilih browser timeout, akses aplikasi Codex ditolak peninjauan otomatis karena berpotensi membuka isi chat pribadi. Pengujian impor/pemulihan inti digantikan halaman QA lokal terisolasi.
- Tampilan HP diuji melalui iframe 390 px, bukan perangkat fisik. Kinerja pada HP kelas rendah dan browser lain masih perlu diuji pada perangkat sasaran.
- Avatar menunjukkan pembagian tugas/rutinitas. Animasi tidak memproses file atau menyelesaikan pesanan otomatis.

Screenshot: `screenshots/rn-office-chibi-fullscreen.png`, `screenshots/rn-office-overview.png`, `screenshots/rn-office-mobile-fullscreen.png`.
