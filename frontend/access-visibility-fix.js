/* PATCH: akses laporan & dashboard + dedicated Laporan Saya.
 *
 * Laporan Saya pada Page_Laporan.html mempunyai panel DOM sendiri
 * (#subtab-saya, laporanSayaTableBody, dst). app.js sebelumnya memetakan
 * Laporan Saya ke panel Daftar Laporan, sehingga tabel Laporan Saya selalu
 * kosong walaupun API mengembalikan data. Patch ini membuat Laporan Saya
 * memakai panelnya sendiri dan memuat data milik session yang aktif.
 */
(function(){
  const originalGoLaporanSubTab = window.goLaporanSubTab;
  const originalSelectAdminStaff = window.selectAdminStaff;
  const originalGoPage = window.goPage;
  const originalApplyFilters = window.applyFilters;
  const originalCanEditReport = window.canEditReport;

  function getStaffId(row){
    if(!row) return '';
    const value = row.staff_id !== undefined && row.staff_id !== null ? row.staff_id : row.StaffID;
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function sameStaffId(a,b){
    if(a === null || a === undefined || b === null || b === undefined) return false;
    return String(a).trim() === String(b).trim();
  }

  function el(id){ return document.getElementById(id); }
  function setText(id,value){
    const x=el(id);
    if(x) x.innerText=value===undefined||value===null?'':String(value);
  }
  function htmlSafe(v){
    return typeof escapeHtml==='function' ? escapeHtml(v) : String(v===undefined||v===null?'':v);
  }

  // Kompatibilitas StaffID/staff_id untuk filter daftar laporan.
  if(typeof originalApplyFilters === 'function'){
    window.applyFilters = function(){
      if(Array.isArray(rawData)) rawData.forEach(function(row){
        if(row && (row.StaffID === undefined || row.StaffID === null || row.StaffID === '')){
          row.StaffID=getStaffId(row);
        }
      });

      const wanted = typeof adminSelectedStaffId !== 'undefined' && adminSelectedStaffId !== null
        ? String(adminSelectedStaffId).trim() : '';

      if(wanted && Array.isArray(rawData)){
        const match=rawData.find(function(r){ return r && sameStaffId(getStaffId(r),wanted); });
        if(match){
          const prev=adminSelectedStaffId;
          adminSelectedStaffId=getStaffId(match);
          try{ return originalApplyFilters(); }
          finally{ adminSelectedStaffId=prev; }
        }
      }
      return originalApplyFilters();
    };
  }

  // KA IPSRS / Administrasi tetap dapat mengedit laporan yang dapat mereka lihat.
  if(typeof originalCanEditReport === 'function'){
    window.canEditReport=function(report){
      if(!CURRENT_SESSION || !report) return false;
      if(CURRENT_SESSION.role==='KA_IPSRS' || CURRENT_SESSION.role==='ADMINISTRASI') return true;
      return sameStaffId(getStaffId(report),CURRENT_SESSION.staff_id);
    };
  }

  // ============================================================
  // LAPORAN SAYA -- gunakan panel khusus yang memang sudah ada di HTML.
  // ============================================================
  let laporanSayaData=[];
  let myControlsReady=false;

  function copyMyFilterOptions(){
    const pairs=[
      ['MyFilterBulan','FilterBulan'],
      ['MyFilterKategori','FilterKategori'],
      ['MyFilterArea','FilterArea'],
      ['MyFilterBidang','FilterBidang'],
      ['MyFilterShift','FilterShift']
    ];

    pairs.forEach(function(pair){
      const dst=el(pair[0]), src=el(pair[1]);
      if(!dst || !src) return;
      const current=dst.value;
      dst.innerHTML=src.innerHTML;
      if(current && Array.from(dst.options).some(o=>o.value===current)) dst.value=current;
      else if(src.value) dst.value=src.value;
    });
  }

  function initLaporanSayaControls(){
    copyMyFilterOptions();
    if(myControlsReady) return;
    myControlsReady=true;

    ['MyFilterBulan','MyFilterStatus','MyFilterKategori','MyFilterArea','MyFilterBidang','MyFilterShift']
      .forEach(function(id){
        const x=el(id);
        if(x) x.addEventListener('change',loadLaporanSaya);
      });

    const cari=el('MyFilterCari');
    if(cari) cari.addEventListener('input',renderLaporanSaya);

    const reload=el('btnReloadLaporanSaya');
    if(reload) reload.addEventListener('click',loadLaporanSaya);
  }

  async function loadLaporanSaya(){
    if(!CURRENT_SESSION) return;
    initLaporanSayaControls();

    const bulan=(el('MyFilterBulan') && el('MyFilterBulan').value)
      || (el('FilterBulan') && el('FilterBulan').value) || '';

    setText('msgLaporanSaya','Memuat laporan saya...');

    try{
      // Filter staff_id dikirim ke backend agar data Laporan Saya tidak
      // bergantung pada filter visual panel Daftar Laporan.
      const json=await authRun('apiGetReports',bulan,CURRENT_SESSION.staff_id||'','','');

      if(!json || !json.ok){
        laporanSayaData=[];
        renderLaporanSaya();
        setText('msgLaporanSaya',(json&&json.msg)?json.msg:'Gagal memuat Laporan Saya.');
        return;
      }

      laporanSayaData=Array.isArray(json.data)?json.data:[];
      renderLaporanSaya();
    }catch(err){
      laporanSayaData=[];
      renderLaporanSaya();
      setText('msgLaporanSaya','Error: '+(err&&err.message?err.message:err));
    }
  }

  function renderLaporanSaya(){
    const status=(el('MyFilterStatus')&&el('MyFilterStatus').value)||'';
    const kategori=(el('MyFilterKategori')&&el('MyFilterKategori').value)||'';
    const area=(el('MyFilterArea')&&el('MyFilterArea').value)||'';
    const bidang=(el('MyFilterBidang')&&el('MyFilterBidang').value)||'';
    const shift=(el('MyFilterShift')&&el('MyFilterShift').value)||'';
    const cari=((el('MyFilterCari')&&el('MyFilterCari').value)||'').trim().toLowerCase();

    const rows=laporanSayaData.filter(function(r){
      if(status && r.Status!==status) return false;
      if(kategori && r.Kategori!==kategori) return false;
      if(area && r.AreaKerja!==area) return false;
      if(bidang && r.Bidang!==bidang) return false;
      if(shift && r.Shift!==shift) return false;
      if(cari){
        const hay=[r.Ruang,r.MasalahKegiatan,r.Tindakan,r.Item,r.NoLK,r.Petugas].join(' ').toLowerCase();
        if(hay.indexOf(cari)===-1) return false;
      }
      return true;
    });

    const total=rows.length;
    const selesai=rows.filter(r=>r.Status==='Selesai').length;
    const belum=rows.filter(r=>r.Status!=='Selesai').length;

    setText('laporanSayaTotal',total);
    setText('laporanSayaSelesai',selesai);
    setText('laporanSayaBelum',belum);

    const bulanEl=el('MyFilterBulan');
    const monthOpt=bulanEl && bulanEl.selectedOptions && bulanEl.selectedOptions[0];
    setText('laporanSayaBulan',monthOpt ? monthOpt.textContent : ((bulanEl&&bulanEl.value)||'-'));

    const tbody=el('laporanSayaTableBody');
    const cards=el('laporanSayaCardList');
    if(!tbody || !cards) return;

    tbody.innerHTML='';
    cards.innerHTML='';

    if(!rows.length){
      cards.innerHTML=typeof emptyStateHtml==='function'
        ? emptyStateHtml('Belum ada laporan pada periode/filter ini.')
        : '<div class="smallnote">Belum ada laporan pada periode/filter ini.</div>';
      setText('msgLaporanSaya','Data tampil: 0 dari '+laporanSayaData.length);
      return;
    }

    window.__IPSRS_REPORTS = window.__IPSRS_REPORTS || {};

    rows.forEach(function(row){
      window.__IPSRS_REPORTS[String(row.ID)]=row;

      const tr=document.createElement('tr');
      tr.className=row.Status==='Selesai'?'status-selesai':(row.Status==='Belum'?'status-belum':'');
      tr.innerHTML=
        '<td>'+htmlSafe(formatTanggalDisplay(row.Tanggal))+'</td>'+
        '<td>'+htmlSafe(row.Pukul)+'</td>'+ 
        '<td>'+htmlSafe(row.Ruang)+'</td>'+ 
        '<td>'+htmlSafe(row.NoLK)+'</td>'+ 
        '<td>'+htmlSafe(row.MasalahKegiatan)+'</td>'+ 
        '<td>'+htmlSafe(row.Tindakan)+'</td>'+ 
        '<td><span class="status-badge '+(row.Status==='Selesai'?'selesai':'belum')+'"><span class="status-dot"></span>'+htmlSafe(row.Status)+'</span></td>'+ 
        '<td>'+htmlSafe(row.Kategori)+'</td>'+ 
        '<td>'+htmlSafe(row.AreaKerja)+'</td>'+ 
        '<td>'+htmlSafe(row.Item)+'</td>';
      tr.onclick=function(){ openEditModalForReport(row); };
      tbody.appendChild(tr);

      const card=document.createElement('div');
      card.className='rcard';
      card.innerHTML=
        '<div class="rc-top"><div class="rc-title">'+htmlSafe(row.Ruang)+' · '+htmlSafe(formatTanggalDisplay(row.Tanggal))+'</div>'+ 
        '<span class="pill '+(row.Status==='Selesai'?'success':'warning')+'">'+htmlSafe(row.Status)+'</span></div>'+ 
        '<div class="rc-line">'+htmlSafe(row.MasalahKegiatan)+'</div>'+ 
        '<div class="rc-line">'+htmlSafe(row.Petugas)+' · '+htmlSafe(row.Bidang||row.Shift||'-')+' · '+htmlSafe(row.Kategori)+'</div>';
      card.onclick=function(){ openEditModalForReport(row); };
      cards.appendChild(card);
    });

    setText('msgLaporanSaya','Data tampil: '+rows.length+' dari '+laporanSayaData.length);
  }

  function laporanDomReady(){
    return !!el('subtab-saya') && !!el('subtab-daftar');
  }

  // ============================================================
  // NAVIGASI SUB-TAB
  // ============================================================
  if(typeof originalGoLaporanSubTab==='function'){
    window.goLaporanSubTab=function(name){
      if(!laporanDomReady()) return false;

      const session=typeof getSession==='function' ? getSession() : CURRENT_SESSION;

      if(name==='saya'){
        _laporanMode='saya';
        document.querySelectorAll('.sub-tab-panel').forEach(p=>p.classList.add('hidden'));
        el('subtab-saya').classList.remove('hidden');
        document.querySelectorAll('.sub-tab').forEach(b=>b.classList.toggle('active',b.dataset.subtab==='saya'));
        const staffPanel=el('adminStaffPanel');
        if(staffPanel) staffPanel.classList.add('hidden');
        if(session && session.staff_id) setText('laporanSayaUserPill','● '+(session.nama||session.username||'Petugas Login'));
        initLaporanSayaControls();
        loadLaporanSaya();
        return true;
      }

      if(name==='daftar'){
        _laporanMode='daftar';
        if(typeof originalSelectAdminStaff==='function') originalSelectAdminStaff('');
        const staffPanel=el('adminStaffPanel');
        if(staffPanel) staffPanel.classList.remove('hidden');
        document.querySelectorAll('.sub-tab-panel').forEach(p=>p.classList.add('hidden'));
        el('subtab-daftar').classList.remove('hidden');
        document.querySelectorAll('.sub-tab').forEach(b=>b.classList.toggle('active',b.dataset.subtab==='daftar'));
        // Panggil loader langsung supaya setiap klik selalu dapat mencoba
        // mengambil data lagi, termasuk setelah request sebelumnya gagal.
        if(typeof loadAdminStaffListIfNeeded==='function') loadAdminStaffListIfNeeded();
        loadReportsBySelectedMonth();
        return true;
      }

      // Monitoring dan Rekap tidak lagi bergantung pada cache sub-tab saat
      // user mengkliknya. Setiap klik memuat ulang data terbaru.
      if(name==='monitoring' || name==='rekap'){
        _laporanMode=name;
        document.querySelectorAll('.sub-tab-panel').forEach(p=>p.classList.add('hidden'));
        const panel=el('subtab-'+name);
        if(!panel) return false;
        panel.classList.remove('hidden');
        document.querySelectorAll('.sub-tab').forEach(b=>b.classList.toggle('active',b.dataset.subtab===name));
        if(name==='monitoring') loadStaffMonitoring();
        if(name==='rekap') loadMonthlyRecap();
        return true;
      }

      return originalGoLaporanSubTab(name);
    };
  }

  // ============================================================
  // NAVIGASI HALAMAN -- tunggu fragment deferred selesai dimount.
  // ============================================================
  const PAGE_READY_KEYS={dashboard:'dashboard',laporan:'laporan'};
  if(typeof originalGoPage==='function'){
    window.goPage=function(name){
      const key=PAGE_READY_KEYS[name];
      const promise=key && window.__ipsrsPageReady ? window.__ipsrsPageReady[key] : null;
      if(promise){
        return Promise.resolve(promise)
          .then(function(){ return originalGoPage(name); })
          .catch(function(err){
            console.error('Halaman "'+name+'" belum berhasil dimuat:',err);
            return false;
          });
      }
      return originalGoPage(name);
    };
  }
})();
