# ☕ Brewhaus Café — Production-Ready 3D Café Ordering System

A full-stack MERN application with 3D interactions, QR-based table ordering, Razorpay payments, and a complete admin panel.

---

## ✨ Features

### Customer Experience
- 🎨 **3D Hero** — Interactive coffee cup with floating beans & particles (Three.js + React Three Fiber)
- 📱 **QR Table Ordering** — Scan → table auto-detected → order delivered to seat
- 🔍 **Search & Filter** — By category, veg/non-veg, price sort, popular items
- 🛒 **Smart Cart** — Persistent cart with add-ons, variants, special instructions
- 💳 **Razorpay Payment** — Full payment flow with server-side signature verification
- 📄 **PDF Receipt** — Downloadable 80mm receipt with order details
- 📍 **Live Order Tracking** — Real-time status updates (polls every 15s)

### Admin Panel
- 📊 **Dashboard** — Today's orders, revenue, pending/completed counts
- 📋 **Order Management** — Live orders with status progression, one-click updates
- 🍽️ **Menu Management** — CRUD items with image upload, variants, add-ons, toggles
- 🏷️ **Category Management** — Create/edit/reorder categories with emoji icons
- 🪑 **Table & QR Management** — Bulk create tables, view/download/print QR codes

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS |
| 3D | Three.js, React Three Fiber, Drei |
| Animations | Framer Motion |
| State | Zustand (persisted cart) |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Auth | JWT (7-day tokens) |
| Payment | Razorpay (server-side verification) |
| PDF | PDFKit (80mm receipt) |
| QR Codes | node-qrcode (base64 PNG) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Razorpay account (test keys work)

### 1. Clone & Install

```bash
git clone <your-repo>
cd brewhaus-cafe
npm run install:all
```

### 2. Configure Environment

**Backend** (`server/.env`):
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/cafe_db
JWT_SECRET=your_super_secret_key_min_32_chars
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**Frontend** (`client/.env`):
```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

### 3. Seed the Database

```bash
npm run seed
```

This creates:
- ✅ Admin user: `admin@brewhaus.com` / `admin123`
- ✅ 9 categories (Coffee, Tea, Cold Drinks, Shakes, Snacks, Burgers, Pizza, Desserts, Specials)
- ✅ 27 realistic menu items with INR pricing
- ✅ 10 tables with QR codes pointing to `http://localhost:5173/menu?table=N`

### 4. Start Development

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Admin: http://localhost:5173/admin/login

---

## 📱 Customer Flow

```
Scan QR → /menu?table=3
  → Table 03 auto-detected
  → Browse menu → tap item → add-ons modal
  → Add to cart → Cart page
  → Checkout (name + phone)
  → Pay online (Razorpay) or cash
  → /order-confirm/:id → live status + PDF receipt
```

## 🔑 Admin Flow

```
/admin/login → admin@brewhaus.com / admin123
  → Dashboard (stats)
  → Orders (live, update status)
  → Menu (add/edit/delete items, toggle availability)
  → Categories (manage with icons)
  → Tables (bulk create, view/print QR)
```

---

## 🌐 Deployment

### Backend → Render

1. Push to GitHub.
2. Create a new Blueprint on Render and select this repository. Render will read `render.yaml`.
3. Ensure the Render Build Command is `npm ci` and the Start Command is `npm start`.
4. Add the secret values for `MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`.
5. After Vercel creates the frontend, set `CLIENT_URL` to its public URL and `SERVER_URL` to the Render service URL.
6. Deploy the service and verify `https://your-backend.onrender.com/api/health` returns `{ "status": "ok" }`.

### Frontend → Vercel

1. Import the repository on Vercel and set **Root Directory** to `client`.
2. Set Install Command to `npm install` and Build Command to `npm run build`. Do not use the root project's `npm run install:all` command when the root directory is `client`.
3. The output directory is `dist`. SPA rewrites are configured in the root `vercel.json` when deploying from the repository root; when using `client` as the Root Directory, add a rewrite in Vercel for all paths to `/index.html` if React Router refreshes return 404.
4. Add these environment variables for Production, Preview, and Development:
  - `VITE_API_URL=https://your-backend.onrender.com/api`
  - `VITE_RAZORPAY_KEY_ID=rzp_live_xxxx`

### MongoDB Atlas

1. Create an Atlas cluster and database user.
2. In Network Access, allow the Render service to connect. For a quick deployment, Atlas can allow `0.0.0.0/0`; use stronger network restrictions when available.
3. Set Render's `MONGO_URI` to the Atlas connection string, replacing the username, password, and database name.
4. Run `npm run seed` locally with the same Atlas `MONGO_URI` and `CLIENT_URL` to create the menu, tables, QR codes, and admin account.

### After Deployment

Re-seed with production URL so QR codes point to live site:

```bash
# In server/.env:
CLIENT_URL=https://your-cafe.vercel.app

# Then re-run seed:
npm run seed
```

---

## 🏗 Project Structure

```
brewhaus-cafe/
├── client/                    # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── 3d/            # Three.js 3D components
│       │   ├── menu/          # MenuCard, ProductModal
│       │   └── ui/            # SkeletonCard, shared UI
│       ├── context/           # Zustand cart store, Auth context
│       ├── layouts/           # AdminLayout (sidebar)
│       ├── pages/
│       │   ├── customer/      # Menu, Cart, Checkout, OrderConfirm, Track
│       │   └── admin/         # Login, Dashboard, Orders, Menu, Categories, Tables
│       └── services/          # Axios API instance
│
└── server/                    # Node.js + Express backend
    ├── config/                # MongoDB connection
    ├── middleware/            # JWT auth middleware
    ├── models/                # User, Category, Product, Table, Order
    ├── routes/                # auth, menu, categories, orders, payment, tables, upload
    ├── services/              # PDF receipt generator
    └── utils/                 # Database seeder
```

---

## 🔒 Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens (7-day expiry)
- Razorpay signature verified server-side (HMAC-SHA256)
- Payment secrets never exposed to frontend
- Helmet.js security headers
- Rate limiting (200 req/15min)
- CORS restricted to known origins

---

## 🧪 Testing the Payment Flow

Use Razorpay test credentials:
- Card: `4111 1111 1111 1111` / Any future date / Any CVV
- UPI: `success@razorpay`
- Net Banking: Any test bank

---

## 🔮 Future Upgrades (₹ Add-ons)

- 📊 Advanced analytics dashboard
- 💬 WhatsApp order notifications
- 🧾 Kitchen display system
- 💳 Loyalty points & rewards
- 🏢 Multi-branch management
- 📱 Waiter mobile app
- 🖨️ Thermal printer integration

---

Built with ☕ by Infinigrowsoftech
