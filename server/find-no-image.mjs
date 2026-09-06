import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const productSchema = new mongoose.Schema({ name: String, image: String, category: mongoose.Schema.Types.ObjectId }, { strict: false });
const Product = mongoose.model("Product", productSchema);

await mongoose.connect(process.env.MONGO_URI);
const items = await Product.find({ $or: [{ image: "" }, { image: null }, { image: { $exists: false } }] }, "name image");
console.log(JSON.stringify(items.map(i => ({ id: i._id, name: i.name })), null, 2));
await mongoose.disconnect();
