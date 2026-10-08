import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  platformName: { type: String, default: 'InfiniGrow Café OS' },
  supportEmail: { type: String, default: 'support@infinigrowsoftech.com' },
  trialDaysDefault: { type: Number, default: 14 },
  maintenanceMode: { type: Boolean, default: false },
  registrationOpen: { type: Boolean, default: true },
  bannerMessage: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
}, { timestamps: true });

export default mongoose.model('PlatformSettings', platformSettingsSchema);
