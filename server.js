const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway volume is mounted at /data — photos go in /data/photos
const PHOTOS_DIR = process.env.PHOTOS_DIR || '/data/photos';
const DATA_FILE = path.join(process.env.PHOTOS_DIR || '/data', 'photos.json');

// Make sure the photos directory exists
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

// ── MULTER (file upload handler) ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max per file
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/i;
    cb(null, allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype));
  }
});

// ── HELPERS ──
function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return { photos: [], categories: ['Nature', 'Wildlife', 'Landscape', 'City'] };
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── MIDDLEWARE ──
app.use(express.json());
app.use(express.static(__dirname)); // HTML/CSS/JS files
app.use('/photos', express.static(PHOTOS_DIR));           // serve uploaded photos

// ── API ROUTES ──

// GET all photos + categories
app.get('/api/photos', (req, res) => {
  res.json(readData());
});

// POST upload one or more photos
app.post('/api/photos', upload.array('files', 20), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const data = readData();
  const title = req.body.title || 'Untitled';
  const category = req.body.category || data.categories[0] || 'Uncategorized';

  const added = req.files.map((file, i) => ({
    id: `${Date.now()}-${i}`,
    filename: file.filename,
    url: `/photos/${file.filename}`,
    title: req.files.length === 1 ? title : `${title} ${i + 1}`,
    category
  }));

  data.photos.push(...added);
  writeData(data);
  res.json({ success: true, photos: added });
});

// PATCH update a photo (title, category, order)
app.patch('/api/photos/:id', (req, res) => {
  const data = readData();
  const idx = data.photos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.photos[idx] = { ...data.photos[idx], ...req.body };
  writeData(data);
  res.json({ success: true, photo: data.photos[idx] });
});

// DELETE a photo
app.delete('/api/photos/:id', (req, res) => {
  const data = readData();
  const idx = data.photos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  // Delete the actual file
  const file = path.join(PHOTOS_DIR, data.photos[idx].filename);
  if (fs.existsSync(file)) fs.unlinkSync(file);

  data.photos.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// PATCH reorder — send full ordered array of ids
app.patch('/api/photos', (req, res) => {
  const { order } = req.body; // array of ids in new order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  const data = readData();
  const map = Object.fromEntries(data.photos.map(p => [p.id, p]));
  data.photos = order.map(id => map[id]).filter(Boolean);
  writeData(data);
  res.json({ success: true });
});

// GET categories
app.get('/api/categories', (req, res) => {
  res.json(readData().categories);
});

// POST add a category
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const data = readData();
  if (!data.categories.includes(name)) { data.categories.push(name); writeData(data); }
  res.json({ success: true, categories: data.categories });
});

// DELETE a category
app.delete('/api/categories/:name', (req, res) => {
  const data = readData();
  data.categories = data.categories.filter(c => c !== req.params.name);
  writeData(data);
  res.json({ success: true, categories: data.categories });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
