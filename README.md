# ☕ Brewhaus Café — Production-Ready 3D Café Ordering System

A full-stack MERN application with 3D interactions, QR-based table ordering, Razorpay payments, and a complete admin panel.

## Tenant white-label settings (Phase 0B)

Run `npm run migrate:phase0b` from `server` after Phase 0A. The migration seeds the existing tenant's customer-facing defaults and has a paired `npm run rollback:phase0b` command. For tenant Razorpay credentials, configure a persistent 32-byte `TENANT_CREDENTIALS_ENCRYPTION_KEY` in the server environment before saving settings in the owner-only Café Settings page. Enter each tenant's Razorpay key ID, key secret, and webhook secret in that page; point that provider account's webhook at `/api/payment/webhook`. Keep the encryption key backed up because losing it makes stored tenant payment credentials unreadable.

---

## ✨ Features

### Customer Experience
- 🎨 **3D Hero** — Interactive coffee cup with floating beans & particles (Three.js + React Three Fiber)
- 📱 **QR Table Ordering** — Scan → table auto-detected → order delivered to seat
- 🔍 **Search & Filter** — By category, veg/non-veg, price sort, popular items
- 🛒 **Smart Cart** — Persistent cart with add-ons, variants, special instructions
- 💳 **Razorpay Payment** — Razorpay checkout with server-verified webhook completion
- 🔐 **Signed table QR codes** — Table-specific signed links that expire after two years
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
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
TABLE_QR_SECRET=your_table_qr_signing_secret_min_32_chars
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
  → Pay online (Razorpay, confirmed by webhook) or cash
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
- Admin access tokens expire after 15 minutes and rotate through an HttpOnly refresh cookie (30-day expiry)
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

Configure the Razorpay webhook endpoint as `https://<your-api-domain>/api/payment/webhook` and set its signing secret as `RAZORPAY_WEBHOOK_SECRET`. The customer checkout callback only displays pending confirmation; it cannot mark an order paid. The MongoDB deployment must support transactions (Atlas replica set or equivalent).

Apply the Phase 1 data migration before deploying the API:

```bash
cd server
npm run migrate:phase1
```

The migration creates the payment collection and unique idempotency indexes, backfills payment records, and refreshes stored table QR images with signed links. Opening the admin Tables page or regenerating a table QR refreshes an expired code.

Apply the Phase 2 table-service request index migration before deploying the API:

```bash
cd server
npm run migrate:phase2
```

Phase 2 order and menu updates use authenticated/public Server-Sent Events. The current event broker is in-memory, so a multi-instance API deployment needs sticky routing or a shared event broker for updates to cross instances.

Apply the Phase 3 admin-security migration before deploying the API:

```bash
cd server
npm run migrate:phase3
```

This migration creates audit-log indexes and the scheduled-availability product index. Existing `admin` users are treated as owners and `staff` users as managers; the migration does not rewrite user records. Owners can create staff accounts, assign roles, review audit events, and optionally enable authenticator-based 2FA from the admin Profile page. Set `JWT_SECRET` to a stable secret of at least 32 characters; it also derives the encryption key for stored 2FA secrets. After deploying the short-lived-token change, admins with an old session must sign in again.

Apply the Phase 4 query-index migration before deploying the API:

```bash
cd server
npm run migrate:phase4
```

The API validates request payload shape and rejects Mongo operator/dotted keys, assigns a request ID, emits JSON request logs, enforces production HTTPS, and uses an exact two-origin production CORS allowlist. Staging origins are read from `STAGING_ALLOWED_ORIGINS`; production ignores preview and staging origins. `createApp({ errorTracker })` accepts an optional error-capture callback for a Sentry-style integration without coupling the app to a paid provider.

Use `.env.staging.example` and `.env.production.example` in each app as environment-variable templates; they contain placeholders only. Keep the actual values in the deployment environment and use separate databases, JWT/QR secrets, and payment credentials for staging and production. Production API traffic must arrive through an HTTPS-terminating proxy that forwards `X-Forwarded-Proto`.

The customer and admin sites have installable PWA manifests, shell/offline fallback caching, and a visible 404 page. API requests and order/customer data are excluded from service-worker caching. The customer site includes privacy, terms, and refund-policy pages, SEO/Open Graph metadata, and sitemap entries. Menu/category responses and immutable uploaded images expose shared-cache headers; menu image URLs already use responsive CDN transformations when served by Unsplash.

### Backups and restore

Install MongoDB Database Tools (`mongodump` and `mongorestore`) on the backup runner, set `MONGO_URI`, and schedule `npm run backup:db` with the host's protected scheduler (for example, a daily cron job or Task Scheduler job). Set `BACKUP_DIR` to a protected, access-controlled location with off-host retention. The generated archive is gzip-compressed and excluded from Git.

To verify a backup without overwriting the source database, set `MONGO_URI` and run:

```bash
cd server
npm run restore:db -- "<path-to-backup-archive>"
```

The restore script maps the archive to a uniquely named `brewhaus_restore_*` database and never uses `--drop`. Verify collections and representative documents there first; changing an application connection string to use restored data is a separate deployment operation.

The GitHub Actions workflow installs the three app workspaces, runs ESLint and the server test suite against an ephemeral MongoDB service, then builds both Vite apps. The integration suite includes a 50-concurrent-order load check; run it with `npm test` from the repository root. It is a basic local/CI check, not a capacity certification.

### Phase 5 growth features

Run `npm run migrate:phase5` from `server` before deploying. It creates indexes for coupon lookup, loyalty-point sorting, and customer order history. Existing customer and order documents receive schema defaults when read; the migration does not delete or rewrite records.

The analytics page already includes daily/monthly sales, top items, peak order hours, and average order value. Sales and GST report buttons export Excel-compatible CSV for paid orders in the current month; the API accepts `from=YYYY-MM-DD&to=YYYY-MM-DD` for custom periods up to 366 days. Set `GSTIN` to the café's registered number for the GST export; the field is blank when unset.

Owner/manager users can manage coupon codes from Admin → Coupons. Checkout validates the cart against server prices, applies eligible discounts before GST, reserves limited-use coupons with order creation, and includes discounts in receipts. Paid orders earn one loyalty point per ₹100 of discounted food subtotal; refunded orders reverse those points. Customers can submit one 1–5 rating and optional comment after a paid order is served, using their order access token.

Customer order history currently covers orders kept on the same device and the active table session. Phone/OTP accounts are not enabled because no operational OTP delivery provider is configured; configuring a paid SMS or messaging account requires a separate service decision. Points are earned and displayed in the admin customer profile; redemption is not included in this phase.

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
