import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import TablesPage from './pages/TablesPage';
import ProfilePage from './pages/ProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';
import CustomersPage from './pages/CustomersPage';
import NotificationsPage from './pages/NotificationsPage';
import InventoryDashboardPage from './pages/inventory/InventoryDashboardPage';
import InventoryItemsPage from './pages/inventory/InventoryItemsPage';
import InventoryItemDetailPage from './pages/inventory/InventoryItemDetailPage';
import RecipeMappingPage from './pages/inventory/RecipeMappingPage';
import InventoryTransactionsPage from './pages/inventory/InventoryTransactionsPage';
import InventoryReportsPage from './pages/inventory/InventoryReportsPage';

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
      <Route path="/customers" element={<ProtectedRoute><AdminLayout title="Customers CRM"><CustomersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><AdminLayout title="Website Notifications"><NotificationsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><AdminLayout title="Products"><ProductsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><AdminLayout title="Categories"><CategoriesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/tables" element={<ProtectedRoute><AdminLayout title="Tables"><TablesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AdminLayout title="My Profile"><ProfilePage /></AdminLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AdminLayout title="Analytics"><AnalyticsPage /></AdminLayout></ProtectedRoute>} />

      {/* Inventory Routes */}
      <Route path="/inventory" element={<ProtectedRoute><AdminLayout title="Inventory Dashboard"><InventoryDashboardPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/items" element={<ProtectedRoute><AdminLayout title="Inventory Items"><InventoryItemsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/items/:id" element={<ProtectedRoute><AdminLayout title="Item Details"><InventoryItemDetailPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/recipes" element={<ProtectedRoute><AdminLayout title="Recipe / BOM Management"><RecipeMappingPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/mappings" element={<ProtectedRoute><AdminLayout title="Recipe / BOM Management"><RecipeMappingPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/transactions" element={<ProtectedRoute><AdminLayout title="Inventory Transactions"><InventoryTransactionsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/reports" element={<ProtectedRoute><AdminLayout title="Inventory Reports"><InventoryReportsPage /></AdminLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
