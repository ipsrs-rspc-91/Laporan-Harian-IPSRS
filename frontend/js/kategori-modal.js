/* ============================================================
   KATEGORI PEMELIHARAAN — modal bertahap
   Build: 20261010-KATEGORI-RESTORE1
   Tidak mengubah data laporan lama.
   ============================================================ */
(function(){
  'use strict';

  const BUILD = '20261010-KATEGORI-RESTORE1';
  const BASE = 'PEMELIHARAAN';
  const REPAIR = 'PERBAIKAN';
  const FINAL = {
    terjadwal_tanpa: 'PEMELIHARAAN RUTIN SESUAI JADWAL',
    terjadwal_dengan: 'PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT',
    luar_tanpa: 'PEMELIHARAAN DILUAR JADWAL RUTIN',
    luar_dengan: 'PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT'
  };

  let originalHandleKategoriChange = null;
  let currentSchedule = '';

  function kategoriModalEsc(v){
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function injectStyles(){
    if(document.getElementById('ipsrs-kategori-modal-style')) return;
    const style = document.createElement('style');
    style.id = 'ipsrs-kategori-modal-style';
    style.textContent = `
      #ipsrsKategoriModalRoot, #ipsrsKategoriModal1, #ipsrsKategoriModal2, #ipsrsKategoriModal3{
        position:fixed; inset:0; z-index:10120; display:none;
        align-items:center; justify-content:center; padding:18px;
        background:rgba(15,23,42,.48);
        backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
      }
      #ipsrsKategoriModalRoot.show, #ipsrsKategoriModal1.show, #ipsrsKategoriModal2.show, #ipsrsKategoriModal3.show{display:flex;}
      .ipsrs-kat-modal{
        width:min(430px,100%); background:#fff; border:1px solid #e2e8f0;
        border-radius:20px; overflow:hidden;
        box-shadow:0 24px 70px rgba(15,23,42,.26);
        animation:ipsrsKatIn .18s ease-out;
      }
      /* Modal kategori utama: batasi tinggi dan gulir daftar secara vertikal. */
      #ipsrsKategoriModalRoot .ipsrs-kat-modal{
        display:flex;flex-direction:column;
        max-height:calc(100vh - 36px);
        max-height:calc(100dvh - 36px);
        min-height:0;
      }
      #ipsrsKategoriModalRoot .ipsrs-kat-body{
        min-height:0;overflow-y:auto;overflow-x:hidden;
        overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
        scrollbar-width:thin;scrollbar-color:#94a3b8 #f1f5f9;
      }
      #ipsrsKategoriModalRoot .ipsrs-kat-body::-webkit-scrollbar{width:7px}
      #ipsrsKategoriModalRoot .ipsrs-kat-body::-webkit-scrollbar-track{background:#f1f5f9;border-radius:8px}
      #ipsrsKategoriModalRoot .ipsrs-kat-body::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:8px}

      @keyframes ipsrsKatIn{
        from{opacity:0;transform:translateY(8px) scale(.985)}
        to{opacity:1;transform:translateY(0) scale(1)}
      }
      .ipsrs-kat-head{
        position:relative;
        display:block;
        padding:18px 58px 12px;
        text-align:center;
      }
      .ipsrs-kat-head > div:first-child{
        width:100%;
        text-align:center;
      }
      .ipsrs-kat-title{font-size:18px;font-weight:800;color:#0f172a}
      .ipsrs-kat-sub{font-size:12px;color:#64748b;margin-top:4px}
      .ipsrs-kat-close{
        position:absolute;
        top:18px;
        right:20px;
        width:34px;height:34px;border:0;border-radius:9px;background:#f8fafc;
        color:#475569;font-size:23px;line-height:1;cursor:pointer;
      }
      .ipsrs-kat-close:hover{background:#f1f5f9}
      .ipsrs-kat-body{padding:8px 20px 20px}
      .ipsrs-kat-info{
        padding:12px 14px;margin-bottom:14px;border:1px solid #dbeafe;
        background:#eff6ff;border-radius:12px;color:#1e3a8a;
        font-size:13px;line-height:1.5;
      }
      /* =========================================================
         MODAL PEMELIHARAAN — elegant card layout
         ========================================================= */
      #ipsrsKategoriModal1 .ipsrs-kat-modal{
        width:min(440px,100%);
        background:#fff;
        border:1px solid #e2e8f0;
        border-radius:22px;
        overflow:hidden;
        box-shadow:0 24px 70px rgba(15,23,42,.28);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-head{
        display:block;
        padding:20px 58px 14px;
        text-align:center;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-head > div:first-child{width:100%;text-align:center}
      #ipsrsKategoriModal1 .ipsrs-kat-title{font-size:20px;font-weight:800;color:#0f172a}
      #ipsrsKategoriModal1 .ipsrs-kat-sub{font-size:12px;color:#64748b;margin-top:4px}
      #ipsrsKategoriModal1 .ipsrs-kat-close{
        top:18px;right:18px;width:36px;height:36px;border-radius:11px;
        background:#f8fafc;color:#475569;font-size:23px;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-body{padding:8px 18px 18px}
      #ipsrsKategoriModal1 .ipsrs-kat-layout{display:flex;flex-direction:column;gap:14px}
      #ipsrsKategoriModal1 .ipsrs-kat-block{
        display:grid;grid-template-columns:1fr;grid-template-rows:auto auto;
        min-height:0;border-radius:17px;overflow:hidden;position:relative;
        box-shadow:0 6px 18px rgba(15,23,42,.09);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.green{
        background:linear-gradient(145deg,#f3fbef 0%,#e4f6dc 100%);
        border:2.5px solid #8fd17f;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.yellow{
        background:linear-gradient(145deg,#fffbed 0%,#fff2bf 100%);
        border:2.5px solid #e0b93f;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block::before{
        display:flex;align-items:center;justify-content:center;
        grid-column:1;grid-row:1;
        min-height:48px;
        padding:10px 15px;
        font-size:15px;font-weight:850;letter-spacing:.25px;
        line-height:1.2;text-align:center;
        text-transform:uppercase;
        border-bottom:1px solid rgba(71,85,105,.14);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.green::before{
        content:"PEMELIHARAAN RUTIN SESUAI JADWAL";
        color:#166534;background:rgba(255,255,255,.32);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.yellow::before{
        content:"PEMELIHARAAN DI LUAR JADWAL RUTIN";
        color:#9a6700;background:rgba(255,255,255,.28);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice{
        min-width:0;min-height:55px;width:calc(100% - 24px);height:auto;
        margin:8px 12px;padding:10px 14px;
        border:1px solid rgba(100,116,139,.28);
        border-radius:13px;
        display:flex;align-items:center;justify-content:flex-start;
        text-align:left;background:rgba(255,255,255,.42);
        box-shadow:0 2px 7px rgba(15,23,42,.045);
        font-family:Arial,sans-serif;cursor:pointer;
        transition:background .14s ease,border-color .14s ease,box-shadow .14s ease,transform .14s ease;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:first-of-type,
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:nth-of-type(2){
        grid-column:1;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:first-of-type{
        grid-row:2;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:nth-of-type(2){
        grid-row:3;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice:hover{
        background:rgba(255,255,255,.78);
        border-color:rgba(37,99,235,.42);
        box-shadow:0 4px 12px rgba(15,23,42,.08);
        filter:none;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice:active{transform:scale(.99)}
      #ipsrsKategoriModal1 .ipsrs-kat-choice::before{
        width:32px;height:32px;flex:0 0 32px;
        display:flex;align-items:center;justify-content:center;
        margin-right:11px;border-radius:50%;
        background:rgba(255,255,255,.78);
        font-size:16px;font-weight:800;
        box-shadow:0 2px 7px rgba(15,23,42,.08);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.green>.ipsrs-kat-choice:first-of-type::before{
        content:"✓";color:#15803d;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.green>.ipsrs-kat-choice:nth-of-type(2)::before{
        content:"⚙";color:#0875d1;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.yellow>.ipsrs-kat-choice:first-of-type::before{
        content:"✓";color:#b36a00;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.yellow>.ipsrs-kat-choice:nth-of-type(2)::before{
        content:"⚙";color:#0875d1;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice-title{
        display:block;font-size:13px;line-height:1.3;font-weight:750;color:#172033;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.green>.ipsrs-kat-choice:nth-of-type(2) .ipsrs-kat-choice-title,
      #ipsrsKategoriModal1 .ipsrs-kat-block.yellow>.ipsrs-kat-choice:nth-of-type(2) .ipsrs-kat-choice-title{
        color:#006bd6;
      }
      @media(max-width:480px){
        #ipsrsKategoriModal1 .ipsrs-kat-modal{width:100%;max-width:calc(100vw - 28px);border-radius:20px}
        #ipsrsKategoriModal1 .ipsrs-kat-head{padding:18px 54px 12px}
        #ipsrsKategoriModal1 .ipsrs-kat-body{padding:6px 14px 14px}
        #ipsrsKategoriModal1 .ipsrs-kat-block::before{
          min-height:52px;padding:10px 12px;font-size:15px;
          text-align:center;line-height:1.2;
        }
        #ipsrsKategoriModal1 .ipsrs-kat-choice{
          min-height:54px;width:calc(100% - 20px);margin:7px 10px;padding:9px 11px;
          border-radius:12px;
        }
        #ipsrsKategoriModal1 .ipsrs-kat-choice-title{font-size:13px}
      }
      #ipsrsKategoriModalRoot .ipsrs-kat-add{
        width:100%;min-height:48px;margin-top:2px;padding:11px 14px;
        border:1px dashed #2563eb;border-radius:12px;background:#eff6ff;
        color:#1d4ed8;text-align:center;font:inherit;font-weight:800;
        cursor:pointer;transition:.15s ease;
      }
      #ipsrsKategoriModalRoot .ipsrs-kat-add:hover{background:#dbeafe;border-color:#1d4ed8}
      .ipsrs-kat-choice{
        width:100%; min-height:58px; margin:0 0 10px; padding:11px 14px;
        border:1px solid #cbd5e1; border-radius:12px; background:#fff;
        color:#0f172a; text-align:left; font:inherit; font-weight:750;
        cursor:pointer; transition:.15s ease;
      }
      .ipsrs-kat-choice:hover{
        border-color:#2563eb; background:#f8fbff;
        box-shadow:0 0 0 2px rgba(37,99,235,.07);
      }
      .ipsrs-kat-choice:last-child{margin-bottom:0}
      .ipsrs-kat-choice-title{display:block;font-size:14px}
      #ipsrsKategoriModal3 .ipsrs-kat-choice:first-child{
        text-align:center;justify-content:center;
        background:#f0fdf4;
        border-color:#86efac;
      }
      #ipsrsKategoriModal3 .ipsrs-kat-choice:first-child .ipsrs-kat-choice-title{
        color:#15803d;
        text-align:center;
        width:100%;
      }
      #ipsrsKategoriModal3 .ipsrs-kat-choice:nth-of-type(2){
        text-align:center;
        justify-content:center;
      }
      #ipsrsKategoriModal3 .ipsrs-kat-choice:nth-of-type(2) .ipsrs-kat-choice-title{
        color:#006bd6;
        text-align:center;
        width:100%;
      }
      #ipsrsKategoriModal3 .ipsrs-kat-choice:nth-of-type(2){
        background:#eff6ff;
        border-color:#93c5fd;
      }
      #ipsrsKategoriModal3 .ipsrs-kat-choice:nth-of-type(2):hover{
        background:#dbeafe;
        border-color:#60a5fa;
      }
      .ipsrs-kat-choice-desc{display:block;font-size:11px;color:#64748b;font-weight:500;margin-top:3px}
      .ipsrs-kat-footer{
        display:flex;justify-content:flex-end;gap:8px;padding:0 20px 18px;
      }
      .ipsrs-kat-cancel{
        min-height:40px;padding:0 15px;border:1px solid #cbd5e1;border-radius:10px;
        background:#fff;color:#334155;font:inherit;font-weight:700;cursor:pointer;
      }
      @media(max-width:480px){
        #ipsrsKategoriModal1,#ipsrsKategoriModal2,#ipsrsKategoriModal3{padding:14px}
        .ipsrs-kat-modal{border-radius:18px}
        .ipsrs-kat-head{padding:16px 58px 10px}
        .ipsrs-kat-close{top:16px;right:16px}
        .ipsrs-kat-body{padding:8px 16px 16px}
        .ipsrs-kat-footer{padding:0 16px 16px}
        .ipsrs-kat-choice{min-height:56px}
      }
    `;
    document.head.appendChild(style);
  }

  function injectModal(id, title, subtitle, bodyHtml, footerHtml){
    if(document.getElementById(id)) return;
    const bg = document.createElement('div');
    bg.id = id;
    bg.setAttribute('role','dialog');
    bg.setAttribute('aria-modal','true');
    bg.innerHTML = `
      <div class="ipsrs-kat-modal">
        <div class="ipsrs-kat-head">
          <div>
            <div class="ipsrs-kat-title">${kategoriModalEsc(title)}</div>
            <div class="ipsrs-kat-sub">${kategoriModalEsc(subtitle)}</div>
          </div>
          <button type="button" class="ipsrs-kat-close" aria-label="Tutup" data-kat-close>×</button>
        </div>
        <div class="ipsrs-kat-body">${bodyHtml}</div>
        ${footerHtml ? '<div class="ipsrs-kat-footer">'+footerHtml+'</div>' : ''}
      </div>`;
    bg.addEventListener('click', function(e){
      if(e.target === bg || e.target.closest('[data-kat-close]')) cancelKategoriFlow();
    });
    document.body.appendChild(bg);
  }

  function buildModals(){
    injectStyles();
    injectModal(
      'ipsrsKategoriModalRoot',
      'KATEGORI',
      'Pilih kategori pekerjaan',
      `
        <div class="ipsrs-kat-layout" data-kat-master-list>
          <div class="ipsrs-kat-info">Memuat kategori dari Supabase…</div>
          <button type="button" class="ipsrs-kat-add" data-kat-add-new>＋ TAMBAH KATEGORI</button>
        </div>`,
      ''
    );

    injectModal(
      'ipsrsKategoriModal1',
      'PEMELIHARAAN',
      'Pilih jenis pemeliharaan',
      `
        <div class="ipsrs-kat-layout">
          <div class="ipsrs-kat-block green">
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="terjadwal-tanpa">
              <span class="ipsrs-kat-choice-title">PEMELIHARAAN SAJA</span>
            </button>
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="terjadwal-dengan">
              <span class="ipsrs-kat-choice-title">DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT</span>
            </button>
          </div>

          <div class="ipsrs-kat-block yellow">
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="luar-tanpa">
              <span class="ipsrs-kat-choice-title">PEMELIHARAAN SAJA</span>
            </button>
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="luar-dengan">
              <span class="ipsrs-kat-choice-title">DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT</span>
            </button>
          </div>
        </div>`,
      ''
    );

    injectModal(
      'ipsrsKategoriModal2',
      'PENGGANTIAN SPARE PART / MATERIAL / UNIT',
      'Tentukan apakah ada penggantian',
      `
        <div class="ipsrs-kat-info" id="ipsrsKategoriModal2Info">Pilih salah satu pilihan berikut.</div>
        <button type="button" class="ipsrs-kat-choice" data-kat-replace="tanpa">
          <span class="ipsrs-kat-choice-title">TANPA PENGGANTIAN SPARE PART / MATERIAL / UNIT</span>
          <span class="ipsrs-kat-choice-desc">Tidak ada spare part atau material yang diganti.</span>
        </button>
        <button type="button" class="ipsrs-kat-choice" data-kat-replace="dengan">
          <span class="ipsrs-kat-choice-title">DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT</span>
          <span class="ipsrs-kat-choice-desc">Ada spare part/material/unit yang diganti atau digunakan.</span>
        </button>`,
      '<button type="button" class="ipsrs-kat-cancel" data-kat-back>Kembali</button>'
    );

    injectModal(
      'ipsrsKategoriModal3',
      'PERBAIKAN',
      '',
      `
        <button type="button" class="ipsrs-kat-choice" data-kat-repair="tanpa">
          <span class="ipsrs-kat-choice-title">PERBAIKAN SAJA</span>
        </button>
        <button type="button" class="ipsrs-kat-choice" data-kat-repair="dengan">
          <span class="ipsrs-kat-choice-title">PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT</span>
        </button>`,
      ''
    );

    const root = document.getElementById('ipsrsKategoriModalRoot');
    if(root && !root.__ipsrsDelegatedCategoryEvents){
      root.addEventListener('click', function(event){
        const addBtn = event.target && event.target.closest ? event.target.closest('[data-kat-add-new]') : null;
        if(addBtn){
          root.classList.remove('show');
          const sel = document.getElementById('Kategori');
          const addNewOption = sel && Array.from(sel.options).find(o => o.value === '__ADD_NEW__' || o.value === '__TAMBAH_KATEGORI_BARU__' || /Tambah Kategori Baru/i.test(o.textContent || ''));
          if(addNewOption){
            sel.value = addNewOption.value;
            sel.dispatchEvent(new Event('change',{bubbles:true}));
          } else if(typeof window.__ipsrsOpenTambahKategoriModal === 'function'){
            window.__ipsrsOpenTambahKategoriModal();
          } else {
            window.alert('Fitur tambah kategori belum tersedia pada halaman ini.');
          }
          return;
        }
        const btn = event.target && event.target.closest ? event.target.closest('[data-kat-root]') : null;
        if(!btn || !root.contains(btn)) return;
        const value = btn.dataset.katRoot || '';
        root.classList.remove('show');
        if(value === BASE){ openScheduleModal(); return; }
        if(value === REPAIR){
          const repair = document.getElementById('ipsrsKategoriModal3');
          if(repair) repair.classList.add('show');
          return;
        }
        finishKategori(value);
      });
      root.__ipsrsDelegatedCategoryEvents = true;
    }

    document.querySelectorAll('[data-kat-direct]').forEach(btn => {
      btn.addEventListener('click', function(){
        const map = {
          'terjadwal-tanpa': FINAL.terjadwal_tanpa,
          'terjadwal-dengan': FINAL.terjadwal_dengan,
          'luar-tanpa': FINAL.luar_tanpa,
          'luar-dengan': FINAL.luar_dengan
        };
        const value = map[this.dataset.katDirect];
        if(value) finishKategori(value);
      });
    });

    document.querySelectorAll('[data-kat-repair]').forEach(btn => {
      btn.addEventListener('click', function(){
        const value = this.dataset.katRepair === 'dengan'
          ? 'PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT'
          : 'PERBAIKAN SAJA';
        finishKategori(value);
      });
    });

    document.querySelectorAll('[data-kat-replace]').forEach(btn => {
      btn.addEventListener('click', function(){
        const replace = this.dataset.katReplace || '';
        let value = '';
        if(currentSchedule === 'terjadwal'){
          value = replace === 'dengan' ? FINAL.terjadwal_dengan : FINAL.terjadwal_tanpa;
        }else if(currentSchedule === 'luar'){
          value = replace === 'dengan' ? FINAL.luar_dengan : FINAL.luar_tanpa;
        }
        if(value) finishKategori(value);
      });
    });

    const back = document.querySelector('[data-kat-back]');
    if(back) back.addEventListener('click', function(){
      document.getElementById('ipsrsKategoriModal2').classList.remove('show');
      document.getElementById('ipsrsKategoriModal1').classList.add('show');
    });
  }

  function openScheduleModal(){
    buildModals();
    document.getElementById('ipsrsKategoriModal2').classList.remove('show');
    document.getElementById('ipsrsKategoriModal3').classList.remove('show');
    document.getElementById('ipsrsKategoriModal1').classList.add('show');
  }

  function cancelKategoriFlow(){
    ['ipsrsKategoriModalRoot','ipsrsKategoriModal1','ipsrsKategoriModal2','ipsrsKategoriModal3'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.remove('show');
    });
    currentSchedule = '';
    const sel = document.getElementById('Kategori');
    if(sel) sel.value = '';
  }

  function finishKategori(value){
    ['ipsrsKategoriModal1','ipsrsKategoriModal2','ipsrsKategoriModal3'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.remove('show');
    });
    currentSchedule = '';
    const sel = document.getElementById('Kategori');
    if(!sel) return;
    let opt = Array.from(sel.options).find(o => o.value === value);
    if(!opt){
      opt = document.createElement('option');
      opt.value = value;
      opt.innerText = value;
      sel.appendChild(opt);
    }
    sel.value = value;
    if(typeof window.syncSparePartSection === 'function') window.syncSparePartSection();
    sel.dispatchEvent(new Event('input',{bubbles:true}));
    sel.dispatchEvent(new Event('change',{bubbles:true}));
    syncKategoriModalTrigger();
  }

  // Kategori induk PEMELIHARAAN sudah dibuat oleh app.js.
  // Modal tidak boleh menambahkan option kedua karena dapat menyebabkan
  // duplikasi ketika kategori-modal.js berjalan sebelum populateStaticSelects().
  function ensureBaseOption(){
    const sel = document.getElementById('Kategori');
    return !!sel;
  }

  function syncKategoriModalTrigger(){
    const sel = document.getElementById('Kategori');
    const btn = document.getElementById('KategoriModalTrigger');
    const txt = document.getElementById('KategoriModalTriggerText');
    if(!sel || !btn || !txt) return;
    const value = String(sel.value || '').trim();
    txt.textContent = value || 'Pilih kategori…';
    btn.setAttribute('aria-expanded','false');
    btn.classList.toggle('ipsrs-required-field', !value && sel.classList.contains('ipsrs-required-field'));
  }

  async function refreshRootCategoriesFromMaster(){
    const root = document.getElementById('ipsrsKategoriModalRoot');
    const layout = root && root.querySelector('[data-kat-master-list]');
    if(!layout) return false;
    const addMarkup = '<button type="button" class="ipsrs-kat-add" data-kat-add-new>＋ TAMBAH KATEGORI</button>';
    try{
      if(typeof window.__ipsrsGetMasterKategori !== 'function'){
        layout.innerHTML = '<div class="ipsrs-kat-info">Sumber master kategori belum tersedia. Tutup lalu buka kembali setelah aplikasi siap.</div>'+addMarkup;
        return false;
      }
      const result = await window.__ipsrsGetMasterKategori();
      if(!result || !result.ok || !Array.isArray(result.kategori)){
        layout.innerHTML = '<div class="ipsrs-kat-info">Gagal memuat kategori dari Supabase. Tidak menggunakan daftar cadangan agar data tidak rancu.</div>'+addMarkup;
        return false;
      }
      // Modal kategori hanya menampilkan 12 kategori induk kanonis.
      // Master kategori lama dinonaktifkan di Supabase dan tidak boleh
      // muncul lagi hanya karena pernah tersimpan pada data historis.
      const allowed = [
        'PEMELIHARAAN','PERBAIKAN','PEMERIKSAAN / INSPEKSI','MONITORING',
        'PERMINTAAN LAYANAN','PERTEMUAN / KOORDINASI','ADMINISTRASI / MANAJEMEN',
        'KUNJUNGAN','PENGUJIAN / ANALISA','PELATIHAN','PROYEK / RENOVASI','LAINNYA'
      ];
      const source = result.kategori.map(v=>String(v||'').trim()).filter(Boolean);
      const sourceSet = new Set(source.map(v=>v.toLocaleUpperCase('id')));
      const values = allowed.filter(v=>sourceSet.has(v.toLocaleUpperCase('id')));
      const buttons = values.map(v=>'<button type="button" class="ipsrs-kat-choice" data-kat-root="'+kategoriModalEsc(v)+'"><span class="ipsrs-kat-choice-title">'+kategoriModalEsc(v)+'</span></button>').join('');
      layout.innerHTML = buttons + addMarkup;
      return true;
    }catch(err){
      layout.innerHTML = '<div class="ipsrs-kat-info">Gagal memuat kategori dari Supabase. Silakan coba lagi.</div>'+addMarkup;
      return false;
    }
  }

  function openKategoriRootModal(){
    buildModals();
    const root = document.getElementById('ipsrsKategoriModalRoot');
    if(root) root.classList.add('show');
    refreshRootCategoriesFromMaster();
  }

  function kategoriModalInstall(){
    const sel = document.getElementById('Kategori');
    const btn = document.getElementById('KategoriModalTrigger');
    if(!sel || !btn) return false;

    buildModals();
    ensureBaseOption();
    syncKategoriModalTrigger();

    if(!btn.__ipsrsKategoriModalClick){
      btn.addEventListener('click', function(){
        openKategoriRootModal();
      });
      btn.__ipsrsKategoriModalClick = true;
    }

    if(!sel.__ipsrsKategoriModalCapture){
      const modalChangeHandler = function(event){
        const currentSel = document.getElementById('Kategori');
        if(!currentSel) return;

        const value = String(currentSel.value || '').trim();
        if(value === BASE){
          event.preventDefault();
          event.stopImmediatePropagation();
          currentSel.value = '';
          openScheduleModal();
          return;
        }

        if(value === REPAIR){
          event.preventDefault();
          event.stopImmediatePropagation();
          currentSel.value = '';
          buildModals();
          ['ipsrsKategoriModal1','ipsrsKategoriModal2'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.remove('show');
          });
          const repairModal = document.getElementById('ipsrsKategoriModal3');
          if(repairModal) repairModal.classList.add('show');
        }
      };

      sel.addEventListener('change', modalChangeHandler, true);
      sel.__ipsrsKategoriModalCapture = modalChangeHandler;
    }

    return true;
  }

  function kategoriModalBoot(){
    let tries = 0;
    const timer = setInterval(function(){
      tries++;
      if(kategoriModalInstall() || tries >= 60) clearInterval(timer);
    }, 100);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kategoriModalBoot, {once:true});
  else kategoriModalBoot();

  // Expose the opener globally so the Form Input trigger remains clickable
  // even if the deferred installer is delayed by another startup script.
  window.__ipsrsOpenKategoriModal = function(){
    openKategoriRootModal();
  };
  window.__ipsrsSyncKategoriModalTrigger = syncKategoriModalTrigger;
  window.__ipsrsKategoriModalBuild = BUILD;
})();