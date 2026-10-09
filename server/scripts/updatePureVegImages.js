import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const productSchema = new mongoose.Schema({
  name: String,
  category: mongoose.Schema.Types.ObjectId,
  price: Number,
  description: String,
  image: String,
  available: Boolean,
  popular: Boolean,
  isVeg: Boolean,
  variants: Array,
  addons: Array,
  cafeId: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const VEG_IMAGE_MAP = {
  // Burgers
  'Classic Veg Burger': '/images/food/classic-veg-burger.jpg',
  'Veggie Burger': '/images/food/classic-veg-burger.jpg',
  'Smoky Paneer Burger': '/images/food/smoky-paneer-burger.jpg',
  'Mushroom Swiss Burger': '/images/food/mushroom-burger-veg.jpg',

  // Pizzas
  'Paneer Tikka Pizza': '/images/food/paneer-tikka-pizza.jpg',
  'Farmhouse Veggie Pizza': '/images/food/farmhouse-pizza-veg.jpg',
  'Farmhouse Delight': '/images/food/farmhouse-pizza-veg.jpg',
  'Pizza': '/images/food/farmhouse-pizza-veg.jpg',
  'Truffle Mushroom Pizza': '/images/food/farmhouse-pizza-veg.jpg',
  'Margherita': '/images/food/farmhouse-pizza-veg.jpg',
  'Margherita Classica': '/images/food/farmhouse-pizza-veg.jpg',

  // Toast & Breakfast Platter (strictly zero eggs)
  'Avocado Toast': '/images/food/avocado-toast-veg.jpg',
  'Avocado Sourdough Toast': '/images/food/avocado-toast-veg.jpg',
  'Brewhaus Brunch Platter': '/images/food/brewhaus-brunch-platter-veg.jpg',
  'Fluffy Buttermilk Pancakes': '/images/food/fluffy-veg-pancakes.jpg',
  'Butter Croissant': '/images/food/butter-croissant.jpg',

  // Salads (strictly zero meat/chicken/eggs)
  'Caesar Salad': '/images/food/fresh-veg-salad.jpg',
  'Café Special Gourmet Bowl': '/images/food/fresh-veg-salad.jpg',

  // Pasta & Sides
  'Pesto Pasta': '/images/food/creamy-pesto-pasta.jpg',
  'Garlic Bread': '/images/food/garlic-bread-cheese.jpg',
  'Garlic Bread Supreme': '/images/food/garlic-bread-cheese.jpg',
  'Loaded Nachos': '/images/food/loaded-veg-nachos.jpg',
  'Loaded Cheese Nachos': '/images/food/loaded-veg-nachos.jpg',
  'Nachos Supreme': '/images/food/loaded-veg-nachos.jpg',

  // Beverages that were empty
  'Iced Latte': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=900&q=80',
  'Vanilla Bean Flat White': 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=80',
  'Brewhaus Pour Over': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80'
};

async function updateVegImages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    let totalUpdated = 0;
    for (const [name, imageUrl] of Object.entries(VEG_IMAGE_MAP)) {
      const result = await Product.updateMany(
        { name },
        { 
          $set: { 
            image: imageUrl,
            isVeg: true
          } 
        }
      );
      if (result.modifiedCount > 0) {
        console.log(`Updated "${name}": ${result.modifiedCount} items -> ${imageUrl}`);
        totalUpdated += result.modifiedCount;
      }
    }

    // Ensure ALL products in DB have isVeg: true
    const vegEnforce = await Product.updateMany({}, { $set: { isVeg: true } });
    console.log(`Enforced isVeg: true on all products (${vegEnforce.matchedCount} products verified)`);

    console.log(`\nSuccessfully updated pure-veg images for ${totalUpdated} product entries across all cafes!`);
  } catch (error) {
    console.error('Error updating veg images:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateVegImages();
