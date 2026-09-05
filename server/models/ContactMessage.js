import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  contact: { type: String, required: true, trim: true, maxlength: 160 },
  subject: { type: String, trim: true, maxlength: 140, default: '' },
  message: { type: String, required: true, trim: true, minlength: 8, maxlength: 2000 },
  status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new' },
}, { timestamps: true });

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ contact: 1, createdAt: -1 });

export default mongoose.model('ContactMessage', contactMessageSchema);
