# PROJECT CHARTER — APLIKASI LHI

## 1. Identitas proyek

| Atribut | Nilai |
|---|---|
| Nama | Aplikasi Laporan Harian IPSRS (LHI) |
| Pemilik proses | Instalasi Pemeliharaan Sarana Rumah Sakit, RS Puri Cinere |
| Sponsor/pemilik keputusan | Manajemen sesuai kewenangan organisasi |
| Product Owner | Kepala IPSRS atau pejabat yang ditunjuk |
| Repository | ipsrs-rspc-91/Laporan-Harian-IPSRS |
| Dokumen induk | 00_MASTER_PROJECT.md |
| Status charter | Draft untuk review dan pengesahan |

## 2. Latar belakang

IPSRS memerlukan sistem terpusat untuk pencatatan aktivitas harian, pengelolaan master data, monitoring petugas, rekapitulasi, audit, dan pengembangan kapabilitas operasional. Aplikasi LHI telah memiliki sistem existing yang perlu dipelihara, diverifikasi, diperkuat keamanannya, dan dikembangkan bertahap.

## 3. Mandat dan tujuan

Mandat proyek adalah menjaga kesinambungan sistem LHI dan meningkatkan kualitasnya secara terkendali. Tujuan:
1. Menyediakan pencatatan aktivitas IPSRS yang konsisten.
2. Menyediakan monitoring dan rekap yang dapat direkonsiliasi.
3. Menjaga data, identitas, dan akses sesuai kewenangan.
4. Mengurangi regresi dan risiko perubahan.
5. Membuat arsitektur dan dokumentasi yang dapat dipelihara.
6. Memungkinkan penambahan modul sesuai kebutuhan tanpa membangun ulang seluruh aplikasi.

## 4. Ruang lingkup

Termasuk: modul LHI existing, autentikasi/otorisasi, input/laporan, master data, dashboard, rekap, monitoring, Form Blok Aplikasi, audit, platform, database, pengujian, keamanan, backup, operasi, dokumentasi, dan modul baru yang disetujui melalui change control.

Tidak otomatis termasuk: penggantian platform, migrasi database, integrasi SIMRS, perubahan proses bisnis, atau pengadaan infrastruktur yang belum disetujui.

## 5. Prinsip dan batas kewenangan

- Master Project adalah dokumen induk arah dan kerangka proyek.
- PROJECT_CONTROL.md tetap menjadi Buku Induk Kontrol Proyek.
- LOCK_REGISTER, BASELINE_REGISTER, REGRESSION_MATRIX, dan SOP tetap berlaku.
- Modul LOCKED tidak boleh diubah perilakunya tanpa persetujuan eksplisit dan prosedur unlock.
- Persetujuan charter tidak sama dengan persetujuan setiap perubahan atau deployment.
- Tidak ada klaim selesai tanpa bukti source, test, deployment, dan runtime yang sesuai.

## 6. Pemangku kepentingan dan tanggung jawab

| Peran | Tanggung jawab |
|---|---|
| Sponsor/manajemen | Mandat, prioritas sumber daya, keputusan lintas unit |
| Product Owner/Kepala IPSRS | Kebutuhan, prioritas, aturan bisnis, UAT, acceptance |
| Admin aplikasi | Administrasi akun/master sesuai permission |
| Pengguna/petugas | Penggunaan, feedback, validasi proses |
| Project/technical lead | Rencana teknis, risiko, koordinasi dan pelaporan |
| Engineer | Implementasi, review, test, dokumentasi |
| QA/security reviewer | Verifikasi mutu dan keamanan |
| Operations/platform owner | Hosting, database, monitoring, backup, incident response |

Nama personel, delegasi, dan pemisahan tugas harus diisi dan disetujui organisasi; dokumen ini tidak menetapkan nama tanpa konfirmasi.

## 7. Model delivery dan persetujuan

Pengembangan dilakukan iteratif. Modul dapat dikerjakan bertahap setelah kebutuhan dan dependensi disetujui. Perubahan melalui issue/change request, branch, review, test, gate, persetujuan, release, dan verifikasi. Perubahan darurat mengikuti prosedur darurat pada Project Control Book dan harus direkonsiliasi.

## 8. Kriteria keberhasilan tingkat charter

- LHI mendukung proses bisnis yang disetujui.
- Data dan hak akses dapat diverifikasi.
- Modul kritis memiliki regression test.
- Penambahan modul dapat dilakukan dengan batas dan kontrak yang jelas.
- Operasi memiliki monitoring, backup/restore, dan incident procedure.
- Release dapat ditelusuri ke commit dan bukti test.
- Pengguna menerima perubahan melalui UAT dan panduan yang sesuai.

## 9. Risiko dan asumsi

Risiko utama: regresi akibat shared code, kontrol akses lemah, perubahan database, cache stale, dokumentasi/runtime mismatch, vendor dependency, backup tidak dapat dipulihkan, dan kekurangan test. Mitigasi dikelola dalam risk register.

Asumsi platform dan arsitektur harus diverifikasi terhadap repository serta runtime sebelum dijadikan baseline final.

## 10. Persetujuan

| Persetujuan | Nama/jabatan | Tanggal | Status |
|---|---|---|---|
| Sponsor/manajemen | Diisi organisasi | — | MENUNGGU |
| Product Owner | Diisi organisasi | — | MENUNGGU |
| Technical/operations owner | Diisi organisasi | — | MENUNGGU |

## 11. Riwayat

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | Charter awal untuk review |
