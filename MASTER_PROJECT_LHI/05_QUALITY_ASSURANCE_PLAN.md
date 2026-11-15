# QUALITY ASSURANCE PLAN — APLIKASI LHI

## 1. Tujuan dan status

Dokumen ini menetapkan cara merencanakan, menjalankan, mencatat, dan menerima pengujian Aplikasi LHI. Dokumen ini adalah rencana dan standar QA; keberadaan dokumen atau test script tidak membuktikan bahwa aplikasi telah lulus. Hasil hanya boleh dinyatakan PASS jika ada bukti eksekusi pada commit dan environment yang dapat diidentifikasi.

Status dokumen: baseline QA awal untuk review Product Owner dan QA owner. Lingkup ini tidak mengubah kode, database, konfigurasi, atau produksi.

## 2. Prinsip QA

1. Requirement dan acceptance criteria harus tersedia sebelum test case disetujui.
2. Pengujian dilakukan pada branch/commit yang jelas dan lingkungan yang disebutkan.
3. Test harus dapat diulang, memiliki data uji aman, expected result, actual result, dan bukti.
4. Perubahan shared file wajib mengidentifikasi seluruh modul terdampak.
5. Modul LOCKED dan perilaku yang dilindungi wajib menjalani regression sesuai Project Control Book.
6. Test gagal, tidak dijalankan, atau tidak memiliki bukti tidak boleh diberi status PASS.
7. UAT bisnis tidak menggantikan security, integration, atau regression test.
8. Production smoke test dibatasi pada pemeriksaan yang diotorisasi dan tidak merusak data.

## 3. Lingkup pengujian

| Level | Tujuan | Contoh |
|---|---|---|
| Static analysis | Menemukan kesalahan source/configuration | syntax, lint, type, secret scan |
| Unit | Memverifikasi fungsi terisolasi | validasi, kalkulasi, helper |
| Component/UI | Memverifikasi komponen dan state UI | modal, form, filter, loading |
| Contract/API | Memverifikasi kontrak dan respons | schema, permission, error code |
| Integration | Memverifikasi interaksi frontend/API/database | create/read/update, RLS |
| End-to-end | Memverifikasi alur pengguna | login sampai laporan tersimpan |
| Regression | Menjamin perilaku lama tidak rusak | Dashboard, kategori, laporan, monitoring |
| Security | Menguji kontrol dan akses negatif | role bypass, IDOR/BOLA, RLS |
| Performance | Mengukur kapasitas dan latency | load, stress, soak, concurrency |
| Compatibility/accessibility | Memeriksa perangkat dan aksesibilitas | browser, keyboard, contrast |
| Recovery | Memeriksa backup/restore/rollback | restore drill, rollback verification |
| UAT | Penerimaan kebutuhan bisnis | skenario kerja petugas dan Kepala IPSRS |

## 4. Test environment dan data

- **Development:** implementasi dan unit test.
- **Staging/test:** integration, E2E, security, performance, UAT; harus sedekat mungkin dengan produksi tanpa memakai data pribadi produksi yang tidak diperlukan.
- **Production:** smoke test terbatas setelah deployment yang disetujui.

Environment harus memisahkan credential, secret, database, dan data. Test menggunakan data sintetis atau dianonimkan. Dilarang menaruh password, token, service-role key, atau data sensitif dalam fixture, screenshot, log, dan artifact.

## 5. Matriks browser/perangkat

QA owner bersama Product Owner harus menetapkan matriks dukungan aktual. Minimum yang perlu dipertimbangkan:
- Chrome/Chromium desktop dan Android;
- Edge desktop bila digunakan organisasi;
- Safari/iOS bila menjadi perangkat yang didukung;
- ukuran layar ponsel, tablet, dan desktop;
- jaringan normal dan jaringan lambat untuk alur kritis.

Versi browser, OS, perangkat, resolusi, dan hasil harus dicatat. Jangan mengklaim kompatibilitas seluruh browser tanpa pengujian.

## 6. Regression suite prioritas

Regression matrix repository tetap menjadi register status test. Prioritas cakupan:
1. AUTH: login, session, logout, expiry, role dan permission di UI/API.
2. REPORT: create, list, edit authorization, delete/soft-delete safety, filter.
3. MASTER/KAT/KESLING: rekonsiliasi area, item, kategori, duplicate detection, modal, required fields.
4. SPARE_MATERIAL_UNIT: input, validasi, klasifikasi BARU/KANIBAL/LAINNYA, recap, legacy compatibility.
5. DASH: dashboard load, unfinished drilldown, spare-part table, mobile.
6. REKAP: monthly recap, month picker, month display.
7. MONITORING: status petugas, Page Online, role visibility.
8. AUDIT_LOG: audit event, report history, delete audit trail.
9. PWA: asset version, service worker update, cache invalidation.
10. SECURITY: API authorization, RLS, audit safety, deletion safety.
11. GLOBAL: production smoke, source/deployment parity, backend parity.

Test ID, status, dan gate harus disinkronkan melalui proses perubahan resmi pada REGRESSION_MATRIX.yaml. Jangan mengubah dokumen kontrol yang LOCKED tanpa prosedur unlock.

## 7. Kriteria penerimaan test

Setiap test case wajib memiliki:
- Test ID dan requirement ID;
- modul dan risiko;
- precondition, test data, dan environment;
- langkah eksekusi;
- expected result dan actual result;
- status PASS/FAIL/BLOCKED/NOT RUN;
- bukti yang aman (log/screenshot/artifact);
- commit SHA dan workflow/run ID;
- tester dan timestamp;
- defect/issue terkait.

PASS berarti seluruh assertion yang ditetapkan terpenuhi. BLOCKED berarti test tidak dapat diselesaikan karena dependency/environment. NOT RUN bukan PASS. Test flaky harus diinvestigasi dan tidak boleh disamarkan dengan rerun tanpa analisis.

## 8. Performance dan kapasitas

Sebelum target disahkan, lakukan baseline untuk:
- waktu startup dan load halaman;
- API latency p50/p95/p99;
- query database dan ukuran payload;
- waktu simpan laporan;
- dashboard, laporan, dan rekap pada volume data representatif;
- concurrent login dan concurrent report submission.

Jenis test: load, stress, spike, soak, dan concurrency. Catat jumlah virtual users, pola request, durasi, dataset, environment, resource, error rate, latency, dan bottleneck. Jangan melakukan load test pada produksi tanpa persetujuan tertulis, jadwal, batas beban, monitoring, dan stop condition.

## 9. Security, accessibility, dan recovery test

Security test mengacu pada Security Assurance Plan dan mencakup authentication, authorization, session, API, RLS, secret, input validation, dependency, dan abuse controls. Accessibility menargetkan WCAG 2.2 AA untuk alur utama sejauh relevan. Recovery test memeriksa backup integrity, restore, RPO/RTO aktual, dan rollback.

## 10. UAT dan business acceptance

UAT dipimpin pemilik proses/representatif pengguna. Skenario minimal meliputi:
- petugas membuat dan melihat laporan;
- admin mengelola master data sesuai kewenangan;
- Kepala IPSRS melihat dashboard, monitoring, dan rekap;
- pembatasan akses lintas role;
- penanganan kesalahan dan pemulihan;
- perubahan modul yang mempengaruhi proses kerja.

Hasil UAT harus mencatat peserta/peran, skenario, hasil, defect, pengecualian, persetujuan, dan tanggal. UAT tidak boleh menyetujui risiko keamanan teknis tanpa review pihak yang berwenang.

## 11. Release quality gate

NO-GO jika:
- test kritis gagal atau belum dijalankan;
- ada regresi pada modul LOCKED;
- ada temuan keamanan Critical/High tanpa risk acceptance resmi;
- migration/backup/rollback tidak siap untuk perubahan berisiko;
- SHA yang diuji berbeda dengan SHA yang akan dirilis;
- source/deployment parity belum terverifikasi;
- tidak ada owner operasional atau runbook untuk perubahan yang berdampak.

Conditional GO harus memiliki risiko, mitigasi, owner, tenggat, persetujuan, dan kondisi pembatalan.

## 12. Laporan QA dan metrik

Laporan per release menampilkan:
- jumlah test PASS/FAIL/BLOCKED/NOT RUN;
- requirement coverage dan risk coverage;
- regression status per modul;
- defect berdasarkan severity dan usia;
- security findings dan retest;
- performance baseline vs hasil;
- browser/device matrix;
- SHA, workflow run, artifact, environment;
- keputusan GO/NO-GO dan approver.

Coverage persentase dihitung dari test yang benar-benar memiliki hasil valid, bukan jumlah file test atau test yang direncanakan.

## 13. Kewenangan dan perubahan

QA Plan tidak mengubah Project Control Book, Lock Register, Baseline Register, Regression Matrix, atau SOP deployment. Perubahan pada dokumen kontrol tersebut wajib mengikuti prosedur kontrol yang berlaku.
