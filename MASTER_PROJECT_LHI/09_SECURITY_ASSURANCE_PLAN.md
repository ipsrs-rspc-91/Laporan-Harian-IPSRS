# SECURITY ASSURANCE PLAN — APLIKASI LHI

## 1. Tujuan dan pernyataan status

Dokumen ini menetapkan program verifikasi keamanan Aplikasi LHI. Ini adalah rencana pengujian, bukan sertifikasi atau pernyataan bahwa aplikasi sudah aman. Tidak ada klaim bebas kerentanan. Setiap kesimpulan harus menyebut cakupan, tanggal, commit, environment, keterbatasan, temuan, dan retest.

## 2. Ruang lingkup aset

Aset minimum:
- akun pengguna, identitas petugas, role, permission;
- password verifier, session, access/refresh token;
- laporan harian, histori, master data, audit log;
- database, RLS, Edge Functions, API;
- konfigurasi Cloudflare Worker dan frontend assets;
- GitHub repository, Actions, deployment artifacts;
- secrets, service accounts, backup, dan log.

## 3. Trust boundary dan aliran data

Boundary utama yang harus diverifikasi:
1. Perangkat/browser pengguna ↔ Cloudflare Worker/frontend.
2. Frontend ↔ Supabase Edge Functions/API.
3. Edge Functions ↔ Supabase PostgreSQL.
4. GitHub repository ↔ GitHub Actions ↔ Cloudflare/Supabase deployment.
5. Engineer/admin ↔ dashboard administrasi dan secret management.

Diagram arsitektur dan data flow harus mencatat protokol, credential, data sensitif, trust boundary, serta kontrol di setiap boundary. Asumsi tidak boleh menggantikan verifikasi konfigurasi.

## 4. Standar acuan

- OWASP ASVS sebagai katalog persyaratan verifikasi aplikasi.
- OWASP Top 10 untuk risiko aplikasi web.
- OWASP API Security Top 10 untuk risiko API.
- OWASP Web Security Testing Guide untuk metode uji.
- NIST Secure Software Development Framework sebagai referensi praktik secure SDLC.
- CVSS dapat digunakan sebagai salah satu input penilaian severity, dengan konteks dampak operasional dan data LHI.

Tingkat verifikasi ASVS harus ditetapkan berdasarkan risk assessment. Pemetaan kontrol ASVS versi yang dipilih ke test case, evidence, hasil, dan pengecualian harus dipelihara terpisah. Penyebutan standar tidak berarti compliance.

## 5. Area kontrol dan skenario minimum

### 5.1 Authentication dan account lifecycle
- Login, logout, reset password, account recovery, lockout/rate limit.
- Enumerasi akun dan brute-force resistance.
- Kebijakan password dan MFA jika ditetapkan.
- Provisioning, deprovisioning, status akun, dan perubahan role.

### 5.2 Session dan token
- Cookie/storage attributes sesuai arsitektur.
- Masa berlaku, refresh, rotasi, invalidasi logout, revoke session.
- Replay, fixation, theft, dan concurrent session behavior.
- Token tidak tampil di URL, log, screenshot, atau frontend bundle secara tidak semestinya.

### 5.3 Authorization dan privilege escalation
- Petugas tidak dapat melihat/mengubah laporan petugas lain kecuali diizinkan.
- Admin/Kepala IPSRS hanya mendapat fungsi sesuai kebijakan.
- Uji horizontal/vertical privilege escalation.
- Uji IDOR/BOLA dan object/property/function-level authorization.
- API menolak operasi tanpa permission walau UI dimanipulasi.

### 5.4 Web dan API
- Injection, XSS, CSRF bila relevan, SSRF pada jalur yang memungkinkan, open redirect, security headers, CORS.
- Input validation, mass assignment, pagination/filter abuse, error leakage.
- Rate limiting, resource consumption, timeout, retry, dan idempotency.
- Inventory endpoint dan versi API.

### 5.5 Supabase/database
- RLS untuk seluruh tabel yang terekspos.
- GRANT/privilege anon, authenticated, service role.
- Edge Function authentication/authorization.
- SQL injection, insecure query construction, exposed database functions.
- Audit log tampering, soft-delete safety, backup access.

### 5.6 CI/CD, source, dan infrastructure
- Secret scanning pada history dan current tree.
- GitHub Actions least privilege, pinning/review action dependencies.
- Protected branches, pull request review, artifact provenance.
- Cloudflare configuration, headers, cache, environment, access.
- Dependency/SCA, license, SBOM, vulnerable packages.
- Separation of development/staging/production.

### 5.7 Data protection dan logging
- Data minimization dan least privilege.
- Encryption in transit dan at rest sesuai dukungan platform.
- PII exposure pada response, log, export, backup, dan test data.
- Audit log integrity dan retensi.
- Tidak mencatat password, token, secret, atau data yang tidak diperlukan.

## 6. Threat modeling

Setiap perubahan material memperbarui threat model menggunakan STRIDE atau metode setara. Catat asset, actor, entry point, data flow, trust boundary, threat scenario, likelihood, impact, control, test, residual risk, owner, dan keputusan penerimaan.

## 7. Metode dan frekuensi

- Security review sebelum release besar dan perubahan auth/session/permission/API/RLS/infrastruktur.
- SAST, secret scan, SCA, dan konfigurasi scan dijalankan pada pipeline sesuai kemampuan tooling.
- DAST dilakukan terhadap staging yang diotorisasi.
- Penetration test independen dilakukan berdasarkan risiko, sebelum readiness produksi awal dan setelah perubahan arsitektur/kontrol yang material.
- Pemeriksaan ulang dilakukan setelah insiden atau temuan Critical/High.
- Jadwal dan cakupan disahkan oleh pemilik layanan dan security owner.

## 8. Severity dan penanganan

| Severity | Tindakan default |
|---|---|
| Critical | Stop release, containment, perbaikan segera, retest |
| High | Tidak release sebelum diperbaiki dan retest, kecuali risk acceptance formal |
| Medium | Masuk remediation plan dengan owner dan due date |
| Low | Backlog terukur dan ditinjau berkala |

Setiap temuan memiliki ID, asset, langkah reproduksi aman, evidence, dampak, severity, remediation, owner, due date, status, dan retest. Risk acceptance harus menyebut mitigasi, masa berlaku, approver, dan trigger pencabutan.

## 9. Rules of engagement

- Pengujian hanya pada aset dan akun yang diotorisasi.
- Utamakan staging dan data sintetis.
- Tidak melakukan destructive testing, denial-of-service, brute force massal, atau pengambilan data pribadi.
- Pengujian produksi yang berpotensi mengganggu wajib mendapat persetujuan eksplisit, jadwal, batasan, monitoring, kontak eskalasi, dan stop condition.
- Bukti uji harus menyamarkan data sensitif.
- Temuan harus dilaporkan melalui jalur yang disetujui dan tidak dipublikasikan tanpa izin.

## 10. Security verification matrix

| Domain | Evidence minimum | Status awal |
|---|---|---|
| Authentication | Test login/reset/lockout dan hasil role | NOT VERIFIED |
| Session/token | Test expiry/rotation/revoke dan storage review | NOT VERIFIED |
| Authorization | Negative test per role/API object | NOT VERIFIED |
| API security | Endpoint inventory, contract, DAST/manual test | NOT VERIFIED |
| Database/RLS | Policy inventory dan test role per tabel | NOT VERIFIED |
| Secret management | Secret scan dan platform configuration review | NOT VERIFIED |
| Dependency/supply chain | SCA, SBOM, license report | NOT VERIFIED |
| Infrastructure | Config review dan deployment permission evidence | NOT VERIFIED |
| Data protection | Data flow, logging, retention, export review | NOT VERIFIED |
| Recovery | Restore drill dan access review backup | NOT VERIFIED |

Status NOT VERIFIED bukan berarti kontrol pasti gagal; artinya bukti belum dikumpulkan dan diverifikasi dalam security assessment yang terdokumentasi.

## 11. Security release gate

NO-GO bila terdapat temuan Critical, High tanpa risk acceptance formal, akses lintas role yang tidak sah, secret exposure, RLS bypass, data corruption, atau kontrol inti tidak dapat diverifikasi. Release gate harus terhubung dengan QA Plan dan Project Control Book.

## 12. Artefak wajib

- Threat model dan data flow diagram.
- Asset/endpoint/table inventory.
- ASVS control-to-evidence matrix.
- SAST/SCA/secret/DAST reports.
- Penetration test report bila dilakukan.
- Findings register dan retest evidence.
- Risk acceptance register.
- Security release decision.

## 13. Riwayat

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | Dokumen Security Assurance Plan awal |
