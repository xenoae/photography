// ── DATA ──
let photos = JSON.parse(localStorage.getItem('portfolio_photos') || '[]');
let categories = JSON.parse(localStorage.getItem('portfolio_categories') || '["Nature","Wildlife","Landscape","City"]');
let adminLoggedIn = sessionStorage.getItem('admin_auth') === '1';
const ADMIN_PASS = 'admin123';

function saveData() {
  localStorage.setItem('portfolio_photos', JSON.stringify(photos));
  localStorage.setItem('portfolio_categories', JSON.stringify(categories));
}

window.addEventListener('scroll', () => {
  // no scroll effect needed for this minimal style
});

function toggleMobileMenu() {
  document.getElementById('mobileMenu')?.classList.toggle('open');
}

// ── ADMIN OPEN/CLOSE ──
function openAdminPrompt(e) {
  if (e) e.preventDefault();
  if (adminLoggedIn) { openAdmin(); return; }
  renderAdminLogin();
  document.getElementById('adminOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAdmin() {
  document.getElementById('adminOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('click', e => {
  if (e.target.id === 'adminOverlay') closeAdmin();
});
function openAdmin() {
  renderAdminMain();
  document.getElementById('adminOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderAdminLogin() {
  document.getElementById('adminBody').innerHTML = `
    <div class="admin-login">
      <h3>Admin</h3>
      <p>Enter your password to manage photos.</p>
      <div class="form-group-admin">
        <label class="form-label">Password</label>
        <input class="form-input" type="password" id="adminPassInput" placeholder="Password"
               onkeydown="if(event.key==='Enter')checkAdminPass()">
      </div>
      <button class="btn-admin-primary" onclick="checkAdminPass()">Enter</button>
      <p class="admin-login-error" id="adminLoginErr">Incorrect password.</p>
    </div>`;
  setTimeout(() => document.getElementById('adminPassInput')?.focus(), 50);
}

function checkAdminPass() {
  if (document.getElementById('adminPassInput').value === ADMIN_PASS) {
    adminLoggedIn = true;
    sessionStorage.setItem('admin_auth', '1');
    renderAdminMain();
  } else {
    document.getElementById('adminLoginErr').style.display = 'block';
  }
}

let adminActiveTab = 'upload';
let pendingUploads = [];
let dragSrc = null;

function renderAdminMain(tab) {
  if (tab) adminActiveTab = tab;
  document.getElementById('adminBody').innerHTML = `
    <div class="admin-tabs">
      <button class="admin-tab${adminActiveTab==='upload'?' active':''}" onclick="renderAdminMain('upload')">Upload</button>
      <button class="admin-tab${adminActiveTab==='manage'?' active':''}" onclick="renderAdminMain('manage')">Manage</button>
      <button class="admin-tab${adminActiveTab==='categories'?' active':''}" onclick="renderAdminMain('categories')">Categories</button>
    </div>
    <div id="adminTabContent"></div>`;
  if (adminActiveTab === 'upload') renderUploadTab();
  if (adminActiveTab === 'manage') renderManageTab();
  if (adminActiveTab === 'categories') renderCategoriesTab();
}

function renderUploadTab() {
  const opts = categories.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('adminTabContent').innerHTML = `
    <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()"
         ondragover="dragOverZone(event)" ondragleave="dragLeaveZone(event)" ondrop="dropFiles(event)">
      <p><strong>Click to select photos</strong><br>or drag and drop here<br>
      <span style="font-size:0.72rem;color:var(--light)">JPG · PNG · WebP</span></p>
    </div>
    <input type="file" id="fileInput" multiple accept="image/*" onchange="handleFiles(this.files)">
    <div class="preview-grid" id="previewGrid"></div>
    <div id="uploadForm" style="display:none">
      <div class="form-group-admin">
        <label class="form-label">Title</label>
        <input class="form-input" id="uploadTitle" type="text" placeholder="Photo title">
      </div>
      <div class="form-group-admin">
        <label class="form-label">Category</label>
        <select class="form-input" id="uploadCat">${opts}</select>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-admin-primary" onclick="addPhotos()">Add to Gallery</button>
        <button class="btn-admin-secondary" onclick="clearUploads()">Clear</button>
      </div>
    </div>`;
  pendingUploads = [];
}

function dragOverZone(e) { e.preventDefault(); document.getElementById('uploadZone').classList.add('dragover'); }
function dragLeaveZone(e) { document.getElementById('uploadZone').classList.remove('dragover'); }
function dropFiles(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
}
function handleFiles(files) {
  Array.from(files).forEach(f => {
    const r = new FileReader();
    r.onload = ev => { pendingUploads.push({ src: ev.target.result, name: f.name.replace(/\.[^.]+$/,'') }); renderPreviews(); };
    r.readAsDataURL(f);
  });
}
function renderPreviews() {
  document.getElementById('previewGrid').innerHTML = pendingUploads.map((u,i) => `
    <div class="preview-thumb">
      <img src="${u.src}" alt="">
      <button class="preview-remove" onclick="removePending(${i})">×</button>
    </div>`).join('');
  document.getElementById('uploadForm').style.display = pendingUploads.length ? 'block' : 'none';
  if (pendingUploads.length === 1) document.getElementById('uploadTitle').value = pendingUploads[0].name;
}
function removePending(i) { pendingUploads.splice(i,1); renderPreviews(); }
function addPhotos() {
  const title = document.getElementById('uploadTitle').value.trim() || 'Untitled';
  const cat = document.getElementById('uploadCat').value;
  pendingUploads.forEach((u,i) => {
    photos.push({ id: Date.now()+i, src: u.src, title: pendingUploads.length===1?title:`${title} ${i+1}`, category: cat });
  });
  saveData(); pendingUploads = [];
  if (typeof initGallery === 'function') initGallery();
  if (typeof updateStats === 'function') updateStats();
  renderAdminMain('manage');
}
function clearUploads() { pendingUploads = []; renderUploadTab(); }

function renderManageTab() {
  if (!photos.length) {
    document.getElementById('adminTabContent').innerHTML = `<p style="color:var(--mid);font-size:0.82rem;margin-top:16px">No photos yet.</p>`;
    return;
  }
  document.getElementById('adminTabContent').innerHTML = `
    <p style="font-size:0.72rem;color:var(--mid);margin-bottom:14px">Drag to reorder</p>
    <div class="photo-manage-list" id="manageList">
      ${photos.map((p,i) => `
        <div class="photo-manage-item" draggable="true" data-idx="${i}"
             ondragstart="dmDragStart(event,${i})" ondragover="dmDragOver(event,${i})"
             ondrop="dmDrop(event,${i})" ondragleave="dmDragLeave(event)">
          <img class="photo-manage-thumb" src="${p.src}" alt="">
          <div class="photo-manage-info">
            <div class="photo-manage-title">${p.title}</div>
            <div class="photo-manage-cat">${p.category}</div>
          </div>
          <div class="photo-manage-actions">
            <button class="btn-icon" onclick="editPhoto(${i})">✎</button>
            <button class="btn-icon danger" onclick="deletePhoto(${i})">✕</button>
          </div>
        </div>`).join('')}
    </div>`;
}
function dmDragStart(e,i) { dragSrc=i; e.dataTransfer.effectAllowed='move'; e.currentTarget.classList.add('dragging'); }
function dmDragOver(e,i) { e.preventDefault(); if(dragSrc!==i) e.currentTarget.setAttribute('data-drag-over',''); }
function dmDragLeave(e) { e.currentTarget.removeAttribute('data-drag-over'); }
function dmDrop(e,i) {
  e.preventDefault(); e.currentTarget.removeAttribute('data-drag-over');
  if(dragSrc===null||dragSrc===i) return;
  const m = photos.splice(dragSrc,1)[0]; photos.splice(i,0,m); dragSrc=null;
  saveData();
  if(typeof initGallery==='function') initGallery();
  renderAdminMain('manage');
}
function deletePhoto(i) {
  if(!confirm('Delete this photo?')) return;
  photos.splice(i,1); saveData();
  if(typeof initGallery==='function') initGallery();
  if(typeof updateStats==='function') updateStats();
  renderManageTab();
}
function editPhoto(i) {
  const p = photos[i];
  const opts = categories.map(c=>`<option value="${c}"${c===p.category?' selected':''}>${c}</option>`).join('');
  document.getElementById('adminTabContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
      <button class="btn-admin-secondary" style="padding:6px 12px" onclick="renderAdminMain('manage')">← Back</button>
    </div>
    <img src="${p.src}" style="width:100%;aspect-ratio:3/2;object-fit:cover;margin-bottom:16px">
    <div class="form-group-admin"><label class="form-label">Title</label>
      <input class="form-input" id="editTitle" type="text" value="${p.title}"></div>
    <div class="form-group-admin"><label class="form-label">Category</label>
      <select class="form-input" id="editCat">${opts}</select></div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="btn-admin-primary" onclick="saveEdit(${i})">Save</button>
      <button class="btn-admin-secondary" onclick="renderAdminMain('manage')">Cancel</button>
    </div>`;
}
function saveEdit(i) {
  photos[i].title = document.getElementById('editTitle').value.trim()||'Untitled';
  photos[i].category = document.getElementById('editCat').value;
  saveData();
  if(typeof initGallery==='function') initGallery();
  renderAdminMain('manage');
}

function renderCategoriesTab() {
  document.getElementById('adminTabContent').innerHTML = `
    <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:20px">
      <div style="flex:1"><label class="form-label">New Category</label>
        <input class="form-input" id="newCatInput" type="text" placeholder="e.g. Portrait"
               onkeydown="if(event.key==='Enter')addCategory()"></div>
      <button class="btn-admin-primary" onclick="addCategory()">Add</button>
    </div>
    <div class="categories-list">
      ${categories.map((c,i) => {
        const cnt = photos.filter(p=>p.category===c).length;
        return `<div class="category-item">
          <div><div class="category-name">${c}</div>
          <div class="category-count">${cnt} photo${cnt!==1?'s':''}</div></div>
          <button class="btn-icon danger" onclick="deleteCategory(${i})">✕</button>
        </div>`;
      }).join('')}
    </div>`;
}
function addCategory() {
  const v = document.getElementById('newCatInput').value.trim();
  if(!v||categories.includes(v)) return;
  categories.push(v); saveData(); renderAdminMain('categories');
}
function deleteCategory(i) {
  const cat = categories[i];
  const cnt = photos.filter(p=>p.category===cat).length;
  if(cnt>0 && !confirm(`"${cat}" has ${cnt} photo(s). Delete anyway?`)) return;
  categories.splice(i,1); saveData(); renderAdminMain('categories');
}
