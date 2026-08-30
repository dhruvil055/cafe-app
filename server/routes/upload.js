import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { adminOnly, protect } from '../middleware/auth.js';

const router = express.Router();
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    return cb(new Error('Only JPEG, PNG, WEBP images with safe extensions are allowed.'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const hasPngStructure = (buffer) => {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8;
  let hasHeader = false;
  let hasData = false;
  let hasEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    if (type === 'IHDR') {
      if (length !== 13 || buffer.readUInt32BE(offset + 8) === 0 || buffer.readUInt32BE(offset + 12) === 0) return false;
      hasHeader = true;
    }
    if (type === 'IDAT') hasData = true;
    if (type === 'IEND') {
      hasEnd = length === 0 && end === buffer.length;
      break;
    }
    offset = end;
  }
  return hasHeader && hasData && hasEnd;
};

const hasJpegStructure = (buffer) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  let hasFrame = false;
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd9) return hasFrame && offset === buffer.length;
    if (marker === 0xda) {
      // Start-of-scan: compressed data runs until the final EOI marker.
      const end = buffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
      return hasFrame && end > offset + 2 && end + 2 === buffer.length;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return false;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return false;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 7 || buffer.readUInt16BE(offset + 3) === 0 || buffer.readUInt16BE(offset + 5) === 0) return false;
      hasFrame = true;
    }
    offset += length;
  }
  return false;
};

const hasWebpStructure = (buffer) => {
  if (buffer.length < 16 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return false;
  const riffSize = buffer.readUInt32LE(4);
  if (riffSize + 8 !== buffer.length) return false;
  let offset = 12;
  let hasImageChunk = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > buffer.length) return false;
    if (['VP8 ', 'VP8L', 'VP8X'].includes(type) && size > 0) hasImageChunk = true;
    offset = end;
  }
  return hasImageChunk && offset === buffer.length;
};

const detectImageType = (buffer) => {
  if (hasJpegStructure(buffer)) return 'jpeg';
  if (hasPngStructure(buffer)) return 'png';
  if (hasWebpStructure(buffer)) return 'webp';
  return null;
};

const runUpload = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image must be 5MB or smaller.' });
    return res.status(400).json({ error: error.message || 'Invalid image upload.' });
  });
};

// POST /api/upload/image — admin
router.post('/image', protect, adminOnly, runUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const detectedType = detectImageType(req.file.buffer);
    const expectedMime = detectedType === 'jpeg' ? new Set(['image/jpeg', 'image/jpg']) : new Set([`image/${detectedType}`]);
    const extension = path.extname(req.file.originalname || '').toLowerCase();
    if (!detectedType || !expectedMime.has(req.file.mimetype) || !allowedExtensions.has(extension)) {
      return res.status(400).json({ error: 'Uploaded file is not a valid supported image.' });
    }

    const safeExtension = detectedType === 'jpeg' ? '.jpg' : `.${detectedType}`;
    const filename = `${crypto.randomBytes(18).toString('hex')}${safeExtension}`;
    await fs.promises.writeFile(path.join(uploadDir, filename), req.file.buffer, { flag: 'wx' });

    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    const url = `${serverUrl.replace(/\/$/, '')}/uploads/${filename}`;
    return res.json({ url, filename });
  } catch (error) {
    return res.status(500).json({ error: 'Image upload failed.' });
  }
});

export { detectImageType };
export default router;
