# Runbook backup dan uji pemulihan database produksi LHI

Tanggal: 3 November 2026  
Project: `tcrmlhfsroyhaxdfwyll` — Laporan Harian IPSRS  
Tujuan: menyediakan backup logis off-site dan membuktikan file dapat dipulihkan sebelum cutover LHI v2.  
Biaya: prosedur ini menggunakan ekspor manual Supabase CLI; tidak mensyaratkan upgrade paket atau PITR berbayar.

## 1. Batas cakupan

Backup harus mencakup tiga dump PostgreSQL terpisah:
1. `roles.sql` — definisi role (password custom role tidak ikut diekspor).
2. `schema.sql` — schema, tabel, index, sequence, function, trigger, policy/RLS, dan struktur database yang didukung dump Supabase.
3. `data.sql` — data database termasuk tabel Auth yang termasuk dalam dump.

Hal yang tidak otomatis tercakup:
- File objek Supabase Storage; database hanya menyimpan metadata objek. Jika bucket dipakai, ekspor objek Storage secara terpisah dan catat daftar bucket serta jumlah objek.
- Source/deployment Edge Functions dan secrets; source harus disimpan di GitHub, sedangkan secrets harus dikelola terpisah dan tidak pernah dimasukkan ke dump atau repository.
- Konfigurasi dashboard Auth/OAuth, SMTP, domain, dan konfigurasi layanan; dokumentasikan terpisah.
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
- `auth.users`
- schema, index, function, trigger, dan RLS policies penting.

Periksa juga bahwa status LHI sebelum cutover terekam pada dump:
- `LHI_GLOBAL_BLOCK=AKTIF`
- incident 1 `LOCKED`
- cron job lama tercatat dalam backup metadata/checkpoint yang dibuat terpisah.

Catat waktu restore, versi PostgreSQL, hasil pemeriksaan, jumlah baris aktual dan hasil perbandingan. Backup baru dinyatakan **RESTORABLE** hanya setelah restore rehearsal dan pemeriksaan tersebut lulus. File dump yang sekadar berhasil dibuat belum membuktikan restore berhasil.

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
