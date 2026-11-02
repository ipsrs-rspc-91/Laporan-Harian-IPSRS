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
- Buat snapshot hanya untuk petugas aktif yang pada saat itu memiliki `missed_full_days >= 9`; satu baris per petugas per insiden.
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
- Menyimpan snapshot satu baris per petugas menggunakan constraint UNIQUE(`incident_id, staff_id`).
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
- Test lokal sebelumnya: 6/6 lulus. Test tambahan yang baru ditambahkan belum dijalankan ulang pada environment project.
- Scheduler produksi belum diubah dan belum di-deploy.
- Spesifikasi ini belum menjadi SQL migration atau fungsi aktif.
