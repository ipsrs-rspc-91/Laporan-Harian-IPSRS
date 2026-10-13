/* Pengingat laporan aktif berumur >=25 hari. Tidak mengubah data/hak akses. */
(function(){
  'use strict';
  const KEY_PREFIX='ipsrs_old_report_reminder_dismissed_v1:';
  const MIN_AGE_DAYS=25;
  let running=false;
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function localISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function monthOffset(offset){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
  function dateOnly(v){
    const s=String(v||'').trim();
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return s.slice(0,10);
    m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    return '';
  }
  function getRows(payload){
    if(Array.isArray(payload))return payload;
    if(Array.isArray(payload?.data))return payload.data;
    if(Array.isArray(payload?.reports))return payload.reports;
    if(Array.isArray(payload?.rows))return payload.rows;
    return [];
  }
  function isUnfinished(row){
    const s=String(row?.Status??row?.status??row?.status_laporan??'').trim().toLowerCase();
    return ['belum','belum selesai','proses','dalam proses','pending','belum ditindaklanjuti'].includes(s);
  }
  function rowDate(row){return dateOnly(row?.Tanggal??row?.tanggal??row?.tanggal_laporan??row?.created_at);}
  function ageDays(date){
    if(!date)return -1;
    const [y,m,d]=date.split('-').map(Number);
    const a=Date.UTC(y,m-1,d), b=(()=>{const n=new Date();return Date.UTC(n.getFullYear(),n.getMonth(),n.getDate());})();
    return Math.floor((b-a)/86400000);
  }
  function dismissedKey(session){return KEY_PREFIX+String(session?.staff_id||session?.id||session?.username||'current');}
  function close(){const el=document.getElementById('ipsrsOldReportReminder');if(el)el.remove();}
  function show(rows,session){
    close();
    const style=document.createElement('style');
    style.id='ipsrsOldReportReminderStyle';
    style.textContent='#ipsrsOldReportReminder{position:fixed;inset:0;z-index:100001;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:14px;font-family:inherit}#ipsrsOldReportReminder .orr-box{width:min(620px,100%);max-height:88vh;overflow:auto;background:#fff;color:#0f172a;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}#ipsrsOldReportReminder h3{margin:0 0 8px;font-size:18px}#ipsrsOldReportReminder p{font-size:13px;line-height:1.5;margin:7px 0}#ipsrsOldReportReminder .orr-list{display:grid;gap:7px;margin:12px 0}#ipsrsOldReportReminder .orr-row{border:1px solid #e2e8f0;border-radius:9px;padding:9px;font-size:12px;line-height:1.45}#ipsrsOldReportReminder .orr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}#ipsrsOldReportReminder button{min-height:40px;border:0;border-radius:9px;padding:9px 13px;font:inherit;font-weight:700;cursor:pointer}#ipsrsOldReportReminder .orr-primary{background:#0f766e;color:#fff}#ipsrsOldReportReminder .orr-secondary{background:#e2e8f0;color:#0f172a}#ipsrsOldReportReminder .orr-note{background:#fff7ed;border:1px solid #fed7aa;border-radius:9px;padding:10px}';
    document.head.appendChild(style);
    const bg=document.createElement('div');bg.id='ipsrsOldReportReminder';
    const list=rows.map(r=>{
      const date=rowDate(r), age=ageDays(date);
      const item=String(r.Item??r.item??r.Pekerjaan??r.pekerjaan??'-');
      const room=String(r.Ruang??r.ruang??'-');
      const reporter=String(r.Pelapor??r.pelapor??r.Petugas??r.petugas??'-');
      return '<div class="orr-row"><strong>'+esc(date||'-')+' · '+age+' hari</strong><br>Ruang: '+esc(room)+'<br>Item/pekerjaan: '+esc(item)+'<br>Pelapor/petugas: '+esc(reporter)+'</div>';
    }).join('');
    bg.innerHTML='<div class="orr-box" role="alertdialog" aria-modal="true" aria-labelledby="orrTitle"><h3 id="orrTitle">⚠️ Pengingat Laporan Belum Selesai</h3><p>Ditemukan <strong>'+rows.length+' laporan</strong> berstatus belum selesai dengan umur minimal 25 hari.</p><div class="orr-list">'+list+'</div><div class="orr-note"><p><strong>Tindak lanjut:</strong></p><p>1. Periksa penyebab laporan belum selesai dan koordinasikan dengan petugas penanggung jawab.</p><p>2. Lakukan tindak lanjut sampai selesai, lalu perbarui status laporan pada aplikasi.</p></div><div class="orr-actions"><button type="button" class="orr-primary" data-action="open">Buka Laporan</button><button type="button" class="orr-secondary" data-action="dismiss">Jangan tampilkan lagi</button><button type="button" class="orr-secondary" data-action="close">Tutup</button></div></div>';
    document.body.appendChild(bg);
    bg.querySelector('[data-action="open"]').onclick=function(){close();try{if(typeof window.goPage==='function')window.goPage('laporan');}catch(_){}};
    bg.querySelector('[data-action="close"]').onclick=close;
    bg.querySelector('[data-action="dismiss"]').onclick=function(){try{localStorage.setItem(dismissedKey(session),'1');}catch(_){}close();};
  }
  async function check(){
    if(running)return;running=true;
    try{
      const session=typeof window.getSession==='function'?window.getSession():null;
      if(!session)return;
      try{if(localStorage.getItem(dismissedKey(session))==='1')return;}catch(_){}
      if(typeof window.gsRun!=='function')return;
      const months=[monthOffset(-1),monthOffset(0)];
      const responses=await Promise.all(months.map(m=>window.gsRun('apiGetReports',m,null,null,'daftar')));
      let all=[];
      responses.forEach((r)=>{if(r?.ok===false)throw new Error(r.msg||'API gagal');all=all.concat(getRows(r));});
      const cutoff=localISO(new Date(Date.now()-MIN_AGE_DAYS*86400000));
      const unique=new Map();
      all.forEach(r=>{
        const d=rowDate(r);
        if(!isUnfinished(r)||!d||d>cutoff||ageDays(d)<MIN_AGE_DAYS)return;
        const id=String(r.id??r.ID??r.report_id??[d,r.Ruang,r.Item,r.Pelapor].join('|'));
        unique.set(id,r);
      });
      if(unique.size)show(Array.from(unique.values()).sort((a,b)=>rowDate(a).localeCompare(rowDate(b))),session);
    }catch(e){console.warn('[IPSRS_OLD_REPORT_REMINDER] Tidak dapat memuat pengingat:',e);}
    finally{running=false;}
  }
  const original=window.performLogin;
  if(typeof original==='function'&&!window.__ipsrsOldReportReminderWrapped){
    window.__ipsrsOldReportReminderWrapped=true;
    window.performLogin=async function(){
      const ok=await original.apply(this,arguments);
      if(ok)setTimeout(check,900);
      return ok;
    };
  }
  window.__ipsrsCheckOldReportReminder=check;
})();