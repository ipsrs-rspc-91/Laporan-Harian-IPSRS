/* Panel Hak Akses — hanya muncul untuk KA IPSRS. */
(function(){
  let mounted=false, staffCache=[];
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function wibDateKey(value){
    if(!value)return '';
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return get('year')+'-'+get('month')+'-'+get('day');
  }
  async function callAccessApi(action,...args){
    if(typeof authRun!=='function') throw new Error('API Supabase belum siap.');
    return authRun(action,...args);
  }
  async function callAccessRead(action){
    if(typeof authRun!=='function') throw new Error('API Supabase belum siap.');
    return authRun(action);
  }
  function mount(){
    if(mounted||typeof getSession!=='function')return;
    const s=getSession();
    if(!s||s.role!=='KA_IPSRS')return;
    mounted=true;
    const style=document.createElement('style');style.textContent=`#accessBtn{display:block;width:100%;margin-top:8px;text-align:left}#accessBg{display:none;position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:9000;align-items:center;justify-content:center;padding:18px}#accessBg.show{display:flex}.access-modal{background:#fff;border-radius:20px;width:min(920px,100%);max-height:90vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.25);padding:24px}.access-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.access-head h2{margin:0 0 5px}.access-muted{color:#64748b;font-size:13px}.access-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}.access-card{border:1px solid #e2e8f0;border-radius:14px;padding:16px}.access-card h3{margin:0 0 6px;font-size:15px}.access-row{display:flex;justify-content:space-between;align-items:center;gap:12px}.access-switch{width:48px;height:26px;border-radius:20px;border:0;background:#cbd5e1;position:relative;cursor:pointer}.access-switch.on{background:#16a34a}.access-switch:after{content:'';position:absolute;width:20px;height:20px;background:#fff;border-radius:50%;top:3px;left:4px;transition:.15s}.access-switch.on:after{left:24px}.access-form{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;margin-top:14px}.access-form label{font-size:12px;font-weight:700;color:#475569}.access-form select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.access-table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}.access-table th,.access-table td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}.access-anchor-table input{width:100%;min-width:130px;padding:8px;border:1px solid #cbd5e1;border-radius:8px}.access-anchor-table td{vertical-align:middle}.access-anchor-status{font-weight:700}.access-anchor-status.pending{color:#b45309}.access-anchor-status.verified{color:#15803d}.access-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}.access-btn-secondary{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:10px 14px;cursor:pointer}.access-btn-primary{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}@media(max-width:700px){.access-grid,.access-form{grid-template-columns:1fr}.access-modal{padding:18px}.access-table{font-size:12px;display:block;overflow:auto;white-space:nowrap}}`;document.head.appendChild(style);
    const oldBtn=document.getElementById('accessBtn');if(oldBtn)oldBtn.remove();const btn=document.createElement('button');btn.id='accessBtn';btn.type='button';btn.className='btn block';btn.textContent='⚙ Hak Akses';btn.onclick=open;const userMenu=document.getElementById('userMenu');const pwBtn=userMenu&&userMenu.querySelector('button[onclick="openPwModal()"]');if(pwBtn&&pwBtn.parentNode===userMenu){pwBtn.insertAdjacentElement('afterend',btn);}else if(userMenu){userMenu.appendChild(btn);}else{document.body.appendChild(btn);}
    const bg=document.createElement('div');bg.id='accessBg';bg.innerHTML=`<div class="access-modal"><div class="access-head"><div><h2>Pengaturan Hak Akses</h2><div class="access-muted">Dikelola khusus oleh KA IPSRS</div></div><button class="access-btn-secondary" onclick="closeAccessPanel()">Tutup</button></div><div id="accessContent"><div class="access-muted">Memuat...</div></div></div>`;bg.onclick=e=>{if(e.target===bg)closeAccessPanel()};document.body.appendChild(bg);
  }
  async function open(){
    let bg=document.getElementById('accessBg');
    if(!bg){mount();bg=document.getElementById('accessBg');}
    if(!bg)return;
    bg.classList.add('show');
    await render();
  }
  window.__ipsrsOpenAccessPanel=function(){
    const s=typeof getSession==='function'?getSession():null;
    if(!s||s.role!=='KA_IPSRS')return;
    return open();
  };
  window.closeAccessPanel=function(){document.getElementById('accessBg').classList.remove('show');};
  async function render(){
    const el=document.getElementById('accessContent');if(!el)return;el.innerHTML='<div class="access-muted">Memuat pengaturan...</div>';
    try{
      const [ac,st,pm,grace,anchorReview]=await Promise.all([
        callAccessRead('apiGetAccessControl'),
        callAccessRead('apiListStaff'),
        callAccessRead('apiListEditPermissions'),
        callAccessRead('apiGetLhiGraceStatus'),
        callAccessRead('apiGetLhiAnchorReview')
      ]);
      if(!ac.ok)throw new Error(ac.msg||'Gagal memuat pengaturan.');
      staffCache=(st&&st.ok?st.data:[]).filter(x=>x.status!=='Nonaktif');
      const perms=pm&&pm.ok?pm.data:[];
      const anchors=anchorReview&&anchorReview.ok&&Array.isArray(anchorReview.data)?anchorReview.data:[];
      const unverifiedAnchors=anchors.filter(x=>!x.lhi_active_since_verified_at).length;
      const graceSummary=grace&&grace.ok&&grace.data ? ('Status: '+esc(grace.data.status)+' · Tenggat: '+esc(new Date(grace.data.deadline_at).toLocaleString('id-ID'))+' · Terpenuhi: '+Number(grace.data.completed||0)+'/'+Number(grace.data.total||0)+' · Belum: '+Number(grace.data.pending||0)+' · Dikecualikan: '+Number(grace.data.excluded||0)) : 'Belum ada insiden kelonggaran yang tercatat.';
      el.innerHTML=`<div class="access-grid"><div class="access-card"><div class="access-row"><div><h3>Visibilitas Laporan Tim</h3><div class="access-muted">AKTIF = semua anggota IPSRS dapat melihat laporan tim. NONAKTIF = hanya pemilik dan KA IPSRS.</div></div><button class="access-switch ${ac.laporan_tim==='AKTIF'?'on':''}" onclick="toggleAccessSetting('LAPORAN_TIM','${ac.laporan_tim}')"></button></div></div><div class="access-card"><div class="access-row"><div><h3>Administrasi — Izin Edit</h3><div class="access-muted">Pengaturan ini disimpan untuk kompatibilitas konfigurasi. Hak edit aktual ditentukan backend melalui pemilik, KA IPSRS, dan EDIT_PERMISSIONS.</div></div><button class="access-switch ${ac.administrasi_edit==='AKTIF'?'on':''}" onclick="toggleAccessSetting('ADMINISTRASI_EDIT','${ac.administrasi_edit}')"></button></div></div></div><div class="access-card"><div class="access-row"><div><h3>Mode Form Blok Aplikasi</h3><div class="access-muted">${ac.lhi_global_block==='AKTIF' ? 'AKTIF — seluruh login normal ditutup. KA IPSRS hanya dapat melanjutkan melalui Form Blok Aplikasi → Reset dan autentikasi akun KA IPSRS.' : 'NONAKTIF — login berjalan normal sesuai status masing-masing petugas.'}</div></div>${ac.lhi_global_block==='AKTIF' ? '<span class="access-muted">Gunakan jalur Reset khusus pada Form Blok Aplikasi. Pemulihan tidak tersedia dari sesi operasional.</span>' : (grace&&grace.ok&&grace.data&&grace.data.status==='GRACE' ? '<span class="access-muted">Kelonggaran 12 jam sedang berjalan</span>' : '<span class="access-muted">Mode blokir tidak aktif</span>')}</div></div><div class="access-card"><h3>Monitoring Kelonggaran 12 Jam</h3><div class="access-muted">${graceSummary}</div></div><div class="access-card"><h3>Verifikasi Tanggal Mulai Aktif Petugas</h3><div class="access-muted">Wajib cocok dengan dokumen HR/TMT atau riwayat master data resmi. Tanggal pembuatan akun hanya data sementara dan tidak boleh dianggap sebagai tanggal mulai aktif tanpa verifikasi.</div><p><strong>${unverifiedAnchors} dari ${anchors.length} petugas aktif belum terverifikasi.</strong></p><table class="access-table access-anchor-table"><thead><tr><th>Petugas</th><th>Anchor tersimpan</th><th>Status</th><th>Tanggal HR (WIB)</th><th>Referensi dokumen HR</th><th>Aksi</th></tr></thead><tbody>${anchors.length?anchors.map((x,i)=>{const verified=!!x.lhi_active_since_verified_at;return '<tr data-lhi-anchor-row="'+i+'" data-staff-id="'+esc(x.staff_id)+'"><td><strong>'+esc(x.nama)+'</strong><div class="access-muted">'+esc(x.staff_id)+' · '+esc(x.role)+'</div></td><td>'+esc(wibDateKey(x.lhi_active_since)||'Belum ada')+'<div class="access-muted">'+esc(x.lhi_active_since_source||'BELUM ADA')+'</div><div class="access-muted">Referensi terakhir: '+esc(x.verification_reference||'Belum ada referensi tersimpan')+'</div></td><td><span class="access-anchor-status '+(verified?'verified':'pending')+'">'+(verified?'TERVERIFIKASI':'PERLU VERIFIKASI')+'</span></td><td><input type="date" data-anchor-date value="'+esc(wibDateKey(x.lhi_active_since))+'"></td><td><input type="text" data-anchor-reference maxlength="300" placeholder="No. SK / TMT / referensi HR"></td><td><button class="access-btn-primary" onclick="verifyLhiAnchor('+i+')">Simpan</button></td></tr>';}).join(''):'<tr><td colspan="6">Tidak ada petugas aktif.</td></tr>'}</tbody></table></div><div class="access-card"><h3>Izin Edit Khusus</h3><div class="access-muted">Berikan izin kepada staf tertentu untuk mengedit laporan staf lain. Laporan KA IPSRS tidak dapat diberi izin edit.</div><div class="access-form"><div><label>Pemberi izin</label><select id="permGrantee">${staffCache.map(x=>`<option value="${esc(x.staff_id)}">${esc(x.nama)} — ${esc(x.role_label||x.role)}</option>`).join('')}</select></div><div><label>Target laporan</label><select id="permTarget">${staffCache.map(x=>`<option value="${esc(x.staff_id)}">${esc(x.nama)} — ${esc(x.role_label||x.role)}</option>`).join('')}</select></div><button class="access-btn-primary" onclick="saveAccessPermission()">Simpan Izin</button></div><table class="access-table"><thead><tr><th>Pemberi</th><th>Target</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${perms.length?perms.map(p=>`<tr><td>${esc(p.granted_to_staff_name)}</td><td>${esc(p.target_staff_name)}</td><td>${p.is_active==='AKTIF'?'AKTIF':'NONAKTIF'}</td><td><button class="access-btn-secondary" onclick="togglePermission('${esc(p.granted_to_staff_id)}','${esc(p.target_staff_id)}','${p.is_active}')">${p.is_active==='AKTIF'?'Cabut':'Aktifkan'}</button></td></tr>`).join(''):'<tr><td colspan="4">Belum ada izin khusus.</td></tr>'}</tbody></table></div><div class="access-actions"><button class="access-btn-secondary" onclick="closeAccessPanel()">Selesai</button></div>`;
    }catch(e){el.innerHTML='<div class="access-muted">Gagal memuat: '+esc(e.message||e)+'</div>';}
  }
  window.toggleAccessSetting=async function(key,current){const next=current==='AKTIF'?'NONAKTIF':'AKTIF';if(!confirm('Ubah '+key+' menjadi '+next+'?'))return;const r=await callAccessApi('apiSetAccessSetting',key,next);if(!r.ok)alert(r.msg||'Gagal mengubah pengaturan.');await render();};
  window.verifyLhiAnchor=async function(index){
    const row=document.querySelector('[data-lhi-anchor-row="'+Number(index)+'"]');
    if(!row)return;
    const staffId=String(row.dataset.staffId||'').trim();
    const date=String(row.querySelector('[data-anchor-date]')?.value||'').trim();
    const reference=String(row.querySelector('[data-anchor-reference]')?.value||'').trim();
    if(!staffId||!date||reference.length<3){
      alert('Tanggal HR dan referensi dokumen resmi wajib diisi.');
      return;
    }
    if(!confirm('Konfirmasi: tanggal mulai aktif petugas ini sudah dicocokkan dengan dokumen HR/TMT atau riwayat master data resmi?')){
      return;
    }
    try{
      const result=await callAccessApi('apiVerifyLhiActiveSince',staffId,date,reference);
      if(!result||result.ok!==true){
        alert((result&&result.msg)||'Verifikasi tanggal aktif gagal.');
        return;
      }
      alert('Tanggal mulai aktif berhasil diverifikasi dan riwayatnya dicatat.');
      await render();
    }catch(error){
      alert('Verifikasi gagal: '+String(error&&error.message||error));
    }
  };
  window.saveAccessPermission=async function(){const g=document.getElementById('permGrantee').value,t=document.getElementById('permTarget').value;if(g===t){alert('Pemberi izin dan target harus berbeda.');return;}const r=await callAccessApi('apiSetEditPermission',g,t,true);if(!r.ok)alert(r.msg||'Gagal menyimpan izin.');await render();};
  window.togglePermission=async function(g,t,current){const next=current==='AKTIF'?false:true;const r=await callAccessApi('apiSetEditPermission',g,t,next);if(!r.ok)alert(r.msg||'Gagal mengubah izin.');await render();};
  const timer=setInterval(()=>{mount();if(mounted)clearInterval(timer);},500);setTimeout(mount,50);
})();
