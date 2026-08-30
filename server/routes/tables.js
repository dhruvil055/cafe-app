import express from 'express';
import QRCode from 'qrcode';
import Table from '../models/Table.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/auth.js';

const router = express.Router();

const generateQR = async (tableNumber, baseUrl) => {
  const url = `${baseUrl || process.env.CLIENT_URL || 'http://localhost:5173'}/menu?table=${tableNumber}`;
  const qrCode = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: { dark: '#1a0f08', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
  return { qrCode, qrUrl: url };
};

// GET /api/tables — public
router.get('/', async (req, res) => {
  try {
    const tables = await Table.find({ active: true }).sort({ tableNumber: 1 });
    res.json({ tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all tables — admin/staff
router.get('/all', protect, staffOrAdmin, async (req, res) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });
    res.json({ tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tables/:number/validate — public (validate table exists)
router.get('/:number/validate', async (req, res) => {
  try {
    const table = await Table.findOne({
      tableNumber: Number(req.params.number),
      active: true
    });
    if (!table) return res.status(404).json({ valid: false, error: 'Invalid table number.' });
    res.json({ valid: true, table: { tableNumber: table.tableNumber, label: table.label } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tables — admin/staff
router.post('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const { tableNumber, seats, label } = req.body;
    const { qrCode, qrUrl } = await generateQR(tableNumber, req.body.baseUrl);

    const table = await Table.create({ tableNumber, seats, label, qrCode, qrUrl });
    res.status(201).json({ table });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/tables/:id — admin/staff
// SECURITY: Mass assignment protection - explicit field allowlist
router.put('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found.' });

    // Only allow these fields to be updated
    const allowedFields = ['tableNumber', 'seats', 'label', 'active'];
    const update = {};
    for (const field of allowedFields) {
      if (req.body.hasOwnProperty(field)) {
        update[field] = req.body[field];
      }
    }

    if (update.tableNumber && update.tableNumber !== table.tableNumber) {
      const { qrCode, qrUrl } = await generateQR(update.tableNumber, req.body.baseUrl);
      update.qrCode = qrCode;
      update.qrUrl = qrUrl;
    }

    const updated = await Table.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ table: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/tables/:id/regenerate-qr — admin/staff
router.post('/:id/regenerate-qr', protect, staffOrAdmin, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found.' });

    const { qrCode, qrUrl } = await generateQR(table.tableNumber, req.body.baseUrl);
    table.qrCode = qrCode;
    table.qrUrl = qrUrl;
    await table.save();

    res.json({ table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/tables/:id — admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Table.findByIdAndDelete(req.params.id);
    res.json({ message: 'Table deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST bulk create tables — admin/staff
router.post('/bulk', protect, staffOrAdmin, async (req, res) => {
  try {
    const { count, baseUrl } = req.body;
    const existing = await Table.find().sort({ tableNumber: -1 }).limit(1);
    let startNum = existing.length ? existing[0].tableNumber + 1 : 1;

    const tables = [];
    for (let i = 0; i < count; i++) {
      const tableNumber = startNum + i;
      const { qrCode, qrUrl } = await generateQR(tableNumber, baseUrl);
      tables.push({ tableNumber, qrCode, qrUrl, seats: 4 });
    }

    const created = await Table.insertMany(tables);
    res.status(201).json({ tables: created, count: created.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
