import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const productSchema = new mongoose.Schema({ name: String, image: String, description: String }, { strict: false });
const Product = mongoose.model("Product", productSchema);
await mongoose.connect(process.env.MONGO_URI);
const items = await Product.find({}, "name image description").sort({ createdAt: 1 });
console.log(JSON.stringify(items.map(i => ({ id: String(i._id), name: i.name, desc: (i.description||"").slice(0,60) })), null, 2));
await mongoose.disconnect();
