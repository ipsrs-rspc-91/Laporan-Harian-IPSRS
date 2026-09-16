/**
 * Code.gs
 * Entry point Web App untuk backend API.
 *
 * Frontend GitHub Pages mengirim POST JSON:
 *   { action: 'apiLogin', data: { ... } }
 *
 * doPost() memvalidasi action melalui whitelist lalu meneruskan request
 * ke fungsi api* di Api.gs. doGet() dipertahankan untuk kompatibilitas
 * dengan deployment/URL Web App yang sudah ada.
 */

function doGet(e) {
  setupDatabase();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('LAPORAN HARIAN IPSRS 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        ok: false,
        msg: 'Request POST tidak memiliki body JSON.'
      });
    }

    var request;

    try {
      request = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({
        ok: false,
        msg: 'Body request bukan JSON yang valid.'
      });
    }

    var action = request && request.action;
    var data = request && request.data;

    if (!action || !Object.prototype.hasOwnProperty.call(API_ACTIONS, action)) {
      return jsonResponse({
        ok: false,
        msg: 'Action API tidak dikenal atau tidak diizinkan.'
      });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return jsonResponse({
        ok: false,
        msg: 'Format data API tidak valid.'
      });
    }

    return jsonResponse(API_ACTIONS[action](data));

  } catch (err) {
    console.error('doPost error:', err);

    return jsonResponse({
      ok: false,
      msg: 'Error server: ' + (
        err && err.message
          ? err.message
          : String(err)
      )
    });
  }
}


var API_ACTIONS = {

  // =========================
  // AUTH
  // =========================

  apiLogin: function(d) {
    return apiLogin(
      d.username || '',
      d.password || ''
    );
  },

  apiLogout: function(d) {
    return apiLogout(
      d.token || ''
    );
  },

  apiWhoAmI: function(d) {
    return apiWhoAmI(
      d.token || ''
    );
  },


  // =========================
  // REPORTS
  // =========================

  apiCreateReport: function(d) {
    return apiCreateReport(
      d.token || '',
      d.payload || {}
    );
  },

  apiGetReports: function(d) {
    return apiGetReportsFixed(
      d.token || '',
      d.bulan || '',
      d.staffIdFilter || null,
      d.bidangFilter || null
    );
  },

  apiUpdateReport: function(d) {
    return apiUpdateReport(
      d.token || '',
      d.reportId || '',
      d.payload || {}
    );
  },

  apiGetReportHistory: function(d) {
    return apiGetReportHistory(
      d.token || '',
      d.reportId || ''
    );
  },


  // =========================
  // STAFF
  // =========================

  apiListStaff: function(d) {
    return apiListStaff(
      d.token || ''
    );
  },

  apiChangePassword: function(d) {
    return apiChangePassword(
      d.token || '',
      d.oldPassword || '',
      d.newPassword || ''
    );
  },


  // =========================
  // DASHBOARD
  // =========================

  apiDashboardStats: function(d) {
    return apiDashboardStatsFixed(
      d.token || '',
      d.bulan || '',
      d.staffIdFilter || null,
      d.bidangFilter || null
    );
  },


  // =========================
  // MONITORING
  // =========================

  apiGetStaffMonitoring: function(d) {
    return apiGetStaffMonitoringFixed(
      d.token || '',
      d.bulan || '',
      d.tanggal || ''
    );
  },

  apiGetStaffDailyStatus: function(d) {
    return apiGetStaffDailyStatus(
      d.token || '',
      d.staffId || '',
      d.bulan || ''
    );
  },

  apiGetMonthlyRecap: function(d) {
    return apiGetMonthlyRecap(
      d.token || '',
      d.bulan || ''
    );
  },

  apiGetStaffReports: function(d) {
    return apiGetStaffReports(
      d.token || '',
      d.staffId || '',
      d.bulan || ''
    );
  },

  apiGetStaffPerformance: function(d) {
    return apiGetStaffPerformance(
      d.token || '',
      d.staffId || '',
      d.bulan || ''
    );
  },


  // =========================
  // AUDIT
  // =========================

  apiGetAuditLog: function(d) {
    return apiGetAuditLog(
      d.token || '',
      d.reportId || ''
    );
  },


  // =========================
  // ACCESS CONTROL
  // =========================

  apiGetAccessControl: function(d) {
    return apiGetAccessControl(
      d.token || ''
    );
  },

  apiSetAccessSetting: function(d) {
    return apiSetAccessSetting(
      d.token || '',
      d.key || '',
      d.value || ''
    );
  },

  apiListEditPermissions: function(d) {
    return apiListEditPermissions(
      d.token || ''
    );
  },

  apiSetEditPermission: function(d) {
    return apiSetEditPermission(
      d.token || '',
      d.grantedToStaffId || '',
      d.targetStaffId || '',
      d.isActive
    );
  },


  // =========================
  // DATA KUSTOM
  // =========================

  apiGetKategoriKustom: function(d) {
    return apiGetKategoriKustom(
      d.token || ''
    );
  },

  apiGetAreaKerjaKustom: function(d) {
    return apiGetAreaKerjaKustom(
      d.token || ''
    );
  },

  apiGetItemKustom: function(d) {
    return apiGetItemKustom(
      d.token || '',
      d.area || '',
      d.nama || '',
      Array.isArray(d.existingItemsForArea)
        ? d.existingItemsForArea
        : []
    );
  },

  apiTambahKategori: function(d) {
    return apiTambahKategori(
      d.token || '',
      d.nama || '',
      Array.isArray(d.staticList)
        ? d.staticList
        : []
    );
  },

  apiTambahAreaKerja: function(d) {
    return apiTambahAreaKerja(
      d.token || '',
      d.nama || '',
      Array.isArray(d.staticList)
        ? d.staticList
        : []
    );
  },

  apiTambahItem: function(d) {
    return apiTambahItem(
      d.token || '',
      d.area || '',
      d.nama || '',
      Array.isArray(d.existingItemsForArea)
        ? d.existingItemsForArea
        : []
    );
  }
};


function jsonResponse(payload) {
  return ContentService
    .createTextOutput(
      JSON.stringify(
        payload == null
          ? {
              ok: false,
              msg: 'Respons kosong.'
            }
          : payload
      )
    )
    .setMimeType(ContentService.MimeType.JSON);
}
