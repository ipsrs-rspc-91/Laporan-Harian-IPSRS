# Tahap 2B–2C — Spesifikasi Scheduler Disiplin LHI v2

Status: **draft implementasi nonaktif**. Dokumen ini bukan migration, bukan SQL untuk dijalankan di produksi, dan bukan persetujuan deployment.

Tanggal: 3 November 2026  
Branch: `repair/lhi-status-separation-20261103`

## 1. Tujuan perbaikan

Scheduler lama terbukti tidak sesuai README karena menggunakan `reports.tanggal`, menghitung tanggal berjalan, mengubah `staff.status`, mengecualikan KA IPSRS, memicu global lock pada hari ke-9, dan membuat kewajiban snapshot per tanggal. Scheduler pengganti wajib memakai satu sumber hitung dan tidak boleh mengubah status kepegawaian.

## 2. Kontrak perhitungan tunggal

Untuk setiap petugas dengan `staff.status = 'Aktif'`:

1. Tentukan `anchor_at`:
   - LHI sah terakhir dalam periode aktif berjalan: `max(reports.created_at)` dengan `deleted_at IS NULL` dan `created_at >= lhi_active_since`.
   - Jika tidak ada, gunakan `staff.lhi_active_since`.
2. Konversi tanggal anchor dan tanggal sekarang ke WIB:
   - `anchor_wib_date = (anchor_at AT TIME ZONE 'Asia/Jakarta')::date`
   - `today_wib = (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date`
3. Hitung:
   - `missed_full_days = GREATEST(0, today_wib - anchor_wib_date - 1)`
4. Abaikan `reports.tanggal` untuk seluruh keputusan disiplin.
5. Beberapa laporan sah pada tanggal WIB yang sama tetap menghasilkan satu tanggal input aktif; pemilihan timestamp terakhir tidak menggandakan hari.
6. Laporan soft-delete tidak sah. Bila seluruh laporan pada tanggal terakhir dibatalkan, tanggal anchor bergeser ke tanggal LHI sah sebelumnya.
7. Semua petugas aktif diproses tanpa pengecualian role. Status akses `BLOCKED_LHI` tidak mengeluarkan petugas dari perhitungan hari ke-10.
8. Petugas NONAKTIF tidak dihitung. Ketika kembali Aktif, `lhi_active_since` harus di-reset oleh mekanisme perubahan status kepegawaian, bukan oleh scheduler atau trigger laporan.

## 3. Pemetaan tahap — nilai batas eksak

| Hari tanpa input penuh | `missed_full_days` | Aksi |
|---:|---:|---|
| 1–3 | 0–2 | MONITOR |
| 4 | 3 | WARNING_1 |
| 5 | 4 | MONITOR |
| 6 | 5 | WARNING_2 |
| 7 | 6 | WARNING_3 |
| 8 | 7 | BLOCK_INDIVIDUAL_ACCESS |
| 9 | 8 | WAITING; tidak mengaktifkan blokir global |
| 10 dan seterusnya | >=9 | GLOBAL_BLOCK |

Hari berjalan tidak dihitung. Tahapan tidak boleh dihitung dengan selisih jam atau `reports.tanggal`.

## 4. Kontrak notifikasi

### Hari 4, 6, dan 7
- Buat satu daftar nama petugas untuk setiap tahap dan tanggal WIB.
- Kirim pesan personal kepada petugas yang bersangkutan.
- Kirim ringkasan tim kepada semua petugas aktif; isi wajib mencantumkan semua nama pada tahap tersebut, tahap peringatan, jumlah hari, dan tindakan.
- Pesan hari ke-7 wajib menyatakan bahwa blokir hak akses individual terjadi pada hari ke-8 jika belum ada LHI sah.
- Kunci deduplikasi disarankan: `LHI:<WIB_DATE>:WARNING_1`, `...WARNING_2`, `...WARNING_3`. Gunakan unique key per event dan recipient.

### Hari 8
- Ubah hanya `staff.lhi_access_status = 'BLOCKED_LHI'`, `lhi_access_blocked_at`, dan `lhi_access_block_reason`.
- Jangan mengubah `staff.status`.
- Petugas yang diblokir mendapat alasan pada saat mencoba login.
- Petugas aktif lainnya mendapat notifikasi yang menyebut nama petugas yang diblokir.
- Kunci deduplikasi: `LHI:<WIB_DATE>:BLOCK_INDIVIDUAL:<staff_id>`.

### Hari 9
- Tidak ada aktivasi global, tidak ada perubahan status kepegawaian, dan tidak ada pembukaan blokir individual.
- Petugas tetap dihitung menuju hari ke-10.

### Hari 10
- Jika minimal satu petugas aktif mencapai `missed_full_days >= 9`, aktifkan global lock satu kali.
- Petugas yang sudah `BLOCKED_LHI` tetap menjadi pemicu.
- Semua role termasuk KA IPSRS ikut dipantau.
- Saat hari ke-10, scheduler hanya membuat incident berstatus LOCKED dan mengaktifkan global lock.
- Snapshot **belum dibuat oleh scheduler**. Sesuai README, snapshot dibuat atomik oleh transaksi Reset KA IPSRS ketika LOCKED berubah menjadi GRACE.
- Transaksi Reset mengambil petugas Aktif dengan `missed_full_days >= 9` pada saat Reset; satu baris per petugas per insiden.
- Jangan masukkan seluruh petugas atau satu baris per tanggal yang terlewat.
- Kunci deduplikasi event global: `LHI:GLOBAL_LOCK:<incident_id>`.

## 5. Pola query inti untuk evaluasi

SQL berikut hanya ilustrasi query pembacaan untuk implementasi setelah skema v2 tersedia. Jangan jalankan sebagai migration atau query produksi tanpa review:

```sql
WITH active_staff AS (
  SELECT staff_id, nama, role, status, lhi_active_since, lhi_access_status
  FROM public.staff
  WHERE status = 'Aktif'
),
anchors AS (
  SELECT
    s.*,
    COALESCE(last_valid.created_at, s.lhi_active_since) AS anchor_at
  FROM active_staff s
  LEFT JOIN LATERAL (
    SELECT max(r.created_at) AS created_at
    FROM public.reports r
    WHERE r.staff_id = s.staff_id
      AND r.deleted_at IS NULL
      AND r.created_at >= s.lhi_active_since
  ) last_valid ON TRUE
),
evaluated AS (
  SELECT
    a.*,
    (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date AS today_wib,
    (a.anchor_at AT TIME ZONE 'Asia/Jakarta')::date AS anchor_wib,
    GREATEST(
      0,
      (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date
        - (a.anchor_at AT TIME ZONE 'Asia/Jakarta')::date - 1
    )::integer AS missed_full_days
  FROM anchors a
)
SELECT *,
  CASE
    WHEN missed_full_days >= 9 THEN 'GLOBAL_BLOCK'
    WHEN missed_full_days = 8 THEN 'WAITING'
    WHEN missed_full_days = 7 THEN 'BLOCK_INDIVIDUAL_ACCESS'
    WHEN missed_full_days = 6 THEN 'WARNING_3'
    WHEN missed_full_days = 5 THEN 'WARNING_2'
    WHEN missed_full_days = 3 THEN 'WARNING_1'
    ELSE 'MONITOR'
  END AS action
FROM evaluated;
```

**Catatan:** dalam fungsi final, simpan `clock_timestamp()` sekali ke variabel `v_now`, lalu turunkan `today_wib` dari timestamp yang sama. Ini mencegah satu eksekusi melintasi tengah malam WIB di antara beberapa statement. Query final juga harus menangani `lhi_active_since IS NULL` sebagai data tidak valid dan mencatat error; jangan diam-diam memakai tanggal buatan.

## 6. Transaksi dan idempotensi scheduler

Implementasi final wajib:
- Mengambil transaction-level advisory lock khusus scheduler agar dua eksekusi cron tidak berjalan bersamaan.
- Mengunci baris global setting/incident yang relevan dengan `FOR UPDATE`.
- Mengambil timestamp dan tanggal WIB satu kali per eksekusi.
- Memproses peringatan dan blokir dengan `INSERT ... ON CONFLICT DO NOTHING` memakai unique key event/recipient.
- Mengaktifkan global lock hanya jika belum ada incident LOCKED/GRACE yang aktif.
- Transaksi Reset membuat snapshot satu baris per petugas menggunakan constraint UNIQUE(`incident_id, staff_id`); scheduler hanya membuat incident LOCKED.
- Tidak membuat atau mengubah status employment.
- Tidak menyelesaikan grace sebelum tenggat 12 jam; evaluator tenggat hanya menilai kewajiban snapshot yang masih PENDING dan pegawainya tetap Aktif.
- Menjaga cron tetap setiap 5 menit; perbaiki fungsi, bukan mempercepat frekuensi cron.

## 7. Hal yang tidak boleh dilakukan

- Jangan deploy Edge Function sebelum kolom `lhi_access_status` dan `lhi_active_since` tersedia.
- Jangan menjalankan fungsi scheduler produksi untuk menguji hasil.
- Jangan mengeksekusi DDL/DML di database produksi selama tahap perancangan.
- Jangan menghapus data legacy atau mengubah `staff.status` secara massal sebelum rekonsiliasi.
- Jangan mengaktifkan scheduler baru sebelum migration, trigger, pemulihan Reset, dan uji nonproduksi selesai.

## 8. Pengujian penerimaan

Minimal harus ada test untuk:
- timestamp UTC yang berubah tanggal setelah konversi WIB;
- tanggal input berbeda dari `reports.tanggal`;
- beberapa LHI pada satu tanggal WIB;
- semua LHI tanggal terakhir dibatalkan sehingga anchor mundur;
- aktivasi ulang setelah periode NONAKTIF;
- status akses BLOCKED tetap dihitung untuk hari ke-10;
- KA IPSRS termasuk dalam daftar evaluasi;
- NONAKTIF tidak dievaluasi;
- batas 3/5/6/7/8/9 missed days;
- warning tim memuat semua nama per tahap;
- pengulangan scheduler tidak menggandakan notifikasi atau snapshot;
- dua pemanggilan scheduler bersamaan hanya menghasilkan satu incident.

## 9. Status pekerjaan

- Helper hitung murni dan evaluasi petugas sudah tersedia di `supabase/functions/ipsrs-api/lhi-discipline.mjs`.
- Test helper dan evaluasi ditambahkan di `tests/lhi-discipline.test.mjs`.
- GitHub Actions run `41530914302` pada commit `aad08f65e734da15563f33ab12e31d9e48a8e15c` berstatus **completed / success**; step `node --test tests/lhi-discipline.test.mjs` berhasil.
- Satu test awal gagal karena timestamp laporan uji ternyata masih sebelum tenggat. Timestamp dikoreksi menjadi setelah tenggat dan workflow berikutnya lulus.
- Scheduler produksi belum diubah dan belum di-deploy.
- Spesifikasi ini belum menjadi SQL migration atau fungsi aktif.


## 10. Helper implementasi dan evaluasi grace

Helper murni di `supabase/functions/ipsrs-api/lhi-discipline.mjs` kini juga menyediakan:

- `evaluateDiscipline(staffRows, reportsByStaff, todayWib)`: satu evaluasi untuk semua petugas Aktif tanpa pengecualian role dan tanpa mengeluarkan status akses BLOCKED_LHI dari pemantauan.
- `buildWarningNotifications(evaluations, activeStaff, todayWib)`: satu broadcast tim per tahap/tanggal yang menyebut seluruh nama petugas lalai, serta daftar penerima dengan event key per penerima.
- `buildGraceSnapshot(evaluations, snapshotAt)`: hanya petugas Aktif yang menjadi pemicu GLOBAL_BLOCK, satu baris per staff_id.
- `evaluateGraceSnapshot(snapshotMembers, staffById, reportsByStaff, startedAt, deadlineAt)`: hanya laporan sah non-deleted dalam rentang [mulai, tenggat) yang memenuhi kewajiban; petugas NONAKTIF dikecualikan; status EXCLUDED_INACTIVE bersifat terminal.

Helper tersebut merupakan aturan referensi dan test fixture. Ia belum menggantikan scheduler PostgreSQL, belum menulis notifikasi ke database, belum mengelola transaksi, dan belum boleh dianggap sebagai implementasi produksi.

## 11. Pengujian otomatis

Workflow GitHub Actions `.github/workflows/lhi-discipline-tests.yml` telah ditambahkan. Workflow menjalankan:

```sh
node --test tests/lhi-discipline.test.mjs
```

Jangan menyatakan pengujian lulus hanya karena workflow terpicu. Periksa status run dan kesimpulan job; jika masih `in_progress`, hasil belum final. Semua perubahan berikutnya pada helper dan test harus memicu ulang workflow.


## 11. Verifikasi ulang terhadap definisi scheduler produksi (read-only)

Pada 3 November 2026 definisi public.run_lhi_discipline_scheduler() dan public.open_lhi_global_grace(p_staff_id, p_staff_name) dibaca menggunakan pg_get_functiondef. Tidak ada fungsi yang dijalankan dan tidak ada perubahan database.

Temuan yang dikonfirmasi langsung dari definisi fungsi:

1. Scheduler menghitung dengan reports.tanggal, bukan reports.created_at WIB.
2. Scheduler memulai loop dari tanggal hari ini dan menghitung tanggal kosong termasuk tanggal berjalan; terdapat dua blok penghitungan yang redundan.
3. Pada nilai hitung 8, scheduler mengubah staff.status menjadi Nonaktif_LHI_HARI_8.
4. Pada nilai hitung >=9, scheduler mengaktifkan global lock, sehingga global lock terjadi satu hari lebih awal dari ketentuan README.
5. Loop mengecualikan role = KA_IPSRS.
6. Snapshot dibuat dengan generate_series per tanggal dan dapat menghasilkan banyak kewajiban untuk satu petugas; scheduler juga menambah kewajiban tanggal berjalan ke incident LOCKED.
7. Grace menghitung laporan berdasarkan created_at, tetapi tidak mensyaratkan status kepegawaian petugas masih Aktif.
8. Evaluasi grace dijalankan dua kali dalam satu fungsi; satu jalur dapat menyelesaikan grace sebelum tenggat karena hanya menguji v_pending=0.
9. Fungsi open_lhi_global_grace mengubah staff.status legacy menjadi Aktif dan memulai ulang started_at/deadline_at pada incident LOCKED. Fungsi lama belum memverifikasi identitas/role KA di dalam database.
10. Trigger laporan lama yang sudah teridentifikasi masih dapat mengubah staff.status menjadi Aktif saat laporan disimpan. Trigger itu harus diganti dalam migration yang sama dengan skema status terpisah.

Temuan ini memperkuat keputusan bahwa scheduler lama tidak boleh dijalankan untuk pengujian dan tidak boleh di-deploy ulang sebagai solusi sementara.

## 12. Perbaikan helper tambahan pada tahap ini

- Ditambahkan buildIndividualBlockNotifications() untuk notifikasi hari ke-8.
- Pesan hari ke-8 menyebut seluruh nama petugas yang hak aksesnya diblokir pada tanggal WIB yang sama.
- Penerima hanya petugas Aktif lain yang aksesnya tidak diblokir. Petugas yang diblokir tidak dikirimi notifikasi dalam aplikasi karena mereka menerima alasan blokir saat mencoba login.
- Ditambahkan test batas waktu grace: laporan tepat pada started_at diterima, laporan tepat pada deadline_at ditolak.
- Ditambahkan test pembatalan laporan grace: jika satu-satunya laporan pemenuh dibatalkan, kewajiban kembali PENDING; jika masih ada laporan sah pengganti di dalam jendela grace, kewajiban tetap COMPLETED.
- Test CI untuk perubahan terbaru menunggu workflow push selesai. Status sukses run sebelumnya tidak boleh dianggap sebagai hasil untuk commit terbaru ini.

## 13. Status keselamatan

- Perubahan hanya berada di branch perbaikan.
- Tidak ada DDL/DML produksi, tidak ada pemanggilan scheduler produksi, tidak ada deploy Edge Function, dan tidak ada perubahan cron.
- Kolom skema v2 belum tersedia di produksi. Karena itu patch API yang membaca lhi_access_status juga belum aman untuk deployment.


## 14. Klarifikasi urutan snapshot berdasarkan README

Implementasi draft terbaru memisahkan dua waktu:
- **Saat hari ke-10:** scheduler mengaktifkan LHI_GLOBAL_BLOCK dan membuat incident LOCKED. Tidak ada snapshot kewajiban dan belum dimulai masa grace.
- **Saat KA IPSRS menekan Reset:** RPC atomik membuat snapshot petugas Aktif yang masih mencapai ambang 10 hari, membuka blokir akses LHI individual, mengubah incident menjadi GRACE, menonaktifkan global lock, dan memulai tenggat tepat 12 jam.

Pemisahan ini mencegah masa grace berjalan sebelum Reset dilakukan dan memastikan snapshot, pembukaan akses, serta perubahan incident berhasil atau batal sebagai satu transaksi.
