/* IPSRS Excel export — lazy-loads SheetJS only after an explicit user click. */
(function () {
  'use strict';

  if (window.__IPSRS_EXCEL_EXPORT_V1) return;
  window.__IPSRS_EXCEL_EXPORT_V1 = true;

  const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  let xlsxPromise = null;

  const COLUMNS = [
    ['ID Laporan', ['ID', 'report_id', 'ReportID', 'id']],
    ['Tanggal', ['Tanggal', 'tanggal']],
    ['Pukul', ['Pukul', 'pukul']],
    ['Ruang', ['Ruang', 'ruang']],
    ['No LK', ['NoLK', 'no_lk', 'No_LK']],
    ['Masalah/Kegiatan', ['MasalahKegiatan', 'masalah_kegiatan', 'Masalah', 'masalah']],
    ['Tindakan', ['Tindakan', 'tindakan']],
    ['Keterangan', ['Keterangan', 'keterangan']],
    ['Petugas', ['Petugas', 'petugas', 'staff_name']],
    ['Bidang', ['Bidang', 'bidang']],
    ['Status', ['Status', 'status']],
    ['Kategori', ['Kategori', 'kategori']],
    ['Area Kerja', ['AreaKerja', 'area_kerja', 'Area']],
    ['Item', ['Item', 'item']],
    ['Status Unit', ['UnitStatus', 'unit_status']],
    ['Nama Unit', ['UnitName', 'unit_name']],
    ['Tipe Unit', ['UnitType', 'unit_type']],
    ['Jumlah Unit', ['UnitJumlah', 'unit_jumlah']],
    ['Status Spare Part/Material', ['SparePartMaterialStatus', 'spare_part_material_status', 'SparePartUnitStatus']],
    ['Nama Spare Part/Material', ['SparePartMaterial', 'spare_part_material', 'SparePartUnit']],
    ['Tipe Spare Part/Material', ['SparePartMaterialType', 'spare_part_material_type', 'Type']],
    ['Jumlah Spare Part/Material', ['SparePartMaterialJumlah', 'spare_part_material_jumlah', 'Jumlah']],
    ['Waktu Input', ['created_at', 'createdAt', 'CREATED_AT']]
  ];

  function firstValue(row, keys) {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null) return row[key];
    }
    return '';
  }

  function safeCell(value) {
    let text = value == null ? '' : String(value);
    // Prevent spreadsheet formula execution for text values originating in reports.
    if (/^[\u0000-\u0020]*[=+@-]/.test(text)) text = "'" + text;
    return text;
  }

  function filePart(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'laporan';
  }

  function filename(suffix) {
    const date = new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('');
    return 'Laporan-IPSRS-' + filePart(suffix) + '-' + stamp;
  }

  function csvFallback(rows, name) {
    const values = [
      COLUMNS.map(col => col[0]),
      ...rows.map(row => COLUMNS.map(col => safeCell(firstValue(row, col[1]))))
    ];
    const csv = '\uFEFF' + values.map(line =>
      line.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')
    ).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name + '.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_URL;
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Library Excel tidak tersedia.'));
      script.onerror = () => reject(new Error('Library Excel gagal dimuat.'));
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }

  async function exportRows(rows, suffix) {
    if (!Array.isArray(rows) || rows.length === 0) {
      alert('Tidak ada laporan yang tampil untuk diunduh.');
      return;
    }

    const baseName = filename(suffix);
    try {
      const XLSX = await loadXlsx();
      const data = [
        COLUMNS.map(col => col[0]),
        ...rows.map(row => COLUMNS.map(col => safeCell(firstValue(row, col[1]))))
      ];
      const sheet = XLSX.utils.aoa_to_sheet(data);
      sheet['!cols'] = COLUMNS.map(col => ({ wch: Math.min(34, Math.max(14, col[0].length + 2)) }));
      sheet['!autofilter'] = { ref: sheet['!ref'] };
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Laporan IPSRS');
      XLSX.writeFile(book, baseName + '.xlsx', { compression: true });
      setMessage('Excel berhasil dibuat: ' + rows.length + ' laporan.');
    } catch (error) {
      console.warn('[IPSRS_EXCEL_EXPORT] XLSX unavailable; using Excel-compatible CSV.', error);
      csvFallback(rows, baseName);
      setMessage('Library XLSX tidak tersedia. File CSV kompatibel Excel telah diunduh.');
    }
  }

  function setMessage(message) {
    const el = document.getElementById('msgReport');
    if (el) el.textContent = message;
  }

  function currentDisplayedRows() {
    // The renderer publishes the full filtered dataset for the selected month.
    // Prefer it over DOM rows so bulk export includes every matching report,
    // even when the table is paginated or only part of the list is visible.
    if (Array.isArray(window.__IPSRS_RENDERED_REPORT_ROWS)) {
      return window.__IPSRS_RENDERED_REPORT_ROWS.slice();
    }
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return [];
    const store = window.__IPSRS_REPORTS || {};
    return Array.from(tbody.querySelectorAll('tr[data-report-id]'))
      .map(tr => store[String(tr.dataset.reportId || '')])
      .filter(Boolean);
  }

  function reportById(id) {
    const store = window.__IPSRS_REPORTS || {};
    return store[String(id || '')] || null;
  }

  function exportOne(id, button) {
    const row = reportById(id);
    if (!row) {
      alert('Data laporan tidak ditemukan. Muat ulang daftar laporan lalu coba kembali.');
      return;
    }
    if (button) button.disabled = true;
    exportRows([row], 'ID-' + filePart(id)).finally(() => {
      if (button && button.isConnected) button.disabled = false;
    });
  }

  function addSingleButton(parent, row, compact) {
    if (!parent || !row) return;
    if (parent.querySelector(':scope > .ipsrs-export-single')) return;
    const id = String(row.ID ?? row.report_id ?? row.ReportID ?? row.id ?? '').trim();
    if (!id) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn ipsrs-export-single';
    button.textContent = compact ? 'Excel' : 'Download Excel';
    button.title = 'Unduh laporan ini sebagai file Excel';
    button.setAttribute('aria-label', 'Download Excel untuk laporan ' + id);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      exportOne(id, button);
    });
    parent.appendChild(button);
  }

  function decorateRenderedReports() {
    // Ekspor seluruh laporan menggunakan tombol utama di toolbar.
    // Jangan menambahkan tombol Excel tambahan pada setiap kartu laporan.
  }

  function installRendererHook() {
    if (typeof window.renderReportTable !== 'function' || window.__IPSRS_EXCEL_RENDERER_WRAPPED) return;
    const original = window.renderReportTable;
    window.renderReportTable = function () {
      const result = original.apply(this, arguments);
      try { decorateRenderedReports(); }
      catch (error) { console.warn('[IPSRS_EXCEL_EXPORT] Could not add row buttons.', error); }
      return result;
    };
    window.__IPSRS_EXCEL_RENDERER_WRAPPED = true;
  }

  function installToolbar() {
    const button = document.getElementById('btnDownloadLaporanExcel');
    if (button && !button.dataset.exportBound) {
      button.dataset.exportBound = '1';
      button.addEventListener('click', async () => {
        const rows = currentDisplayedRows();
        button.disabled = true;
        const oldText = button.textContent;
        button.textContent = 'Menyiapkan Excel...';
        try {
          await exportRows(rows, 'Daftar-Tampil');
        } finally {
          button.disabled = false;
          button.textContent = oldText || 'Download Excel';
        }
      });
    }
    installRendererHook();
    decorateRenderedReports();
  }

  function injectStyles() {
    if (document.getElementById('ipsrsExcelExportStyles')) return;
    const style = document.createElement('style');
    style.id = 'ipsrsExcelExportStyles';
    style.textContent = [
      '.ipsrs-export-excel{border-color:#217346!important;color:#217346!important;font-weight:700!important}',
      '.ipsrs-export-single{font-size:11px!important;padding:5px 8px!important;margin:2px!important;border-color:#217346!important;color:#217346!important;white-space:nowrap!important}',
      '#reportCardList>.ipsrs-export-single{align-self:flex-start;margin-top:10px!important}',
      '.ipsrs-export-single:disabled,#btnDownloadLaporanExcel:disabled{opacity:.6;cursor:wait}'
    ].join('');
    document.head.appendChild(style);
  }

  function start() {
    injectStyles();
    const pageReady = window.__ipsrsPageReady && window.__ipsrsPageReady.laporan;
    if (pageReady && typeof pageReady.then === 'function') {
      pageReady.then(installToolbar).catch(error => console.warn('[IPSRS_EXCEL_EXPORT] Page not ready.', error));
    } else {
      installToolbar();
    }
  }

  start();
})();
