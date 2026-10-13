/* KA IPSRS master data manager. Soft deactivation preserves historical report snapshots. */
(function(){
'use strict';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],kind='area',busy=false,showInactive=false;
const label={kategori:'Kategori',area:'Area Kerja',item:'Item',subarea:'Sub Area Kerja'};
function session(){try{return typeof getSession==='function'?getSession():null}catch(_){return null}}
function allowed(){return session()?.role==='KA_IPSRS'}
function ensureModal(){
 let bg=document.getElementById('masterDataCrudBg');if(bg)return bg;
 bg=document.createElement('div');bg.id='masterDataCrudBg';bg.className='modal-bg';bg.setAttribute('aria-hidden','true');
 bg.innerHTML='<div class="modal ipsrs-master-crud-modal" role="dialog" aria-modal="true" aria-labelledby="masterCrudTitle"><div class="ipsrs-master-crud-head"><div><h3 id="masterCrudTitle">Manajemen Master Data</h3><div id="masterCrudSub" class="modal-sub"></div></div><button type="button" class="btn" id="masterCrudClose">Tutup</button></div><div id="masterCrudBody"><div class="modal-sub">Memuat master data...</div></div></div>';
 document.body.appendChild(bg);
 bg.querySelector('#masterCrudClose').addEventListener('click',close);
 bg.addEventListener('click',e=>{if(e.target===bg)close()});
 return bg;
}
function close(){const bg=document.getElementById('masterDataCrudBg');if(bg){bg.classList.remove('show');bg.setAttribute('aria-hidden','true')}}
function notify(msg,err=false){const el=document.getElementById('masterCrudNotice');if(el){el.className=err?'msg-err':'modal-sub';el.textContent=msg}}
async function call(op,type,id,name,parentId,sortOrder,active){
 return authRun('apiManageMasterData',op,type||'',id??null,name||'',parentId??null,sortOrder??null,active);
}
async function load(){
 const body=document.getElementById('masterCrudBody');if(!body)return;
 body.innerHTML='<div class="modal-sub">Memuat master data...</div>';
 try{const r=await call('LIST');if(!r?.ok)throw new Error(r?.msg||'Master data gagal dimuat.');rows=Array.isArray(r.data)?r.data:[];render()}
 catch(e){body.innerHTML='<div class="msg-err">'+esc(e.message||e)+'</div>'}
}
function render(){
 const body=document.getElementById('masterCrudBody');if(!body)return;
 const type=kind==='kategori'?'KATEGORI':kind==='area'?'AREA':kind==='item'?'ITEM':'';
 if(kind==='subarea'){body.innerHTML='<div class="modal-sub">Struktur database saat ini hanya menetapkan tiga tipe master: Kategori, Area Kerja, dan Item. Sub Area Kerja belum menjadi tipe data tersendiri, sehingga tidak dibuat sebagai data baru agar sinkronisasi formulir tetap aman.</div>';return}
 const list=rows.filter(x=>x.data_type===type).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),'id'));
 const activeCount=list.filter(x=>x.is_active).length;
 const areas=rows.filter(x=>x.data_type==='AREA'&&x.is_active).sort((a,b)=>String(a.name).localeCompare(String(b.name),'id'));
 const toolbar='<div class="ipsrs-master-crud-toolbar"><div><strong>'+esc(label[kind])+'</strong><div class="modal-sub">'+list.length+' data · '+activeCount+' aktif</div></div><div class="ipsrs-master-crud-actions"><label class="ipsrs-master-toggle"><input type="checkbox" id="masterCrudShowInactive"> Tampilkan nonaktif</label>'+(kind!=='kategori'?'<button class="btn primary" id="masterCrudAdd">+ Tambah</button>':'')+'</div></div>';
 const rowsToShow=list.filter(x=>showInactive||x.is_active);
 const table=rowsToShow.length?'<div class="ipsrs-master-crud-list">'+rowsToShow.map(x=>'<article class="ipsrs-master-crud-row"><div class="ipsrs-master-crud-main"><div class="ipsrs-master-crud-name">'+esc(x.name)+'</div><div class="modal-sub">'+(kind==='item'?'Area: '+esc(x.parent_name||'Tidak diketahui')+' · ':'')+'ID '+esc(x.id)+' · Urutan '+esc(x.sort_order)+' · <span class="'+(x.is_active?'ipsrs-active':'ipsrs-inactive')+'">'+(x.is_active?'Aktif':'Nonaktif')+'</span></div></div><div class="ipsrs-master-crud-row-actions">'+(kind!=='kategori'?'<button class="btn" data-edit="'+x.id+'">Ubah</button><button class="btn '+(x.is_active?'danger':'primary')+'" data-toggle="'+x.id+'" data-active="'+(!x.is_active)+'">'+(x.is_active?'Nonaktifkan':'Aktifkan')+'</button>':'<span class="modal-sub">Dikunci</span>')+'</div></article>').join('')+'</div>':'<div class="modal-sub ipsrs-master-empty">Tidak ada data pada filter ini.</div>';
 body.innerHTML=toolbar+table+'<div id="masterCrudNotice" class="modal-sub" style="margin-top:10px">'+(kind==='kategori'?'Kategori resmi dikunci agar 12 kategori baku tetap konsisten.':'Penonaktifan tidak menghapus data dan tidak menghapus laporan lama.')+'</div>';
 const show=document.getElementById('masterCrudShowInactive');if(show){show.checked=showInactive;show.addEventListener('change',()=>{showInactive=show.checked;render()})}
 const add=document.getElementById('masterCrudAdd');if(add)add.addEventListener('click',()=>form(null,areas));
 body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>form(rows.find(x=>String(x.id)===b.dataset.edit),areas)));
 body.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>toggle(b.dataset.toggle,b.dataset.active==='true')));
}
function form(item,areas){
 const body=document.getElementById('masterCrudBody');if(!body)return;
 const isItem=kind==='item',editing=!!item;
 body.innerHTML='<form id="masterCrudForm" class="ipsrs-master-form"><label for="masterCrudName">Nama '+esc(label[kind])+'</label><input id="masterCrudName" maxlength="120" required value="'+esc(item?.name||'')+'" placeholder="Masukkan nama"><label for="masterCrudOrder">Urutan tampil</label><input id="masterCrudOrder" type="number" min="0" max="9999" value="'+esc(item?.sort_order??999)+'" required>'+(isItem?'<label for="masterCrudParent">Area Kerja</label><select id="masterCrudParent" required><option value="">Pilih area kerja</option>'+areas.map(a=>'<option value="'+a.id+'" '+(String(item?.parent_id||'')===String(a.id)?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select>':'')+'<div id="masterCrudNotice" class="modal-sub"></div><div class="ipsrs-master-form-actions"><button type="button" class="btn" id="masterCrudCancel">Batal</button><button type="submit" class="btn primary">'+(editing?'Simpan perubahan':'Tambah data')+'</button></div></form>';
 body.querySelector('#masterCrudCancel').addEventListener('click',render);
 body.querySelector('#masterCrudForm').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!allowed())return;
  const name=body.querySelector('#masterCrudName').value.trim(),order=Number(body.querySelector('#masterCrudOrder').value),parent=isItem?Number(body.querySelector('#masterCrudParent').value):null;
  if(!name){notify('Nama wajib diisi.',true);return}
  busy=true;const submit=body.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Menyimpan...';
  try{const r=editing?await call('UPDATE',null,item.id,name,isItem?parent:null,order):await call('CREATE',isItem?'ITEM':'AREA',null,name,parent,order);if(!r?.ok)throw new Error(r?.msg||'Penyimpanan gagal.');await load()}
  catch(err){notify(err.message||err,true);submit.disabled=false;submit.textContent=editing?'Simpan perubahan':'Tambah data'}
  finally{busy=false}
 });
}
async function toggle(id,active){
 const row=rows.find(x=>String(x.id)===String(id));if(!row||busy)return;
 const action=active?'mengaktifkan kembali':'menonaktifkan';
 if(!confirm('Yakin '+action+' '+row.data_type+' “'+row.name+'”? Data dan riwayat laporan lama tidak akan dihapus.'))return;
 busy=true;
 try{const r=await call('SET_ACTIVE',null,Number(id),'',null,null,active);if(!r?.ok)throw new Error(r?.msg||'Status gagal diubah.');await load()}
 catch(e){notify(e.message||e,true)}
 finally{busy=false}
}
window.__ipsrsOpenMasterDataManager=function(nextKind){
 if(!allowed()){alert('Menu ini khusus Ka IPSRS.');return}
 kind=['kategori','area','item','subarea'].includes(nextKind)?nextKind:'area';showInactive=false;
 const bg=ensureModal();bg.querySelector('#masterCrudTitle').textContent='Manajemen '+(label[kind]||'Master Data');
 bg.querySelector('#masterCrudSub').textContent='Khusus Ka IPSRS · perubahan dicatat di audit log';
 bg.classList.add('show');bg.setAttribute('aria-hidden','false');load();
};
window.addEventListener('focus',()=>{const bg=document.getElementById('masterDataCrudBg');if(bg?.classList.contains('show')&&allowed())load()});
})();
