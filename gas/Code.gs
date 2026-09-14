/**
 * Code.gs
 * Entry point Web App. Karena seluruh UI sekarang dilayani langsung dari
 * Apps Script (bukan file statis di hosting lain), doGet() hanya bertugas
 * merender Index.html. Semua operasi data (login, simpan laporan, dsb)
 * dipanggil dari frontend lewat google.script.run ke fungsi-fungsi di Api.gs.
 */
function doGet(e) {
  setupDatabase();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('LAPORAN HARIAN IPSRS 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
