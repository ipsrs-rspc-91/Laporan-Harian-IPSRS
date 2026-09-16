/* Laporan navigation fix v20260916-4
 * - Menjamin 4 sub-tab Laporan selalu dapat diklik.
 * - Menyediakan panel Laporan Saya yang memang dibutuhkan oleh navigasi.
 * - Tidak memakai cache yang dapat membuat tab macet.
 */
(function(){
  function el(id){ return document.getElementById(id); }
  function text(id,v){ var x=el(id); if(x) x.innerText=(v==null?'':String(v)); }
  function safe(v){ return typeof escapeHtml==='function' ? escapeHtml(v) : String(v==null?'':v); }

  function ensureLaporanSayaPanel(){
    if(el('subtab-saya')) return true;
    var daftar=el('subtab-daftar');
    if(!daftar || !daftar.parentNode) return false;
    var p=document.createElement('div');
    p.id='subtab-saya';
    p.className='sub-tab-panel hidden';
    p.innerHTML=''
      +'<div class="card" style="margin-bottom:var(--sp-4);">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">'
      +'<div><h3 style="margin:0;color:var(--primary-dark);">Laporan Saya</h3><div class="smallnote" id="laporanSayaUserPill"></div></div>'
      +'<div class="laporan-summary">'
      +'<div class="stat-card"><div class="s-value" id="laporanSayaTotal">0</div><div class="s-label">Total</div></div>'
      +'<div class="stat-card status-selesai"><div class="s-value" id="laporanSayaSelesai">0</div><div class="s-label">Selesai</div></div>'
      +'<div class="stat-card status-belum"><div class="s-value" id="laporanSayaBelum">0</div><div class="s-label">Belum</div></div>'
      +'</div></div></div>'
      +'<div class="card">'
      +'<div class="filters-bar">'
      +'<div class="f-item"><label>Bulan</label><select id="MyFilterBulan"></select></div>'
      +'<div class="f-item"><label>Status</label><select id="MyFilterStatus"><option value="">Semua status</option><option value="Selesai">Selesai</option><option value="Belum">Belum</option></select></div>'
      +'<div class="f-item"><label>Kategori</label><select id="MyFilterKategori"><option value="">Semua kategori</option></select></div>'
      +'<div class="f-item"><label>Area Kerja</label><select id="MyFilterArea"><option value="">Semua area</option></select></div>'
      +'<div class="f-item"><label>Bidang</label><select id="MyFilterBidang"><option value="">Semua bidang</option></select></div>'
      +'<div class="f-item"><label>Shift</label><select id="MyFilterShift"><option value="">Semua shift</option></select></div>'
      +'<div class="f-item" style="flex:1;min-width:180px;"><label>Cari</label><input id="MyFilterCari" placeholder="Cari ruang, masalah, item..."></div>'
      +'<div class="f-item" style="min-width:auto;"><label>&nbsp;</label><button type="button" class="btn" id="btnReloadLaporanSaya">Muat Ulang</button></div>'
      +'</div>'
      +'<div id="msgLaporanSaya" class="smallnote"></div>'
      +'<div class="table-wrap"><table class="data-table"><thead><tr>'
      +'<th>Tanggal</th><th>Pukul</th><th>Ruang</th><th>No LK</th><th>Masalah/Kegiatan</th><th>Tindakan</th><th>Status</th><th>Kategori</th><th>Area Kerja</th><th>Item</th>'
      +'</tr></thead><tbody id="laporanSayaTableBody"></tbody></table></div>'
      +'<div class="card-list" id="laporanSayaCardList"></div>'
      +'</div>';
    daftar.parentNode.insertBefore(p,daftar);
    return true;
  }

  var myData=[];
  var myReady=false;

  function copyMyOptions(){
    [['MyFilterBulan','FilterBulan'],['MyFilterKategori','FilterKategori'],['MyFilterArea','FilterArea'],['MyFilterBidang','FilterBidang'],['MyFilterShift','FilterShift']].forEach(function(pair){
      var d=el(pair[0]),s=el(pair[1]);
      if(d&&s){ var v=d.value; d.innerHTML=s.innerHTML; if(v && Array.from(d.options).some(function(o){return o.value===v;})) d.value=v; else d.value=s.value; }
    });
  }
  function initMyControls(){
    ensureLaporanSayaPanel();
    copyMyOptions();
    if(myReady) return;
    myReady=true;
    ['MyFilterBulan','MyFilterStatus','MyFilterKategori','MyFilterArea','MyFilterBidang','MyFilterShift'].forEach(function(id){ var x=el(id); if(x) x.addEventListener('change',loadLaporanSaya); });
    var c=el('MyFilterCari'); if(c) c.addEventListener('input',renderLaporanSaya);
    var b=el('btnReloadLaporanSaya'); if(b) b.addEventListener('click',loadLaporanSaya);
  }
  async function loadLaporanSaya(){
    if(!CURRENT_SESSION) return;
    initMyControls();
    var bulan=(el('MyFilterBulan')||{}).value || (el('FilterBulan')||{}).value || '';
    text('msgLaporanSaya','Memuat laporan saya...');
    try{
      var json=await authRun('apiGetReports',bulan,CURRENT_SESSION.staff_id||'','','');
      if(!json||!json.ok) throw new Error(json&&json.msg?json.msg:'Gagal memuat Laporan Saya.');
      myData=Array.isArray(json.data)?json.data:[];
      renderLaporanSaya();
    }catch(e){ myData=[]; renderLaporanSaya(); text('msgLaporanSaya','Error: '+(e&&e.message?e.message:e)); }
  }
  function renderLaporanSaya(){
    var status=(el('MyFilterStatus')||{}).value||'',kat=(el('MyFilterKategori')||{}).value||'',area=(el('MyFilterArea')||{}).value||'',bid=(el('MyFilterBidang')||{}).value||'',shift=(el('MyFilterShift')||{}).value||'',q=((el('MyFilterCari')||{}).value||'').trim().toLowerCase();
    var rows=myData.filter(function(r){
      if(status&&r.Status!==status) return false; if(kat&&r.Kategori!==kat) return false; if(area&&r.AreaKerja!==area) return false; if(bid&&r.Bidang!==bid) return false; if(shift&&r.Shift!==shift) return false;
      if(q && [r.Ruang,r.MasalahKegiatan,r.Tindakan,r.Item,r.NoLK,r.Petugas].join(' ').toLowerCase().indexOf(q)<0) return false; return true;
    });
    text('laporanSayaTotal',rows.length); text('laporanSayaSelesai',rows.filter(function(r){return r.Status==='Selesai';}).length); text('laporanSayaBelum',rows.filter(function(r){return r.Status!=='Selesai';}).length);
    var tb=el('laporanSayaTableBody'),cards=el('laporanSayaCardList'); if(!tb||!cards) return; tb.innerHTML=''; cards.innerHTML='';
    if(!rows.length){ cards.innerHTML=typeof emptyStateHtml==='function'?emptyStateHtml('Belum ada laporan pada periode/filter ini.'):'<div class="smallnote">Belum ada laporan pada periode/filter ini.</div>'; text('msgLaporanSaya','Data tampil: 0 dari '+myData.length); return; }
    window.__IPSRS_REPORTS=window.__IPSRS_REPORTS||{};
    rows.forEach(function(r){
      window.__IPSRS_REPORTS[String(r.ID)]=r;
      var tr=document.createElement('tr'); tr.innerHTML='<td>'+safe(typeof formatTanggalDisplay==='function'?formatTanggalDisplay(r.Tanggal):r.Tanggal)+'</td><td>'+safe(r.Pukul)+'</td><td>'+safe(r.Ruang)+'</td><td>'+safe(r.NoLK)+'</td><td>'+safe(r.MasalahKegiatan)+'</td><td>'+safe(r.Tindakan)+'</td><td>'+safe(r.Status)+'</td><td>'+safe(r.Kategori)+'</td><td>'+safe(r.AreaKerja)+'</td><td>'+safe(r.Item)+'</td>'; tr.onclick=function(){ if(typeof openEditModalForReport==='function') openEditModalForReport(r); }; tb.appendChild(tr);
      var card=document.createElement('div'); card.className='rcard'; card.innerHTML='<div class="rc-top"><div class="rc-title">'+safe(r.Ruang)+' · '+safe(typeof formatTanggalDisplay==='function'?formatTanggalDisplay(r.Tanggal):r.Tanggal)+'</div><span class="pill '+(r.Status==='Selesai'?'success':'warning')+'">'+safe(r.Status)+'</span></div><div class="rc-line">'+safe(r.MasalahKegiatan)+'</div><div class="rc-line">'+safe(r.Petugas)+'</div>'; card.onclick=function(){ if(typeof openEditModalForReport==='function') openEditModalForReport(r); }; cards.appendChild(card);
    });
    text('msgLaporanSaya','Data tampil: '+rows.length+' dari '+myData.length);
  }

  window.goLaporanSubTab=function(name){
    if(name==='saya'){
      if(!ensureLaporanSayaPanel()) return false;
      document.querySelectorAll('.sub-tab-panel').forEach(function(p){p.classList.add('hidden');});
      el('subtab-saya').classList.remove('hidden');
      document.querySelectorAll('.sub-tab').forEach(function(b){b.classList.toggle('active',b.dataset.subtab==='saya');});
      var ap=el('adminStaffPanel'); if(ap) ap.classList.add('hidden');
      if(CURRENT_SESSION) text('laporanSayaUserPill','● '+(CURRENT_SESSION.nama||CURRENT_SESSION.username||'Petugas Login'));
      initMyControls(); loadLaporanSaya(); return true;
    }
    if(name==='monitoring'||name==='rekap'||name==='daftar'){
      document.querySelectorAll('.sub-tab-panel').forEach(function(p){p.classList.add('hidden');});
      var p=el('subtab-'+name); if(!p) return false; p.classList.remove('hidden');
      document.querySelectorAll('.sub-tab').forEach(function(b){b.classList.toggle('active',b.dataset.subtab===name);});
      var ap2=el('adminStaffPanel'); if(ap2) ap2.classList.toggle('hidden',name!=='daftar');
      try{
        if(name==='monitoring'&&typeof loadStaffMonitoring==='function') loadStaffMonitoring();
        if(name==='rekap'&&typeof loadMonthlyRecap==='function') loadMonthlyRecap();
        if(name==='daftar'&&typeof loadReportsBySelectedMonth==='function') loadReportsBySelectedMonth();
      }catch(e){ console.error(e); }
      return true;
    }
    return false;
  };

  function bindTabTypes(){ document.querySelectorAll('.sub-tab').forEach(function(b){b.type='button';}); }
  var obs=new MutationObserver(function(){ if(el('page-laporan')) bindTabTypes(); if(el('subtab-daftar')) ensureLaporanSayaPanel(); });
  obs.observe(document.body,{childList:true,subtree:true});
  if(document.readyState!=='loading'){ bindTabTypes(); ensureLaporanSayaPanel(); }
  else document.addEventListener('DOMContentLoaded',function(){bindTabTypes();});
})();
