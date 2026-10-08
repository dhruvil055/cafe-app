import { useEffect, useState, useMemo } from 'react';
import {
  Download, Eye, Loader2, Plus, QrCode, RefreshCw, Trash2,
  Users, Layers, ArrowRightLeft, Sparkles, AlertCircle, Clock,
  CheckCircle2, DollarSign, Edit, Printer, X, Monitor
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatMoney } from '../utils/money';

const STATUS_CONFIG = {
  AVAILABLE: {
    label: 'Available',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/20',
  },
  OCCUPIED: {
    label: 'Occupied',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    ring: 'ring-blue-500/20',
  },
  WAITING_PAYMENT: {
    label: 'Bill Waiting',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
  },
  RESERVED: {
    label: 'Reserved',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    ring: 'ring-purple-500/20',
  },
  CLEANING: {
    label: 'Cleaning',
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500/20',
  },
  DISABLED: {
    label: 'Disabled',
    bg: 'bg-stone-100 text-stone-500 border-stone-200',
    dot: 'bg-stone-400',
    ring: 'ring-stone-400/20',
  },
};

export default function TablesPage() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState(['Ground Floor']);
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('floor'); // 'floor' | 'qr'
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [transferModalData, setTransferModalData] = useState(null); // { fromTable }
  const [mergeModalData, setMergeModalData] = useState(null);
  const [activeQrModal, setActiveQrModal] = useState(null);

  // Form Fields
  const [tableNumber, setTableNumber] = useState('');
  const [seats, setSeats] = useState(4);
  const [label, setLabel] = useState('');
  const [floor, setFloor] = useState('Ground Floor');
  const [shape, setShape] = useState('square');
  const [saving, setSaving] = useState(false);

  // Transfer Fields
  const [targetTableNumber, setTargetTableNumber] = useState('');
  const [transferring, setTransferring] = useState(false);

  const fetchFloorPlan = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tables/floor-plan');
      setTables(data.tables || []);
      if (data.floors && data.floors.length > 0) {
        setFloors(data.floors);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load floor plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloorPlan();
    const interval = setInterval(fetchFloorPlan, 15000); // Live poll every 15s
    return () => clearInterval(interval);
  }, []);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      const floorMatch = selectedFloor === 'ALL' || (t.floor || 'Ground Floor') === selectedFloor;
      const statusMatch = selectedStatus === 'ALL' || t.effectiveStatus === selectedStatus;
      return floorMatch && statusMatch;
    });
  }, [tables, selectedFloor, selectedStatus]);

  // Metrics
  const metrics = useMemo(() => {
    const total = tables.length;
    const occupied = tables.filter(t => t.effectiveStatus === 'OCCUPIED').length;
    const available = tables.filter(t => t.effectiveStatus === 'AVAILABLE').length;
    const waiting = tables.filter(t => t.effectiveStatus === 'WAITING_PAYMENT').length;
    const liveRevenue = tables.reduce((sum, t) => sum + (t.currentBillAmount || 0), 0);
    return { total, occupied, available, waiting, liveRevenue };
  }, [tables]);

  // Create or Update Table
  const handleSaveTable = async (e) => {
    e.preventDefault();
    if (!tableNumber) {
      toast.error('Table number is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tableNumber: Number(tableNumber),
        seats: Number(seats),
        label: label.trim(),
        floor: floor.trim() || 'Ground Floor',
        shape,
      };

      if (editingTable) {
        await api.put(`/tables/${editingTable._id}`, payload);
        toast.success(`Table ${tableNumber} updated`);
      } else {
        await api.post('/tables', payload);
        toast.success(`Table ${tableNumber} created`);
      }

      setShowAddModal(false);
      setEditingTable(null);
      resetForm();
      fetchFloorPlan();
    } catch (error) {
      toast.error(error.message || 'Failed to save table');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTableNumber('');
    setSeats(4);
    setLabel('');
    setFloor('Ground Floor');
    setShape('square');
  };

  const handleEditClick = (table) => {
    setEditingTable(table);
    setTableNumber(String(table.tableNumber));
    setSeats(table.seats || 4);
    setLabel(table.label || '');
    setFloor(table.floor || 'Ground Floor');
    setShape(table.shape || 'square');
    setShowAddModal(true);
  };

  // Change Status
  const handleStatusChange = async (tableId, newStatus) => {
    try {
      await api.patch(`/tables/${tableId}/status`, { status: newStatus });
      toast.success(`Table status changed to ${newStatus}`);
      fetchFloorPlan();
    } catch (error) {
      toast.error(error.message || 'Failed to change status');
    }
  };

  // Transfer Table
  const handleTransfer = async () => {
    if (!transferModalData?.tableNumber || !targetTableNumber) {
      toast.error('Select a target table');
      return;
    }

    setTransferring(true);
    try {
      const { data } = await api.post('/tables/transfer', {
        fromTableNumber: transferModalData.tableNumber,
        toTableNumber: Number(targetTableNumber),
      });
      toast.success(data.message || 'Table transferred successfully');
      setTransferModalData(null);
      setTargetTableNumber('');
      fetchFloorPlan();
    } catch (error) {
      toast.error(error.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  // Delete Table
  const handleDeleteTable = async (id, num) => {
    if (!window.confirm(`Delete Table ${num}? This cannot be undone.`)) return;
    try {
      await api.delete(`/tables/${id}`);
      toast.success(`Table ${num} deleted`);
      fetchFloorPlan();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  // Regenerate QR
  const handleRegenerateQr = async (table) => {
    try {
      await api.post(`/tables/${table._id}/regenerate-qr`);
      toast.success(`QR regenerated for Table ${table.tableNumber}`);
      fetchFloorPlan();
    } catch (error) {
      toast.error(error.message || 'QR generation failed');
    }
  };

  // Download QR Image
  const downloadQr = (table) => {
    const link = document.createElement('a');
    link.href = table.qrCode;
    link.download = `table-${String(table.tableNumber).padStart(2, '0')}-qr.png`;
    link.click();
  };

  // Print Acrylic Standee Card
  const printStandee = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Total Tables</span>
            <Layers size={16} className="text-stone-400" />
          </div>
          <div className="text-2xl font-bold font-display text-espresso-900 mt-2">{metrics.total}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">{floors.length} floor section(s)</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm bg-gradient-to-br from-emerald-50/30 to-transparent">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            <span>Available</span>
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-display text-emerald-700 mt-2">{metrics.available}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Ready for guests</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-sm bg-gradient-to-br from-blue-50/30 to-transparent">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <span>Occupied</span>
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold font-display text-blue-700 mt-2">{metrics.occupied}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">Dining in session</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm bg-gradient-to-br from-amber-50/30 to-transparent">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 uppercase tracking-wider">
            <span>Bill Waiting</span>
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          </div>
          <div className="text-2xl font-bold font-display text-amber-700 mt-2">{metrics.waiting}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Needs checkout</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-espresso-200/80 shadow-sm bg-gradient-to-br from-espresso-50/50 to-transparent col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs font-semibold text-espresso-700 uppercase tracking-wider">
            <span>Live Table Total</span>
            <DollarSign size={16} className="text-espresso-600" />
          </div>
          <div className="text-2xl font-bold font-display text-espresso-900 mt-2">{formatMoney(metrics.liveRevenue)}</div>
          <div className="text-[11px] text-espresso-600 mt-0.5">Active open tickets</div>
        </div>
      </div>

      {/* Control Bar: Floor Filters, View Toggle, Add Table */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Floor Selection */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">Floor:</span>
            <button
              onClick={() => setSelectedFloor('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                selectedFloor === 'ALL'
                  ? 'bg-espresso-900 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All Floors ({tables.length})
            </button>
            {floors.map(fl => {
              const count = tables.filter(t => (t.floor || 'Ground Floor') === fl).length;
              return (
                <button
                  key={fl}
                  onClick={() => setSelectedFloor(fl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedFloor === fl
                      ? 'bg-espresso-900 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {fl} ({count})
                </button>
              );
            })}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Switcher */}
            <div className="flex bg-stone-100 rounded-xl p-1 border border-stone-200">
              <button
                onClick={() => setViewMode('floor')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  viewMode === 'floor' ? 'bg-white text-espresso-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Floor Plan
              </button>
              <button
                onClick={() => setViewMode('qr')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  viewMode === 'qr' ? 'bg-white text-espresso-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                QR Directory
              </button>
            </div>

            <button
              onClick={() => {
                resetForm();
                setEditingTable(null);
                setShowAddModal(true);
              }}
              className="btn-primary rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Add Table
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-stone-100">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">Status:</span>
          {['ALL', 'AVAILABLE', 'OCCUPIED', 'WAITING_PAYMENT', 'RESERVED', 'CLEANING', 'DISABLED'].map(st => {
            const isAll = st === 'ALL';
            const count = isAll ? tables.length : tables.filter(t => t.effectiveStatus === st).length;
            const config = STATUS_CONFIG[st] || {};
            return (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  selectedStatus === st
                    ? 'bg-stone-800 text-white font-semibold'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/60'
                }`}
              >
                {!isAll && <div className={`h-2 w-2 rounded-full ${config.dot || 'bg-stone-400'}`} />}
                <span>{isAll ? 'All Status' : config.label || st}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table Grid / Directory */}
      {loading && tables.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center text-stone-400">
          <Loader2 className="animate-spin text-brew-500" size={32} />
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-20 text-center text-stone-500">
          <p className="text-base font-semibold text-stone-700">No tables matching this filter</p>
          <p className="text-xs text-stone-400 mt-1">Try selecting a different floor or status filter</p>
        </div>
      ) : viewMode === 'floor' ? (
        /* Visual Floor Plan Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredTables.map(table => {
            const statusCfg = STATUS_CONFIG[table.effectiveStatus] || STATUS_CONFIG.AVAILABLE;
            const isOccupied = table.effectiveStatus === 'OCCUPIED' || table.effectiveStatus === 'WAITING_PAYMENT';
            const shapeClass = table.shape === 'round' ? 'rounded-full' : table.shape === 'rectangle' ? 'rounded-2xl' : 'rounded-3xl';

            return (
              <div
                key={table._id}
                className={`bg-white rounded-3xl border transition-all duration-200 p-4 shadow-soft hover:shadow-md flex flex-col justify-between ${
                  isOccupied
                    ? 'border-blue-300 ring-2 ring-blue-500/10'
                    : table.effectiveStatus === 'CLEANING'
                    ? 'border-orange-200 bg-orange-50/10'
                    : 'border-stone-200'
                }`}
              >
                <div>
                  {/* Card Header: Table # and Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-11 w-11 flex items-center justify-center font-display font-bold text-lg text-white shadow-sm ${shapeClass} ${
                        table.effectiveStatus === 'OCCUPIED'
                          ? 'bg-blue-600'
                          : table.effectiveStatus === 'WAITING_PAYMENT'
                          ? 'bg-amber-600'
                          : table.effectiveStatus === 'CLEANING'
                          ? 'bg-orange-500'
                          : table.effectiveStatus === 'RESERVED'
                          ? 'bg-purple-600'
                          : table.effectiveStatus === 'DISABLED'
                          ? 'bg-stone-400'
                          : 'bg-emerald-600'
                      }`}>
                        {table.tableNumber}
                      </div>
                      <div>
                        <div className="font-display font-bold text-stone-900 text-sm">
                          Table {String(table.tableNumber).padStart(2, '0')}
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-1">
                          <Users size={11} /> {table.seats} seats · {table.floor || 'Ground'}
                        </div>
                      </div>
                    </div>

                    <div className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${statusCfg.bg}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                      <span>{statusCfg.label}</span>
                    </div>
                  </div>

                  {/* Occupied / Active Orders Summary Box */}
                  {isOccupied && (
                    <div className="mt-3.5 bg-blue-50/60 border border-blue-200/60 rounded-2xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                        <span>Current Bill:</span>
                        <span className="text-sm font-display text-blue-700">{formatMoney(table.currentBillAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-blue-700">
                        <span>{table.activeOrdersCount} order(s) · {table.totalItemsCount} item(s)</span>
                        {table.occupiedSince && (
                          <span className="flex items-center gap-0.5 text-stone-500">
                            <Clock size={11} />
                            {Math.max(1, Math.round((Date.now() - new Date(table.occupiedSince).getTime()) / 60000))}m
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {table.label && (
                    <div className="mt-2 text-xs text-stone-500 italic truncate">
                      "{table.label}"
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Open POS for this table */}
                    <button
                      onClick={() => navigate(`/pos?table=${table.tableNumber}`)}
                      className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
                      title="Open fast POS terminal for this table"
                    >
                      <Monitor size={12} /> POS
                    </button>

                    {/* View QR Code */}
                    <button
                      onClick={() => setActiveQrModal(table)}
                      className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition border border-stone-200"
                    >
                      <QrCode size={12} /> QR
                    </button>
                  </div>

                  {/* Contextual Status Transition Buttons */}
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    {table.effectiveStatus === 'OCCUPIED' && (
                      <button
                        onClick={() => setTransferModalData(table)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
                      >
                        <ArrowRightLeft size={11} /> Transfer
                      </button>
                    )}

                    {table.effectiveStatus === 'AVAILABLE' && (
                      <button
                        onClick={() => handleStatusChange(table._id, 'RESERVED')}
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        Reserve
                      </button>
                    )}

                    {table.effectiveStatus === 'RESERVED' && (
                      <button
                        onClick={() => handleStatusChange(table._id, 'AVAILABLE')}
                        className="text-emerald-600 hover:text-emerald-800 font-medium"
                      >
                        Release
                      </button>
                    )}

                    {table.effectiveStatus === 'CLEANING' && (
                      <button
                        onClick={() => handleStatusChange(table._id, 'AVAILABLE')}
                        className="text-emerald-600 hover:text-emerald-800 font-semibold"
                      >
                        Mark Clean
                      </button>
                    )}

                    {!['OCCUPIED', 'CLEANING'].includes(table.effectiveStatus) && (
                      <button
                        onClick={() => handleStatusChange(table._id, 'CLEANING')}
                        className="text-orange-600 hover:text-orange-800 font-medium"
                      >
                        Clean
                      </button>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => handleEditClick(table)}
                        className="text-stone-400 hover:text-stone-700 p-1"
                        title="Edit Table"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteTable(table._id, table.tableNumber)}
                        className="text-stone-400 hover:text-red-500 p-1"
                        title="Delete Table"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* QR Directory View */
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredTables.map(table => (
            <div key={table._id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
              <div className="flex items-center justify-center bg-stone-50 p-5">
                {table.qrCode ? (
                  <img
                    src={table.qrCode}
                    alt={`Table ${table.tableNumber}`}
                    className="h-32 w-32 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm"
                  />
                ) : (
                  <QrCode size={56} className="text-stone-400" />
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="text-center">
                  <div className="font-display text-xl font-bold text-espresso-900">
                    Table {String(table.tableNumber).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {table.seats} seats · {table.floor || 'Ground'} {table.label ? `· ${table.label}` : ''}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => downloadQr(table)}
                    className="btn-secondary rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Download size={13} /> Save PNG
                  </button>
                  <button
                    onClick={() => handleRegenerateQr(table)}
                    className="btn-secondary rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>

                <button
                  onClick={() => setActiveQrModal(table)}
                  className="w-full py-1.5 text-xs text-brew-600 hover:text-brew-800 font-semibold text-center"
                >
                  View Acrylic Standee Card
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-espresso-900">
                {editingTable ? `Edit Table ${editingTable.tableNumber}` : 'Add New Table'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                  Table Number *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  placeholder="e.g. 5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                    Seats Capacity
                  </label>
                  <select
                    value={seats}
                    onChange={e => setSeats(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  >
                    {[2, 4, 6, 8, 10, 12, 16].map(count => (
                      <option key={count} value={count}>{count} seats</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                    Shape
                  </label>
                  <select
                    value={shape}
                    onChange={e => setShape(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  >
                    <option value="square">Square</option>
                    <option value="round">Round</option>
                    <option value="rectangle">Rectangle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                  Floor Section
                </label>
                <input
                  type="text"
                  value={floor}
                  onChange={e => setFloor(e.target.value)}
                  placeholder="e.g. Ground Floor, Rooftop, Terrace"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                  Description / Label (Optional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Window Corner, AC Booth"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold flex items-center gap-1.5"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingTable ? 'Update Table' : 'Create Table'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Table Modal */}
      {transferModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-espresso-900 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-blue-600" />
                <span>Transfer Table {transferModalData.tableNumber}</span>
              </h3>
              <button
                onClick={() => setTransferModalData(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-stone-500 mb-4">
              Move all open orders and bills ({formatMoney(transferModalData.currentBillAmount)}) to another table.
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700">
                Destination Table Number:
              </label>
              <select
                value={targetTableNumber}
                onChange={e => setTargetTableNumber(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none"
              >
                <option value="">-- Choose destination table --</option>
                {tables
                  .filter(t => t.tableNumber !== transferModalData.tableNumber && t.active)
                  .map(t => (
                    <option key={t._id} value={t.tableNumber}>
                      Table {t.tableNumber} ({t.seats} seats - {t.effectiveStatus})
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setTransferModalData(null)}
                className="btn-secondary rounded-xl px-3.5 py-1.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring || !targetTableNumber}
                className="btn-primary rounded-xl px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5"
              >
                {transferring && <Loader2 size={13} className="animate-spin" />}
                <span>Confirm Transfer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standee & Large QR Print Modal */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl text-center space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Table QR Standee</span>
              <button
                onClick={() => setActiveQrModal(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-inner space-y-3">
              <div className="font-display font-bold text-2xl text-espresso-950">
                Table {String(activeQrModal.tableNumber).padStart(2, '0')}
              </div>
              <div className="text-xs text-stone-500">
                Scan to browse menu & order instantly
              </div>

              {activeQrModal.qrCode && (
                <div className="flex justify-center py-2">
                  <img
                    src={activeQrModal.qrCode}
                    alt={`Table ${activeQrModal.tableNumber}`}
                    className="h-48 w-48 rounded-2xl border-2 border-stone-800 bg-white p-2.5 shadow-md"
                  />
                </div>
              )}

              <div className="text-[11px] text-stone-400 font-medium">
                No app download required · Powered by InfiniGrow OS
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              <button
                onClick={() => downloadQr(activeQrModal)}
                className="btn-secondary rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                <Download size={14} /> Download PNG
              </button>
              <button
                onClick={printStandee}
                className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer size={14} /> Print Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
