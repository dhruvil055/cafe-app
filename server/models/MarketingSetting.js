import mongoose from 'mongoose';

const marketingSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global',
  },
  maxPromotionsPerCustomerPeriod: {
    type: Number,
    default: 3,
    min: 1,
    max: 50,
  },
  periodDays: {
    type: Number,
    default: 30,
    min: 1,
    max: 365,
  },
  enabledChannels: {
    sms: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
  },
  whatsappCloud: {
    accessToken: { type: String, default: '' },
    phoneNumberId: { type: String, default: '' },
    businessAccountId: { type: String, default: '' },
  },
  twilio: {
    accountSid: { type: String, default: '' },
    authToken: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
  },
}, { timestamps: true });

export const getMarketingSettings = async () => {
  try {
    const settings = await mongoose.model('MarketingSetting').findOneAndUpdate(
      { key: 'global' },
      { $setOnInsert: { key: 'global' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return settings;
  } catch (err) {
    // In case of any concurrent upsert collision, fetch the created document
    const fallback = await mongoose.model('MarketingSetting').findOne({ key: 'global' });
    if (fallback) return fallback;
    return {
      maxPromotionsPerCustomerPeriod: 3,
      periodDays: 30,
      enabledChannels: { sms: true, whatsapp: true, push: true },
      whatsappCloud: { accessToken: '', phoneNumberId: '', businessAccountId: '' },
      twilio: { accountSid: '', authToken: '', phoneNumber: '' },
    };
  }
};

export default mongoose.model('MarketingSetting', marketingSettingSchema);
