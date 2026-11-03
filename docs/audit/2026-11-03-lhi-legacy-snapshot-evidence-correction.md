# Audit koreksi snapshot legacy LHI — 3 November 2026

## Temuan

Pencocokan implementasi PR #71 dengan README-FORM-BLOK-APLIKASI.md Bagian 8 menemukan bahwa jalur Reset untuk insiden LOCKED legacy mengisi:

- `anchor_input_at = NULL`
- `missed_full_days_at_snapshot = count(DISTINCT lhi_discipline_obligations.required_date)`

Jumlah tanggal kewajiban lama bukan definisi jumlah hari kalender penuh tanpa input. Nilai tersebut tidak boleh dipresentasikan sebagai hasil hitung kepatuhan.

## Koreksi pada branch

- Snapshot legacy sekarang tetap mengambil identitas petugas dari kewajiban legacy yang masih pending.
- `anchor_input_at` diisi dari `max(reports.created_at)` untuk laporan yang tidak dibatalkan (`deleted_at IS NULL`) dan tersimpan sampai waktu snapshot.
- `missed_full_days_at_snapshot` dihitung dari selisih tanggal WIB snapshot dan tanggal WIB input sah terakhir, dikurangi satu hari penuh sesuai README.
- Jika petugas tidak memiliki LHI sah historis, kedua nilai bukti tersebut dibiarkan `NULL`; sistem tidak membuat tanggal fiktif dan tidak menggunakan `staff.created_at` sebagai tanggal aktivasi HR.
- Sumber snapshot dicatat secara eksplisit sebagai `LEGACY_OBLIGATION_SNAPSHOT`, terpisah dari snapshot insiden format baru.
- Kolom missed-day snapshot dibuat nullable agar kondisi bukti historis yang tidak tersedia dinyatakan jujur, bukan diisi angka pengganti.
- Draft SQL dan migration CLI tetap byte-identical.

## Pengujian

- PostgreSQL integration ditambah skenario satu petugas dengan LHI sah historis dan satu petugas tanpa LHI sah historis.
- Test memeriksa timestamp input terakhir, hitungan hari kalender penuh berdasarkan WIB, dan NULL untuk data yang tidak dapat dibuktikan.
- Static test memastikan hitungan tidak lagi memakai `count(DISTINCT required_date)`.

## Batas perubahan

Perubahan ini hanya pada branch `repair/lhi-status-separation-20261103`. Tidak ada migration, update data, reset, perubahan cron, atau deployment ke Supabase produksi. Pengujian CI untuk commit koreksi masih berjalan dan statusnya harus diverifikasi sebelum dinyatakan lulus.

## Koreksi lanjutan audit peristiwa dan notifikasi

Pemeriksaan Bagian 10 README menemukan bahwa riwayat snapshot perlu mencatat status lama dan baru secara tepat, identitas proses sistem, referensi LHI, serta evaluasi tenggat 12 jam. Scheduler v2 diperbaiki agar:

- Perubahan ke `EXCLUDED_INACTIVE` menyimpan status lama yang sebenarnya (`PENDING` atau `COMPLETED`), status baru, aktor `SYSTEM`, dan alasan pengecualian.
- Peristiwa `REPORT_QUALIFIED`, `REPORT_CANCELLED`, dan `OBLIGATION_REOPENED` menyimpan aktor `SYSTEM`, ID laporan baru atau ID laporan sebelumnya, dan konteks proses scheduler.
- Saat tenggat 12 jam selesai dengan sukses, satu peristiwa `GRACE_COMPLETED` ditambahkan per anggota snapshot yang berstatus `COMPLETED` atau `EXCLUDED_INACTIVE`.
- Peristiwa `GLOBAL_RELOCKED` menyimpan status kewajiban yang tepat, aktor `SYSTEM`, dan tenggat yang dievaluasi.

Pemeriksaan frontend menemukan komponen notifikasi memanggil `window.authRun`, tetapi fungsi tersebut belum diekspos; komponen juga memanggil dua action backend yang belum ada. Koreksi pada branch:

- Mengekspos wrapper `window.authRun` yang tetap memakai token sesi Supabase dan pemeriksaan server.
- Menambahkan action `apiGetLhiNotifications` yang hanya mengambil notifikasi milik `staff_id` dari sesi yang sudah diverifikasi.
- Menambahkan action `apiMarkLhiNotificationRead` yang hanya dapat menandai notifikasi milik penerima yang sedang login dan hanya jika belum dibaca.
- Menambahkan pemanggilan loader notifikasi segera setelah login berhasil; polling berkala tetap digunakan saat aplikasi terbuka.

Seluruh perubahan masih di branch. Belum ada deployment ke produksi. Hasil CI terbaru harus diperiksa setelah workflow selesai.
