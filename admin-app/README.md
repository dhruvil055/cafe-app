# Brewhaus Admin App

This is the standalone admin website for Brewhaus café. It uses the same shared backend and MongoDB database as the customer app.

## Local development

1. Install dependencies:
   npm install
2. Copy `.env.example` to `.env` and set the values.
3. Run:
   npm run dev

## Environment variables

- `VITE_API_URL`: API base URL, such as `https://your-backend.onrender.com/api`
- `VITE_CUSTOMER_APP_URL`: production customer website URL, used for QR generation
- `VITE_ADMIN_APP_URL`: admin app URL for deploy metadata

## Deployment

Deploy this folder as a separate Vercel app, using the same backend deployment for all requests.
