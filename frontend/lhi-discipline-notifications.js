/* Notifikasi disiplin LHI — tampil untuk penerima yang sedang login. */
(function(){
  'use strict';
  let loading=false, lastShown='';
  const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function close(){const x=document.getElementById('lhiDisciplineNotice');if(x)x.remove();}
  function render(rows){
    const unread=rows.filter(x=>!x.read_at);
    if(!unread.length||document.getElementById('lhiDisciplineNotice'))return;
    const newest=unread[0];if(String(newest.notification_id)===lastShown)return;
    lastShown=String(newest.notification_id);
    const style=document.createElement('style');
    style.textContent='#lhiDisciplineNotice{position:fixed;inset:0;z-index:100050;background:rgba(15,23,42,.56);display:flex;align-items:center;justify-content:center;padding:14px;font-family:inherit}#lhiDisciplineNotice .lhi-note-box{width:min(620px,100%);max-height:85vh;overflow:auto;background:#fff;color:#172033;border-radius:14px;padding:18px;box-shadow:0 18px 55px rgba(0,0,0,.25)}#lhiDisciplineNotice h3{margin:0 0 12px;font-size:18px;color:#9a3412}#lhiDisciplineNotice .lhi-note-item{padding:11px 0;border-bottom:1px solid #e2e8f0}#lhiDisciplineNotice .lhi-note-item:last-child{border:0}#lhiDisciplineNotice .lhi-note-title{font-weight:800;margin-bottom:4px}#lhiDisciplineNotice .lhi-note-message{font-size:13px;line-height:1.5;color:#334155}#lhiDisciplineNotice .lhi-note-date{font-size:11px;color:#64748b;margin-top:5px}#lhiDisciplineNotice .lhi-note-actions{display:flex;justify-content:flex-end;margin-top:14px}#lhiDisciplineNotice button{border:0;border-radius:8px;padding:10px 16px;background:#0f766e;color:#fff;font-weight:700;cursor:pointer}';
    if(!document.getElementById('lhiDisciplineNoticeStyle')){style.id='lhiDisciplineNoticeStyle';document.head.appendChild(style);}
    const bg=document.createElement('div');bg.id='lhiDisciplineNotice';
    bg.innerHTML='<div class="lhi-note-box" role="alertdialog" aria-modal="true"><h3>🔔 Pemberitahuan Disiplin LHI</h3>'+unread.map(x=>'<div class="lhi-note-item" data-id="'+Number(x.notification_id)+'"><div class="lhi-note-title">'+esc(x.subject)+'</div><div class="lhi-note-message">'+esc(x.message)+'</div><div class="lhi-note-date">'+esc(new Date(x.created_at).toLocaleString('id-ID'))+'</div></div>').join('')+'<div class="lhi-note-actions"><button type="button" id="lhiNoticeClose">Saya Mengerti</button></div></div>';
    document.body.appendChild(bg);
    document.getElementById('lhiNoticeClose').onclick=async()=>{
      for(const row of unread){try{await window.authRun('apiMarkLhiNotificationRead',Number(row.notification_id));}catch(e){console.warn('[LHI_NOTICE_READ]',e);}}
      close();
    };
  }
  async function load(){
    if(loading||typeof window.getSession!=='function'||!window.getSession()||typeof window.authRun!=='function')return;
    loading=true;
    try{const r=await window.authRun('apiGetLhiNotifications');if(r&&r.ok)render(Array.isArray(r.data)?r.data:[]);}
    catch(e){console.warn('[LHI_NOTIFICATIONS]',e);}
    finally{loading=false;}
  }
  window.__ipsrsLoadLhiNotifications=load;
  const original=window.performLogin;
  if(typeof original==='function'&&!window.__ipsrsLhiNotificationWrapped){
    window.__ipsrsLhiNotificationWrapped=true;
    window.performLogin=async function(){const result=await original.apply(this,arguments);if(result)setTimeout(load,1200);return result;};
  }
  window.addEventListener('DOMContentLoaded',()=>setTimeout(load,2500));
  setInterval(load,5*60*1000);
})();