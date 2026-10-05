import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const superAdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'super_admin', immutable: true },
  refreshTokenHash: { type: String, default: '', select: false },
  refreshTokenExpiresAt: { type: Date, default: null, select: false },
}, { timestamps: true });

superAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

superAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

superAdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokenHash;
  delete obj.refreshTokenExpiresAt;
  return obj;
};

export default mongoose.model('SuperAdmin', superAdminSchema);
