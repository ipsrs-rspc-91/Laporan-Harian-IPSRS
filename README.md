# Laporan Harian IPSRS (LHI)

Aplikasi operasional IPSRS. Repository ini merupakan sumber kode utama dan riwayat perubahan aplikasi.

## Mulai dari sini

**Dokumen induk dan peta proyek:** [MASTER PROJECT LHI](MASTER_PROJECT_LHI/00_MASTER_PROJECT.md)

Dokumen tersebut menjelaskan arsitektur existing, peta direktori, katalog modul, backend, CI/CD, status modularisasi, dan rencana refactor bertahap.

## Arsitektur singkat

- **GitHub:** source code utama dan version history.
- **GitHub Actions:** audit otomatis, regression test, dan deployment.
- **Cloudflare Worker:** penyajian frontend/static assets.
- **Supabase Edge Functions:** backend/API.
- **Supabase PostgreSQL:** database aplikasi.
- **GitHub Pages:** redirect pendukung sesuai workflow.

Cloudflare D1 adalah arah/target yang pernah didokumentasikan, bukan database aktif yang boleh diasumsikan sudah menggantikan Supabase.

## Dokumen kontrol wajib

1. [PROJECT_CONTROL.md](PROJECT_CONTROL.md) — Buku Induk Kontrol Proyek.
2. [LOCK_REGISTER.yaml](LOCK_REGISTER.yaml) — status modul dan batas perubahan.
3. [BASELINE_REGISTER.yaml](BASELINE_REGISTER.yaml) — baseline dan checkpoint.
4. [REGRESSION_MATRIX.yaml](REGRESSION_MATRIX.yaml) — test dan deployment gate.
5. [SOP-UPDATE-DAN-DEPLOY.md](SOP-UPDATE-DAN-DEPLOY.md) — SOP update sampai production.
6. [AI_AUDIT_PROTOCOL.md](AI_AUDIT_PROTOCOL.md) — protokol audit.

## Workflow otomatis

- [IPSRS Automated Audit Gate](.github/workflows/ipsrs-audit-gate.yml)
- [Deploy IPSRS Production](.github/workflows/deploy-production.yml)
- [Lihat riwayat GitHub Actions](../../actions)

## Prinsip keselamatan perubahan

- Baca dokumen kontrol sebelum mengubah kode.
- Modul berstatus LOCKED tidak boleh diubah perilakunya tanpa persetujuan eksplisit dan prosedur unlock.
- Perubahan shared file harus dianalisis dampaknya ke semua modul yang menggunakannya.
- Audit/regression gagal berarti deployment tidak boleh dianggap berhasil.
- Commit bukan bukti deployment; verifikasi SHA dan smoke test wajib.
- Jangan menaruh secret/service-role key di frontend, source, log, atau dokumentasi.

## Status modularisasi

Repository memiliki beberapa script pendukung yang terpisah, tetapi file inti `frontend/app.js` masih besar dan sejumlah fungsi masih terpusat. Lihat master project untuk status existing dan target modularisasi. Tidak ada pemindahan kode yang dilakukan hanya dengan membuat dokumen ini.
