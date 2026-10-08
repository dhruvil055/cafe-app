import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/POSPage';
import OrdersPage from './pages/OrdersPage';
import KitchenDisplayPage from './pages/KitchenDisplayPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import TablesPage from './pages/TablesPage';
import ProfilePage from './pages/ProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';
import CustomersPage from './pages/CustomersPage';
import NotificationsPage from './pages/NotificationsPage';
import ExpensesPage from './pages/ExpensesPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchasesPage from './pages/PurchasesPage';
import ReviewsPage from './pages/ReviewsPage';
import InventoryDashboardPage from './pages/inventory/InventoryDashboardPage';
import InventoryItemsPage from './pages/inventory/InventoryItemsPage';
import InventoryItemDetailPage from './pages/inventory/InventoryItemDetailPage';
import RecipeMappingPage from './pages/inventory/RecipeMappingPage';
import InventoryTransactionsPage from './pages/inventory/InventoryTransactionsPage';
import InventoryReportsPage from './pages/inventory/InventoryReportsPage';
import TeamPage from './pages/TeamPage';
import NotFoundPage from './pages/NotFoundPage';
import CouponsPage from './pages/CouponsPage';
import TenantSettingsPage from './pages/TenantSettingsPage';
import SignupPage from './pages/SignupPage';
import SetupWizardPage from './pages/SetupWizardPage';
import BillingPage from './pages/BillingPage';
import SuperAdminLoginPage from './pages/super-admin/SuperAdminLoginPage';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import { canManageMenu, canManageTeam, canViewOrders, effectiveRole } from './utils/roles';

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-espresso-200 border-t-espresso-700" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(effectiveRole(user?.role))) return <Navigate to={canViewOrders(user?.role) ? '/orders' : '/login'} replace />;

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/setup-wizard" element={<ProtectedRoute allowedRoles={['owner']}><SetupWizardPage /></ProtectedRoute>} />
      <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
      <Route path="/super-admin" element={<SuperAdminDashboard />} />

      <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Dashboard"><DashboardPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/pos" element={<ProtectedRoute allowedRoles={['owner', 'manager', 'cashier']}><AdminLayout title="POS Terminal"><POSPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute allowedRoles={['owner', 'manager', 'cashier', 'kitchen']}><AdminLayout title="Orders"><OrdersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/orders/kitchen" element={<ProtectedRoute allowedRoles={['owner', 'manager', 'cashier', 'kitchen']}><AdminLayout title="Kitchen Display"><KitchenDisplayPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Customers CRM"><CustomersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/coupons" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Coupons & Offers"><CouponsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Website Notifications"><NotificationsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Products"><ProductsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Categories"><CategoriesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/tables" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Tables & Floor Plan"><TablesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Operating Expenses"><ExpensesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Suppliers & Vendors"><SuppliersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Purchase Orders"><PurchasesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/reviews" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Customer Reviews"><ReviewsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AdminLayout title="My Profile"><ProfilePage /></AdminLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Analytics"><AnalyticsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute allowedRoles={['owner']}><AdminLayout title="Team & Security"><TeamPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute allowedRoles={['owner']}><AdminLayout title="Plan & Billing"><BillingPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={['owner']}><AdminLayout title="Café Settings"><TenantSettingsPage /></AdminLayout></ProtectedRoute>} />

      {/* Inventory Routes */}
      <Route path="/inventory" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Inventory Dashboard"><InventoryDashboardPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/items" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Inventory Items"><InventoryItemsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/items/:id" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Item Details"><InventoryItemDetailPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/recipes" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Recipe / BOM Management"><RecipeMappingPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/mappings" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Recipe / BOM Management"><RecipeMappingPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/transactions" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Inventory Transactions"><InventoryTransactionsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/inventory/reports" element={<ProtectedRoute allowedRoles={['owner', 'manager']}><AdminLayout title="Inventory Reports"><InventoryReportsPage /></AdminLayout></ProtectedRoute>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
