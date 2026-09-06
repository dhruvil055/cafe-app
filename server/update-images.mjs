import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const productSchema = new mongoose.Schema({ name: String, image: String }, { strict: false });
const Product = mongoose.model("Product", productSchema);
await mongoose.connect(process.env.MONGO_URI);

const SERVER_URL = process.env.SERVER_URL || "https://cafe-app-n8mn.onrender.com";

const updates = [
  { name: "Classic Espresso",        image: `${SERVER_URL}/uploads/espresso.jpg` },
  { name: "Creamy Cappuccino",        image: `${SERVER_URL}/uploads/cappuccino.jpg` },
  { name: "Caramel Latte",            image: `${SERVER_URL}/uploads/caramel_latte.jpg` },
  { name: "Hazelnut Mocha",           image: `${SERVER_URL}/uploads/hazelnut_mocha.jpg` },
  { name: "Americano",                image: `${SERVER_URL}/uploads/americano.jpg` },
  { name: "Honey Cinnamon Latte",     image: `${SERVER_URL}/uploads/honey_cinnamon_latte.jpg` },
  { name: "Cold Brew",                image: `${SERVER_URL}/uploads/cold_brew.jpg` },
  { name: "Iced Caramel Macchiato",   image: `${SERVER_URL}/uploads/iced_caramel_macchiato.jpg` },
  { name: "Dalgona Coffee",           image: `${SERVER_URL}/uploads/dalgona_coffee.jpg` },
  { name: "Espresso Tonic",           image: `${SERVER_URL}/uploads/espresso_tonic.jpg` },
  { name: "Matcha Latte",             image: `${SERVER_URL}/uploads/matcha_latte.jpg` },
  { name: "Masala Chai",              image: `${SERVER_URL}/uploads/masala_chai.jpg` },
  { name: "Avocado Toast",            image: `${SERVER_URL}/uploads/avocado_toast.jpg` },
];

for (const u of updates) {
  const res = await Product.updateOne({ name: u.name }, { $set: { image: u.image } });
  console.log(`${res.modifiedCount ? "✅" : "⚠️ "} ${u.name}`);
}

await mongoose.disconnect();
console.log("Done.");
