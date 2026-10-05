import { useState, useEffect } from 'react';
import {
  ShieldCheck, Store, Users, ShoppingBag, TrendingUp, AlertTriangle,
  CheckCircle2, LogOut, RefreshCw, Loader2, ArrowUpRight, Search, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { setAccessToken } from '../../services/accessToken';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = sessionStorage.getItem('brewhaus_superadmin_token');

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const loadData = async () => {
    if (!token) {
      navigate('/super-admin/login', { replace: true });
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [mRes, tRes, aRes] = await Promise.all([
        api.get('/platform/admin/metrics', { headers }),
        api.get('/platform/admin/tenants', { headers }),
        api.get('/platform/admin/audit-logs', { headers }).catch(() => ({ data: { logs: [] } })),
      ]);

      setMetrics(mRes.data.metrics);
      setTenants(tRes.data.tenants);
      setAuditLogs(aRes.data.logs || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        sessionStorage.removeItem('brewhaus_superadmin_token');
        navigate('/super-admin/login', { replace: true });
      } else {
        setError(err.message || 'Failed to fetch platform administration data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    setActionLoadingId(tenant.id);
    setError('');
    setSuccess('');

    try {
      await api.put(`/platform/admin/tenants/${tenant.id}/status`, {
        status: newStatus,
        reason: 'Super admin manual override',
      }, { headers });

      setSuccess(`Tenant "${tenant.name}" is now ${newStatus}.`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not update tenant status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleChangePlan = async (tenant, newPlan) => {
    setActionLoadingId(tenant.id);
    setError('');
    setSuccess('');

    try {
      await api.put(`/platform/admin/tenants/${tenant.id}/plan`, {
        plan: newPlan,
      }, { headers });

      setSuccess(`Tenant "${tenant.name}" plan updated to ${newPlan}.`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not update tenant plan.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleImpersonate = async (tenant) => {
    setActionLoadingId(tenant.id);
    setError('');

    try {
      const res = await api.post(`/platform/admin/tenants/${tenant.id}/impersonate`, {}, { headers });
      const { token: ownerToken } = res.data;

      // Set owner access token so AdminLayout and AuthContext pick up session
      setAccessToken(ownerToken);

      // Redirect directly to the café admin dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Failed to impersonate tenant.');
      setActionLoadingId(null);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('brewhaus_superadmin_token');
    sessionStorage.removeItem('brewhaus_superadmin_user');
    navigate('/super-admin/login', { replace: true });
  };

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.ownerEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-16">
      {/* Top Bar */}
      <header className="border-b border-stone-800 bg-stone-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-white">Platform Administration</div>
              <div className="text-[11px] text-stone-400">Multi-Tenant SaaS Core</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl border border-stone-800 text-stone-400 hover:text-white hover:bg-stone-800 transition"
              title="Refresh Platform Data"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 transition"
            >
              <LogOut size={13} /> Exit Platform Admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8 space-y-8">
        {/* Messages */}
        {success && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-300">
            <CheckCircle2 size={16} /> <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-300">
            <AlertTriangle size={16} /> <span>{error}</span>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-semibold uppercase">Total Cafés</span>
              <Store size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">{metrics?.totalTenants ?? '-'}</div>
            <div className="text-[11px] text-stone-500 mt-1">Multi-tenant accounts</div>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-semibold uppercase">Active Cafés</span>
              <Activity size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">{metrics?.activeTenants ?? '-'}</div>
            <div className="text-[11px] text-stone-500 mt-1">Serving diners live</div>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-semibold uppercase">Suspended</span>
              <AlertTriangle size={16} className="text-red-400" />
            </div>
            <div className="text-2xl font-black text-red-400">{metrics?.suspendedTenants ?? 0}</div>
            <div className="text-[11px] text-stone-500 mt-1">Halted / Overdue</div>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-semibold uppercase">Platform Orders</span>
              <ShoppingBag size={16} className="text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white">{metrics?.totalOrders ?? '-'}</div>
            <div className="text-[11px] text-stone-500 mt-1">All-time transactions</div>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-xs font-semibold uppercase">Gross GMV</span>
              <TrendingUp size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">₹{metrics?.totalGmv?.toLocaleString() ?? 0}</div>
            <div className="text-[11px] text-stone-500 mt-1">Processed platform volume</div>
          </div>
        </div>

        {/* Tenant Management Table */}
        <div className="rounded-3xl border border-stone-800 bg-stone-900/60 overflow-hidden">
          <div className="p-6 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Registered Cafés</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Real-time tenant status, tier limits, and live impersonation
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3.5 top-3 text-stone-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, slug..."
                className="w-full rounded-xl border border-stone-800 bg-stone-950/80 pl-10 pr-3 py-2 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950/60 text-stone-400 uppercase tracking-wider text-[10px] border-b border-stone-800">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Café & Subdomain</th>
                  <th className="py-3.5 px-4 font-semibold">Owner</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Plan</th>
                  <th className="py-3.5 px-4 font-semibold">Tables / Menu</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 text-stone-300">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-500">
                      No cafés found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-stone-800/30 transition">
                      <td className="py-4 px-6">
                        <div className="font-bold text-white">{t.name}</div>
                        <div className="font-mono text-[11px] text-amber-500/80">{t.slug}.localhost:5173</div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="text-stone-200">{t.ownerEmail}</div>
                        <div className="text-[10px] text-stone-500">Joined {new Date(t.createdAt).toLocaleDateString()}</div>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <select
                          value={t.plan}
                          onChange={(e) => handleChangePlan(t, e.target.value)}
                          disabled={actionLoadingId === t.id}
                          className="rounded-lg border border-stone-700 bg-stone-950 px-2 py-1 text-[11px] text-stone-200 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </td>

                      <td className="py-4 px-4 text-stone-400">
                        <span className="font-semibold text-stone-200">{t.tableCount}</span> tables ·{' '}
                        <span className="font-semibold text-stone-200">{t.productCount}</span> items
                      </td>

                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleToggleStatus(t)}
                          disabled={actionLoadingId === t.id}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                            t.status === 'active'
                              ? 'border border-red-500/30 text-red-400 hover:bg-red-950/40'
                              : 'border border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40'
                          }`}
                        >
                          {t.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>

                        <button
                          onClick={() => handleImpersonate(t)}
                          disabled={actionLoadingId === t.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 transition"
                        >
                          {actionLoadingId === t.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <>
                              Impersonate <ArrowUpRight size={11} />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Trail */}
        <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-6">
          <h3 className="text-sm font-bold text-white mb-3">Platform Audit Trail (Latest 10)</h3>
          <div className="space-y-2">
            {auditLogs.slice(0, 10).map((log) => (
              <div
                key={log._id}
                className="flex items-center justify-between p-3 rounded-xl bg-stone-950/50 border border-stone-800 text-xs"
              >
                <div>
                  <span className="font-bold text-amber-400">{log.action}</span>
                  <span className="text-stone-400 ml-2">on café "{log.targetTenantSlug || 'N/A'}"</span>
                  <span className="text-stone-500 ml-2">by {log.actorEmail}</span>
                </div>
                <div className="text-[11px] text-stone-500">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
