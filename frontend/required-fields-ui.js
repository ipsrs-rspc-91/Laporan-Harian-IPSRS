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
    const isModalProxy = el.id==='KategoriModalTrigger' ||
      el.id==='areaKerjaPicker' || el.classList.contains('area-picker-trigger') ||
      el.id==='TanggalWaktuDisplay' || el.classList.contains('status-choice-group') ||
      el.classList.contains('spmu-choice-group');
    if(!isModalProxy && !el.matches('input,textarea,select')) return;

    // Nilai data adalah satu-satunya penentu status "terisi".
    // Fokus/tap tidak boleh meninggalkan status hijau pada field kosong.
    const filled = hasFieldValue(el);
    setClass(el, 'ipsrs-field-filled', filled);

    // Tombol pembuka modal sering tetap menjadi activeElement setelah modal
    // ditutup (termasuk tombol Back Android). Jangan anggap itu sebagai field
    // yang sedang diketik; warna proxy mengikuti nilai yang benar-benar dipilih.
    const focused = !isModalProxy && document.activeElement === el;
    setClass(el, 'ipsrs-field-focused', focused);
  }

  function initFieldColorStates(){
    const page=document.getElementById('page-input');
    if(!page || page.dataset.ipsrsFieldColorsBound) return;
    page.dataset.ipsrsFieldColorsBound='1';

    const refresh=()=>{
      // Ambil elemen proxy terbaru setiap refresh karena picker dapat dibangun ulang.
      page.querySelectorAll('input,textarea,select').forEach(syncFieldColor);
      [
        document.getElementById('KategoriModalTrigger'),
        document.getElementById('areaKerjaPicker'),
        document.getElementById('TanggalWaktuDisplay'),
        page.querySelector('.status-choice-group'),
        page.querySelector('.spmu-choice-group'),
        page.querySelector('.area-picker-trigger')
      ].filter(Boolean).forEach(syncFieldColor);
    };
    const scheduleRefresh=()=>requestAnimationFrame(refresh);

    page.addEventListener('focusin',scheduleRefresh);
    page.addEventListener('focusout',scheduleRefresh);
    page.addEventListener('input',scheduleRefresh);
    page.addEventListener('change',scheduleRefresh);

    // Tutup modal native/browser dapat tidak menghasilkan click atau keydown
    // (terutama tombol Back Android). Pantau perubahan status modal, bukan hanya
    // perubahan isi #page-input, lalu hitung ulang kelas warna berdasarkan nilai.
    const modalIds = new Set([
      'areaItemPickerModalBg',
      'ipsrsKategoriModalRoot','ipsrsKategoriModal1','ipsrsKategoriModal2','ipsrsKategoriModal3',
      'datetimePickerBackdrop','sparePartUnitModal','requiredFieldsModalBg'
    ]);
    let modalRefreshQueued = false;
    const modalObserver = new MutationObserver(mutations=>{
      const relevant = mutations.some(m=>{
        const target = m.target;
        if(!target || target.nodeType !== 1 || !modalIds.has(target.id)) return false;
        if(m.attributeName === 'hidden') return true;
        if(m.attributeName === 'class'){
          const before = String(m.oldValue || '');
          const after = String(target.className || '');
          return before.split(/\\s+/).includes('show') !== after.split(/\\s+/).includes('show') ||
            before.split(/\\s+/).includes('hidden') !== after.split(/\\s+/).includes('hidden');
        }
        return false;
      });
      if(!relevant || modalRefreshQueued) return;
      modalRefreshQueued = true;
      requestAnimationFrame(()=>{ modalRefreshQueued=false; refresh(); });
    });
    modalObserver.observe(document.body,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class','hidden']});

    // Klik penutup modal berada di luar #page-input. Sinkronkan setelah modal
    // ditutup agar field kosong langsung kembali putih, tanpa mengubah nilainya.
    document.addEventListener('click',scheduleRefresh,true);
    document.addEventListener('pointerup',scheduleRefresh,true);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' || e.key==='Backspace') scheduleRefresh();
    },true);
    document.addEventListener('keyup',e=>{
      if(e.key==='Escape' || e.key==='Backspace') scheduleRefresh();
    },true);
    window.addEventListener('popstate',scheduleRefresh);
    window.addEventListener('hashchange',scheduleRefresh);
    window.addEventListener('pageshow',scheduleRefresh);
    window.addEventListener('focus',scheduleRefresh);
    document.addEventListener('visibilitychange',scheduleRefresh);

    // Dipanggil eksplisit oleh fungsi penutup modal. Tetap gunakan sumber nilai
    // native agar membuka/menutup modal tanpa memilih tidak pernah menjadi hijau.
    window.__ipsrsRefreshFieldColors = refresh;

    // Pantau field yang dibuat ulang di dalam formulir.
    let refreshQueued = false;
    const observer=new MutationObserver(()=>{
      if(refreshQueued) return;
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
