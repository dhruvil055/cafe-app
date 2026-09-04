import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import TablesPage from './pages/TablesPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-espresso-200 border-t-espresso-700" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><AdminLayout title="Dashboard"><DashboardPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><AdminLayout title="Orders"><OrdersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><AdminLayout title="Products"><ProductsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><AdminLayout title="Categories"><CategoriesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/tables" element={<ProtectedRoute><AdminLayout title="Tables"><TablesPage /></AdminLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
