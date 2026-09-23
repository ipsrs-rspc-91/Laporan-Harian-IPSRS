/* Required-field visual indicator for IPSRS input form.
 * Visual only: does not alter validation, payload, API, or database logic.
 */
(function(){
  'use strict';

  const REQUIRED_IDS = ['Ruang','MasalahKegiatan','Tindakan','Kategori','AreaKerja','Item'];
  const DYNAMIC_IDS = ['SparePartUnit','Type','Jumlah'];

  function fieldBox(id){
    const el = document.getElementById(id);
    if(!el) return null;
    if(id === 'Tanggal'){
      return document.getElementById('TanggalWaktuDisplay');
    }
    if(id === 'Pukul'){
      return document.getElementById('TanggalWaktuDisplay');
    }
    if(id === 'Status'){
      return document.querySelector('#page-input .status-choice-group');
    }
    return el;
  }

  function setRequiredVisual(id, required){
    const el = fieldBox(id);
    if(!el) return;
    el.classList.toggle('ipsrs-required-field', !!required);
    el.setAttribute('aria-required', required ? 'true' : 'false');

    const label = document.querySelector('label[for="' + id + '"]');
    if(label) label.classList.toggle('ipsrs-required-label', !!required);
  }

  function isReplacementCategory(){
    const sel = document.getElementById('Kategori');
    const value = sel ? String(sel.value || '').trim() : '';

    // Harus sama persis dengan daftar kategori resmi di backend.
    // Jangan menggunakan pencarian kata "baru" karena dapat memicu
    // field wajib pada kategori lain yang kebetulan mengandung kata tersebut.
    const normalized = value.replace(/\s+/g, ' ').toUpperCase();
    const requiredNewCategories = new Set([
      'PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART BARU',
      'PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART BARU',
      'PERBAIKAN DENGAN PENGGANTIAN SPARE PART BARU',
      'PENGGANTIAN ATAU PEMASANGAN UNIT /ALAT BARU (PERBAIKAN ATAU PASANG BARU)'
    ]);
    return requiredNewCategories.has(normalized);
  }

  function updateRequiredFieldVisuals(){
    // Field yang selalu wajib sesuai validateInputPayload().
    setRequiredVisual('Tanggal', true);
    setRequiredVisual('Pukul', true);
    setRequiredVisual('Ruang', true);
    setRequiredVisual('MasalahKegiatan', true);
    setRequiredVisual('Tindakan', true);
    setRequiredVisual('Status', true);
    setRequiredVisual('Kategori', true);
    setRequiredVisual('AreaKerja', true);
    setRequiredVisual('Item', true);

    // Field penggantian hanya wajib pada kategori yang memang menyatakan
    // ada Spare Part Baru / Unit Baru.
    const replacement = isReplacementCategory();
    DYNAMIC_IDS.forEach(id => setRequiredVisual(id, replacement));
  }

  function init(){
    updateRequiredFieldVisuals();

    const kategori = document.getElementById('Kategori');
    if(kategori && !kategori.dataset.ipsrsRequiredVisualBound){
      kategori.addEventListener('change', updateRequiredFieldVisuals);
      kategori.dataset.ipsrsRequiredVisualBound = '1';
    }

    // Page Input dapat di-remount. Amati hanya area form agar ringan.
    let visualUpdateQueued = false;
    const observer = new MutationObserver(function(mutations){
      // Page Input dapat di-remount. Jangan menjalankan update untuk setiap
      // perubahan DOM global; cukup jadwalkan satu update per frame dan hanya
      // jika mutasi memang menyentuh area form input.
      const pageInput = document.getElementById('page-input');
      if(!pageInput) return;
      const relevant = mutations.some(function(m){
        return pageInput.contains(m.target) ||
          Array.from(m.addedNodes || []).some(function(n){
            return n.nodeType === 1 && (n === pageInput || pageInput.contains(n));
          });
      });
      if(!relevant || visualUpdateQueued) return;
      visualUpdateQueued = true;
      requestAnimationFrame(function(){
        visualUpdateQueued = false;
        updateRequiredFieldVisuals();
        const sel = document.getElementById('Kategori');
        if(sel && !sel.dataset.ipsrsRequiredVisualBound){
          sel.addEventListener('change', updateRequiredFieldVisuals);
          sel.dataset.ipsrsRequiredVisualBound = '1';
        }
      });
    });
    observer.observe(document.body, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }

  window.updateRequiredFieldVisuals = updateRequiredFieldVisuals;
})();
