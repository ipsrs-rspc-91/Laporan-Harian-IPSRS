# IPSRS Automated Audit Gate

Audit otomatis berjalan setiap push/PR.

## Pemeriksaan
- JavaScript syntax
- Referensi asset HTML
- Cache/version-busting dependency
- Secret/service-role key exposure
- Migration timestamp consistency
- Duplicate top-level functions
- Dampak perubahan file/dependency
- Indikasi direct Supabase access dari frontend
- Checklist Markdown + JSON

## Gate
FAIL = workflow gagal dan deployment gate berhenti.
WARN = dilaporkan tetapi tidak memblokir.
Hasil disimpan sebagai GitHub Actions artifact dan job summary.

## Prinsip
Setiap perubahan harus menghasilkan jejak audit. User tidak perlu menjadi pihak pertama yang menemukan error.
