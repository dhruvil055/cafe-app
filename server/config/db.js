import mongoose from 'mongoose';
import { initializeOrderNumberCounter } from '../models/Order.js';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI is not configured. Add your MongoDB Atlas connection string.');

    const conn = await mongoose.connect(mongoUri);
    await initializeOrderNumberCounter();
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};
