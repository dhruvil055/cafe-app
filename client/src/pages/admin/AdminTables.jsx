import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Download, Eye, Trash2, Loader2, X, RefreshCw, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/api';

export default function AdminTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [viewQr, setViewQr] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [addForm, setAddForm] = useState({ tableNumber: '', seats: 4 });
  const [bulkCount, setBulkCount] = useState(5);
  const [regenerating, setRegenerating] = useState(null);

  const fetchTables = () => {
    setLoading(true);
    api.get('/tables/all')
      .then(res => setTables(res.data.tables))
      .catch(() => toast.error('Failed to load tables'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTables(); }, []);

  const getBaseUrl = () => window.location.origin;

  const handleAddTable = async () => {
    if (!addForm.tableNumber) { toast.error('Table number required'); return; }
    setSaving(true);
    try {
      const res = await api.post('/tables', { ...addForm, tableNumber: Number(addForm.tableNumber), baseUrl: getBaseUrl() });
      setTables(prev => [...prev, res.data.table].sort((a, b) => a.tableNumber - b.tableNumber));
      setShowAdd(false);
      setAddForm({ tableNumber: '', seats: 4 });
      toast.success(`Table ${addForm.tableNumber} created`);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleBulkCreate = async () => {
    setSaving(true);
    try {
      const res = await api.post('/tables/bulk', { count: Number(bulkCount), baseUrl: getBaseUrl() });
      fetchTables();
      setShowBulk(false);
      toast.success(`${res.data.count} tables created`);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, num) => {
    if (!confirm(`Delete Table ${num}?`)) return;
    setDeleting(id);
    try {
      await api.delete(`/tables/${id}`);
      setTables(prev => prev.filter(t => t._id !== id));
      toast.success('Table deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(null); }
  };

  const handleRegenQr = async (table) => {
    setRegenerating(table._id);
    try {
      const res = await api.post(`/tables/${table._id}/regenerate-qr`, { baseUrl: getBaseUrl() });
      setTables(prev => prev.map(t => t._id === table._id ? res.data.table : t));
      toast.success('QR regenerated');
    } catch { toast.error('Failed to regenerate QR'); }
    finally { setRegenerating(null); }
  };

  const downloadQR = (table) => {
    const link = document.createElement('a');
    link.href = table.qrCode;
    link.download = `table-${String(table.tableNumber).padStart(2, '0')}-qr.png`;
    link.click();
  };

  const printQR = (table) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>Table ${table.tableNumber} QR</title>
        <style>
          body { font-family: Georgia, serif; text-align: center; padding: 40px; background: #FAF6F0; }
          .container { max-width: 300px; margin: 0 auto; padding: 30px; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          img { width: 200px; height: 200px; border-radius: 12px; }
          h2 { margin: 16px 0 4px; font-size: 22px; color: #1a0f08; }
          p { color: #8a5e35; font-size: 13px; margin: 0; }
          .cafe { font-size: 11px; color: #999; margin-top: 12px; }
        </style>
        </head>
        <body>
          <div class="container">
            <img src="${table.qrCode}" />
            <h2>Table ${String(table.tableNumber).padStart(2, '0')}</h2>
            <p>Scan to order</p>
            <p class="cafe">Brewhaus Café</p>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <AdminLayout title="Tables & QR Codes">
      <div className="flex flex-wrap gap-3 mb-5 justify-end">
        <button onClick={() => setShowBulk(true)} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
          <Plus size={15} /> Bulk Create
        </button>
        <button onClick={() => setShowAdd(true)} className="btn-accent text-sm py-2 px-4 flex items-center gap-2">
          <Plus size={15} /> Add Table
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-brew-500" size={28} /></div>
      ) : tables.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">🪑</p>
          <p className="font-medium">No tables yet</p>
          <p className="text-sm mt-1">Create tables to generate QR codes for customers</p>
          <button onClick={() => setShowBulk(true)} className="mt-4 btn-primary text-sm py-2 px-5">Create Tables</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map(table => (
            <motion.div
              key={table._id}
              layout
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                ${!table.active ? 'opacity-60' : ''}`}
            >
              {/* QR preview */}
              <div
                className="bg-gray-50 p-4 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setViewQr(table)}
              >
                {table.qrCode ? (
                  <img src={table.qrCode} alt={`Table ${table.tableNumber} QR`} className="w-24 h-24 rounded-lg" />
                ) : (
                  <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                    <QrCode size={32} className="text-gray-400" />
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="text-center mb-3">
                  <p className="font-display font-bold text-espresso-900 text-lg">
                    {String(table.tableNumber).padStart(2, '0')}
                  </p>
                  <p className="text-xs text-gray-400">{table.seats} seats</p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <button
                    onClick={() => setViewQr(table)}
                    className="flex items-center justify-center gap-1 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Eye size={12} /> View
                  </button>
                  <button
                    onClick={() => downloadQR(table)}
                    className="flex items-center justify-center gap-1 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Download size={12} /> Save
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleRegenQr(table)}
                    disabled={regenerating === table._id}
                    className="flex items-center justify-center gap-1 py-1.5 border border-blue-100 rounded-xl text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    {regenerating === table._id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <RefreshCw size={12} />}
                    Regen
                  </button>
                  <button
                    onClick={() => handleDelete(table._id, table.tableNumber)}
                    disabled={deleting === table._id}
                    className="flex items-center justify-center gap-1 py-1.5 border border-red-100 rounded-xl text-xs text-red-400 hover:bg-red-50 transition-colors"
                  >
                    {deleting === table._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* QR Viewer */}
      <AnimatePresence>
        {viewQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setViewQr(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <button onClick={() => setViewQr(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50">
                <X size={16} />
              </button>

              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Brewhaus Café</p>
              <h2 className="font-display text-3xl font-bold text-espresso-900 mb-4">
                Table {String(viewQr.tableNumber).padStart(2, '0')}
              </h2>

              {viewQr.qrCode && (
                <img src={viewQr.qrCode} alt="QR Code" className="w-52 h-52 mx-auto rounded-2xl border-4 border-espresso-50 shadow-lg" />
              )}

              <p className="text-sm text-gray-500 mt-4">Scan to order</p>
              <p className="text-xs text-gray-400 mt-1 break-all">{viewQr.qrUrl}</p>

              <div className="flex gap-3 mt-6">
                <button onClick={() => downloadQR(viewQr)} className="flex-1 btn-secondary text-sm py-2.5 flex items-center justify-center gap-1.5">
                  <Download size={15} /> Download
                </button>
                <button onClick={() => printQR(viewQr)} className="flex-1 btn-primary text-sm py-2.5">
                  🖨️ Print
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Table Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-espresso-900">Add Table</h2>
                <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Table Number *</label>
                <input
                  type="number"
                  value={addForm.tableNumber}
                  onChange={e => setAddForm(f => ({ ...f, tableNumber: e.target.value }))}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brew-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Seats</label>
                <select
                  value={addForm.seats}
                  onChange={e => setAddForm(f => ({ ...f, seats: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
                >
                  {[2, 4, 6, 8, 10].map(n => <option key={n} value={n}>{n} seats</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
                <button onClick={handleAddTable} disabled={saving} className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Create Modal */}
      <AnimatePresence>
        {showBulk && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowBulk(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-espresso-900">Bulk Create Tables</h2>
                <button onClick={() => setShowBulk(false)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-gray-500">Tables will be numbered sequentially after the last existing table.</p>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">How many tables?</label>
                <input
                  type="number"
                  value={bulkCount}
                  onChange={e => setBulkCount(e.target.value)}
                  min="1"
                  max="50"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brew-300"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowBulk(false)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
                <button onClick={handleBulkCreate} disabled={saving} className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Create {bulkCount} Tables
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
