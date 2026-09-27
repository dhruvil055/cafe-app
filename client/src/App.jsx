import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import QuickCartPopup from './components/ui/QuickCartPopup';
import WebPushPrompt from './components/ui/WebPushPrompt';

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

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes?.('Failed to fetch dynamically imported module') ||
      error?.message?.includes?.('dynamically imported module') ||
      error?.message?.includes?.('Expected a JavaScript-or-Wasm module script');
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes?.('Failed to fetch dynamically imported module') ||
      error?.message?.includes?.('dynamically imported module') ||
      error?.message?.includes?.('Expected a JavaScript-or-Wasm module script');

    if (isChunkError) {
      const reloadKey = 'chunk_boundary_reload';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(reloadKey, now.toString());
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#120804] text-[#FAF6F0] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full border border-[#d4862a]/40 bg-[#d4862a]/10 flex items-center justify-center mb-4 text-2xl">
            ☕
          </div>
          <h2 className="text-xl font-bold font-serif mb-2 tracking-wide">Updated Version Available</h2>
          <p className="text-sm text-stone-300 max-w-sm mb-6 leading-relaxed">
            A new version of Brewhaus Café was just deployed. Please refresh to load the updated page.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem('chunk_boundary_reload');
              window.location.reload();
            }}
            className="px-6 py-2.5 rounded-full bg-[#d4862a] text-[#1a0f08] font-semibold text-sm hover:bg-[#b86f1e] transition-colors cursor-pointer"
          >
            Refresh Now
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <WebPushPrompt />
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

      <ChunkErrorBoundary>
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
      </ChunkErrorBoundary>
    </BrowserRouter>
  );
}
