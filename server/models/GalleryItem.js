import mongoose from 'mongoose';

const galleryItemSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true, maxlength: 60 },
  review: { type: String, required: true, trim: true, maxlength: 500 },
  rating: { type: Number, required: true, min: 1, max: 5 },
  imageUrl: { type: String, required: true, trim: true },
}, { timestamps: true });

galleryItemSchema.index({ createdAt: -1 });

galleryItemSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('GalleryItem', galleryItemSchema);
