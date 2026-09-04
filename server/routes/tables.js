import express from 'express';
import QRCode from 'qrcode';
import Table from '../models/Table.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/auth.js';

const router = express.Router();

const getTrustedClientUrl = () => {
  const configured = String(process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL || '').trim();
  if (!configured) throw new Error('CUSTOMER_APP_URL or CLIENT_URL is not configured.');

  const parsed = new URL(configured);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('CUSTOMER_APP_URL is invalid.');
  }

  return configured.replace(/\/$/, '');
};

const generateQR = async (tableNumber) => {
  const url = `${getTrustedClientUrl()}/menu?table=${encodeURIComponent(tableNumber)}`;
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
    const tableNumber = Number(req.params.number);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      return res.status(400).json({ valid: false, error: 'Invalid table number.' });
    }

    const table = await Table.findOne({
      tableNumber,
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
    const normalizedTableNumber = Number(tableNumber);
    const normalizedSeats = Number(seats ?? 4);
    if (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber <= 0) {
      return res.status(400).json({ error: 'Table number must be a positive integer.' });
    }
    if (!Number.isInteger(normalizedSeats) || normalizedSeats < 1 || normalizedSeats > 50) {
      return res.status(400).json({ error: 'Seats must be an integer between 1 and 50.' });
    }

    const { qrCode, qrUrl } = await generateQR(normalizedTableNumber);

    const table = await Table.create({
      tableNumber: normalizedTableNumber,
      seats: normalizedSeats,
      label: String(label || '').trim().slice(0, 100),
      qrCode,
      qrUrl,
    });
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

    if (Object.prototype.hasOwnProperty.call(update, 'tableNumber')) {
      update.tableNumber = Number(update.tableNumber);
      if (!Number.isInteger(update.tableNumber) || update.tableNumber <= 0) {
        return res.status(400).json({ error: 'Table number must be a positive integer.' });
      }
    }
    if (Object.prototype.hasOwnProperty.call(update, 'seats')) {
      update.seats = Number(update.seats);
      if (!Number.isInteger(update.seats) || update.seats < 1 || update.seats > 50) {
        return res.status(400).json({ error: 'Seats must be an integer between 1 and 50.' });
      }
    }

    if (update.tableNumber !== undefined && update.tableNumber !== table.tableNumber) {
      const { qrCode, qrUrl } = await generateQR(update.tableNumber);
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

    const { qrCode, qrUrl } = await generateQR(table.tableNumber);
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
    const count = Number(req.body.count);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return res.status(400).json({ error: 'Count must be an integer between 1 and 100.' });
    }

    const existing = await Table.find().sort({ tableNumber: -1 }).limit(1);
    let startNum = existing.length ? existing[0].tableNumber + 1 : 1;

    const tables = [];
    for (let i = 0; i < count; i++) {
      const tableNumber = startNum + i;
      const { qrCode, qrUrl } = await generateQR(tableNumber);
      tables.push({ tableNumber, qrCode, qrUrl, seats: 4 });
    }

    const created = await Table.insertMany(tables);
    res.status(201).json({ tables: created, count: created.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
