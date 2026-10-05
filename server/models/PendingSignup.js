import mongoose from 'mongoose';

const pendingSignupSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  cafeName: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  verificationCode: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index auto-deletes expired records
}, { timestamps: true });

export default mongoose.model('PendingSignup', pendingSignupSchema);
