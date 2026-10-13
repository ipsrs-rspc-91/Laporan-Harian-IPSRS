/* KA IPSRS master data manager. Delete is a soft deactivation to preserve historical reports. */
(function(){
'use strict';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],kind='area',busy=false,showInactive=false;
const label={kategori:'Kategori',area:'Area Kerja',subarea:'Sub Area Kerja',item:'Item'};
function session(){try{return typeof getSession==='function'?getSession():null}catch(_){return null}}
function allowed(){return session()?.role==='KA_IPSRS'}
function typeOf(k){return ({kategori:'KATEGORI',area:'AREA',subarea:'SUBAREA',item:'ITEM'})[k]||'AREA'}
function ensureModal(){
 let bg=document.getElementById('masterDataCrudBg');if(bg)return bg;
 bg=document.createElement('div');bg.id='masterDataCrudBg';bg.className='modal-bg';bg.setAttribute('aria-hidden','true');
 bg.innerHTML='<div class="modal ipsrs-master-crud-modal" role="dialog" aria-modal="true" aria-labelledby="masterCrudTitle"><div class="ipsrs-master-crud-head"><div><h3 id="masterCrudTitle">Manajemen Master Data</h3><div id="masterCrudSub" class="modal-sub"></div></div><button type="button" class="btn" id="masterCrudClose">Tutup</button></div><div id="masterCrudBody"><div class="modal-sub">Memuat master data...</div></div></div>';
 document.body.appendChild(bg);bg.querySelector('#masterCrudClose').addEventListener('click',close);bg.addEventListener('click',e=>{if(e.target===bg)close()});return bg;
}
function close(){const bg=document.getElementById('masterDataCrudBg');if(bg){bg.classList.remove('show');bg.setAttribute('aria-hidden','true')}}
function notify(msg,err=false){const el=document.getElementById('masterCrudNotice');if(el){el.className=err?'msg-err':'modal-sub';el.textContent=msg}}
async function call(op,type,id,name,parentId,sortOrder,active){return authRun('apiManageMasterData',op,type||'',id??null,name||'',parentId??null,sortOrder??null,active)}
async function load(){
 const body=document.getElementById('masterCrudBody');if(!body)return;body.innerHTML='<div class="modal-sub">Memuat master data...</div>';
 try{const r=await call('LIST');if(!r?.ok)throw new Error(r?.msg||'Master data gagal dimuat.');rows=Array.isArray(r.data)?r.data:[];render()}
 catch(e){body.innerHTML='<div class="msg-err">'+esc(e.message||e)+'</div>'}
}
function render(){
 const body=document.getElementById('masterCrudBody');if(!body)return;
 const type=typeOf(kind),list=rows.filter(x=>x.data_type===type).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),'id'));
 const activeCount=list.filter(x=>x.is_active).length;
 const areas=rows.filter(x=>x.data_type==='AREA'&&x.is_active).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),'id'));
 const subareas=rows.filter(x=>x.data_type==='SUBAREA'&&x.is_active).sort((a,b)=>String(a.parent_name||'').localeCompare(String(b.parent_name||''),'id')||String(a.name).localeCompare(String(b.name),'id'));
 const toolbar='<div class="ipsrs-master-crud-toolbar"><div><strong>'+esc(label[kind])+'</strong><div class="modal-sub">'+list.length+' data · '+activeCount+' aktif</div></div><div class="ipsrs-master-crud-actions"><label class="ipsrs-master-toggle"><input type="checkbox" id="masterCrudShowInactive"> Tampilkan nonaktif</label><button class="btn primary" id="masterCrudAdd">+ Tambah</button></div></div>';
 const rowsToShow=list.filter(x=>showInactive||x.is_active);
 const table=rowsToShow.length?'<div class="ipsrs-master-crud-list">'+rowsToShow.map(x=>{
  const parentText=(kind==='subarea'?'Area induk: '+esc(x.parent_name||'Tidak diketahui')+' · ':kind==='item'?'Induk: '+esc(x.parent_name||'Tidak diketahui')+' · ':'');
  const actions=x.is_active?'<button class="btn" data-edit="'+x.id+'">Ubah</button><button class="btn danger" data-delete="'+x.id+'">Hapus</button>':'<button class="btn primary" data-toggle="'+x.id+'" data-active="true">Aktifkan kembali</button>';
  return '<article class="ipsrs-master-crud-row"><div class="ipsrs-master-crud-main"><div class="ipsrs-master-crud-name">'+esc(x.name)+'</div><div class="modal-sub">'+parentText+'ID '+esc(x.id)+' · Urutan '+esc(x.sort_order)+' · <span class="'+(x.is_active?'ipsrs-active':'ipsrs-inactive')+'">'+(x.is_active?'Aktif':'Nonaktif')+'</span></div></div><div class="ipsrs-master-crud-row-actions">'+actions+'</div></article>';
 }).join('')+'</div>':'<div class="modal-sub ipsrs-master-empty">Tidak ada data pada filter ini.</div>';
 body.innerHTML=toolbar+table+'<div id="masterCrudNotice" class="modal-sub" style="margin-top:10px">Tombol Hapus menonaktifkan data agar laporan dan riwayat lama tetap aman. Pengelolaan hanya untuk KA IPSRS.</div>';
 const show=document.getElementById('masterCrudShowInactive');if(show){show.checked=showInactive;show.addEventListener('change',()=>{showInactive=show.checked;render()})}
 document.getElementById('masterCrudAdd')?.addEventListener('click',()=>form(null,areas,subareas));
 body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>form(rows.find(x=>String(x.id)===b.dataset.edit),areas,subareas)));
 body.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>setActive(b.dataset.delete,false,true)));
 body.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>setActive(b.dataset.toggle,b.dataset.active==='true',false)));
}
function form(item,areas,subareas){
 const body=document.getElementById('masterCrudBody');if(!body)return;
 const editing=!!item,isSubarea=kind==='subarea',isItem=kind==='item',needsParent=isSubarea||isItem;
 const parents=isSubarea?areas:(isItem?[...areas,...subareas]:[]);
 const parentLabel=isSubarea?'Area Kerja induk': 'Area Kerja / Sub Area Kerja';
 const parentOptions=parents.map(a=>{
  const display=a.data_type==='SUBAREA'?(String(a.parent_name||'')+' / '+a.name):a.name;
  return '<option value="'+a.id+'" '+(String(item?.parent_id||'')===String(a.id)?'selected':'')+'>'+esc(display)+'</option>';
 }).join('');
 body.innerHTML='<form id="masterCrudForm" class="ipsrs-master-form"><label for="masterCrudName">Nama '+esc(label[kind])+'</label><input id="masterCrudName" maxlength="120" required value="'+esc(item?.name||'')+'" placeholder="Masukkan nama"><label for="masterCrudOrder">Urutan tampil</label><input id="masterCrudOrder" type="number" min="0" max="9999" value="'+esc(item?.sort_order??999)+'" required>'+(needsParent?'<label for="masterCrudParent">'+esc(parentLabel)+'</label><select id="masterCrudParent" required><option value="">Pilih induk</option>'+parentOptions+'</select>':'')+'<div id="masterCrudNotice" class="modal-sub"></div><div class="ipsrs-master-form-actions"><button type="button" class="btn" id="masterCrudCancel">Batal</button><button type="submit" class="btn primary">'+(editing?'Simpan perubahan':'Tambah data')+'</button></div></form>';
 body.querySelector('#masterCrudCancel').addEventListener('click',render);
 body.querySelector('#masterCrudForm').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!allowed())return;
  const name=body.querySelector('#masterCrudName').value.trim(),order=Number(body.querySelector('#masterCrudOrder').value),parent=needsParent?Number(body.querySelector('#masterCrudParent').value):null;
  if(!name){notify('Nama wajib diisi.',true);return}
  if(needsParent&&!parent){notify('Silakan pilih induk.',true);return}
  busy=true;const submit=body.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Menyimpan...';
  try{const r=editing?await call('UPDATE',null,item.id,name,parent,order):await call('CREATE',typeOf(kind),null,name,parent,order);if(!r?.ok)throw new Error(r?.msg||'Penyimpanan gagal.');await load()}
  catch(err){notify(err.message||err,true);submit.disabled=false;submit.textContent=editing?'Simpan perubahan':'Tambah data'}
  finally{busy=false}
 });
}
async function setActive(id,active,deleting){
 const row=rows.find(x=>String(x.id)===String(id));if(!row||busy)return;
 const prompt=deleting?'Hapus '+label[String(row.data_type||'').toLowerCase()]+' “'+row.name+'”? Data akan dinonaktifkan, bukan dihapus permanen, agar laporan lama tetap aman.':'Aktifkan kembali '+row.name+'?';
 if(!confirm(prompt))return;
 busy=true;
 try{const r=deleting?await call('DELETE',null,Number(id),'',null,null,false):await call('SET_ACTIVE',null,Number(id),'',null,null,active);if(!r?.ok)throw new Error(r?.msg||'Status gagal diubah.');await load()}
 catch(e){notify(e.message||e,true)}
 finally{busy=false}
}
window.__ipsrsOpenMasterDataManager=function(nextKind){
 if(!allowed()){alert('Menu ini khusus Ka IPSRS.');return}
 kind=['kategori','area','subarea','item'].includes(nextKind)?nextKind:'area';showInactive=false;
 const bg=ensureModal();bg.querySelector('#masterCrudTitle').textContent='Manajemen '+label[kind];bg.querySelector('#masterCrudSub').textContent='Khusus Ka IPSRS · perubahan dicatat di audit log';bg.classList.add('show');bg.setAttribute('aria-hidden','false');load();
};
window.addEventListener('focus',()=>{const bg=document.getElementById('masterDataCrudBg');if(bg?.classList.contains('show')&&allowed())load()});
})();