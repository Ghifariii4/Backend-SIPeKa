const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Pastikan folder public/uploads/ ada
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi penyimpanan Multer di public/uploads/ dengan nama unik
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

// Filter hanya file gambar
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|gif/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimeType = file.mimetype.toLowerCase();

  if (allowedExtensions.test(ext) || allowedExtensions.test(mimeType)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (jpg, jpeg, png, webp, gif) yang diperbolehkan!'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Maksimal 10MB
  },
  fileFilter
});

// Middleware helper fleksibel untuk menangani upload gambar baik dengan fieldname 'image', 'file', atau tanpa file
const uploadFlexible = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        message: 'Gagal mengunggah file gambar: ' + err.message,
        data: null
      });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files.find(f => f.fieldname === 'image' || f.fieldname === 'file') || req.files[0];
    }
    next();
  });
};

upload.flexible = uploadFlexible;

module.exports = upload;
