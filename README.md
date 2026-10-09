# RN GROUP / Kantor Virtual

Kantor pribadi dengan Vue 3, TypeScript, Pinia, Three.js, dan Supabase. Primary abu-abu, aksen teal, interior kayu terang. Enam role dikelola pemilik yang sama. Karakter manusia 3D bergaya chibi sesuai referensi: kepala besar, wajah sederhana, rambut dan pakaian kantor. Interior memakai tekstur oak, lantai krem, bingkai kaca hitam, dan laptop gelap.

## Jalankan

```sh
cd /Users/rakan/Documents/office
npm install
npm run dev
```

Buka http://127.0.0.1:5173. Node 20.19+ / 22+ disarankan. Dependensi dan aset sudah disertakan pada paket lokal ini. Bila npm mengeluhkan izin cache, gunakan `npm install --cache .npm-cache`; jangan mengubah izin seluruh home directory.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Build produksi berada di `dist`. Hosting gratis dapat menyajikan folder tersebut. Hosting/deployment tidak dijalankan otomatis.

## Cara menggunakan

1. Buka Kantor: drag untuk geser kamera, scroll zoom, klik kanan untuk rotasi. Tombol kamera menyediakan zoom/rotasi/reset. Layar penuh memperbesar kantor dengan kendali CEO tetap tersedia; Keluar layar penuh atau Escape untuk kembali. Browser tanpa Fullscreen API memakai tampilan penuh di dalam halaman. Dialog komputer dan notifikasi tetap terlihat.
2. Klik lantai kosong untuk menggerakkan CEO. WASD/tombol panah juga tersedia. Klik komputer, avatar, label, atau daftar role untuk desktop virtual.
3. Kartu setiap role di bawah kantor memuat nama/jabatan, tanggung jawab, kesiapan, metrik sesuai fungsi, prioritas berikutnya, checklist, tenggat terdekat, jumlah terlambat, catatan terakhir beserta waktu/zona waktu, dan rutinitas avatar. Kesiapan dihitung dari tahapan pesanan; QC mendahului CEO, pesanan selesai/arsip tidak masuk antrean tindakan. Catatan terkait tidak menyatakan bahwa avatar mengerjakan pesanan. Klik Buka komputer untuk rincian. Komputer berisi tugas, file, hasil, dan aktivitas role. Komputer CEO memuat pemasukan dan antrean persetujuan; Marketing membuka calon pelanggan/draf.
4. Buat pesanan dengan layanan, pelanggan, lingkup, tenggat, harga, dan penanggung jawab. Mulai Dikerjakan, unggah bahan/hasil, tandai checklist. Untuk perubahan, tambahkan revisi.
5. Masuk Pemeriksaan, selesaikan revisi, unggah file hasil, setujui sebagai QC lalu CEO. Pesanan hanya dapat selesai jika syarat terpenuhi. Harga dan pembayaran dicatat manual; tidak ada payment gateway.
6. Tim & role: ubah nama, jabatan, tanggung jawab, preset pakaian/rambut chibi, warna pakaian/kulit/rambut. ID role tetap; pesanan tidak terputus. CEO selalu aktif. Role yang masih memegang pesanan aktif tidak dapat dinonaktifkan.
7. Pengaturan: identitas, kontak, tema, warna, nama ruangan, kualitas 3D, rutinitas, jam kerja/zona waktu, layanan/harga/checklist/tahapan, notifikasi, cadangan.
8. Atur dekorasi: pilih tanaman, klik lantai untuk pindah dengan snap 0,5 meter, simpan atau batal. Sistem memeriksa tabrakan, akses meja, pintu CEO, dan sudut kopi. Meja/partisi tetap untuk menjaga navigasi.
9. Pemasaran: kelola calon pelanggan dan draf, salin teks untuk dibagikan sendiri. Contoh portofolio fiktif disediakan. Tidak mengirim pesan otomatis.

Rutinitas: karakter yang tidak memiliki tugas siap dapat ngopi, duduk, membaca, atau menyapa. Tempat dipesan satu karakter setiap saat. Tugas baru yang siap mengembalikan karakter ke meja. Jam istirahat/hari kerja mengikuti zona waktu. Animasi tidak mengubah progres. CEO manual secara default; tombol ke meja/ngopi/santai tersedia. Pengaturan reduced motion dan preferensi OS dihormati. HP memiliki daftar role tanpa perlu mengendalikan 3D.

## Data lokal

Metadata disimpan di localStorage, file di IndexedDB pada browser/origin ini. `localhost` dan `127.0.0.1` adalah penyimpanan berbeda; gunakan URL yang konsisten. Mode lokal berfungsi tanpa login. Data contoh fiktif diberi label; hapus contoh melalui Pengaturan > Data untuk mulai operasional. File lokal tidak berada di folder source.

Pengaturan > Data > Siapkan ZIP, lalu klik Unduh ZIP siap. ZIP memuat `workspace.json` dan seluruh file. Maksimal 128 MB total file per ekspor, 20 MB per file, 150 MB berkas ZIP yang diimpor. Impor memvalidasi format/referensi; salinan lengkap data sebelumnya disimpan di IndexedDB dan unduhan juga dipicu. Tombol Pulihkan sebelumnya memungkinkan pembatalan impor/pergantian snapshot meskipun unduhan browser diblokir. Jika file tidak tersedia, ekspor gagal secara eksplisit. Jangan membersihkan data browser sebelum menyimpan ZIP. Simpan ZIP di tempat privat.

## Supabase

Konfigurasi project pengguna sudah ada di `.env.local`:

- Project: `kviucybtwdinsdbbqvnc`
- Frontend memakai **publishable key**, tidak memerlukan secret/service_role key.
- `.env.local` diabaikan Git; `.env.example` tersedia.

Migrasi sudah diterapkan dan diuji pada project `office` (`kviucybtwdinsdbbqvnc`) tanggal 9 Oktober 2026. Akun pemilik masih diperlukan untuk sinkronisasi aplikasi. Untuk pemasangan ulang pada project lain, ikuti langkah berikut.

1. Buka project yang benar di dashboard Supabase, SQL Editor.
2. Jalankan `supabase/migrations/202610090001_rn_office.sql`.
3. Pastikan table `rn_workspaces` memiliki RLS aktif; bucket `rn-files` privat, limit 20 MB.
4. Authentication > URL Configuration: set Site URL sesuai URL aplikasi dan Redirect URLs untuk konfirmasi signup. Aktifkan email/password. Daftar/login melalui tombol cloud aplikasi; jika konfirmasi email aktif, konfirmasi dahulu. Pengiriman email hanya terjadi setelah pengguna memilih Daftar.
5. Pilih data cloud atau unggah data lokal bila berbeda. Membuka cloud mengunduh cadangan lokal dahulu. Sinkronisasi **manual** melalui tombol Sinkronkan sekarang; indikator membedakan lokal tersimpan dan cloud belum sinkron.
6. Perubahan dari perangkat lain ditolak dengan `RN_CONFLICT`; buka snapshot cloud atau periksa perubahan sebelum mencoba mengganti. Kegagalan cloud tidak dilaporkan sebagai berhasil.

Satu akun memiliki satu workspace privat. Role merupakan pembagian tugas, bukan akun login/karyawan terpisah. RLS membatasi pemilik antar akun. Storage memakai path `userId/orderId/fileId`. Unduhan memakai sesi terautentikasi; tidak ada public URL. Tambahan multi-user dan hak akses tiap karyawan membutuhkan desain akses lanjutan.

File yang telah diunggah/dibuka juga tersedia di cache lokal. File cloud yang belum pernah diunduh membutuhkan login dan koneksi. Keluar dari akun tidak menghapus metadata/cache browser. Aplikasi ini ditujukan untuk perangkat pemilik; gunakan profil browser pribadi.

Supabase Free memiliki kuota dan dapat pause; biaya awal tambahan Rp0 mengasumsikan perangkat/internet tersedia. Tidak ada API AI berbayar. Aplikasi membantu organisasi pekerjaan; pengerjaan CV/data/Word tetap dilakukan pemilik menggunakan alat pilihan. Paket ini tidak mengendalikan komputer fisik, video call, atau agen AI otomatis.

## Struktur

- `src/components`: UI kantor, komputer, pesanan, tim, pemasaran, pengaturan.
- `src/scene`: interior Three.js, chibi beranimasi buatan sendiri, tekstur canvas, pathfinding, reservasi/rutinitas.
- `src/lib`: tipe, data contoh, validasi/workflow, store, file/cadangan, Supabase.
- `public/models`: enam aset manusia CC0 lama disimpan sebagai referensi; tampilan aktif memakai chibi procedural tanpa mengunduh GLB.
- `supabase/migrations`: schema, RPC revisi, RLS, Storage privat.
- `tests`: pengujian workflow, validasi, navigasi, dan rutinitas.
- `PLAN.md`: rencana lengkap yang menjadi acuan; fitur lanjutan tidak dijanjikan berjalan otomatis.
- `LICENSE-ASSETS.md`: sumber dan lisensi aset.

Tidak ada file pelanggan dalam source. Seluruh teks pengguna ditampilkan melalui escaping Vue. Unggahan dibatasi format/20 MB; preview dibatasi PDF/gambar. Tidak ada `v-html` untuk isi pengguna. Tidak menerapkan pembayaran, promosi eksternal, atau deployment otomatis.

Tata letak lama diperbarui otomatis melalui `layoutVersion: 2`: posisi meja tetap, kursi dipindahkan ke sisi belakang agar wajah terlihat. ID role dan kaitan pesanan tetap stabil; migrasi juga berlaku untuk ZIP dan snapshot cloud lama. Pengujian dan batas verifikasi tercatat di `VERIFICATION.md`.
