import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import QuickCartPopup from './components/ui/QuickCartPopup';
import PushNotificationBanner from './components/ui/PushNotificationBanner';

// Primary customer entry page loaded eagerly
import MenuPage from './pages/customer/MenuPage';

// Lazy-loaded customer pages
const CartPage = lazy(() => import('./pages/customer/CartPage'));
const CheckoutPage = lazy(() => import('./pages/customer/CheckoutPage'));
const OrderConfirmPage = lazy(() => import('./pages/customer/OrderConfirmPage'));
const TrackOrderPage = lazy(() => import('./pages/customer/TrackOrderPage'));
const AboutPage = lazy(() => import('./pages/customer/AboutPage'));
const OffersPage = lazy(() => import('./pages/customer/OffersPage'));
const ContactPage = lazy(() => import('./pages/customer/ContactPage'));
const GalleryPage = lazy(() => import('./pages/customer/GalleryPage'));
const ReceiptPage = lazy(() => import('./pages/customer/ReceiptPage'));
const OrdersPage = lazy(() => import('./pages/customer/OrdersPage'));
const UnsubscribePage = lazy(() => import('./pages/customer/UnsubscribePage'));

function PageFallback() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-brew-500 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QuickCartPopup />
      <PushNotificationBanner />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a0f08',
            color: '#FAF6F0',
            borderRadius: '12px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#d4862a', secondary: '#FAF6F0' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#FAF6F0' } },
        }}
      />

      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />

          <Route path="/receipt" element={<ReceiptPage />} />
          <Route path="/receipt/:orderId" element={<ReceiptPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/order-confirm/:orderId" element={<OrderConfirmPage />} />
          <Route path="/track/:orderId" element={<TrackOrderPage />} />

          <Route path="/admin" element={<Navigate to="/menu" replace />} />
          <Route path="/admin/*" element={<Navigate to="/menu" replace />} />

          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
