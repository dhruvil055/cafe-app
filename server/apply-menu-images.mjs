import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const updates = [
  // 1. Green Cucumber Detox (replacing chef cooking photo from user screenshot)
  {
    name: 'Green Cucumber Detox',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=900&q=80'
  },
  // 2. Paneer Tikka Pizza (replacing 404 broken URL)
  {
    name: 'Paneer Tikka Pizza',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80'
  },
  // 3. Farmhouse Delight (replacing pepperoni meat pizza with stone-baked vegetarian pizza)
  {
    name: 'Farmhouse Delight',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80'
  },
  // 4. Strawberry Shake (replacing chocolate oreo sundae with fresh pink strawberry milkshake)
  {
    name: 'Strawberry Shake',
    image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=900&q=80'
  },
  // 5. Veggie Crispy Bites (replacing ribs with crispy golden vegetarian samosas & chutney)
  {
    name: 'Veggie Crispy Bites',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80'
  },
  // 6. Pesto Pasta (replacing clam seafood pasta with fresh basil pesto pasta)
  {
    name: 'Pesto Pasta',
    image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80'
  },
  // 7. Café Special Thali (replacing salmon bowl with authentic Indian curries & rice)
  {
    name: 'Café Special Thali',
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80'
  },
  // 8. Watermelon Cooler (replacing yellow citrus bottle with iced watermelon drink with mint)
  {
    name: 'Watermelon Cooler',
    image: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=900&q=80'
  },
  // 9. Watermelon Mint Cooler (replacing 5 smoothie jars with fresh watermelon juice & slice)
  {
    name: 'Watermelon Mint Cooler',
    image: 'https://images.unsplash.com/photo-1683166263544-e754e85c3e7c?auto=format&fit=crop&w=900&q=80'
  },
  // 10. Mango Lassi (replacing donuts/watermelon with authentic chilled mango lassi)
  {
    name: 'Mango Lassi',
    image: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=900&q=80'
  },
  // 11. Virgin Mojito (replacing mango photo with sparkling virgin mojito with lime wheels & mint)
  {
    name: 'Virgin Mojito',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80'
  },
  // 12. Brewhaus Brunch Platter (replacing plain toast with full breakfast platter)
  {
    name: 'Brewhaus Brunch Platter',
    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80'
  },
  // 13. Classic Veg Burger (replacing double beef burger with artisanal vegetarian burger)
  {
    name: 'Classic Veg Burger',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80'
  },
  // 14. Veggie Burger (replacing beef patty with black bean & quinoa veggie burger)
  {
    name: 'Veggie Burger',
    image: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=900&q=80'
  },
  // 15. Garlic Bread (replacing steak with toasted ciabatta garlic bread with herbs & cheese)
  {
    name: 'Garlic Bread',
    image: 'https://images.unsplash.com/photo-1751199592465-f142293a8cc6?auto=format&fit=crop&w=900&q=80'
  },
  // 16. Gulab Jamun with Ice Cream (replacing cupcake with authentic Indian gulab jamun in syrup)
  {
    name: 'Gulab Jamun with Ice Cream',
    image: 'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?auto=format&fit=crop&w=900&q=80'
  },
  // 17. Granola Bowl (replacing spinach salad with yogurt granola fruit bowl)
  {
    name: 'Granola Bowl',
    image: 'https://images.unsplash.com/photo-1612182062572-e29c5dfb5eb4?auto=format&fit=crop&w=900&q=80'
  },
  // 18. Spinach & Cheese Puffs (replacing gajar halwa with golden baked flaky puff pastries)
  {
    name: 'Spinach & Cheese Puffs',
    image: 'https://images.unsplash.com/photo-1682263167429-0dbcf2c1e127?auto=format&fit=crop&w=900&q=80'
  },
  // 19. Peanut Butter Banana (replacing berry smoothie with peanut butter banana smoothie)
  {
    name: 'Peanut Butter Banana',
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&w=900&q=80'
  }
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

  for (const u of updates) {
    const res = await Product.updateMany({ name: u.name }, { $set: { image: u.image } });
    console.log(`Updated "${u.name}": matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log('All image updates successfully applied to MongoDB.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
