import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const reviewSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderNumber: { type: String, default: '' },
  customerPhone: { type: String, default: '', trim: true },
  customerName: { type: String, default: '', trim: true },
  foodRating: { type: Number, required: true, min: 1, max: 5 },
  serviceRating: { type: Number, required: true, min: 1, max: 5 },
  ambienceRating: { type: Number, required: true, min: 1, max: 5 },
  overallRating: { type: Number, min: 1, max: 5 },
  comment: { type: String, default: '', trim: true, maxlength: 1000 },
  reply: {
    text: { type: String, default: '', trim: true, maxlength: 1000 },
    repliedAt: { type: Date, default: null },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  status: {
    type: String,
    enum: ['published', 'hidden', 'flagged'],
    default: 'published',
  },
}, { timestamps: true });

reviewSchema.pre('save', function (next) {
  if (this.foodRating && this.serviceRating && this.ambienceRating) {
    this.overallRating = Math.round(((this.foodRating + this.serviceRating + this.ambienceRating) / 3) * 10) / 10;
  }
  next();
});

reviewSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });
reviewSchema.index({ tenantId: 1, overallRating: -1, createdAt: -1 });

reviewSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('Review', reviewSchema);
