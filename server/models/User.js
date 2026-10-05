import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  // `admin` and `staff` remain valid for existing accounts. Authorization maps
  // them to owner and manager without rewriting existing user records.
  role: { type: String, enum: ['owner', 'manager', 'cashier', 'kitchen', 'admin', 'staff', 'customer'], default: 'owner' },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  loginLockUntil: { type: Date, default: null, select: false },
  refreshTokenHash: { type: String, default: '', select: false },
  refreshTokenExpiresAt: { type: Date, default: null, select: false },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecretEncrypted: { type: String, default: '', select: false },
  // Password reset
  resetPasswordToken: { type: String, default: '', select: false },
  resetPasswordExpiresAt: { type: Date, default: null, select: false },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.plugin(tenantIsolationPlugin);
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
export default mongoose.model('User', userSchema);
