/* Ka IPSRS: post-submission review of newly added master items. */
(function(){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let busy=false;
  function session(){try{return typeof getSession==='function'?getSession():null;}catch(_){return null;}}
  function ensureUI(){
    const s=session();
    const modal=document.getElementById('masterDataManagementBg');
    if(!s||s.role!=='KA_IPSRS'){if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');}return;}
    refreshCount();
  }
  async function refreshCount(){
    const s=session(), badge=document.getElementById('masterDataReviewCount');
    if(!s||s.role!=='KA_IPSRS'||!badge)return;
    try{const r=await authRun('apiListMasterItemReviews','MENUNGGU');if(!r||!r.ok)return;const n=(r.data||[]).length;badge.textContent=String(n);badge.style.display=n?'inline-block':'none';}catch(_){}
  }
  function ensureModal(){
    let bg=document.getElementById('masterItemReviewBg');if(bg)return bg;
    bg=document.createElement('div');bg.id='masterItemReviewBg';bg.className='modal-bg';
    bg.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="masterItemReviewTitle" style="width:min(760px,calc(100vw - 24px));max-height:85vh;overflow:auto"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h3 id="masterItemReviewTitle">Croscek Item Baru</h3><div class="modal-sub">Item langsung dapat digunakan oleh petugas. Periksa kesesuaian master data di sini.</div></div><button type="button" class="btn" id="masterItemReviewClose">Tutup</button></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button type="button" class="btn primary" data-review-filter="MENUNGGU">Menunggu</button><button type="button" class="btn" data-review-filter="SEMUA">Semua status</button></div><div id="masterItemReviewList"><div class="modal-sub">Memuat data...</div></div></div>';
    document.body.appendChild(bg);
    bg.querySelector('#masterItemReviewClose').addEventListener('click',()=>bg.classList.remove('show'));
    bg.addEventListener('click',e=>{if(e.target===bg)bg.classList.remove('show');});
    bg.querySelectorAll('[data-review-filter]').forEach(b=>b.addEventListener('click',()=>loadRows(b.dataset.reviewFilter)));
    return bg;
  }
  async function openReview(){const bg=ensureModal();bg.classList.add('show');await loadRows('MENUNGGU');}
  async function loadRows(status){
    const list=document.getElementById('masterItemReviewList');if(!list)return;
    list.innerHTML='<div class="modal-sub">Memuat antrean pemeriksaan...</div>';
    try{
      const r=await authRun('apiListMasterItemReviews',status);
      if(!r||!r.ok)throw new Error(r&&r.msg||'Antrean tidak dapat dimuat.');
      const rows=r.data||[];
      if(!rows.length){list.innerHTML='<div class="modal-sub" style="padding:16px 0">Tidak ada item pada daftar ini.</div>';await refreshCount();return;}
      list.innerHTML=rows.map(x=>'<article style="border:1px solid var(--border,#dbe2e8);border-radius:10px;padding:12px;margin:10px 0"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><strong>'+esc(x.item_name)+'</strong><div class="modal-sub">Area: '+esc(x.area_name)+'</div><div class="modal-sub">Pengusul: '+esc(x.submitted_by_name||x.submitted_by_staff_id||'Tidak teridentifikasi')+' · '+esc(x.submitted_at?new Date(x.submitted_at).toLocaleString('id-ID'):'')+'</div></div><span class="badge">'+esc(x.status)+'</span></div>'+(x.review_note?'<div class="modal-sub" style="margin-top:6px">Catatan: '+esc(x.review_note)+'</div>':'')+(x.status==='MENUNGGU'?'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn primary" data-review-action="SESUAI" data-id="'+x.review_id+'">Sesuai</button><button class="btn" data-review-action="PERLU_KOREKSI" data-id="'+x.review_id+'">Koreksi</button><button class="btn" data-review-action="DITOLAK" data-id="'+x.review_id+'">Tolak / nonaktifkan</button></div>':'<div class="modal-sub" style="margin-top:8px">Diperiksa oleh '+esc(x.checked_by_name||x.checked_by_staff_id||'-')+' · '+esc(x.checked_at?new Date(x.checked_at).toLocaleString('id-ID'):'')+'</div>')+'</article>').join('');
      list.querySelectorAll('[data-review-action]').forEach(b=>b.addEventListener('click',()=>reviewOne(b.dataset.id,b.dataset.reviewAction,status)));
      await refreshCount();
    }catch(e){list.innerHTML='<div class="msg-err">'+esc(e.message||e)+'</div>';}
  }
  async function reviewOne(id,status,filter){
    if(busy)return;
    let note='',corrected='';
    if(status==='PERLU_KOREKSI'){
      corrected=window.prompt('Nama item yang benar (kosong jika hanya memberi catatan):','');
      if(corrected===null)return;
      note=window.prompt('Catatan koreksi untuk pengusul/riwayat:','');
      if(note===null)return;
      if(!corrected.trim()&&!note.trim()){alert('Isi nama koreksi atau catatan.');return;}
    }else if(status==='DITOLAK'){
      if(!window.confirm('Item akan dinonaktifkan agar tidak dipilih lagi. Laporan lama tetap dipertahankan. Lanjutkan?'))return;
      note=window.prompt('Alasan penolakan (opsional):','')||'';
    }else if(!window.confirm('Tandai item ini sebagai SESUAI?'))return;
    busy=true;
    try{
      const r=await authRun('apiReviewMasterItem',Number(id),status,note,corrected);
      if(!r||!r.ok)throw new Error(r&&r.msg||'Pemeriksaan gagal disimpan.');
      await loadRows(filter);await refreshCount();
    }catch(e){alert(e.message||e);}finally{busy=false;}
  }
  window.__ipsrsOpenMasterItemReview=openReview;
  window.__ipsrsRefreshMasterReviewCount=refreshCount;
  const observer=new MutationObserver(()=>ensureUI());
  function init(){ensureUI();const shell=document.getElementById('appShell');if(shell)observer.observe(shell,{attributes:true,attributeFilter:['class']});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.addEventListener('focus',refreshCount);
})();