import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import GalleryItem from '../models/GalleryItem.js';
import { detectImageType } from './upload.js';

const router = express.Router();
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      return callback(new Error('Only JPEG, PNG, and WEBP images are allowed.'));
    }
    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const parseUpload = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image must be 5MB or smaller.' });
    return res.status(400).json({ error: error.message || 'Invalid image upload.' });
  });
};

// GET /api/gallery — public customer gallery
router.get('/', async (_req, res) => {
  try {
    const items = await GalleryItem.find().sort({ createdAt: -1 }).limit(60).lean();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Unable to load the gallery.' });
  }
});

// POST /api/gallery — public customer photo and review submission
router.post('/', parseUpload, async (req, res) => {
  try {
    const customerName = String(req.body.customerName || '').trim();
    const review = String(req.body.review || '').trim();
    const rating = Number(req.body.rating);

    if (customerName.length < 2 || customerName.length > 60) {
      return res.status(400).json({ error: 'Name must be between 2 and 60 characters.' });
    }
    if (review.length < 8 || review.length > 500) {
      return res.status(400).json({ error: 'Review must be between 8 and 500 characters.' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Please choose a photo.' });

    const detectedType = detectImageType(req.file.buffer);
    const expectedMime = detectedType === 'jpeg'
      ? new Set(['image/jpeg', 'image/jpg'])
      : new Set([`image/${detectedType}`]);
    const extension = path.extname(req.file.originalname || '').toLowerCase();
    if (!detectedType || !expectedMime.has(req.file.mimetype) || !allowedExtensions.has(extension)) {
      return res.status(400).json({ error: 'Uploaded file is not a valid supported image.' });
    }

    const safeExtension = detectedType === 'jpeg' ? '.jpg' : `.${detectedType}`;
    const filename = `gallery-${crypto.randomBytes(18).toString('hex')}${safeExtension}`;
    await fs.promises.writeFile(path.join(uploadDir, filename), req.file.buffer, { flag: 'wx' });

    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    const item = await GalleryItem.create({
      customerName,
      review,
      rating,
      imageUrl: `${serverUrl.replace(/\/$/, '')}/uploads/${filename}`,
    });

    res.status(201).json({ item });
  } catch (error) {
    res.status(500).json({ error: 'Unable to publish your review right now.' });
  }
});

export default router;
