/* ============================================================
   KATEGORI PEMELIHARAAN — modal bertahap
   Build: 20260929-KATEGORI-MODAL3
   Tidak mengubah data laporan lama.
   ============================================================ */
(function(){
  'use strict';

  const BUILD = '20260929-KATEGORI-MODAL3';
  const BASE = 'PEMELIHARAAN';
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
        display:flex; align-items:center; justify-content:space-between;
        gap:12px; padding:18px 20px 12px;
      }
      .ipsrs-kat-title{font-size:18px;font-weight:800;color:#0f172a}
      .ipsrs-kat-sub{font-size:12px;color:#64748b;margin-top:4px}
      .ipsrs-kat-close{
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
      /* Pilihan modal PEMELIHARAAN */
      #ipsrsKategoriModal1 .ipsrs-kat-body{padding-top:4px}
      #ipsrsKategoriModal1 .ipsrs-kat-choice{
        min-height:70px;
        padding:13px 15px;
        border-width:1.5px;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-schedule="terjadwal"]{
        border-color:#22a447;
        background:#f0faF2;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-schedule="terjadwal"]:hover{
        border-color:#16883a;
        background:#e7f7eb;
        box-shadow:0 0 0 2px rgba(34,164,71,.10);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-schedule="luar"]{
        border-color:#e9c46a;
        background:#fff9e8;
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-schedule="luar"]:hover{
        border-color:#d7a52e;
        background:#fff4d3;
        box-shadow:0 0 0 2px rgba(233,196,106,.12);
      }
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-schedule="terjadwal"] .ipsrs-kat-choice-title{color:#176b2e}
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-schedule="luar"] .ipsrs-kat-choice-title{color:#7a5700}
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-schedule="terjadwal"] .ipsrs-kat-choice-desc,
      #ipsrsKategoriModal1 .ipsrs-kat-choice[data-kat-schedule="luar"] .ipsrs-kat-choice-desc{color:#5f6875}
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
        .ipsrs-kat-head{padding:16px 16px 10px}
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
      'Pilih jenis pemeliharaan',
      `
        <button type="button" class="ipsrs-kat-choice" data-kat-schedule="terjadwal">
          <span class="ipsrs-kat-choice-title">RUTIN SESUAI JADWAL</span>
        </button>
        <button type="button" class="ipsrs-kat-choice" data-kat-schedule="luar">
          <span class="ipsrs-kat-choice-title">DI LUAR JADWAL RUTIN</span>
        </button>`,
      '<button type="button" class="ipsrs-kat-cancel" data-kat-cancel>Batalkan</button>'
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
          <span class="ipsrs-kat-choice-title">DENGAN PENGGANTIAN SPARE PART / MATERIAL</span>
          <span class="ipsrs-kat-choice-desc">Ada spare part/material yang diganti atau digunakan.</span>
        </button>`,
      '<button type="button" class="ipsrs-kat-cancel" data-kat-back>Kembali</button><button type="button" class="ipsrs-kat-cancel" data-kat-cancel>Batalkan</button>'
    );

    document.querySelectorAll('[data-kat-schedule]').forEach(btn => {
      btn.addEventListener('click', function(){
        currentSchedule = this.dataset.katSchedule || '';
        document.getElementById('ipsrsKategoriModal1').classList.remove('show');
        const info = document.getElementById('ipsrsKategoriModal2Info');
        if(info){
          info.textContent = currentSchedule === 'terjadwal'
            ? 'PEMELIHARAAN RUTIN SESUAI JADWAL dipilih.'
            : 'PEMELIHARAAN DI LUAR JADWAL RUTIN dipilih.';
        }
        document.getElementById('ipsrsKategoriModal2').classList.add('show');
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
    document.getElementById('ipsrsKategoriModal1').classList.add('show');
  }

  function cancelKategoriFlow(){
    ['ipsrsKategoriModal1','ipsrsKategoriModal2'].forEach(id => {
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
    // Final value memakai kategori lama yang sudah ada, sehingga laporan lama
    // dan logika spare-part existing tetap kompatibel.
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

  function ensureBaseOption(){
    const sel = document.getElementById('Kategori');
    if(!sel) return false;
    if(!Array.from(sel.options).some(o => o.value === BASE)){
      const opt = document.createElement('option');
      opt.value = BASE;
      opt.innerText = BASE;
      const firstReal = Array.from(sel.options).find(o => o.value && o.value !== 'ADD_NEW');
      if(firstReal) sel.insertBefore(opt, firstReal);
      else sel.appendChild(opt);
    }
    return true;
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