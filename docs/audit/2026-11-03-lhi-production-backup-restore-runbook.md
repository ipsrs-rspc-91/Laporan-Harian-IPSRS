# Runbook backup dan uji pemulihan database produksi LHI

Tanggal: 3 November 2026  
Project: `tcrmlhfsroyhaxdfwyll` — Laporan Harian IPSRS  
Tujuan: menyediakan backup logis off-site dan membuktikan file dapat dipulihkan sebelum cutover LHI v2.  
Biaya: prosedur ini menggunakan ekspor manual Supabase CLI; tidak mensyaratkan upgrade paket atau PITR berbayar.

## 1. Batas cakupan

Prosedur ini menghasilkan tiga dump PostgreSQL terpisah:
1. `roles.sql` — definisi role yang didukung dump (password custom role tidak ikut diekspor).
2. `schema.sql` — schema dan objek database yang didukung dump Supabase.
3. `data.sql` — data pada schema yang disertakan oleh dump.

**PENTING: ketiga dump tersebut BUKAN backup lengkap seluruh layanan Supabase.** Perintah `supabase db dump` secara default mengecualikan schema yang dikelola Supabase, termasuk `auth` dan `storage`, serta schema ekstensi. Karena itu `auth.users` dan isi schema Auth tidak boleh diasumsikan ikut tercakup. Jangan menyebut hasil tiga dump ini sebagai backup identitas pengguna yang lengkap atau sebagai bukti pemulihan penuh sebelum komponen yang dikecualikan ditangani dan diuji dengan prosedur resmi yang kompatibel.

Komponen yang tidak otomatis tercakup:
- **Supabase Auth:** schema/tabel Auth (termasuk `auth.users`) dan konfigurasi provider, OAuth, SMTP, domain, serta pengaturan dashboard. Buat rencana ekspor/pemulihan terpisah yang didukung Supabase; jangan menyalin atau memodifikasi tabel internal Auth secara manual sebagai jalan pintas.
- **Supabase Storage:** schema Storage dan file objek. Database tidak menyertakan objek Storage; ekspor objek serta catat bucket dan jumlah objek dengan prosedur terpisah.
- Source/deployment Edge Functions dan secrets; source harus disimpan di GitHub, sedangkan secrets harus dikelola terpisah dan tidak pernah dimasukkan ke dump atau repository.
- Password role PostgreSQL kustom tidak disertakan; atur ulang secara aman setelah restore bila ada.

## 2. Persiapan pada komputer operator

Gunakan komputer admin tepercaya. Pastikan Docker Desktop aktif dan Supabase CLI tersedia. Jangan menjalankan perintah pada komputer publik.

Buat folder backup baru dengan tanggal/waktu UTC dan batasi izin folder. Contoh PowerShell:

```powershell
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$backupDir = Join-Path "$HOME\LHI-Production-Backups" $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Set-Location $backupDir
```

Ambil connection string PostgreSQL dari Supabase Dashboard > Project > Connect. Gunakan direct connection atau session pooler sesuai jaringan. Simpan sementara sebagai environment variable pada terminal saja; jangan tempel connection string/password ke chat, issue, log, atau file repository.

```powershell
$secureUrl = Read-Host "Database connection string" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
try {
  $env:SUPABASE_DB_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Variable secureUrl,ptr -ErrorAction SilentlyContinue
}
```

Catatan: CLI meneruskan URL sebagai argumen proses; jalankan hanya pada komputer admin tepercaya, tutup terminal setelah backup, dan jangan gunakan komputer bersama. Untuk perlindungan lebih kuat, gunakan terminal/credential manager yang disetujui organisasi.

## 3. Buat tiga dump

Jalankan dengan Supabase CLI versi yang sama/pinned dan Docker aktif:

```powershell
supabase db dump --db-url "$env:SUPABASE_DB_URL" -f roles.sql --role-only
if ($LASTEXITCODE -ne 0) { throw "Dump roles gagal" }

supabase db dump --db-url "$env:SUPABASE_DB_URL" -f schema.sql
if ($LASTEXITCODE -ne 0) { throw "Dump schema gagal" }

supabase db dump --db-url "$env:SUPABASE_DB_URL" -f data.sql --use-copy --data-only
if ($LASTEXITCODE -ne 0) { throw "Dump data gagal" }
```

Jangan melanjutkan jika salah satu perintah gagal atau file kosong. Jangan gunakan raw `pg_dump` untuk menggantikan Supabase CLI tanpa evaluasi karena dump Supabase menerapkan filter khusus platform.

## 4. Validasi file dan integritas

```powershell
Get-Item roles.sql, schema.sql, data.sql | Select-Object Name,Length,LastWriteTimeUtc
Get-FileHash roles.sql, schema.sql, data.sql -Algorithm SHA256 |
  Format-Table Path,Hash -AutoSize
```

Simpan output hash dan ukuran di change record internal rumah sakit (bukan di repository publik). Enkripsi folder backup menggunakan media/penyimpanan yang disetujui rumah sakit. Simpan salinan off-site terpisah dari akun Supabase produksi.

## 5. Uji restore — jangan pernah ke project produksi

Siapkan PostgreSQL/Supabase lokal atau instance uji kosong yang versinya kompatibel. Pastikan target benar-benar database uji dan bukan URL produksi. Gunakan connection string target hanya pada terminal privat:

```powershell
$env:RESTORE_DB_URL = Read-Host "Paste connection string database UJI kosong"
psql `
  --single-transaction `
  --variable ON_ERROR_STOP=1 `
  --file roles.sql `
  --file schema.sql `
  --command 'SET session_replication_role = replica' `
  --file data.sql `
  --dbname "$env:RESTORE_DB_URL"
if ($LASTEXITCODE -ne 0) { throw "Restore rehearsal gagal" }
```

Jika dump berisi fitur/objek yang tidak tersedia pada target, catat error dan perbaiki prosedur pada lingkungan uji. Jangan mengedit file backup asli; buat salinan kerja untuk penyesuaian.

## 6. Verifikasi setelah restore

Bandingkan jumlah baris dan keberadaan objek utama antara produksi dan database uji, minimal:
- `public.staff`
- `public.reports`
- `public.master_data`
- `public.access_settings`
- `public.lhi_discipline_incidents`
- `public.lhi_discipline_obligations`
- Verifikasi Auth melalui mekanisme ekspor/pemulihan resmi yang terpisah; jangan mengharapkan `auth.users` ada di tiga dump default.
- schema, index, function, trigger, dan RLS policies penting.

Periksa juga bahwa status LHI sebelum cutover terekam pada dump:
- `LHI_GLOBAL_BLOCK=AKTIF`
- incident 1 `LOCKED`
- cron job lama tercatat dalam backup metadata/checkpoint yang dibuat terpisah.

Catat waktu restore, versi PostgreSQL, hasil pemeriksaan, jumlah baris aktual dan hasil perbandingan. Dump database inti baru dinyatakan **RESTORABLE untuk cakupan schema/data yang benar-benar disertakan** setelah restore rehearsal dan pemeriksaan tersebut lulus. Backup layanan Supabase secara keseluruhan belum boleh dinyatakan RESTORABLE sampai Auth, Storage, secrets, konfigurasi layanan, dan seluruh komponen yang dikecualikan mempunyai bukti pemulihan terpisah. File dump yang sekadar berhasil dibuat belum membuktikan restore berhasil.

## 7. Setelah backup tervalidasi

1. Simpan hash, ukuran, lokasi terenkripsi, operator, waktu, dan hasil restore test pada change record.
2. Verifikasi rollback Cloudflare Worker yang sudah tercatat pada runbook utama.
3. Baru lanjutkan preflight migrasi: `supabase migration list --linked` dan `supabase db push --dry-run`. Harus tepat empat migrasi LHI v2 yang pending; jangan mengulang dua hotfix keamanan yang sudah tercatat pada riwayat migrasi produksi.
4. Set secrets Edge Function secara lokal melalui CLI, jangan melalui SQL atau repository:

Buat salt dengan generator kriptografis OpenSSL. Jalankan perintah berikut pada terminal privat; nilainya tidak ditampilkan atau disimpan ke repository:

```sh
supabase secrets set --project-ref tcrmlhfsroyhaxdfwyll \
  LHI_ALLOWED_ORIGINS="https://laporan-harian-ipsrs.rspc.workers.dev" \
  LHI_RATE_LIMIT_SALT="$(openssl rand -hex 32)"
```

Jangan pernah menampilkan nilai salt. Setelah secret dipasang, lakukan verifikasi hanya dengan memastikan nama secret tersedia; jangan membaca atau mencetak nilainya.

5. Lanjutkan cutover sesuai `docs/audit/2026-11-03-lhi-global-unlock-runbook.md`. Jika backup tidak dapat direstore, hentikan cutover. Global block harus tetap AKTIF.

## 8. Sumber prosedur

- Supabase Database Backups: https://supabase.com/docs/guides/platform/backups
- Supabase CLI `db dump`: https://supabase.com/docs/reference/cli/supabase-db-dump
- Supabase backup/restore: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore


## 9. Script operator untuk backup dan restore rehearsal

Repository menyediakan `scripts/lhi-production-backup.ps1` agar operator tidak perlu menyalin tiga perintah dump secara manual.

Jalankan pada PowerShell komputer admin tepercaya setelah mengatur `SUPABASE_DB_URL` sesuai bagian 2:

```powershell
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$backupDir = Join-Path "$HOME\LHI-Production-Backups" $stamp
.scripts\lhi-production-backup.ps1 -Mode Backup -BackupDirectory $backupDir
```

Script akan:
- membuat tiga dump terpisah (roles, schema, data);
- menghentikan proses bila salah satu file gagal dibuat/kosong;
- merekam SHA-256 dan jumlah baris enam tabel kritis dalam `manifest.json`;
- tidak menulis connection string ke manifest;
- memberi peringatan bahwa Auth, Storage, secrets, dan konfigurasi layanan tetap merupakan backup terpisah.

Setelah database uji kosong tersedia, atur `RESTORE_DB_URL` hanya pada terminal privat lalu jalankan:

```powershell
.scripts\lhi-production-backup.ps1 -Mode RestoreTest -BackupDirectory $backupDir
```

Script memverifikasi checksum sebelum restore, meminta operator mengetik `RESTORE-TO-ISOLATED-TEST`, menjalankan restore hanya ke URL yang diberikan operator, lalu membandingkan jumlah baris tabel kritis dengan manifest. Jangan pernah mengarahkan `RESTORE_DB_URL` ke produksi.

**Batas penting:** script dan tes otomatis repository hanya menyiapkan prosedur dan guardrail. Script belum dijalankan terhadap database produksi, restore rehearsal belum dilakukan, dan backup layanan Supabase lengkap belum terbukti. Status baru boleh diubah menjadi RESTORABLE setelah operator menyelesaikan proses di atas dan bukti hasilnya diperiksa.
