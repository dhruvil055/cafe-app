import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import QuickCartPopup from './components/ui/QuickCartPopup';
import QrScannerModal from './components/ui/QrScannerModal';
import useCartStore from './context/cartStore';
import { useSessionValidator } from './hooks/useSessionValidator';

// Customer pages
import MenuPage from './pages/customer/MenuPage';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import OrderConfirmPage from './pages/customer/OrderConfirmPage';
import TrackOrderPage from './pages/customer/TrackOrderPage';
import AboutPage from './pages/customer/AboutPage';
import OffersPage from './pages/customer/OffersPage';
import ContactPage from './pages/customer/ContactPage';
import GalleryPage from './pages/customer/GalleryPage';

import ReceiptPage from './pages/customer/ReceiptPage';
import OrdersPage from './pages/customer/OrdersPage';

/**
 * SessionWatchdog — renders nothing visually.
 * Runs the session validator hook globally so even pages that don't import it
 * (About, Gallery, etc.) still trigger session re-validation on route change
 * and on the 2-minute periodic interval.
 */
function SessionWatchdog() {
  useSessionValidator();
  return null;
}

export default function App() {
  const { isScannerOpen, closeScanner } = useCartStore();

  return (
    <BrowserRouter>
      {/* Global session watchdog — validates stored token on every route change */}
      <SessionWatchdog />

      <QuickCartPopup />
      {isScannerOpen && <QrScannerModal onClose={closeScanner} />}
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

      <Routes>
        <Route path="/" element={<Navigate to="/menu" replace />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />

        <Route path="/receipt" element={<ReceiptPage />} />
        <Route path="/receipt/:orderId" element={<ReceiptPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/order-confirm/:orderId" element={<OrderConfirmPage />} />
        <Route path="/track/:orderId" element={<TrackOrderPage />} />

        <Route path="/admin" element={<Navigate to="/menu" replace />} />
        <Route path="/admin/*" element={<Navigate to="/menu" replace />} />

        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
