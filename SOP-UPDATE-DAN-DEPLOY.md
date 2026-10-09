# SOP: Setiap Update/Perbaikan IPSRS Wajib Deploy Otomatis

## Aturan wajib
1. Setiap perubahan atau perbaikan pada repositori `ipsrs-rspc-91/Laporan-Harian-IPSRS` harus disimpan sebagai commit di branch `main`, kecuali ada instruksi eksplisit untuk branch lain.
2. Setelah commit, biarkan GitHub Actions menjalankan **IPSRS Automated Audit Gate** (audit statis dan browser regression).
3. Jika audit lengkap berhasil, **Deploy IPSRS Production** harus berjalan otomatis untuk SHA yang diaudit. Jangan menunggu permintaan terpisah dari pengguna untuk deploy.
4. Jika audit gagal, jangan mengklaim deploy berhasil. Periksa log, perbaiki penyebabnya, commit perbaikan, lalu ulangi proses otomatis.
5. Setelah deployment, verifikasi job **Deploy GitHub Pages** dan **Post-deployment smoke check** sukses. Verifikasi pula target backend/Worker jika memang berubah dan kredensial deployment tersedia.
6. Pastikan SHA yang di-deploy sama dengan commit perubahan terbaru yang telah lulus audit. Jangan menyatakan produksi sudah diperbarui hanya berdasarkan commit atau audit yang sukses.
7. Setelah verifikasi, beri tahu pengguna secara ringkas: perubahan yang dilakukan, SHA commit, status deployment, dan tautan workflow. Jika masih berjalan, nyatakan belum selesai dan pantau hingga hasil final.

## Alur otomatis
- Push ke `main` memicu `IPSRS Automated Audit Gate`.
- `Deploy IPSRS Production` dipicu setelah workflow audit selesai dan hanya meneruskan deployment bila audit sukses serta SHA audit masih merupakan `main` terkini.
- Deployment harus diikuti smoke check produksi.

## Larangan
- Jangan menganggap commit sama dengan deployment.
- Jangan mengatakan “sudah deploy” sebelum workflow deployment dan pemeriksaan setelah deployment berstatus sukses.
- Jangan melewati audit/regression hanya untuk mempercepat deployment.
- Jangan meminta pengguna mengingatkan agar deployment dilakukan; deployment merupakan bagian wajib dari setiap update/perbaikan.
