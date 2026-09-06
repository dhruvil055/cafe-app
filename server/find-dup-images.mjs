import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const productSchema = new mongoose.Schema({ name: String, image: String }, { strict: false });
const Product = mongoose.model("Product", productSchema);

await mongoose.connect(process.env.MONGO_URI);
const items = await Product.find({}, "name image");

// Group by image URL to find duplicates
const urlMap = {};
for (const item of items) {
  const url = item.image || "";
  if (!urlMap[url]) urlMap[url] = [];
  urlMap[url].push({ id: String(item._id), name: item.name });
}
// Show duplicated or empty image URLs
for (const [url, products] of Object.entries(urlMap)) {
  if (products.length > 1 || !url) {
    console.log(JSON.stringify({ url: url.slice(0,60), count: products.length, items: products.map(p => p.name) }));
  }
}
await mongoose.disconnect();
