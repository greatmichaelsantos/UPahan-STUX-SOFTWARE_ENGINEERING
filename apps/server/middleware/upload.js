const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createStorage = (subDir) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  if (allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const docFilter = (req, file, cb) => {
  const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  const allowedExt  = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (allowedMime.includes(file.mimetype) && allowedExt.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and PDF files are accepted.'), false);
  }
};

const imageOnlyFilter = (req, file, cb) => {
  const allowedMime = ['image/jpeg', 'image/jpg', 'image/png'];
  const allowedExt  = /jpeg|jpg|png/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (allowedMime.includes(file.mimetype) && allowedExt.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG images are accepted.'), false);
  }
};

const unitPhotoUpload = multer({
  storage: createStorage('units'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const maintenancePhotoUpload = multer({
  storage: createStorage('maintenance'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const paymentProofUpload = multer({
  storage: createStorage('payments'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: docFilter,
});

// ID front + back (both fields, 5 MB each, JPG/PNG only)
const documentIdUpload = multer({
  storage: createStorage('documents'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageOnlyFilter,
}).fields([
  { name: 'frontImage', maxCount: 1 },
  { name: 'backImage',  maxCount: 1 },
]);

// Contract (single file, 5 MB, JPG/PNG/PDF)
const contractUpload = multer({
  storage: createStorage('documents'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: docFilter,
}).single('contractFile');

// Profile avatar (single image, 2 MB)
const avatarUpload = multer({
  storage: createStorage('avatars'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single('avatar');

// Wraps a multer upload call so MulterError and fileFilter errors
// return a 400 JSON response instead of falling through to the 500 handler.
const wrapUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (!err) return next();
    const msg = err instanceof multer.MulterError
      ? err.message
      : (err.message || 'File upload failed.');
    return res.status(400).json({ success: false, message: msg });
  });
};

module.exports = {
  unitPhotoUpload, maintenancePhotoUpload, paymentProofUpload,
  documentIdUpload, contractUpload, avatarUpload,
  wrapUpload,
};
