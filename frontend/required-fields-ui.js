/* Required-field visual indicator for IPSRS input form.
 * Visual only: does not alter validation, payload, API, or database logic.
 */
(function(){
  'use strict';

  const REQUIRED_IDS = ['Ruang','MasalahKegiatan','Tindakan','Kategori','AreaKerja','Item'];
  const DYNAMIC_IDS = ['SparePartUnitKind','SparePartUnitStatus','SparePartUnit','Type','Jumlah'];

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

  // Mutasi DOM hanya dilakukan bila nilai benar-benar berubah.
  function setClass(el, name, on){
    if(!el || !el.classList) return;
    const shouldHave = !!on;
    if(el.classList.contains(name) !== shouldHave){
      el.classList.toggle(name, shouldHave);
    }
  }

  function setAttr(el, name, value){
    if(el && el.getAttribute(name) !== String(value)){
      el.setAttribute(name, String(value));
    }
  }

  function setRequiredVisual(id, required){
    const el = fieldBox(id);
    if(!el) return;
    setClass(el, 'ipsrs-required-field', required);
    setAttr(el, 'aria-required', required ? 'true' : 'false');

    if(id === 'AreaKerja'){
      const picker = document.getElementById('areaKerjaPicker');
      if(picker) setClass(picker, 'ipsrs-required-field', required);
    }
    if(id === 'Kategori'){
      // #Kategori adalah select native tersembunyi; border merah wajib
      // dipasang pada tombol picker yang benar-benar terlihat.
      const picker = document.getElementById('KategoriModalTrigger');
      if(picker) setClass(picker, 'ipsrs-required-field', required);
    }

    const label = document.querySelector('label[for="' + id + '"]');
    if(label) setClass(label, 'ipsrs-required-label', required);
  }

  function isReplacementCategory(){
    const sel = document.getElementById('Kategori');
    const value = sel ? String(sel.value || '').trim() : '';

    // Harus sama persis dengan daftar kategori resmi di backend.
    // Jangan menggunakan pencarian kata "baru" karena dapat memicu
    // field wajib pada kategori lain yang kebetulan mengandung kata tersebut.
    const normalized = value.replace(/\s+/g, ' ').toUpperCase();
    const requiredNewCategories = new Set([
      'PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT',
      'PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT',
      'PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT',
      'PENGGANTIAN ATAU PEMASANGAN UNIT / ALAT',
      // Compatibility: historical category values remain valid/readable.
      'PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART / MATERIAL',
      'PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART / MATERIAL',
      'PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL'
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
    const kindEl=document.getElementById('SparePartUnitKind');
    const kind=String(kindEl?.value||'').trim().toUpperCase();
    const state=window.__IPSRS_SPMU_STATE || null;
    const hasUnit=!!(state?.UNIT?.status || state?.UNIT?.name || state?.UNIT?.type || String(state?.UNIT?.qty??'').trim());
    const hasSpare=!!(state?.['SPARE PART / MATERIAL']?.status || state?.['SPARE PART / MATERIAL']?.name || state?.['SPARE PART / MATERIAL']?.type || String(state?.['SPARE PART / MATERIAL']?.qty??'').trim());
    const replacement = isReplacementCategory() || !!kind || hasUnit || hasSpare;
    DYNAMIC_IDS.forEach(id => setRequiredVisual(id, replacement));

  }

  function hasFieldValue(el){
    if(!el) return false;
    if(el.id === 'TanggalWaktuDisplay'){
      return !!(String(document.getElementById('Tanggal')?.value||'').trim() &&
                String(document.getElementById('Pukul')?.value||'').trim());
    }
    if(el.id === 'KategoriModalTrigger'){
      return !!String(document.getElementById('Kategori')?.value||'').trim();
    }
    if(el.id === 'areaKerjaPicker' || el.classList.contains('area-picker-trigger')){
      return !!String(document.getElementById('AreaKerja')?.value||'').trim();
    }
    if(el.classList.contains('status-choice-group')){
      return !!String(document.getElementById('Status')?.value||'').trim();
    }
    if(el.classList.contains('spmu-choice-group')){
      const state=window.__IPSRS_SPMU_STATE||{};
      return Object.values(state).some(v=>v && (String(v.status||'').trim()||String(v.name||'').trim()||String(v.type||'').trim()||String(v.qty??'').trim()));
    }
    if(el.matches('input,textarea,select')){
      if(el.type==='hidden') return !!String(el.value||'').trim();
      return !!String(el.value||'').trim();
    }
    return false;
  }

  function syncFieldColor(el){
    if(!el || !el.classList) return;
    const isProxy = el.id==='KategoriModalTrigger' || el.id==='areaKerjaPicker' ||
      el.id==='TanggalWaktuDisplay' || el.classList.contains('status-choice-group') ||
      el.classList.contains('spmu-choice-group') || el.classList.contains('area-picker-trigger');
    if(!isProxy && !el.matches('input,textarea,select')) return;
    setClass(el, 'ipsrs-field-filled', hasFieldValue(el));
    setClass(el, 'ipsrs-field-focused', document.activeElement === el);
  }

  function initFieldColorStates(){
    const page=document.getElementById('page-input');
    if(!page || page.dataset.ipsrsFieldColorsBound) return;
    page.dataset.ipsrsFieldColorsBound='1';
    const proxies=[
      document.getElementById('KategoriModalTrigger'),
      document.getElementById('areaKerjaPicker'),
      document.getElementById('TanggalWaktuDisplay'),
      page.querySelector('.status-choice-group'),
      page.querySelector('.spmu-choice-group')
    ].filter(Boolean);
    const refresh=()=>{
      page.querySelectorAll('input,textarea,select').forEach(syncFieldColor);
      proxies.forEach(syncFieldColor);
      const areaTrigger=page.querySelector('.area-picker-trigger');
      if(areaTrigger) syncFieldColor(areaTrigger);
    };
    function syncRelatedProxy(target){
      if(!target || !target.closest) return;
      if(target.closest('.spmu-choice-group')){
        const spmuProxy=page.querySelector('.spmu-choice-group');
        if(spmuProxy) syncFieldColor(spmuProxy);
      }
      if(target.id==='Kategori' || target.closest('.kategori-picker-wrap')){
        const kategoriProxy=document.getElementById('KategoriModalTrigger');
        if(kategoriProxy) syncFieldColor(kategoriProxy);
      }
      if(target.id==='AreaKerja' || target.closest('.area-picker-wrap')){
        const areaProxy=document.getElementById('areaKerjaPicker');
        if(areaProxy) syncFieldColor(areaProxy);
      }
    }
    page.addEventListener('focusin',e=>{
      const target=e.target;
      if(target.matches && target.matches('input,textarea,select,[role="button"],button')){
        setClass(target, 'ipsrs-field-focused', true);
        setClass(target, 'ipsrs-field-filled', false);
      }
      syncFieldColor(target);
      syncRelatedProxy(target);
    });
    page.addEventListener('focusout',e=>{
      const target=e.target;
      if(target.matches && target.matches('input,textarea,select,[role="button"],button')){
        setClass(target, 'ipsrs-field-focused', false);
        syncFieldColor(target);
      }
      syncRelatedProxy(target);
    });
    // Saat mengetik, sinkronkan hanya field yang berubah; hindari scan semua field per karakter.
    page.addEventListener('input',e=>{
      const target=e.target;
      syncFieldColor(target);
      if(target && target.closest && target.closest('.spmu-choice-group')){
        const spmuProxy=page.querySelector('.spmu-choice-group');
        if(spmuProxy) syncFieldColor(spmuProxy);
      }
    });
    page.addEventListener('change',e=>{
      syncFieldColor(e.target);
      syncRelatedProxy(e.target);
      // Native select updates can affect visible custom controls.
      if(e.target && (e.target.id==='Kategori' || e.target.id==='AreaKerja' || e.target.id==='Status')){
        proxies.forEach(syncFieldColor);
      }
    });
    page.addEventListener('click',e=>{
      const target=e.target && e.target.closest
        ? e.target.closest('button,[role="button"],input,textarea,select')
        : e.target;
      if(target) syncFieldColor(target);
      syncRelatedProxy(target);
    });
    // Pantau penambahan/penghapusan node saja. Perubahan class visual dibuat oleh
    // refresh() sendiri, sedangkan nilai form diperbarui lewat event input/change.
    // Ini mencegah observer memicu refresh hanya karena kelas visual berubah.
    let refreshQueued = false;
    const observer=new MutationObserver(mutations=>{
      // textContent updates (for example, the Pelapor/No LK status on each
      // keystroke) create text nodes, not form structure. Ignore those so they
      // cannot trigger a full-form scan while the user is typing.
      const hasElementStructureChange = mutations.some(m =>
        Array.from(m.addedNodes || []).some(node => node.nodeType === 1) ||
        Array.from(m.removedNodes || []).some(node => node.nodeType === 1)
      );
      if(!hasElementStructureChange || refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(()=>{ refreshQueued = false; refresh(); });
    });
    observer.observe(page,{childList:true,subtree:true});
    refresh();
  }

  function init(){
    initFieldColorStates();
    updateRequiredFieldVisuals();

    const kategori = document.getElementById('Kategori');
    if(kategori && !kategori.dataset.ipsrsRequiredVisualBound){
      kategori.addEventListener('change', updateRequiredFieldVisuals);
      kategori.dataset.ipsrsRequiredVisualBound = '1';
    }
    const kind=document.getElementById('SparePartUnitKind');
    if(kind && !kind.dataset.ipsrsRequiredVisualBound){
      kind.addEventListener('change', updateRequiredFieldVisuals);
      kind.dataset.ipsrsRequiredVisualBound='1';
    }

    // Page Input dapat di-remount. Amati hanya area form agar ringan.
    let visualUpdateQueued = false;
    const observer = new MutationObserver(function(mutations){
      // Perubahan textContent pada status Pelapor/No LK terjadi tiap karakter.
      // Abaikan text-only mutation; update visual hanya saat struktur elemen
      // form berubah atau Page Input dipasang ulang.
      const pageInput = document.getElementById('page-input');
      if(!pageInput) return;
      const relevant = mutations.some(function(m){
        const elementStructureChanged =
          Array.from(m.addedNodes || []).some(function(n){ return n.nodeType === 1; }) ||
          Array.from(m.removedNodes || []).some(function(n){ return n.nodeType === 1; });
        if(!elementStructureChanged) return false;
        return m.target === pageInput || pageInput.contains(m.target) ||
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
    const pageInputRoot = document.getElementById('page-input');
    if(pageInputRoot) observer.observe(pageInputRoot, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }

  window.updateRequiredFieldVisuals = updateRequiredFieldVisuals;
})();
