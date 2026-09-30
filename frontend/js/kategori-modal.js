/* ============================================================
   KATEGORI PEMELIHARAAN — modal bertahap
   Build: 20260930-KATEGORI-MODAL13
   Tidak mengubah data laporan lama.
   ============================================================ */
(function(){
  'use strict';

  const BUILD = '20260930-KATEGORI-MODAL13';
  const BASE = 'PEMELIHARAAN';
  const REPAIR = 'PERBAIKAN';
  const FINAL = {
    terjadwal_tanpa: 'PEMELIHARAAN RUTIN SESUAI JADWAL',
    terjadwal_dengan: 'PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART BARU',
    luar_tanpa: 'PEMELIHARAAN DILUAR JADWAL RUTIN',
    luar_dengan: 'PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART BARU'
  };

  let originalHandleKategoriChange = null;
  let currentSchedule = '';

  function esc(v){
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function injectStyles(){
    if(document.getElementById('ipsrs-kategori-modal-style')) return;
    const style = document.createElement('style');
    style.id = 'ipsrs-kategori-modal-style';
    style.textContent = `
      #ipsrsKategoriModal1, #ipsrsKategoriModal2{
        position:fixed; inset:0; z-index:10120; display:none;
        align-items:center; justify-content:center; padding:18px;
        background:rgba(15,23,42,.48);
        backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
      }
      #ipsrsKategoriModal1.show, #ipsrsKategoriModal2.show{display:flex;}
      .ipsrs-kat-modal{
        width:min(430px,100%); background:#fff; border:1px solid #e2e8f0;
        border-radius:20px; overflow:hidden;
        box-shadow:0 24px 70px rgba(15,23,42,.26);
        animation:ipsrsKatIn .18s ease-out;
      }
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
         MODAL PEMELIHARAAN — MOBILE ELEGANT / LIGHTWEIGHT
         Tidak memakai gambar eksternal. Ikon dibuat CSS/Unicode
         sehingga tidak menambah network request.
         ========================================================= */
      #ipsrsKategoriModal1{padding:14px}
      #ipsrsKategoriModal1 .ipsrs-kat-modal{
        width:360px;max-width:calc(100vw - 28px);background:transparent;
        border:0;border-radius:0;box-shadow:none;overflow:visible;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-head,#ipsrsKategoriModal1 .ipsrs-kat-footer{display:none}
      #ipsrsKategoriModal1 .ipsrs-kat-body{padding:0}
      #ipsrsKategoriModal1 .ipsrs-kat-layout{display:flex;flex-direction:column;gap:18px}
      #ipsrsKategoriModal1 .ipsrs-kat-block{
        display:grid;grid-template-columns:42% 58%;grid-template-rows:58px 58px;
        min-height:116px;border-radius:18px;overflow:hidden;
        box-shadow:0 10px 28px rgba(15,23,42,.18);position:relative;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.green{
        background:linear-gradient(135deg,#edf9e8 0%,#cdeabf 100%);
        border:1px solid #80bd69;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.yellow{
        background:linear-gradient(135deg,#fff8d9 0%,#ffe69a 100%);
        border:1px solid #e5b52b;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice{
        min-width:0;min-height:0;width:100%;height:100%;margin:0;padding:8px 10px;
        border:0;border-radius:0;display:flex;align-items:center;justify-content:center;
        text-align:center;background:transparent;box-shadow:none;
        font-family:Arial,sans-serif;cursor:pointer;
        transition:background .14s ease,transform .14s ease;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:first-child{
        grid-column:1;grid-row:1/3;border-right:1px solid rgba(71,85,105,.25);
        flex-direction:column;gap:7px;padding:10px 7px;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:nth-child(2){
        grid-column:2;grid-row:1;border-bottom:1px solid rgba(71,85,105,.22);
        justify-content:flex-start;text-align:left;padding-left:17px;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:nth-child(3){
        grid-column:2;grid-row:2;justify-content:flex-start;text-align:left;padding-left:17px;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice:hover{background:rgba(255,255,255,.40);box-shadow:none;filter:none}
      #ipsrsKategoriModal1 .ipsrs-kat-choice:active{transform:scale(.985)}
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:first-child::before{
        content:"✓";width:34px;height:34px;display:flex;align-items:center;justify-content:center;
        border-radius:50%;background:rgba(255,255,255,.70);font-size:21px;font-weight:800;
        color:#19733a;box-shadow:0 2px 8px rgba(25,115,58,.14);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block.yellow>.ipsrs-kat-choice:first-child::before{
        content:"⚒";color:#b36a00;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:nth-child(2)::before,
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:nth-child(3)::before{
        width:30px;height:30px;flex:0 0 30px;display:flex;align-items:center;justify-content:center;
        border-radius:50%;margin-right:10px;background:rgba(255,255,255,.62);
        font-size:15px;font-weight:800;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:nth-child(2)::before{content:"✓";color:#16723a}
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:nth-child(3)::before{content:"⚙";color:#0875d1}
      #ipsrsKategoriModal1 .ipsrs-kat-choice-title{
        display:block;font-size:13px;line-height:1.25;font-weight:700;color:#172033;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:first-child .ipsrs-kat-choice-title{
        font-size:13px;line-height:1.18;font-weight:800;text-align:center;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-direct$="dengan"] .ipsrs-kat-choice-title{
        color:#006bd6;
      }
      @media(max-width:380px){
        #ipsrsKategoriModal1 .ipsrs-kat-modal{width:100%}
        #ipsrsKategoriModal1 .ipsrs-kat-block{grid-template-rows:56px 56px;min-height:112px}
        #ipsrsKategoriModal1 .ipsrs-kat-choice-title{font-size:12px}
        #ipsrsKategoriModal1 .ipsrs-kat-block>.ipsrs-kat-choice:first-child .ipsrs-kat-choice-title{font-size:12px}
      }
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
      .ipsrs-kat-choice-desc{display:block;font-size:11px;color:#64748b;font-weight:500;margin-top:3px}
      .ipsrs-kat-footer{
        display:flex;justify-content:flex-end;gap:8px;padding:0 20px 18px;
      }
      .ipsrs-kat-cancel{
        min-height:40px;padding:0 15px;border:1px solid #cbd5e1;border-radius:10px;
        background:#fff;color:#334155;font:inherit;font-weight:700;cursor:pointer;
      }
      @media(max-width:480px){
        #ipsrsKategoriModal1,#ipsrsKategoriModal2{padding:14px}
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
            <div class="ipsrs-kat-title">${esc(title)}</div>
            <div class="ipsrs-kat-sub">${esc(subtitle)}</div>
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
      'ipsrsKategoriModal1',
      'PEMELIHARAAN',
      'Pilih salah satu dari 4 pilihan',
      `
        <div class="ipsrs-kat-layout">
          <div class="ipsrs-kat-block green">
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="terjadwal-tanpa">
              <span class="ipsrs-kat-choice-title">PEMELIHARAAN<br>RUTIN<br>SESUAI JADWAL</span>
            </button>
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="terjadwal-tanpa">
              <span class="ipsrs-kat-choice-title">PEMELIHARAAN SAJA</span>
            </button>
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="terjadwal-dengan">
              <span class="ipsrs-kat-choice-title">DENGAN PENGGANTIAN<br>MATERIAL / SPARE PART BARU</span>
            </button>
          </div>

          <div class="ipsrs-kat-block yellow">
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="luar-tanpa">
              <span class="ipsrs-kat-choice-title">PEMELIHARAAN<br>DI LUAR<br>JADWAL RUTIN</span>
            </button>
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="luar-tanpa">
              <span class="ipsrs-kat-choice-title">PEMELIHARAAN SAJA</span>
            </button>
            <button type="button" class="ipsrs-kat-choice" data-kat-direct="luar-dengan">
              <span class="ipsrs-kat-choice-title">DENGAN PENGGANTIAN<br>MATERIAL / SPARE PART BARU</span>
            </button>
          </div>
        </div>`,
      ''
    );

    injectModal(
      'ipsrsKategoriModal2',
      'PENGGANTIAN SPARE PART / MATERIAL',
      'Tentukan apakah ada penggantian',
      `
        <div class="ipsrs-kat-info" id="ipsrsKategoriModal2Info">Pilih salah satu pilihan berikut.</div>
        <button type="button" class="ipsrs-kat-choice" data-kat-replace="tanpa">
          <span class="ipsrs-kat-choice-title">TANPA PENGGANTIAN SPARE PART / MATERIAL</span>
          <span class="ipsrs-kat-choice-desc">Tidak ada spare part atau material yang diganti.</span>
        </button>
        <button type="button" class="ipsrs-kat-choice" data-kat-replace="dengan">
          <span class="ipsrs-kat-choice-title">DENGAN PENGGANTIAN SPARE PART / MATERIAL BARU</span>
          <span class="ipsrs-kat-choice-desc">Ada spare part/material yang diganti atau digunakan.</span>
        </button>`,
      '<button type="button" class="ipsrs-kat-cancel" data-kat-back>Kembali</button><button type="button" class="ipsrs-kat-cancel" data-kat-cancel>Batalkan</button>'
    );

    injectModal(
      'ipsrsKategoriModal3',
      'PERBAIKAN',
      'Tentukan apakah ada penggantian spare part / material',
      `
        <button type="button" class="ipsrs-kat-choice" data-kat-repair="tanpa">
          <span class="ipsrs-kat-choice-title">TANPA PENGGANTIAN SPARE PART / MATERIAL</span>
        </button>
        <button type="button" class="ipsrs-kat-choice" data-kat-repair="dengan">
          <span class="ipsrs-kat-choice-title">DENGAN PENGGANTIAN SPARE PART / MATERIAL BARU</span>
        </button>`,
      '<button type="button" class="ipsrs-kat-cancel" data-kat-cancel>Batalkan</button>'
    );

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
          ? 'PERBAIKAN DENGAN PENGGANTIAN SPARE PART BARU'
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

    document.querySelectorAll('[data-kat-cancel]').forEach(btn => btn.addEventListener('click', cancelKategoriFlow));
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
    ['ipsrsKategoriModal1','ipsrsKategoriModal2','ipsrsKategoriModal3'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.remove('show');
    });
    currentSchedule = '';
    const sel = document.getElementById('Kategori');
    if(sel) sel.value = '';
  }

  function finishKategori(value){
    ['ipsrsKategoriModal1','ipsrsKategoriModal2'].forEach(id => {
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
  }

  // Kategori induk PEMELIHARAAN sudah dibuat oleh app.js.
  // Modal tidak boleh menambahkan option kedua karena dapat menyebabkan
  // duplikasi ketika kategori-modal.js berjalan sebelum populateStaticSelects().
  function ensureBaseOption(){
    const sel = document.getElementById('Kategori');
    return !!sel;
  }

  function install(){
    if(!document.getElementById('Kategori')) return;
    buildModals();
    ensureBaseOption();

    if(typeof window.handleKategoriChange === 'function' && !window.handleKategoriChange.__ipsrsKategoriModal){
      originalHandleKategoriChange = window.handleKategoriChange;
      function wrappedHandleKategoriChange(){
        const sel = document.getElementById('Kategori');
        if(sel && sel.value === BASE){
          sel.value = '';
          openScheduleModal();
          return;
        }
        if(sel && sel.value === REPAIR){
          sel.value = '';
          buildModals();
          document.getElementById('ipsrsKategoriModal1').classList.remove('show');
          document.getElementById('ipsrsKategoriModal2').classList.remove('show');
          document.getElementById('ipsrsKategoriModal3').classList.add('show');
          return;
        }
        return originalHandleKategoriChange.apply(this, arguments);
      }
      wrappedHandleKategoriChange.__ipsrsKategoriModal = true;
      wrappedHandleKategoriChange.__ipsrsOriginal = originalHandleKategoriChange;
      window.handleKategoriChange = wrappedHandleKategoriChange;
    }
    return true;
  }

  function boot(){
    let tries = 0;
    const timer = setInterval(function(){
      tries++;
      if(install() || tries >= 60) clearInterval(timer);
    }, 100);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__ipsrsKategoriModalBuild = BUILD;
})();