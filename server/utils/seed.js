import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import QRCode from 'qrcode';

dotenv.config();

const BASE_URL = process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL;
if (!BASE_URL) throw new Error('CUSTOMER_APP_URL or CLIENT_URL must be configured before seeding tables.');

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

    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
      throw new Error('Refusing to seed in production without explicit ALLOW_PRODUCTION_SEED=true environment variable.');
    }

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

    const productImages = {
      Espresso: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80',
      Cappuccino: 'https://images.unsplash.com/photo-1497636577773-f1231844b336?auto=format&fit=crop&w=900&q=80',
      'Flat White': 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=80',
      'Café Latte': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80',
      'Cold Brew': 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80',
      'Masala Chai': 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=900&q=80',
      'Matcha Latte': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=900&q=80',
      'Peach Iced Tea': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=80',
      'Virgin Mojito': 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=900&q=80',
      'Watermelon Cooler': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80',
      Lemonade: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80',
      'Classic Chocolate Shake': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=80',
      'Strawberry Shake': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80',
      'Mango Mastani': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=80',
      'Loaded Nachos': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=900&q=80',
      'Garlic Bread': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
      'Veggie Crispy Bites': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
      'Classic Veg Burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
      'Mushroom Swiss Burger': 'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=900&q=80',
      'Smoky Paneer Burger': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80',
      Margherita: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
      'Paneer Tikka Pizza': 'https://images.unsplash.com/photo-1548365328-9f547fb9587c?auto=format&fit=crop&w=900&q=80',
      'Farmhouse Delight': 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=900&q=80',
      Tiramisu: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=80',
      'Belgian Waffle': 'https://images.unsplash.com/photo-1568051243851-f9b136146e97?auto=format&fit=crop&w=900&q=80',
      'Gulab Jamun with Ice Cream': 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&w=900&q=80',
      'Brewhaus Brunch Platter': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80',
      'Café Special Thali': 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
    };

    // Create products
    const products = [
      // Coffee
      { name: 'Espresso', description: 'Bold single shot of pure espresso, rich and intense with a golden crema.', price: 99, category: catMap['Coffee'], image: productImages.Espresso, popular: true, prepTime: 3, addons: [{ name: 'Extra Shot', price: 40 }, { name: 'Sugar', price: 0 }] },
      { name: 'Cappuccino', description: 'Fresh espresso layered with velvety steamed milk and thick foam. A timeless classic.', price: 149, category: catMap['Coffee'], image: productImages.Cappuccino, popular: true, prepTime: 5, addons: [{ name: 'Extra Shot', price: 40 }, { name: 'Caramel Drizzle', price: 20 }, { name: 'Oat Milk', price: 30 }] },
      { name: 'Flat White', description: 'Smooth double ristretto with silky microfoam milk. Stronger than a latte, smoother than a cappuccino.', price: 169, category: catMap['Coffee'], image: productImages['Flat White'], popular: true, prepTime: 5, addons: [{ name: 'Extra Shot', price: 40 }] },
      { name: 'Café Latte', description: 'Espresso with generous steamed milk and light foam. Smooth and comforting.', price: 159, category: catMap['Coffee'], image: productImages['Café Latte'], prepTime: 5, addons: [{ name: 'Vanilla Syrup', price: 20 }, { name: 'Hazelnut Syrup', price: 20 }, { name: 'Extra Shot', price: 40 }] },
      { name: 'Cold Brew', description: 'Slow-steeped for 12 hours. Smooth, bold, naturally sweet — served over ice.', price: 179, category: catMap['Coffee'], image: productImages['Cold Brew'], popular: true, prepTime: 2, addons: [{ name: 'Cold Foam', price: 30 }, { name: 'Oat Milk', price: 30 }] },

      // Tea
      { name: 'Masala Chai', description: 'Our signature spiced Indian chai with ginger, cardamom, and cinnamon. Brewed strong the way it should be.', price: 79, category: catMap['Tea'], image: productImages['Masala Chai'], popular: true, prepTime: 7, addons: [{ name: 'Extra Ginger', price: 0 }, { name: 'Extra Sugar', price: 0 }] },
      { name: 'Matcha Latte', description: 'Ceremonial-grade Japanese matcha whisked with steamed oat milk. Earthy and elegant.', price: 199, category: catMap['Tea'], image: productImages['Matcha Latte'], prepTime: 6, addons: [{ name: 'Honey', price: 20 }, { name: 'Extra Matcha', price: 30 }] },
      { name: 'Peach Iced Tea', description: 'Chilled black tea infused with real peach, a hint of lemon, and mint.', price: 129, category: catMap['Tea'], image: productImages['Peach Iced Tea'], prepTime: 3 },

      // Cold Drinks
      { name: 'Virgin Mojito', description: 'Fresh lime, mint leaves, sugar syrup, soda — a cool classic.', price: 119, category: catMap['Cold Drinks'], image: productImages['Virgin Mojito'], popular: true, prepTime: 4 },
      { name: 'Watermelon Cooler', description: 'Fresh watermelon juice with mint and a pinch of black salt. Refreshing and seasonal.', price: 129, category: catMap['Cold Drinks'], image: productImages['Watermelon Cooler'], prepTime: 5 },
      { name: 'Lemonade', description: 'Classic fresh-squeezed lemonade with just the right sweetness.', price: 99, category: catMap['Cold Drinks'], image: productImages.Lemonade, prepTime: 3, addons: [{ name: 'Mint', price: 0 }, { name: 'Ginger', price: 10 }] },

      // Shakes
      { name: 'Classic Chocolate Shake', description: 'Belgian dark chocolate blended with premium ice cream. Thick, rich, indulgent.', price: 219, category: catMap['Shakes'], image: productImages['Classic Chocolate Shake'], popular: true, prepTime: 5, addons: [{ name: 'Extra Scoop', price: 40 }, { name: 'Choco Chips', price: 20 }] },
      { name: 'Strawberry Shake', description: 'Real strawberries blended with vanilla ice cream. Sweet and fruity.', price: 199, category: catMap['Shakes'], image: productImages['Strawberry Shake'], prepTime: 5, addons: [{ name: 'Extra Scoop', price: 40 }] },
      { name: 'Mango Mastani', description: 'Thick alphonso mango shake topped with ice cream and dry fruits. A Pune special.', price: 229, category: catMap['Shakes'], image: productImages['Mango Mastani'], popular: true, prepTime: 6, addons: [{ name: 'Extra Ice Cream', price: 40 }] },

      // Snacks
      { name: 'Loaded Nachos', description: 'Crispy corn nachos with cheese sauce, jalapeños, sour cream, and pico de gallo.', price: 199, category: catMap['Snacks'], image: productImages['Loaded Nachos'], popular: true, prepTime: 8, addons: [{ name: 'Extra Cheese', price: 30 }, { name: 'Extra Jalapeños', price: 10 }] },
      { name: 'Garlic Bread', description: 'Toasted ciabatta with garlic butter and fresh herbs. Served with marinara.', price: 149, category: catMap['Snacks'], image: productImages['Garlic Bread'], prepTime: 7, addons: [{ name: 'Cheese Topping', price: 30 }] },
      { name: 'Veggie Crispy Bites', description: 'Crispy herb-coated bites with a spicy dip and signature seasoning.', price: 219, category: catMap['Snacks'], image: productImages['Veggie Crispy Bites'], popular: true, prepTime: 10, addons: [{ name: 'Extra Dip', price: 20 }] },

      // Burgers
      { name: 'Classic Veg Burger', description: 'Crispy potato patty, lettuce, tomato, cheese, and our house sauce in a toasted brioche bun.', price: 199, category: catMap['Burgers'], image: productImages['Classic Veg Burger'], popular: true, prepTime: 10, addons: [{ name: 'Extra Cheese', price: 30 }, { name: 'Extra Patty', price: 60 }, { name: 'No Onion', price: 0 }] },
      { name: 'Mushroom Swiss Burger', description: 'Sautéed portobello mushrooms, Swiss cheese, caramelized onions on a sesame bun.', price: 229, category: catMap['Burgers'], image: productImages['Mushroom Swiss Burger'], prepTime: 12, addons: [{ name: 'Extra Mushrooms', price: 30 }] },
      { name: 'Smoky Paneer Burger', description: 'Tandoori-spiced paneer patty, lettuce, slaw, and smoky aioli in a toasted bun.', price: 249, category: catMap['Burgers'], image: productImages['Smoky Paneer Burger'], popular: true, prepTime: 12, addons: [{ name: 'Extra Cheese', price: 30 }, { name: 'Double Patty', price: 60 }] },

      // Pizza
      { name: 'Margherita', description: 'San Marzano tomato base, fresh mozzarella, basil, olive oil. Simple perfection.', price: 299, category: catMap['Pizza'], image: productImages.Margherita, popular: true, prepTime: 15, variants: [{ name: 'Regular (8")', price: 299 }, { name: 'Large (12")', price: 449 }], addons: [{ name: 'Extra Cheese', price: 40 }, { name: 'Chilli Flakes', price: 0 }] },
      { name: 'Paneer Tikka Pizza', description: 'Tandoori-spiced paneer, onions, capsicum, mint chutney base. Desi fusion at its best.', price: 349, category: catMap['Pizza'], image: productImages['Paneer Tikka Pizza'], popular: true, prepTime: 15, variants: [{ name: 'Regular (8")', price: 349 }, { name: 'Large (12")', price: 499 }] },
      { name: 'Farmhouse Delight', description: 'Roasted veggies, olives, mozzarella, and herb sauce on a crisp thin crust.', price: 329, category: catMap['Pizza'], image: productImages['Farmhouse Delight'], popular: true, prepTime: 15, variants: [{ name: 'Regular (8")', price: 329 }, { name: 'Large (12")', price: 489 }] },

      // Desserts
      { name: 'Tiramisu', description: 'Classic Italian dessert with mascarpone, espresso-soaked ladyfingers, and cocoa dust.', price: 199, category: catMap['Desserts'], image: productImages.Tiramisu, popular: true, prepTime: 2 },
      { name: 'Belgian Waffle', description: 'Crispy waffle topped with vanilla ice cream, chocolate sauce, and strawberries.', price: 229, category: catMap['Desserts'], image: productImages['Belgian Waffle'], prepTime: 8, addons: [{ name: 'Extra Ice Cream', price: 40 }, { name: 'Nutella Drizzle', price: 20 }] },
      { name: 'Gulab Jamun with Ice Cream', description: 'Warm soft gulab jamun served with chilled vanilla ice cream. Best of both worlds.', price: 149, category: catMap['Desserts'], image: productImages['Gulab Jamun with Ice Cream'], popular: true, prepTime: 5 },

      // Specials
      { name: 'Brewhaus Brunch Platter', description: 'Eggs your way, garlic toast, hash browns, grilled tomatoes, and a coffee of your choice.', price: 449, category: catMap['Specials'], image: productImages['Brewhaus Brunch Platter'], popular: true, prepTime: 20, addons: [{ name: 'Add Egg', price: 60 }, { name: 'Extra Toast', price: 20 }] },
      { name: 'Café Special Thali', description: 'Chef\'s daily special — ask your server. Changes every day. Always delicious.', price: 299, category: catMap['Specials'], image: productImages['Café Special Thali'], popular: true, prepTime: 15 },
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
