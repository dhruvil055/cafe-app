---
title: "Production Deployment & Migration Guide"
version: "1.0"
date: 2024-01-15
---

# Brewhaus Café App — Security Hardening Deployment Guide

## Overview

This guide walks through deploying the security-hardened version of the cafe ordering application. All customer-facing functionality remains unchanged; only backend payment processing and data security have been enhanced.

---

## Pre-Deployment Checklist

### 1. Environment Setup

**Create production `.env` file with real values:**

```bash
# Server Configuration
PORT=5000
NODE_ENV=production
SERVER_URL=https://your-backend.onrender.com
CLIENT_URL=https://client-seven-sigma-26.vercel.app
# Optional: comma-separated exact origins for additional approved deployments.
# CLIENT_URLS=https://client-seven-sigma-26.vercel.app,https://preview.example.com

# Database
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/cafe_db?retryWrites=true&w=majority

# Authentication (generate using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<generate-32-char-random-secret-here>
ADMIN_SETUP_SECRET=<generate-32-char-random-secret-here>

# Razorpay Payment (from Razorpay Dashboard)
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<your-razorpay-secret-from-dashboard>
```

**Generate secure secrets:**
```bash
# macOS/Linux
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Windows PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Database Preparation

**Add new order fields to existing orders:**

```javascript
// MongoDB Shell or MongoDB Compass
db.orders.updateMany(
  { accessTokenHash: { $exists: false } },
  [{
    $set: {
      accessTokenHash: { $function: {
        body: "return require('crypto').randomBytes(32).toString('hex');",
        args: [],
        lang: "js"
      }},
      paymentVerifiedAt: null
    }
  }]
);
```

**Or run migration script:**
```bash
cd server
node utils/migrateOrders.js
```

### 3. Admin Account Setup

**First-time admin creation (use the new secure setup endpoint):**

```bash
# Generate setup secret
SETUP_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Setup Secret: $SETUP_SECRET"

# Call setup endpoint (only works once!)
curl -X POST http://localhost:5000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "setupToken": "'$SETUP_SECRET'",
    "name": "Admin Name",
    "email": "admin@cafe.com",
    "password": "SecureAdminPassword123!"
  }'

# Response:
# { "success": true, "message": "Admin created successfully" }
```

**Important**: 
- This endpoint can only be called ONCE
- After first admin creation, the endpoint will return 403 (admin already exists)
- **REMOVE the ADMIN_SETUP_SECRET from .env after initial setup** (or set to empty string)

---

## Deployment Steps

### Step 1: Backend Deployment

```bash
cd cafe-app/server

# Install dependencies (if not already done)
npm install

# Verify syntax
node --check index.js

# Start server
npm start
# or for production:
npm run start:prod
```

### Step 2: Frontend Deployment

```bash
cd cafe-app/client

# Build production bundle
npm run build

# Deploy dist/ folder to hosting
# Option A: Vercel
vercel

# Option B: Manual upload to web server
# Copy dist/* to your web server's public directory
```

### Step 3: Database Indices

**Create indices for performance and data integrity:**

```bash
# MongoDB Shell
db.orders.createIndex({ accessTokenHash: 1 }, { unique: true })
db.orders.createIndex({ orderNumber: 1 }, { unique: true })
db.orders.createIndex({ razorpayOrderId: 1 })
db.users.createIndex({ email: 1 }, { unique: true })
```

---

## Breaking Changes & Migration

### For Mobile Clients

**Order Retrieval (Customer)**:
- **Before**: `GET /api/orders/:orderId`
- **After**: `GET /api/orders/:orderId?accessToken=<token>`

**Action Required**:
- Customer receives `accessToken` after order creation
- Store token in localStorage/session
- Pass token in all subsequent order queries (status tracking, receipt download)

### For Admin Dashboard

**No Breaking Changes** — Admin endpoints remain the same:
- `GET /api/orders/list/all` — List all orders (requires admin token)
- `PUT /api/orders/:id/status` — Update order status (requires admin token)
- Cannot modify paymentStatus (attempted changes now return 400 error)

### For Menu Management

**Mass Assignment Fix**:
- **Before**: `POST /api/menu { ...any fields... }`
- **After**: Only allowed fields accepted

**Allowed Fields**:
- name, description, price, image, category, available, popular, variants, addons, prepTime

**Action Required**: If you have custom scripts creating products, update to only include these fields.

---

## API Changes Summary

### Orders Endpoint

#### POST /api/orders (Create Order)
**Request** (CHANGED):
```json
{
  "tableNumber": 5,
  "customer": { "name": "John", "phone": "9876543210" },
  "items": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "quantity": 2,
      "variantId": "optional-variant-id",
      "addonIds": ["addon-id-1", "addon-id-2"]
    }
  ],
  "paymentMethod": "razorpay",
  "notes": "Extra sugar in coffee"
}
```

**Response** (CHANGED):
```json
{
  "order": {
    "_id": "...",
    "orderNumber": "CAF1001",
    "total": 29900,
    "paymentStatus": "pending",
    ...
  },
  "accessToken": "64-character-hex-token"
}
```

**Important**: accessToken is ONLY returned on creation. Store it securely on the client.

#### GET /api/orders/:id (Retrieve Order)
**Request** (CHANGED):
```
GET /api/orders/507f1f77bcf86cd799439011?accessToken=<token>
```

**Response**:
```json
{
  "order": {
    "_id": "...",
    "orderNumber": "CAF1001",
    "customer": { "name": "John", "phone": "9876543210" },
    "items": [...],
    "total": 29900,
    "paymentStatus": "paid",
    "orderStatus": "preparing",
    ...
  }
}
```

#### GET /api/orders/:id/receipt (Download Receipt)
**Request** (CHANGED):
```
GET /api/orders/507f1f77bcf86cd799439011/receipt?accessToken=<token>
```

**Response**: PDF blob

### Payment Endpoint

#### POST /payment/verify (Verify Payment)
**Verification is now idempotent** — calling twice returns success safely:
```json
{
  "razorpay_order_id": "order_DBJOWzybf0sJbb",
  "razorpay_payment_id": "pay_DBJOWzybf0sJbb",
  "razorpay_signature": "...",
  "orderId": "507f1f77bcf86cd799439011"
}
```

---

## Rollback Plan

If critical issues occur after deployment:

### Quick Rollback
1. Revert server version in your deployment (Vercel/Render/etc.)
2. Clear browser localStorage to remove old access tokens
3. Database remains unchanged (migrations are backward-compatible)

### Database Rollback
```javascript
// If new fields cause issues, remove them:
db.orders.updateMany({}, { $unset: { accessTokenHash: "", paymentVerifiedAt: "" } })
```

---

## Testing Checklist

### Test Cart to Checkout Flow
- [ ] Add items to cart
- [ ] Verify cart displays item totals (from client calculation)
- [ ] Checkout screen shows order summary
- [ ] "Place Order" sends secure format (productId+quantity)

### Test Order Creation
- [ ] Cash payment: Order created successfully
- [ ] Razorpay payment: Order created, Razorpay modal opens
- [ ] Order response includes accessToken

### Test Order Tracking (Customer)
- [ ] Pass accessToken in URL query param
- [ ] Order status updates in real-time
- [ ] Without accessToken, order cannot be accessed (401/403)
- [ ] Receipt downloads successfully with token

### Test Payment Verification
- [ ] First payment verification succeeds
- [ ] Second payment verification (duplicate) returns success safely
- [ ] Order paymentStatus is 'paid'
- [ ] Staff cannot manually set paymentStatus via status endpoint

### Test Admin Dashboard
- [ ] Admin login works
- [ ] Order list shows all orders
- [ ] Order status updates (confirmed → preparing → ready)
- [ ] Cannot set paymentStatus (endpoint returns 400)
- [ ] Can upload product images

### Test Security
- [ ] Customer cannot guess another customer's order ID
- [ ] Invalid accessToken returns 403
- [ ] Search with special characters doesn't cause ReDoS
- [ ] Rate limiting kicks in after 200 requests

---

## Monitoring After Deployment

### Key Metrics to Track

**Payment Processing**:
- Payment verification success rate (target: >99%)
- Average payment verification time
- Duplicate payment attempts (should be rare)

**Order Processing**:
- Order creation rate
- Average order value
- Orders with missing accessToken (should be 0)

**Security Events**:
- Failed authentication attempts
- 403 access denied responses
- CORS rejections
- Rate limit triggers

**Performance**:
- API response time (target: <200ms)
- Database query time
- Backend error rate (target: <0.1%)

### Recommended Tools

- **Monitoring**: Sentry (error tracking), DataDog/New Relic (performance)
- **Logging**: Winston (server logs), Cloudwatch (AWS)
- **Analytics**: Mixpanel (payment funnel), Google Analytics (customer)

---

## Support & Troubleshooting

### Issue: "Admin setup not available"
**Cause**: ADMIN_SETUP_SECRET not configured or set to placeholder  
**Fix**: Add real secret to `.env`

### Issue: "Invalid access token"
**Cause**: Customer accessing order without token or with wrong token  
**Fix**: Ensure token passed in query parameter: `?accessToken=<token>`

### Issue: "Payment verification failed"
**Cause**: RAZORPAY_KEY_SECRET incorrect or Razorpay API down  
**Fix**: Verify credentials in Razorpay dashboard; check API status at razorpay.com

### Issue: CORS errors when accessing from frontend
**Cause**: CLIENT_URL not in CORS allowlist  
**Fix**: Add frontend URL to `allowedOrigins` in `server/index.js`

### Issue: File upload fails with "Only JPEG, PNG, WEBP images allowed"
**Cause**: Uploading non-image file type  
**Fix**: Only upload .jpg, .png, or .webp images

---

## FAQ

**Q: Will existing orders break?**  
A: No. Existing orders will work once you run the database migration to add new fields.

**Q: Do I need to recreate the database?**  
A: No. Migration script adds new fields to existing orders.

**Q: What if I forget the accessToken?**  
A: Customers will need to use order tracking QR code or admin can provide order details.

**Q: Can I use the old order format?**  
A: No. New API expects `{productId, quantity}` format. Old `{price, itemTotal}` format will be rejected.

**Q: How long is the accessToken valid?**  
A: Indefinitely, until order is deleted or completed. No expiration.

**Q: Can staff see accessTokens?**  
A: No. Only customers receive tokens on order creation. Admin dashboard uses JWT tokens.

**Q: Is payment information stored?**  
A: Only order ID, payment ID, signature, and status. Never store card details (handled by Razorpay).

---

## Post-Deployment Tasks

1. **Monitor logs** for first 24 hours
2. **Verify Razorpay integration** with test payment
3. **Test customer flow** end-to-end
4. **Document any customizations** made
5. **Set up backup schedule** for database
6. **Configure monitoring alerts**
7. **Train staff** on new admin dashboard
8. **Update customer support** with FAQ

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial security hardening deployment |

---

**Questions?** Contact the development team or refer to SECURITY-AUDIT-REPORT.md for technical details.
