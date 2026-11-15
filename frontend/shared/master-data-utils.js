// Pure master-data normalization helpers shared by IPSRS frontend modules.
(function(global){
  'use strict';

  function getAreaKerjaGroup_(name){
    const n=String(name||'').trim();
    if(/^m\.e\b/i.test(n)) return 'M.E.';
    if(/^sipil\b/i.test(n)) return 'SIPIL';
    if(/^elektromedik\b/i.test(n)) return 'ELEKTROMEDIK';
    if(/^kesling\b/i.test(n)) return 'KESLING';
    // Normalize spaces and punctuation so equivalent master-data labels stay grouped.
    const compact=n.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(compact.includes('ceklistutilitas') || compact.includes('ceklistmeutiliti')) return 'CEK LIST UTILITAS';
    if(compact === 'administrasiipsrs') return 'ADMINISTRASI IPSRS';
    if(compact === 'rapatpertemuan') return 'RAPAT/PERTEMUAN';
    if(compact.includes('arearuangpanellvmdvlantai1') || compact.includes('ceklistlvmdp')) return 'CEK LIST LVMDP';
    if(/^kitchen\b/i.test(n)) return 'KITCHEN / DAPUR';
    return 'LAINNYA';
  }

  global.getAreaKerjaGroup_ = getAreaKerjaGroup_;
})(window);
