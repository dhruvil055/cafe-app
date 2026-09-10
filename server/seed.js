import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI not set'); process.exit(1); }

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
  console.error('Refusing to seed in production without ALLOW_PRODUCTION_SEED=true');
  process.exit(1);
}

// ── Minimal inline schemas (no circular import issues) ──────────────────────
const addonSchema = new mongoose.Schema({ name: String, price: Number });
const variantSchema = new mongoose.Schema({ name: String, price: Number });

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  image: { type: String, default: '' },
  icon: { type: String, default: '☕' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  available: { type: Boolean, default: true },
  popular: { type: Boolean, default: false },
  variants: [variantSchema],
  addons: [addonSchema],
  rating: { type: Number, default: 4.5 },
  prepTime: { type: Number, default: 10 },
}, { timestamps: true });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
const Product  = mongoose.models.Product  || mongoose.model('Product', productSchema);

// ── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Hot Coffee',   icon: '☕', sortOrder: 1,  image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80' },
  { name: 'Cold Coffee',  icon: '🧊', sortOrder: 2,  image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80' },
  { name: 'Tea & Matcha', icon: '🍵', sortOrder: 3,  image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80' },
  { name: 'Smoothies',    icon: '🥤', sortOrder: 4,  image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&q=80' },
  { name: 'Breakfast',    icon: '🥞', sortOrder: 5,  image: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&q=80' },
  { name: 'Snacks',       icon: '🥙', sortOrder: 6,  image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
  { name: 'Mains',        icon: '🍽️', sortOrder: 7,  image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80' },
  { name: 'Desserts',     icon: '🍰', sortOrder: 8,  image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80' },
  { name: 'Juices',       icon: '🍹', sortOrder: 9,  image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&q=80' },
];

// ── Products builder ─────────────────────────────────────────────────────────
const PRODUCTS = (C) => [
  // ── HOT COFFEE ──
  {
    name: 'Classic Espresso', category: C['Hot Coffee'],
    description: 'Rich, concentrated shot with a golden crema — the purest coffee experience.',
    price: 120, popular: true, prepTime: 5, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500&q=80',
    variants: [{ name: 'Single', price: 120 }, { name: 'Double', price: 160 }],
    addons: [{ name: 'Extra Shot', price: 40 }],
  },
  {
    name: 'Creamy Cappuccino', category: C['Hot Coffee'],
    description: 'Equal parts espresso, steamed milk and silky microfoam for a balanced cup.',
    price: 180, popular: true, prepTime: 7, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&q=80',
    variants: [{ name: 'Regular', price: 180 }, { name: 'Large', price: 220 }],
    addons: [{ name: 'Oat Milk', price: 30 }, { name: 'Extra Shot', price: 40 }, { name: 'Sugar-Free Syrup', price: 20 }],
  },
  {
    name: 'Flat White', category: C['Hot Coffee'],
    description: 'Velvety microfoam over a ristretto base — bold yet smooth.',
    price: 190, prepTime: 7, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=500&q=80',
    addons: [{ name: 'Oat Milk', price: 30 }, { name: 'Extra Shot', price: 40 }],
  },
  {
    name: 'Caramel Latte', category: C['Hot Coffee'],
    description: 'Smooth espresso, steamed milk and house-made caramel drizzle.',
    price: 210, popular: true, prepTime: 8, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=900&q=80',
    variants: [{ name: 'Regular', price: 210 }, { name: 'Large', price: 250 }],
    addons: [{ name: 'Oat Milk', price: 30 }, { name: 'Extra Caramel', price: 20 }, { name: 'Vanilla Syrup', price: 20 }],
  },
  {
    name: 'Hazelnut Mocha', category: C['Hot Coffee'],
    description: 'Espresso meets rich dark chocolate and roasted hazelnut in every sip.',
    price: 230, prepTime: 8, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=900&q=80',
    addons: [{ name: 'Whipped Cream', price: 25 }, { name: 'Extra Chocolate', price: 20 }],
  },
  {
    name: 'Americano', category: C['Hot Coffee'],
    description: 'Espresso diluted with hot water — clean, bold and aromatic.',
    price: 140, prepTime: 5, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
    variants: [{ name: 'Regular', price: 140 }, { name: 'Large', price: 170 }],
    addons: [{ name: 'Extra Shot', price: 40 }],
  },
  {
    name: 'Honey Cinnamon Latte', category: C['Hot Coffee'],
    description: 'Warm espresso with steamed milk, raw honey and a dusting of cinnamon.',
    price: 220, prepTime: 8, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=900&q=80',
    addons: [{ name: 'Oat Milk', price: 30 }, { name: 'Extra Honey', price: 15 }],
  },

  // ── COLD COFFEE ──
  {
    name: 'Cold Brew', category: C['Cold Coffee'],
    description: '18-hour slow-steeped coffee over ice — naturally sweet, never bitter.',
    price: 220, popular: true, prepTime: 3, rating: 4.9,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=500&q=80',
    variants: [{ name: 'Regular', price: 220 }, { name: 'Large', price: 270 }],
    addons: [{ name: 'Vanilla Syrup', price: 20 }, { name: 'Oat Milk', price: 30 }],
  },
  {
    name: 'Iced Caramel Macchiato', category: C['Cold Coffee'],
    description: 'Layers of vanilla, cold milk, espresso and caramel drizzle over ice.',
    price: 250, popular: true, prepTime: 5, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=900&q=80',
    addons: [{ name: 'Extra Caramel', price: 20 }, { name: 'Oat Milk', price: 30 }],
  },
  {
    name: 'Dalgona Coffee', category: C['Cold Coffee'],
    description: 'Whipped coffee foam over chilled milk — the viral cafe classic.',
    price: 230, prepTime: 8, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1587080413959-06b859fb107d?auto=format&fit=crop&w=900&q=80',
    addons: [{ name: 'Oat Milk', price: 30 }, { name: 'Extra Foam', price: 15 }],
  },
  {
    name: 'Iced Mocha', category: C['Cold Coffee'],
    description: 'Espresso blended with chocolate sauce and cold milk, served over crushed ice.',
    price: 240, prepTime: 5, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1530373239216-42518e6b4063?auto=format&fit=crop&w=900&q=80',
    addons: [{ name: 'Whipped Cream', price: 25 }, { name: 'Extra Chocolate', price: 20 }],
  },
  {
    name: 'Espresso Tonic', category: C['Cold Coffee'],
    description: 'A chilled shot of espresso poured over sparkling tonic — bright and refreshing.',
    price: 200, prepTime: 4, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80',
  },

  // ── TEA & MATCHA ──
  {
    name: 'Matcha Latte', category: C['Tea & Matcha'],
    description: 'Ceremonial-grade matcha whisked with steamed oat milk and a touch of honey.',
    price: 220, popular: true, prepTime: 7, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=900&q=80',
    variants: [{ name: 'Hot', price: 220 }, { name: 'Iced', price: 240 }],
    addons: [{ name: 'Oat Milk', price: 30 }, { name: 'Extra Honey', price: 15 }, { name: 'Vanilla Syrup', price: 20 }],
  },
  {
    name: 'Masala Chai', category: C['Tea & Matcha'],
    description: 'House-blend spiced tea with cardamom, ginger, cinnamon and full-fat milk.',
    price: 120, popular: true, prepTime: 8, rating: 4.9,
    image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80',
    variants: [{ name: 'Regular', price: 120 }, { name: 'Large', price: 160 }],
    addons: [{ name: 'Extra Ginger', price: 10 }, { name: 'Sugar-Free', price: 0 }],
  },
  {
    name: 'Jasmine Green Tea', category: C['Tea & Matcha'],
    description: 'Delicate loose-leaf jasmine green tea, steeped to perfection.',
    price: 140, prepTime: 6, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80',
    variants: [{ name: 'Hot', price: 140 }, { name: 'Iced', price: 160 }],
  },
  {
    name: 'Chamomile Honey Tea', category: C['Tea & Matcha'],
    description: 'Soothing chamomile flowers with raw wildflower honey — perfect evening brew.',
    price: 150, prepTime: 6, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&q=80',
    addons: [{ name: 'Extra Honey', price: 15 }],
  },
  {
    name: 'Iced Matcha Lemonade', category: C['Tea & Matcha'],
    description: 'Vibrant matcha meets zesty lemonade over ice — tart, earthy, refreshing.',
    price: 200, prepTime: 5, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=900&q=80',
  },

  // ── SMOOTHIES ──
  {
    name: 'Berry Blast Smoothie', category: C['Smoothies'],
    description: 'Blueberries, strawberries, raspberries and Greek yoghurt — antioxidant-packed.',
    price: 240, popular: true, prepTime: 6, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=500&q=80',
    addons: [{ name: 'Protein Boost', price: 40 }, { name: 'Chia Seeds', price: 20 }],
  },
  {
    name: 'Mango Lassi', category: C['Smoothies'],
    description: 'Thick, creamy Alphonso mango purée blended with chilled yoghurt and a hint of cardamom.',
    price: 190, popular: true, prepTime: 5, rating: 4.9,
    image: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=500&q=80',
    variants: [{ name: 'Regular', price: 190 }, { name: 'Large', price: 240 }],
  },
  {
    name: 'Green Detox Smoothie', category: C['Smoothies'],
    description: 'Spinach, cucumber, apple, ginger and coconut water — clean and energising.',
    price: 220, prepTime: 6, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=900&q=80',
    addons: [{ name: 'Protein Boost', price: 40 }],
  },
  {
    name: 'Peanut Butter Banana', category: C['Smoothies'],
    description: 'Frozen banana, natural peanut butter, almond milk and a drizzle of honey.',
    price: 230, prepTime: 5, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&q=80',
    addons: [{ name: 'Protein Boost', price: 40 }, { name: 'Oat Milk', price: 0 }],
  },

  // ── BREAKFAST ──
  {
    name: 'Avocado Toast', category: C['Breakfast'],
    description: 'Sourdough, smashed avocado, cherry tomatoes, chilli flakes and a poached egg.',
    price: 280, popular: true, prepTime: 12, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=900&q=80',
    addons: [{ name: 'Extra Egg', price: 40 }, { name: 'Feta Crumble', price: 30 }, { name: 'Smoked Salmon', price: 80 }],
  },
  {
    name: 'Fluffy Buttermilk Pancakes', category: C['Breakfast'],
    description: 'Stack of three golden pancakes with maple syrup, fresh berries and whipped butter.',
    price: 260, popular: true, prepTime: 15, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=500&q=80',
    addons: [{ name: 'Extra Stack (+3)', price: 100 }, { name: 'Nutella Drizzle', price: 30 }, { name: 'Banana Slices', price: 20 }],
  },
  {
    name: 'Eggs Benedict', category: C['Breakfast'],
    description: 'Toasted English muffin, back bacon, perfectly poached eggs and hollandaise sauce.',
    price: 320, prepTime: 18, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=500&q=80',
    addons: [{ name: 'Extra Egg', price: 40 }],
  },
  {
    name: 'Granola Bowl', category: C['Breakfast'],
    description: 'House-baked granola, Greek yoghurt, seasonal fruit and a drizzle of local honey.',
    price: 220, prepTime: 5, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=500&q=80',
    addons: [{ name: 'Extra Granola', price: 30 }, { name: 'Chia Seeds', price: 20 }],
  },
  {
    name: 'Veggie Omelette', category: C['Breakfast'],
    description: 'Three-egg omelette stuffed with bell peppers, onions, mushrooms and cheese.',
    price: 240, prepTime: 12, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=500&q=80',
    addons: [{ name: 'Extra Cheese', price: 25 }, { name: 'Add Chicken', price: 60 }],
  },

  // ── SNACKS ──
  {
    name: 'Truffle Fries', category: C['Snacks'],
    description: 'Crispy golden fries tossed in truffle oil, parmesan and fresh herbs.',
    price: 220, popular: true, prepTime: 10, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&q=80',
    addons: [{ name: 'Cheese Sauce', price: 30 }, { name: 'Garlic Mayo', price: 25 }],
  },
  {
    name: 'Chicken Quesadilla', category: C['Snacks'],
    description: 'Grilled tortilla with spiced chicken, cheddar, jalapeños and sour cream.',
    price: 280, popular: true, prepTime: 14, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=500&q=80',
    addons: [{ name: 'Extra Cheese', price: 25 }, { name: 'Guacamole', price: 40 }],
  },
  {
    name: 'Bruschetta', category: C['Snacks'],
    description: 'Grilled ciabatta, fresh tomatoes, basil, garlic and extra-virgin olive oil.',
    price: 180, prepTime: 8, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=500&q=80',
  },
  {
    name: 'Spinach & Cheese Puffs', category: C['Snacks'],
    description: 'Golden puff pastry parcels filled with spinach, ricotta and a hint of nutmeg.',
    price: 160, prepTime: 10, rating: 4.4,
    image: 'https://images.unsplash.com/photo-1517244683847-7456b63c5969?w=500&q=80',
  },
  {
    name: 'Nachos Supreme', category: C['Snacks'],
    description: 'Tortilla chips loaded with salsa, sour cream, jalapeños and melted cheese.',
    price: 250, prepTime: 8, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?auto=format&fit=crop&w=900&q=80',
    addons: [{ name: 'Guacamole', price: 40 }, { name: 'Add Chicken', price: 60 }],
  },

  // ── MAINS ──
  {
    name: 'Grilled Chicken Sandwich', category: C['Mains'],
    description: 'Herb-marinated chicken breast, lettuce, tomato, avocado and honey mustard on sourdough.',
    price: 340, popular: true, prepTime: 18, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?w=500&q=80',
    addons: [{ name: 'Extra Chicken', price: 60 }, { name: 'Add Bacon', price: 50 }, { name: 'Gluten-Free Bread', price: 30 }],
  },
  {
    name: 'Mushroom Risotto', category: C['Mains'],
    description: 'Arborio rice slow-cooked with wild mushrooms, truffle oil and aged parmesan.',
    price: 380, prepTime: 20, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=500&q=80',
    addons: [{ name: 'Extra Parmesan', price: 25 }, { name: 'Add Chicken', price: 70 }],
  },
  {
    name: 'Pesto Pasta', category: C['Mains'],
    description: 'Al-dente penne in homemade basil-pine nut pesto, cherry tomatoes and parmesan.',
    price: 320, popular: true, prepTime: 16, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=500&q=80',
    variants: [{ name: 'Regular', price: 320 }, { name: 'Large', price: 390 }],
    addons: [{ name: 'Extra Parmesan', price: 25 }, { name: 'Add Chicken', price: 70 }, { name: 'Gluten-Free Pasta', price: 30 }],
  },
  {
    name: 'Veggie Burger', category: C['Mains'],
    description: 'House-made black bean and quinoa patty, lettuce, tomato, pickles and chipotle aioli.',
    price: 300, prepTime: 14, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=500&q=80',
    addons: [{ name: 'Extra Patty', price: 80 }, { name: 'Cheese Slice', price: 25 }, { name: 'Fries', price: 60 }],
  },
  {
    name: 'Caesar Salad', category: C['Mains'],
    description: 'Crisp romaine, house Caesar dressing, parmesan shavings and garlic croutons.',
    price: 260, prepTime: 8, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500&q=80',
    addons: [{ name: 'Grilled Chicken', price: 80 }, { name: 'Smoked Salmon', price: 100 }, { name: 'Extra Dressing', price: 20 }],
  },

  // ── DESSERTS ──
  {
    name: 'Tiramisu', category: C['Desserts'],
    description: 'Classic Italian layers of espresso-soaked ladyfingers and mascarpone cream.',
    price: 260, popular: true, prepTime: 5, rating: 4.9,
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&q=80',
  },
  {
    name: 'Warm Chocolate Lava Cake', category: C['Desserts'],
    description: 'Dark chocolate cake with a molten centre, served with vanilla ice cream.',
    price: 280, popular: true, prepTime: 14, rating: 4.9,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&q=80',
    addons: [{ name: 'Extra Ice Cream', price: 40 }, { name: 'Caramel Drizzle', price: 20 }],
  },
  {
    name: 'New York Cheesecake', category: C['Desserts'],
    description: 'Dense, creamy cheesecake on a buttery graham cracker crust with berry compote.',
    price: 240, prepTime: 5, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=500&q=80',
    addons: [{ name: 'Extra Berry Compote', price: 30 }],
  },
  {
    name: 'Belgian Waffles', category: C['Desserts'],
    description: 'Crispy-outside, fluffy-inside waffles with fresh strawberries, cream and syrup.',
    price: 240, popular: true, prepTime: 12, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=500&q=80',
    addons: [{ name: 'Nutella Spread', price: 30 }, { name: 'Extra Cream', price: 25 }, { name: 'Banana Slices', price: 20 }],
  },
  {
    name: 'Mango Panna Cotta', category: C['Desserts'],
    description: 'Silky Italian panna cotta topped with fresh Alphonso mango coulis.',
    price: 200, prepTime: 5, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80',
  },
  {
    name: 'Gulab Jamun with Ice Cream', category: C['Desserts'],
    description: 'Soft rose-syrup gulab jamun served warm alongside a scoop of kulfi ice cream.',
    price: 180, popular: true, prepTime: 5, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1601303556393-fa8ac0ac6a38?w=500&q=80',
  },

  // ── JUICES ──
  {
    name: 'Fresh Orange Juice', category: C['Juices'],
    description: 'Cold-pressed from hand-picked Nagpur oranges — no sugar, no concentrate.',
    price: 160, popular: true, prepTime: 5, rating: 4.8,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&q=80',
    variants: [{ name: 'Regular (250ml)', price: 160 }, { name: 'Large (400ml)', price: 220 }],
  },
  {
    name: 'Watermelon Mint Cooler', category: C['Juices'],
    description: 'Blended fresh watermelon with a squeeze of lime and a sprig of garden mint.',
    price: 150, popular: true, prepTime: 5, rating: 4.7,
    image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=500&q=80',
  },
  {
    name: 'Carrot Ginger Juice', category: C['Juices'],
    description: 'Cold-pressed carrot, apple, ginger and turmeric — an immunity-boosting blend.',
    price: 170, prepTime: 5, rating: 4.5,
    image: 'https://images.unsplash.com/photo-1603569283847-aa295f0d016a?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Pomegranate Lemonade', category: C['Juices'],
    description: 'Fresh pomegranate juice with lemon, basil seeds and a pinch of black salt.',
    price: 180, prepTime: 5, rating: 4.6,
    image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&q=80',
    addons: [{ name: 'Add Soda', price: 15 }],
  },
  {
    name: 'Green Cucumber Detox', category: C['Juices'],
    description: 'Cucumber, spinach, green apple and coconut water — light, hydrating, clean.',
    price: 160, prepTime: 5, rating: 4.4,
    image: 'https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=500&q=80',
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Upsert categories
  const catMap = {};
  for (const cat of CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { name: cat.name },
      { $set: cat },
      { upsert: true, new: true }
    );
    catMap[cat.name] = doc._id;
    console.log(`  📁 Category: ${cat.name}`);
  }

  // Insert products (skip if name already exists)
  const products = PRODUCTS(catMap);
  let added = 0, skipped = 0;
  for (const p of products) {
    const exists = await Product.findOne({ name: p.name });
    if (exists) { skipped++; continue; }
    await Product.create(p);
    console.log(`  🍽️  ${p.name}`);
    added++;
  }

  console.log(`\n🎉 Done! Added ${added} products, skipped ${skipped} existing.`);
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
