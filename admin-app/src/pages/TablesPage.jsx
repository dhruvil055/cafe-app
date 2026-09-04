import { useEffect, useState } from 'react';
import { Download, Eye, Loader2, Plus, QrCode, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [seats, setSeats] = useState(4);
  const [saving, setSaving] = useState(false);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tables/all');
      setTables(data.tables || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const createTable = async () => {
    if (!tableNumber) {
      toast.error('Table number is required');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post('/tables', { tableNumber: Number(tableNumber), seats: Number(seats) });
      setTables((current) => [...current, data.table].sort((a, b) => a.tableNumber - b.tableNumber));
      setShowForm(false);
      setTableNumber('');
      setSeats(4);
      toast.success('Table added');
    } catch (error) {
      toast.error(error.message || 'Unable to add table');
    } finally {
      setSaving(false);
    }
  };

  const regenerateQr = async (table) => {
    try {
      const { data } = await api.post(`/tables/${table._id}/regenerate-qr`);
      setTables((current) => current.map((item) => item._id === table._id ? data.table : item));
      toast.success('QR regenerated');
    } catch (error) {
      toast.error(error.message || 'QR generation failed');
    }
  };

  const deleteTable = async (id) => {
    if (!window.confirm('Delete this table?')) return;
    try {
      await api.delete(`/tables/${id}`);
      setTables((current) => current.filter((item) => item._id !== id));
      toast.success('Table removed');
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const downloadQr = (table) => {
    const link = document.createElement('a');
    link.href = table.qrCode;
    link.download = `table-${String(table.tableNumber).padStart(2, '0')}-qr.png`;
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2"><Plus size={15} /> Add table</span>
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center text-stone-500"><Loader2 className="animate-spin" size={28} /></div>
      ) : tables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center text-stone-500">No tables found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tables.map((table) => (
            <div key={table._id} className={`overflow-hidden rounded-2xl border bg-white shadow-soft ${table.active ? 'border-stone-200' : 'border-stone-200 opacity-70'}`}>
              <div className="flex items-center justify-center bg-stone-100 p-4">
                {table.qrCode ? <img src={table.qrCode} alt={`Table ${table.tableNumber}`} className="h-28 w-28 rounded-xl border border-stone-200 bg-white p-2" /> : <QrCode size={48} className="text-stone-400" />}
              </div>
              <div className="space-y-3 p-4">
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-espresso-900">Table {String(table.tableNumber).padStart(2, '0')}</div>
                  <div className="text-xs text-stone-500">{table.seats} seats</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => downloadQr(table)} className="btn-secondary rounded-lg px-2 py-2 text-xs"><span className="inline-flex items-center gap-1"><Download size={12} /> Save</span></button>
                  <button onClick={() => regenerateQr(table)} className="btn-secondary rounded-lg px-2 py-2 text-xs"><span className="inline-flex items-center gap-1"><RefreshCw size={12} /> QR</span></button>
                </div>

                <button onClick={() => deleteTable(table._id)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-100 px-2 py-2 text-xs font-medium text-red-500 hover:bg-red-50"><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-espresso-900">Add table</h2>
              <button onClick={() => setShowForm(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Table number</label>
                <input type="number" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Seats</label>
                <select value={seats} onChange={(event) => setSeats(event.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none">
                  {[2, 4, 6, 8, 10].map((count) => <option key={count} value={count}>{count} seats</option>)}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">Cancel</button>
              <button onClick={createTable} disabled={saving} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
                {saving ? 'Creating...' : 'Create table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
