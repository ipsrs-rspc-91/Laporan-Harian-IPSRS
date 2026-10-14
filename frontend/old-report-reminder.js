/* Pengingat laporan aktif berumur >=25 hari. Tidak mengubah data/hak akses. */
(function(){
  'use strict';
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
  function rowTime(row){
    const raw=String(row?.Pukul??row?.pukul??row?.Jam??row?.Waktu??row?.waktu??row?.jam??row?.TanggalWaktu??row?.tanggal_waktu??row?.Tanggal??row?.tanggal??'').trim();
    const m=raw.match(/(?:T|\s)(\d{1,2}[:.]\d{2})(?::\d{2})?/);
    if(m)return m[1].replace('.',':');
    const t=raw.match(/^(\d{1,2}[:.]\d{2})(?::\d{2})?$/);
    return t?t[1].replace('.',':'):'';
  }
  function ageDays(date){
    if(!date)return -1;
    const [y,m,d]=date.split('-').map(Number);
    const a=Date.UTC(y,m-1,d), b=(()=>{const n=new Date();return Date.UTC(n.getFullYear(),n.getMonth(),n.getDate());})();
    return Math.floor((b-a)/86400000);
  }
  function close(){const el=document.getElementById('ipsrsOldReportReminder');if(el)el.remove();}
  function show(rows,session){
    close();
    const style=document.createElement('style');
    style.id='ipsrsOldReportReminderStyle';
    style.textContent='#ipsrsOldReportReminder{position:fixed;inset:0;z-index:100001;background:rgba(15,23,42,.56);display:flex;align-items:center;justify-content:center;padding:14px;font-family:inherit}#ipsrsOldReportReminder .orr-box{width:min(900px,100%);max-height:90vh;overflow:auto;background:#fff;color:#172033;border-radius:13px;padding:16px;box-shadow:0 18px 55px rgba(0,0,0,.24)}#ipsrsOldReportReminder .orr-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}#ipsrsOldReportReminder .orr-bell{width:48px;height:48px;flex:none;border-radius:50%;display:grid;place-items:center;background:#fee2e2;color:#dc2626;font-size:26px}#ipsrsOldReportReminder .orr-headtext{flex:1;min-width:0}#ipsrsOldReportReminder h3{margin:0;color:#b91c1c;font-size:19px;line-height:1.3}#ipsrsOldReportReminder .orr-subtitle{font-size:12px;line-height:1.4;margin-top:3px;color:#334155}#ipsrsOldReportReminder .orr-x{border:0;background:transparent;color:#64748b;font-size:25px;padding:2px 8px;cursor:pointer}#ipsrsOldReportReminder .orr-instructions{background:#fff1f2;border-radius:8px;padding:10px 12px;margin:10px 0 12px;color:#9f1239;font-size:12px;line-height:1.55}#ipsrsOldReportReminder .orr-instruction{display:flex;gap:8px;align-items:flex-start;margin:3px 0}#ipsrsOldReportReminder .orr-number{width:19px;height:19px;flex:none;border-radius:50%;background:#dc2626;color:white;font-weight:800;display:inline-grid;place-items:center;font-size:11px}#ipsrsOldReportReminder .orr-table-wrap{width:100%;overflow-x:auto;border:1px solid #e2e8f0;border-radius:7px}#ipsrsOldReportReminder table{width:100%;min-width:650px;border-collapse:collapse;font-size:11px;line-height:1.4}#ipsrsOldReportReminder th{background:#eff6ff;color:#475569;text-align:left;font-weight:700;padding:8px 6px;border-bottom:1px solid #dbeafe}#ipsrsOldReportReminder td{padding:8px 6px;vertical-align:top;border-bottom:1px solid #e5e7eb}#ipsrsOldReportReminder tr:last-child td{border-bottom:0}#ipsrsOldReportReminder .orr-age{font-weight:800;color:#dc2626;font-size:18px;text-align:center;white-space:nowrap}#ipsrsOldReportReminder .orr-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}#ipsrsOldReportReminder button.orr-close{min-height:38px;min-width:110px;padding:8px 20px;border:0;border-radius:7px;background:#0875e1;color:#fff;font:inherit;font-weight:700;cursor:pointer}@media(max-width:560px){#ipsrsOldReportReminder .orr-box{padding:14px;border-radius:13px}#ipsrsOldReportReminder h3{font-size:17px}#ipsrsOldReportReminder .orr-bell{width:42px;height:42px;font-size:23px}#ipsrsOldReportReminder .orr-subtitle{font-size:11px}#ipsrsOldReportReminder .orr-instructions{font-size:12px;padding:9px}#ipsrsOldReportReminder .orr-actions button.orr-close{width:100%}}';
    document.head.appendChild(style);
    const bg=document.createElement('div');bg.id='ipsrsOldReportReminder';
    const escAttr=esc;
    const tableRows=rows.map((r,i)=>{
      const date=rowDate(r), age=ageDays(date);
      const displayDate=date?(()=>{const p=date.split('-');return Number(p[2])+' '+['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][Number(p[1])-1]+' '+p[0];})():'-';
      const displayTime=rowTime(r);
      const staff=String(r.nama_snapshot??r.created_by_name??r.NamaPetugas??r.nama_petugas??r.Pelapor??r.pelapor??r.staff_name??'-');
      const item=String(r.Item??r.item??'-');
      const room=String(r.Ruang??r.ruang??'-');
      const issue=String(r.MasalahKegiatan??r.masalah_kegiatan??r.Masalah??r.masalah??'-');
      const action=String(r.Tindakan??r.tindakan??'-');
      return '<tr><td>'+(i+1)+'</td><td>'+esc(displayDate)+(displayTime?'<br>'+esc(displayTime):'')+'</td><td class="orr-age">'+age+'</td><td><strong>'+esc(item)+'</strong></td><td>'+esc(room)+'</td><td>'+esc(issue)+'</td><td>'+esc(action)+'</td><td>'+esc(staff)+'</td></tr>';
    }).join('');
    bg.innerHTML='<div class="orr-box" role="alertdialog" aria-modal="true" aria-labelledby="orrTitle"><div class="orr-head"><div class="orr-bell" aria-hidden="true">🔔</div><div class="orr-headtext"><h3 id="orrTitle">Pengingat Laporan IPSRS</h3><div class="orr-subtitle">Ada <strong>'+rows.length+' laporan</strong> yang sudah berumur 25 hari atau lebih dan masih berstatus <strong>Belum Selesai</strong>.</div></div><button type="button" class="orr-x" aria-label="Tutup">×</button></div><div class="orr-instructions"><div class="orr-instruction"><span class="orr-number">1</span><span><strong>Segera</strong> untuk ditindak lanjuti dan <strong>pesan spare part</strong> jika diperlukan.</span></div><div class="orr-instruction"><span class="orr-number">2</span><span>Jika sudah di tindak lanjut, <strong>rubah status laporan dari Belum menjadi Selesai.</strong></span></div></div><div class="orr-table-wrap"><table><thead><tr><th>No.</th><th>Tanggal Laporan</th><th>Umur</th><th>Item</th><th>Ruang</th><th>Masalah</th><th>Tindakan Terakhir</th><th>Nama Petugas</th></tr></thead><tbody>'+tableRows+'</tbody></table></div><div class="orr-actions"><button type="button" class="orr-close">Tutup</button></div></div>';
    document.body.appendChild(bg);
    function closeReminder(){close();}
    bg.querySelector('.orr-x').onclick=closeReminder;
    bg.querySelector('.orr-close').onclick=closeReminder;
  }
  function showCheckError(message){
    let el=document.getElementById('ipsrsOldReportReminderError');
    if(!el){
      el=document.createElement('div');el.id='ipsrsOldReportReminderError';
      el.style.cssText='position:fixed;z-index:100002;left:12px;right:12px;bottom:12px;max-width:640px;margin:auto;padding:12px 14px;border-radius:9px;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;box-shadow:0 6px 22px rgba(0,0,0,.16);font:13px/1.45 inherit';
      document.body.appendChild(el);
      setTimeout(()=>{if(el&&el.isConnected)el.remove();},10000);
    }
    el.textContent='Pengingat laporan lama belum dapat diperiksa. '+String(message||'Periksa koneksi lalu muat ulang aplikasi.');
  }
  async function check(){
    if(running)return;running=true;
    try{
      const session=typeof window.getSession==='function'?window.getSession():null;
      if(!session)return;
      if(typeof window.__ipsrsFetchOverdueReports!=='function')throw new Error('Modul pengingat belum termuat. Muat ulang aplikasi.');
      const cutoff=localISO(new Date(Date.now()-MIN_AGE_DAYS*86400000));
      const response=await window.__ipsrsFetchOverdueReports(cutoff);
      if(!response||response.ok!==true)throw new Error(response?.msg||'Gagal memuat laporan dari server.');
      const unique=new Map();
      getRows(response).forEach(r=>{
        const d=rowDate(r);
        if(!isUnfinished(r)||!d||d>cutoff||ageDays(d)<MIN_AGE_DAYS)return;
        const id=String(r.ID??r.report_id??r.id??[d,r.Ruang,r.Item,r.Pelapor].join('|'));
        unique.set(id,r);
      });
      if(unique.size)show(Array.from(unique.values()).sort((a,b)=>rowDate(a).localeCompare(rowDate(b))),session);
    }catch(e){
      console.warn('[IPSRS_OLD_REPORT_REMINDER] Tidak dapat memuat pengingat:',e);
      showCheckError(e&&e.message?e.message:'Terjadi kesalahan saat memeriksa laporan.');
    }finally{running=false;}
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