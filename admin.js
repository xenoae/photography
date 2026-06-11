// ── All data now comes from the server API, not localStorage ──

let photos = [];
let categories = [];
let adminLoggedIn = sessionStorage.getItem('admin_auth') === '1';
const ADMIN_PASS = 'admin123'; // change this

// ── LOAD DATA FROM SERVER ──
async function loadData() {
  try {
    const res = await fetch('/api/photos');
    const data = await res.json();
    photos = data.photos || [];
    categories = data.categories || [];
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

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
async function openAdmin() {
  await loadData();
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
    openAdmin();
  } else {
    document.getElementById('adminLoginErr').style.display = 'block';
  }
}

let adminActiveTab = 'upload';
let pendingFiles = []; // {file, previewSrc, name}
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

// ── UPLOAD ──
function renderUploadTab() {
  const opts = categories.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('adminTabContent').innerHTML = `
    <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()"
         ondragover="dragOverZone(event)" ondragleave="dragLeaveZone(event)" ondrop="dropFiles(event)">
      <p><strong>Click to select photos</strong><br>or drag and drop here<br>
      <span style="font-size:0.72rem;color:var(--light)">JPG · PNG · WebP · max 20MB each</span></p>
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
      <div style="display:flex;gap:8px;margin-top:4px;align-items:center">
        <button class="btn-admin-primary" onclick="uploadPhotos()">Upload to Gallery</button>
        <button class="btn-admin-secondary" onclick="clearUploads()">Clear</button>
        <span id="uploadStatus" style="font-size:0.75rem;color:var(--mid)"></span>
      </div>
    </div>`;
  pendingFiles = [];
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
    r.onload = ev => {
      pendingFiles.push({ file: f, previewSrc: ev.target.result, name: f.name.replace(/\.[^.]+$/, '') });
      renderPreviews();
    };
    r.readAsDataURL(f);
  });
}
function renderPreviews() {
  document.getElementById('previewGrid').innerHTML = pendingFiles.map((u, i) => `
    <div class="preview-thumb">
      <img src="${u.previewSrc}" alt="">
      <button class="preview-remove" onclick="removePending(${i})">×</button>
    </div>`).join('');
  document.getElementById('uploadForm').style.display = pendingFiles.length ? 'block' : 'none';
  if (pendingFiles.length === 1) document.getElementById('uploadTitle').value = pendingFiles[0].name;
}
function removePending(i) { pendingFiles.splice(i, 1); renderPreviews(); }

async function uploadPhotos() {
  if (!pendingFiles.length) return;
  const title = document.getElementById('uploadTitle').value.trim() || 'Untitled';
  const category = document.getElementById('uploadCat').value;
  const status = document.getElementById('uploadStatus');

  status.textContent = 'Uploading…';

  const formData = new FormData();
  pendingFiles.forEach(p => formData.append('files', p.file));
  formData.append('title', title);
  formData.append('category', category);

  try {
    const res = await fetch('/api/photos', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    await loadData();
    if (typeof initGallery === 'function') initGallery();
    if (typeof updateStats === 'function') updateStats();
    renderAdminMain('manage');
  } catch (e) {
    status.textContent = 'Upload failed: ' + e.message;
  }
}
function clearUploads() { pendingFiles = []; renderUploadTab(); }

// ── MANAGE ──
function renderManageTab() {
  if (!photos.length) {
    document.getElementById('adminTabContent').innerHTML = `<p style="color:var(--mid);font-size:0.82rem;margin-top:16px">No photos yet.</p>`;
    return;
  }
  document.getElementById('adminTabContent').innerHTML = `
    <p style="font-size:0.72rem;color:var(--mid);margin-bottom:14px">Drag to reorder</p>
    <div class="photo-manage-list" id="manageList">
      ${photos.map((p, i) => `
        <div class="photo-manage-item" draggable="true" data-idx="${i}"
             ondragstart="dmDragStart(event,${i})" ondragover="dmDragOver(event,${i})"
             ondrop="dmDrop(event,${i})" ondragleave="dmDragLeave(event)">
          <img class="photo-manage-thumb" src="${p.url}" alt="">
          <div class="photo-manage-info">
            <div class="photo-manage-title">${p.title}</div>
            <div class="photo-manage-cat">${p.category}</div>
          </div>
          <div class="photo-manage-actions">
            <button class="btn-icon" onclick="editPhoto(${i})">✎</button>
            <button class="btn-icon danger" onclick="deletePhoto('${p.id}')">✕</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function dmDragStart(e, i) { dragSrc = i; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); }
function dmDragOver(e, i) { e.preventDefault(); if (dragSrc !== i) e.currentTarget.setAttribute('data-drag-over', ''); }
function dmDragLeave(e) { e.currentTarget.removeAttribute('data-drag-over'); }
async function dmDrop(e, i) {
  e.preventDefault(); e.currentTarget.removeAttribute('data-drag-over');
  if (dragSrc === null || dragSrc === i) return;
  const moved = photos.splice(dragSrc, 1)[0]; photos.splice(i, 0, moved); dragSrc = null;
  // Save new order to server
  await fetch('/api/photos', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: photos.map(p => p.id) })
  });
  if (typeof initGallery === 'function') initGallery();
  renderAdminMain('manage');
}

async function deletePhoto(id) {
  if (!confirm('Delete this photo?')) return;
  await fetch(`/api/photos/${id}`, { method: 'DELETE' });
  await loadData();
  if (typeof initGallery === 'function') initGallery();
  if (typeof updateStats === 'function') updateStats();
  renderManageTab();
}

function editPhoto(i) {
  const p = photos[i];
  const opts = categories.map(c => `<option value="${c}"${c === p.category ? ' selected' : ''}>${c}</option>`).join('');
  document.getElementById('adminTabContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
      <button class="btn-admin-secondary" style="padding:6px 12px" onclick="renderAdminMain('manage')">← Back</button>
    </div>
    <img src="${p.url}" style="width:100%;aspect-ratio:3/2;object-fit:cover;margin-bottom:16px">
    <div class="form-group-admin"><label class="form-label">Title</label>
      <input class="form-input" id="editTitle" type="text" value="${p.title}"></div>
    <div class="form-group-admin"><label class="form-label">Category</label>
      <select class="form-input" id="editCat">${opts}</select></div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="btn-admin-primary" onclick="saveEdit('${p.id}')">Save</button>
      <button class="btn-admin-secondary" onclick="renderAdminMain('manage')">Cancel</button>
    </div>`;
}

async function saveEdit(id) {
  const title = document.getElementById('editTitle').value.trim() || 'Untitled';
  const category = document.getElementById('editCat').value;
  await fetch(`/api/photos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category })
  });
  await loadData();
  if (typeof initGallery === 'function') initGallery();
  renderAdminMain('manage');
}

// ── CATEGORIES ──
function renderCategoriesTab() {
  document.getElementById('adminTabContent').innerHTML = `
    <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:20px">
      <div style="flex:1"><label class="form-label">New Category</label>
        <input class="form-input" id="newCatInput" type="text" placeholder="e.g. Portrait"
               onkeydown="if(event.key==='Enter')addCategory()"></div>
      <button class="btn-admin-primary" onclick="addCategory()">Add</button>
    </div>
    <div class="categories-list">
      ${categories.map((c, i) => {
        const cnt = photos.filter(p => p.category === c).length;
        return `<div class="category-item">
          <div><div class="category-name">${c}</div>
          <div class="category-count">${cnt} photo${cnt !== 1 ? 's' : ''}</div></div>
          <button class="btn-icon danger" onclick="deleteCategory('${c}')">✕</button>
        </div>`;
      }).join('')}
    </div>`;
}

async function addCategory() {
  const v = document.getElementById('newCatInput').value.trim();
  if (!v) return;
  await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: v })
  });
  await loadData();
  renderAdminMain('categories');
}

async function deleteCategory(name) {
  const cnt = photos.filter(p => p.category === name).length;
  if (cnt > 0 && !confirm(`"${name}" has ${cnt} photo(s). Delete anyway?`)) return;
  await fetch(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
  await loadData();
  renderAdminMain('categories');
}
