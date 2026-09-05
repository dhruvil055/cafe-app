import express from 'express';
import rateLimit from 'express-rate-limit';
import ContactMessage from '../models/ContactMessage.js';

const router = express.Router();
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait a few minutes before sending another message.' },
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\-\s]{7,20}$/;
const normalizeLine = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeMessage = (value) => String(value || '')
  .trim()
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n');

router.post('/', contactLimiter, async (req, res) => {
  try {
    const name = normalizeLine(req.body?.name);
    const rawContact = normalizeLine(req.body?.contact);
    const contact = emailPattern.test(rawContact) ? rawContact.toLowerCase() : rawContact;
    const subject = normalizeLine(req.body?.subject);
    const message = normalizeMessage(req.body?.message);

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (contact.length > 160 || (!emailPattern.test(contact) && !phonePattern.test(contact))) {
      return res.status(400).json({ error: 'Please enter a valid email address or phone number.' });
    }
    if (subject.length > 140) {
      return res.status(400).json({ error: 'Please keep the subject under 140 characters.' });
    }
    if (message.length < 8 || message.length > 2000) {
      return res.status(400).json({ error: 'Please enter a message between 8 and 2,000 characters.' });
    }

    const submittedSince = new Date(Date.now() - 5 * 60 * 1000);
    const duplicate = await ContactMessage.exists({ name, contact, subject, message, createdAt: { $gte: submittedSince } });
    if (duplicate) {
      return res.status(409).json({ error: 'We already received this message. Thank you.' });
    }

    await ContactMessage.create({ name, contact, subject, message });
    return res.status(201).json({ message: 'Your message has been received.' });
  } catch (error) {
    console.error('Contact message error:', error);
    return res.status(500).json({ error: 'Unable to send your message right now. Please try again shortly.' });
  }
});

export default router;
