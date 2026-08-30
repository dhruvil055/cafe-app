import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import QRCode from 'qrcode';

dotenv.config();

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const categories = [
  { name: 'Coffee', icon: '☕', sortOrder: 1 },
  { name: 'Tea', icon: '🍵', sortOrder: 2 },
  { name: 'Cold Drinks', icon: '🧊', sortOrder: 3 },
  { name: 'Shakes', icon: '🥤', sortOrder: 4 },
  { name: 'Snacks', icon: '🥪', sortOrder: 5 },
  { name: 'Burgers', icon: '🍔', sortOrder: 6 },
  { name: 'Pizza', icon: '🍕', sortOrder: 7 },
  { name: 'Desserts', icon: '🍰', sortOrder: 8 },
  { name: 'Specials', icon: '⭐', sortOrder: 9 },
];

const seed = async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured. Add your MongoDB Atlas connection string.');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Table.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create admin
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@brewhaus.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log('✅ Admin created — admin@brewhaus.com / admin123');

    // Create categories
    const cats = await Category.insertMany(categories);
    const catMap = {};
    cats.forEach(c => { catMap[c.name] = c._id; });
    console.log('✅ Categories created');

    // Create products
    const products = [
      // Coffee
      { name: 'Espresso', description: 'Bold single shot of pure espresso, rich and intense with a golden crema.', price: 99, category: catMap['Coffee'], isVeg: true, popular: true, prepTime: 3, addons: [{ name: 'Extra Shot', price: 40 }, { name: 'Sugar', price: 0 }] },
      { name: 'Cappuccino', description: 'Fresh espresso layered with velvety steamed milk and thick foam. A timeless classic.', price: 149, category: catMap['Coffee'], isVeg: true, popular: true, prepTime: 5, addons: [{ name: 'Extra Shot', price: 40 }, { name: 'Caramel Drizzle', price: 20 }, { name: 'Oat Milk', price: 30 }] },
      { name: 'Flat White', description: 'Smooth double ristretto with silky microfoam milk. Stronger than a latte, smoother than a cappuccino.', price: 169, category: catMap['Coffee'], isVeg: true, popular: true, prepTime: 5, addons: [{ name: 'Extra Shot', price: 40 }] },
      { name: 'Café Latte', description: 'Espresso with generous steamed milk and light foam. Smooth and comforting.', price: 159, category: catMap['Coffee'], isVeg: true, prepTime: 5, addons: [{ name: 'Vanilla Syrup', price: 20 }, { name: 'Hazelnut Syrup', price: 20 }, { name: 'Extra Shot', price: 40 }] },
      { name: 'Cold Brew', description: 'Slow-steeped for 12 hours. Smooth, bold, naturally sweet — served over ice.', price: 179, category: catMap['Coffee'], isVeg: true, popular: true, prepTime: 2, addons: [{ name: 'Cold Foam', price: 30 }, { name: 'Oat Milk', price: 30 }] },

      // Tea
      { name: 'Masala Chai', description: 'Our signature spiced Indian chai with ginger, cardamom, and cinnamon. Brewed strong the way it should be.', price: 79, category: catMap['Tea'], isVeg: true, popular: true, prepTime: 7, addons: [{ name: 'Extra Ginger', price: 0 }, { name: 'Extra Sugar', price: 0 }] },
      { name: 'Matcha Latte', description: 'Ceremonial-grade Japanese matcha whisked with steamed oat milk. Earthy and elegant.', price: 199, category: catMap['Tea'], isVeg: true, prepTime: 6, addons: [{ name: 'Honey', price: 20 }, { name: 'Extra Matcha', price: 30 }] },
      { name: 'Peach Iced Tea', description: 'Chilled black tea infused with real peach, a hint of lemon, and mint.', price: 129, category: catMap['Tea'], isVeg: true, prepTime: 3 },

      // Cold Drinks
      { name: 'Virgin Mojito', description: 'Fresh lime, mint leaves, sugar syrup, soda — a cool classic.', price: 119, category: catMap['Cold Drinks'], isVeg: true, popular: true, prepTime: 4 },
      { name: 'Watermelon Cooler', description: 'Fresh watermelon juice with mint and a pinch of black salt. Refreshing and seasonal.', price: 129, category: catMap['Cold Drinks'], isVeg: true, prepTime: 5 },
      { name: 'Lemonade', description: 'Classic fresh-squeezed lemonade with just the right sweetness.', price: 99, category: catMap['Cold Drinks'], isVeg: true, prepTime: 3, addons: [{ name: 'Mint', price: 0 }, { name: 'Ginger', price: 10 }] },

      // Shakes
      { name: 'Classic Chocolate Shake', description: 'Belgian dark chocolate blended with premium ice cream. Thick, rich, indulgent.', price: 219, category: catMap['Shakes'], isVeg: true, popular: true, prepTime: 5, addons: [{ name: 'Extra Scoop', price: 40 }, { name: 'Choco Chips', price: 20 }] },
      { name: 'Strawberry Shake', description: 'Real strawberries blended with vanilla ice cream. Sweet and fruity.', price: 199, category: catMap['Shakes'], isVeg: true, prepTime: 5, addons: [{ name: 'Extra Scoop', price: 40 }] },
      { name: 'Mango Mastani', description: 'Thick alphonso mango shake topped with ice cream and dry fruits. A Pune special.', price: 229, category: catMap['Shakes'], isVeg: true, popular: true, prepTime: 6, addons: [{ name: 'Extra Ice Cream', price: 40 }] },

      // Snacks
      { name: 'Loaded Nachos', description: 'Crispy corn nachos with cheese sauce, jalapeños, sour cream, and pico de gallo.', price: 199, category: catMap['Snacks'], isVeg: true, popular: true, prepTime: 8, addons: [{ name: 'Extra Cheese', price: 30 }, { name: 'Extra Jalapeños', price: 10 }] },
      { name: 'Garlic Bread', description: 'Toasted ciabatta with garlic butter and fresh herbs. Served with marinara.', price: 149, category: catMap['Snacks'], isVeg: true, prepTime: 7, addons: [{ name: 'Cheese Topping', price: 30 }] },
      { name: 'Chicken Wings', description: 'Crispy fried wings tossed in our house hot sauce. Served with blue cheese dip.', price: 279, category: catMap['Snacks'], isVeg: false, popular: true, prepTime: 12, addons: [{ name: 'Extra Dip', price: 20 }] },

      // Burgers
      { name: 'Classic Veg Burger', description: 'Crispy potato patty, lettuce, tomato, cheese, and our house sauce in a toasted brioche bun.', price: 199, category: catMap['Burgers'], isVeg: true, popular: true, prepTime: 10, addons: [{ name: 'Extra Cheese', price: 30 }, { name: 'Extra Patty', price: 60 }, { name: 'No Onion', price: 0 }] },
      { name: 'Brewhaus Chicken Burger', description: 'Juicy grilled chicken breast, coleslaw, pickles, and chipotle mayo. Our bestseller.', price: 259, category: catMap['Burgers'], isVeg: false, popular: true, prepTime: 12, addons: [{ name: 'Extra Cheese', price: 30 }, { name: 'Bacon Strip', price: 40 }] },
      { name: 'Mushroom Swiss Burger', description: 'Sautéed portobello mushrooms, Swiss cheese, caramelized onions on a sesame bun.', price: 229, category: catMap['Burgers'], isVeg: true, prepTime: 12, addons: [{ name: 'Extra Mushrooms', price: 30 }] },

      // Pizza
      { name: 'Margherita', description: 'San Marzano tomato base, fresh mozzarella, basil, olive oil. Simple perfection.', price: 299, category: catMap['Pizza'], isVeg: true, popular: true, prepTime: 15, variants: [{ name: 'Regular (8")', price: 299 }, { name: 'Large (12")', price: 449 }], addons: [{ name: 'Extra Cheese', price: 40 }, { name: 'Chilli Flakes', price: 0 }] },
      { name: 'BBQ Chicken Pizza', description: 'Smoky BBQ sauce, grilled chicken, red onions, bell peppers, mozzarella.', price: 379, category: catMap['Pizza'], isVeg: false, popular: true, prepTime: 15, variants: [{ name: 'Regular (8")', price: 379 }, { name: 'Large (12")', price: 549 }], addons: [{ name: 'Extra Chicken', price: 60 }, { name: 'Extra Cheese', price: 40 }] },
      { name: 'Paneer Tikka Pizza', description: 'Tandoori-spiced paneer, onions, capsicum, mint chutney base. Desi fusion at its best.', price: 349, category: catMap['Pizza'], isVeg: true, popular: true, prepTime: 15, variants: [{ name: 'Regular (8")', price: 349 }, { name: 'Large (12")', price: 499 }] },

      // Desserts
      { name: 'Tiramisu', description: 'Classic Italian dessert with mascarpone, espresso-soaked ladyfingers, and cocoa dust.', price: 199, category: catMap['Desserts'], isVeg: true, popular: true, prepTime: 2 },
      { name: 'Belgian Waffle', description: 'Crispy waffle topped with vanilla ice cream, chocolate sauce, and strawberries.', price: 229, category: catMap['Desserts'], isVeg: true, prepTime: 8, addons: [{ name: 'Extra Ice Cream', price: 40 }, { name: 'Nutella Drizzle', price: 20 }] },
      { name: 'Gulab Jamun with Ice Cream', description: 'Warm soft gulab jamun served with chilled vanilla ice cream. Best of both worlds.', price: 149, category: catMap['Desserts'], isVeg: true, popular: true, prepTime: 5 },

      // Specials
      { name: 'Brewhaus Brunch Platter', description: 'Eggs your way, garlic toast, hash browns, grilled tomatoes, and a coffee of your choice.', price: 449, category: catMap['Specials'], isVeg: false, popular: true, prepTime: 20, addons: [{ name: 'Add Bacon', price: 60 }, { name: 'Extra Toast', price: 20 }] },
      { name: 'Café Special Thali', description: 'Chef\'s daily special — ask your server. Changes every day. Always delicious.', price: 299, category: catMap['Specials'], isVeg: true, popular: true, prepTime: 15 },
    ];

    const createdProducts = await Product.insertMany(products);
    console.log(`✅ ${createdProducts.length} products created`);

    // Create tables with QR codes
    const tableDocs = [];
    for (let i = 1; i <= 10; i++) {
      const url = `${BASE_URL}/menu?table=${i}`;
      const qrCode = await QRCode.toDataURL(url, {
        width: 400, margin: 2,
        color: { dark: '#1a0f08', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      });
      tableDocs.push({ tableNumber: i, qrCode, qrUrl: url, seats: i <= 2 ? 2 : i <= 6 ? 4 : 6 });
    }

    await Table.insertMany(tableDocs);
    console.log('✅ 10 tables with QR codes created');

    console.log('\n🎉 Database seeded successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin login: admin@brewhaus.com / admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seed();
