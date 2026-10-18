# Konsep Penguncian Data Master Kategori IPSRS

Status: rancangan kontrol; tidak mengubah data produksi atau database.

## 1. Arti “12 kategori dikunci”
- Dua belas nilai kategori yang disetujui adalah **master data baku**. Pengguna operasional tidak boleh menambah, menghapus, mengganti nama, atau menukar nilai kategori melalui UI.
- Pengguna tetap boleh memilih kategori baku ketika membuat laporan.
- Perubahan daftar kategori hanya melalui perubahan master-data yang disetujui oleh penanggung jawab, disertai rekonsiliasi data lama dan pengujian kompatibilitas.

## 2. Kode tetap boleh diperbaiki
- Penguncian master data **bukan** larangan mengubah JavaScript/HTML/API.
- Perubahan kode boleh dilakukan pada branch kerja setelah checkpoint/backup, dengan scope terbatas, audit diff, uji statis, dan regression test.
- File bersama tidak otomatis berarti semua perilaku di dalamnya tidak boleh disentuh. Yang dilindungi adalah perilaku kritis; perubahan harus membuktikan bahwa perilaku tersebut tetap lulus tes.
- Modul yang telah diverifikasi tetap memblokir merge/deploy jika regression test perilakunya gagal.

## 3. Lapisan pengamanan yang diinginkan
1. **UI:** tidak menampilkan aksi tambah/edit/hapus untuk master kategori kepada pengguna biasa; pilihan hanya dari daftar baku.
2. **API/database:** jangan mempercayai UI saja. Jika endpoint master kategori dapat menulis data, validasi role dan allowlist 12 nilai di server; jika master hanya statis, jangan sediakan jalur tulis umum.
3. **Audit:** setiap perubahan master oleh admin berwenang dicatat; perubahan tanpa otorisasi ditolak.
4. **Regression:** tes jumlah dan identitas 12 kategori, urutan/label yang disetujui, pemilihan kategori saat input, penyimpanan laporan, filter laporan, serta kompatibilitas data lama.
5. **Perubahan kode:** backup/checkpoint -> branch -> perubahan minimal -> static audit -> browser regression -> review diff -> persetujuan merge/deploy -> verifikasi produksi.

## 4. Aturan tombol Cari dan Refresh
- **Cari:** kata yang diketik tidak langsung mengubah hasil. Hanya tombol Cari atau Enter yang menerapkan kata kunci.
- Ruang lingkup kata kunci: Ruang, Masalah/Kegiatan, Tindakan, dan Keterangan saja; bukan ID laporan, tanggal, petugas, kategori, atau bidang.
- **Refresh:** mempertahankan teks kata kunci, mengosongkan filter tambahan (status/kategori/area/bidang/petugas), mengembalikan bulan akhir ke bulan berjalan dan periode ke 3 bulan, lalu meminta data terbaru dari backend tanpa memakai cache hasil lama.
- Kedua aksi memiliki status loading yang terlihat, mencegah klik ganda selama proses, mengembalikan label/tampilan tombol aslinya, dan menampilkan pesan jika gagal.
- Refresh bukan tombol deploy dan tidak mengubah atau menghapus data.

## 5. Batas pelaksanaan
Dokumen ini menetapkan konsep. Penguncian server-side master kategori baru boleh dinyatakan aktif setelah endpoint/database yang benar sudah diaudit dan dites. Tidak ada perubahan database atau produksi sebagai bagian dari rancangan ini.
