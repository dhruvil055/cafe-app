import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Customer pages
import MenuPage from './pages/customer/MenuPage';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import OrderConfirmPage from './pages/customer/OrderConfirmPage';
import TrackOrderPage from './pages/customer/TrackOrderPage';
import AboutPage from './pages/customer/AboutPage';
import OffersPage from './pages/customer/OffersPage';
import ContactPage from './pages/customer/ContactPage';

// Admin pages
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMenu from './pages/admin/AdminMenu';
import AdminCategories from './pages/admin/AdminCategories';
import AdminTables from './pages/admin/AdminTables';

const ProtectedRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-espresso-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brew-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return isAdmin ? children : <Navigate to="/admin/login" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
          {/* Customer routes */}
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirm/:orderId" element={<OrderConfirmPage />} />
          <Route path="/track/:orderId" element={<TrackOrderPage />} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<ProtectedRoute><Navigate to="/admin/orders" replace /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute><AdminOrders /></ProtectedRoute>} />
          <Route path="/admin/menu" element={<ProtectedRoute><AdminMenu /></ProtectedRoute>} />
          <Route path="/admin/categories" element={<ProtectedRoute><AdminCategories /></ProtectedRoute>} />
          <Route path="/admin/tables" element={<ProtectedRoute><AdminTables /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
