import { useEffect, useState, useMemo } from 'react';
import {
  Download, Eye, Loader2, Plus, QrCode, RefreshCw, Trash2,
  Users, Layers, ArrowRightLeft, Sparkles, AlertCircle, Clock,
  CheckCircle2, DollarSign, Edit, Printer, X, Monitor, Grid,
  Maximize2, Move
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import PageHeader from '../components/common/PageHeader';
import StatusPill from '../components/common/StatusPill';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';
import ConfirmDialog from '../components/common/ConfirmDialog';

const STATUS_CONFIG = {
  AVAILABLE: {
    label: 'Available',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    color: '#10b981',
  },
  OCCUPIED: {
    label: 'Occupied',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    color: '#3b82f6',
  },
  WAITING_PAYMENT: {
    label: 'Bill Waiting',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    color: '#f59e0b',
  },
  RESERVED: {
    label: 'Reserved',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    color: '#8b5cf6',
  },
  CLEANING: {
    label: 'Cleaning',
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    color: '#f97316',
  },
  DISABLED: {
    label: 'Disabled',
    bg: 'bg-stone-100 text-stone-500 border-stone-200',
    dot: 'bg-stone-400',
    color: '#a8a29e',
  },
};

export default function TablesPage() {
  const navigate = useNavigate();
  const tenant = useTenant();
  const currency = tenant.currency || tenant.settings?.currency || '₹';

  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState(['Ground Floor']);
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' | 'cards' | 'qr'
  const [loading, setLoading] = useState(true);

  // Selected table for slide-over drawer
  const [activeDrawerTable, setActiveDrawerTable] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [transferModalData, setTransferModalData] = useState(null);
  const [activeQrModal, setActiveQrModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, table: null });

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

  // Canvas visual layout coordinates state
  const [tablePositions, setTablePositions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('brewhaus_table_positions') || '{}');
    } catch {
      return {};
    }
  });

  const fetchFloorPlan = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tables/floor-plan');
      setTables(data.tables || []);
      if (data.floors && data.floors.length > 0) {
        setFloors(data.floors);
      }
      // If drawer is open, keep its data fresh
      if (activeDrawerTable) {
        const fresh = (data.tables || []).find((t) => t._id === activeDrawerTable._id);
        if (fresh) setActiveDrawerTable(fresh);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load floor plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloorPlan();
    const interval = setInterval(fetchFloorPlan, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      const floorMatch = selectedFloor === 'ALL' || (t.floor || 'Ground Floor') === selectedFloor;
      const statusMatch = selectedStatus === 'ALL' || t.effectiveStatus === selectedStatus;
      return floorMatch && statusMatch;
    });
  }, [tables, selectedFloor, selectedStatus]);

  const metrics = useMemo(() => {
    const total = tables.length;
    const occupied = tables.filter(t => t.effectiveStatus === 'OCCUPIED').length;
    const available = tables.filter(t => t.effectiveStatus === 'AVAILABLE').length;
    const waiting = tables.filter(t => t.effectiveStatus === 'WAITING_PAYMENT').length;
    const liveRevenue = tables.reduce((sum, t) => sum + (t.currentBillAmount || 0), 0);
    return { total, occupied, available, waiting, liveRevenue };
  }, [tables]);

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

  const handleStatusChange = async (tableId, newStatus) => {
    try {
      await api.patch(`/tables/${tableId}/status`, { status: newStatus });
      toast.success(`Table marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      fetchFloorPlan();
    } catch (error) {
      toast.error(error.message || 'Failed to change status');
    }
  };

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

  const executeDelete = async () => {
    if (!deleteConfirm.table) return;
    try {
      await api.delete(`/tables/${deleteConfirm.table._id}`);
      toast.success(`Table ${deleteConfirm.table.tableNumber} removed`);
      setDeleteConfirm({ isOpen: false, table: null });
      if (activeDrawerTable?._id === deleteConfirm.table._id) {
        setActiveDrawerTable(null);
      }
      fetchFloorPlan();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const handleRegenerateQr = async (table) => {
    try {
      await api.post(`/tables/${table._id}/regenerate-qr`);
      toast.success(`QR regenerated for Table ${table.tableNumber}`);
      fetchFloorPlan();
    } catch (error) {
      toast.error(error.message || 'QR generation failed');
    }
  };

  const downloadQr = (table) => {
    const link = document.createElement('a');
    link.href = table.qrCode;
    link.download = `table-${String(table.tableNumber).padStart(2, '0')}-qr.png`;
    link.click();
  };

  const printAllQrCodes = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Tables & Floor Management"
        subtitle="Live floor layout, occupancy tracking, and QR table ordering standees."
        breadcrumbs={[
          { label: 'Operations', to: '/dashboard' },
          { label: 'Tables & Floor' }
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={printAllQrCodes}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
            >
              <Printer size={14} className="text-stone-500" />
              <span>Print All Standees</span>
            </button>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setEditingTable(null);
                setShowAddModal(true);
              }}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
            >
              <Plus size={15} />
              <span>Add Table</span>
            </button>

            <button
              type="button"
              onClick={fetchFloorPlan}
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50 shadow-xs transition"
              title="Refresh floor status"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      />

      {/* Floor Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-400">
            <span>Total Tables</span>
            <Layers size={15} className="text-stone-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-display text-espresso-950">
            {metrics.total}
          </div>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {floors.length} floor section{floors.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-800">
            <span>Available</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-display text-emerald-900">
            {metrics.available}
          </div>
          <p className="mt-0.5 text-[11px] text-emerald-700">
            Ready for guests
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-blue-800">
            <span>Occupied</span>
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold font-display text-blue-900">
            {metrics.occupied}
          </div>
          <p className="mt-0.5 text-[11px] text-blue-700">
            Dining in session
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-800">
            <span>Bill Waiting</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-display text-amber-900">
            {metrics.waiting}
          </div>
          <p className="mt-0.5 text-[11px] text-amber-700">
            Checkout requested
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-stone-50 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-espresso-800">
            <span>Active Bill Value</span>
            <DollarSign size={15} className="text-amber-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-display text-espresso-950 tabular-nums">
            {formatMoney(metrics.liveRevenue, currency)}
          </div>
          <p className="mt-0.5 text-[11px] text-stone-500">
            Open table tabs
          </p>
        </div>
      </div>

      {/* Control Bar: Floor Filters, View Toggle, Status Chips */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Floor Selection */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-1">Floor:</span>
            <button
              type="button"
              onClick={() => setSelectedFloor('ALL')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                selectedFloor === 'ALL'
                  ? 'bg-espresso-950 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              All Floors ({tables.length})
            </button>
            {floors.map(fl => {
              const count = tables.filter(t => (t.floor || 'Ground Floor') === fl).length;
              return (
                <button
                  key={fl}
                  type="button"
                  onClick={() => setSelectedFloor(fl)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    selectedFloor === fl
                      ? 'bg-espresso-950 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                  }`}
                >
                  {fl} ({count})
                </button>
              );
            })}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center self-end sm:self-auto rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition flex items-center gap-1.5 ${
                viewMode === 'canvas'
                  ? 'bg-white text-espresso-950 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Move size={13} /> Floor Canvas
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white text-espresso-950 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Grid size={13} /> Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('qr')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition flex items-center gap-1.5 ${
                viewMode === 'qr'
                  ? 'bg-white text-espresso-950 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <QrCode size={13} /> QR Standees
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-stone-100">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-1">Status:</span>
          {['ALL', 'AVAILABLE', 'OCCUPIED', 'WAITING_PAYMENT', 'RESERVED', 'CLEANING', 'DISABLED'].map(st => {
            const isAll = st === 'ALL';
            const count = isAll ? tables.length : tables.filter(t => t.effectiveStatus === st).length;
            const config = STATUS_CONFIG[st] || {};
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                  selectedStatus === st
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                }`}
              >
                {!isAll && <span className={`h-1.5 w-1.5 rounded-full ${config.dot || 'bg-stone-400'}`} />}
                <span>{isAll ? 'All Status' : config.label || st}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main View Area */}
      {loading && tables.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center text-stone-400">
          <Loader2 className="animate-spin text-amber-600" size={32} />
        </div>
      ) : filteredTables.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No tables found"
          description="No tables match your selected floor or status filter."
          actionLabel="Add a new table"
          onAction={() => { resetForm(); setShowAddModal(true); }}
        />
      ) : viewMode === 'canvas' ? (
        /* INTERACTIVE 2D FLOOR CANVAS VIEW */
        <div className="rounded-3xl border border-stone-200/90 bg-stone-100/70 p-6 shadow-inner relative min-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Live Floor Plan: {selectedFloor === 'ALL' ? 'Main Dining Room' : selectedFloor}
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Click any table to open current order, billing, or QR actions.
            </p>
          </div>

          {/* Spatial Grid representation of the café floor */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 p-4 rounded-2xl bg-white/60 border border-stone-200/60 backdrop-blur-xs">
            {filteredTables.map((table) => {
              const statusCfg = STATUS_CONFIG[table.effectiveStatus] || STATUS_CONFIG.AVAILABLE;
              const isOccupied = table.effectiveStatus === 'OCCUPIED' || table.effectiveStatus === 'WAITING_PAYMENT';
              const isRound = table.shape === 'round';
              const isRect = table.shape === 'rectangle';

              return (
                <div
                  key={table._id}
                  onClick={() => setActiveDrawerTable(table)}
                  className={`group relative flex flex-col items-center justify-center p-4 cursor-pointer transition-all duration-200 hover:scale-105 select-none ${
                    isRound
                      ? 'rounded-full aspect-square'
                      : isRect
                      ? 'rounded-2xl aspect-[4/3]'
                      : 'rounded-2xl aspect-square'
                  } bg-white border-2 shadow-sm hover:shadow-lg ${
                    table.effectiveStatus === 'OCCUPIED'
                      ? 'border-blue-400 ring-4 ring-blue-500/10'
                      : table.effectiveStatus === 'WAITING_PAYMENT'
                      ? 'border-amber-400 ring-4 ring-amber-500/15'
                      : table.effectiveStatus === 'CLEANING'
                      ? 'border-orange-300 bg-orange-50/20'
                      : table.effectiveStatus === 'RESERVED'
                      ? 'border-purple-300'
                      : 'border-emerald-300 hover:border-emerald-500'
                  }`}
                >
                  {/* Chairs Indicator Around Table */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                    {Array.from({ length: Math.min(table.seats, 4) }).map((_, i) => (
                      <span key={i} className="h-1 w-3 rounded-full bg-stone-300" />
                    ))}
                  </div>

                  {/* Status dot */}
                  <span className={`absolute top-2.5 right-2.5 h-2 w-2 rounded-full ${statusCfg.dot}`} />

                  {/* Table Number */}
                  <span className="font-display text-xl font-bold text-espresso-950">
                    T{table.tableNumber}
                  </span>

                  {/* Seat count & Status */}
                  <span className="text-[10px] font-semibold text-stone-500 mt-0.5">
                    {table.seats} seats
                  </span>

                  {/* Live order amount badge */}
                  {isOccupied && table.currentBillAmount > 0 && (
                    <span className="mt-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                      {formatMoney(table.currentBillAmount, currency)}
                    </span>
                  )}

                  {table.effectiveStatus === 'CLEANING' && (
                    <span className="mt-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-700">
                      Clean Me
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* TABLE CARDS GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredTables.map((table) => {
            const statusCfg = STATUS_CONFIG[table.effectiveStatus] || STATUS_CONFIG.AVAILABLE;
            const isOccupied = table.effectiveStatus === 'OCCUPIED' || table.effectiveStatus === 'WAITING_PAYMENT';
            const shapeClass = table.shape === 'round' ? 'rounded-full' : 'rounded-2xl';

            return (
              <div
                key={table._id}
                className={`flex flex-col justify-between rounded-3xl border bg-white p-4.5 shadow-xs hover:shadow-md transition duration-200 ${
                  isOccupied
                    ? 'border-blue-300 ring-2 ring-blue-500/10'
                    : table.effectiveStatus === 'CLEANING'
                    ? 'border-orange-200 bg-orange-50/10'
                    : 'border-stone-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-11 w-11 items-center justify-center font-display text-lg font-bold text-white shadow-xs ${shapeClass} ${
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

                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${statusCfg.bg}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                      <span>{statusCfg.label}</span>
                    </div>
                  </div>

                  {isOccupied && (
                    <div className="mt-3.5 bg-blue-50/70 border border-blue-200/60 rounded-2xl p-2.5 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                        <span>Current Bill:</span>
                        <span className="text-sm font-display text-blue-700">{formatMoney(table.currentBillAmount, currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-blue-700">
                        <span>{table.activeOrdersCount || 0} order(s)</span>
                        {table.occupiedSince && (
                          <span className="flex items-center gap-0.5 text-stone-500">
                            <Clock size={11} />
                            {Math.max(1, Math.round((Date.now() - new Date(table.occupiedSince).getTime()) / 60000))}m ago
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {table.label && (
                    <p className="mt-2 text-xs text-stone-500 italic truncate">
                      "{table.label}"
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/pos?table=${table.tableNumber}`)}
                      className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
                    >
                      <Monitor size={12} /> Fast POS
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDrawerTable(table)}
                      className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition border border-stone-200"
                    >
                      <Eye size={12} /> Details
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px] pt-1">
                    {table.effectiveStatus === 'AVAILABLE' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(table._id, 'RESERVED')}
                        className="text-purple-600 hover:text-purple-800 font-semibold"
                      >
                        Reserve
                      </button>
                    )}
                    {table.effectiveStatus === 'RESERVED' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(table._id, 'AVAILABLE')}
                        className="text-emerald-600 hover:text-emerald-800 font-semibold"
                      >
                        Release
                      </button>
                    )}
                    {table.effectiveStatus === 'CLEANING' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(table._id, 'AVAILABLE')}
                        className="text-emerald-600 hover:text-emerald-800 font-semibold"
                      >
                        Mark Clean
                      </button>
                    )}
                    {table.effectiveStatus === 'OCCUPIED' && (
                      <button
                        type="button"
                        onClick={() => setTransferModalData(table)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
                      >
                        <ArrowRightLeft size={11} /> Transfer
                      </button>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleEditClick(table)}
                        className="text-stone-400 hover:text-stone-700 p-1"
                        title="Edit Table"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ isOpen: true, table })}
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
        /* QR DIRECTORY VIEW */
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredTables.map((table) => (
            <div key={table._id} className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs p-4 flex flex-col items-center text-center">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 mb-3">
                {table.qrCode ? (
                  <img
                    src={table.qrCode}
                    alt={`Table ${table.tableNumber} QR`}
                    className="h-36 w-36 object-contain"
                  />
                ) : (
                  <QrCode size={64} className="text-stone-400" />
                )}
              </div>

              <h3 className="font-display text-lg font-bold text-espresso-950">
                Table {String(table.tableNumber).padStart(2, '0')}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {table.seats} seats · {table.floor || 'Ground'} {table.label ? `· ${table.label}` : ''}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => downloadQr(table)}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition flex items-center justify-center gap-1"
                >
                  <Download size={13} /> PNG
                </button>
                <button
                  type="button"
                  onClick={() => handleRegenerateQr(table)}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition flex items-center justify-center gap-1"
                >
                  <RefreshCw size={13} /> New QR
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABLE DRAWER DETAILS */}
      <Drawer
        isOpen={Boolean(activeDrawerTable)}
        onClose={() => setActiveDrawerTable(null)}
        title={activeDrawerTable ? `Table ${activeDrawerTable.tableNumber}` : ''}
        subtitle={activeDrawerTable ? `${activeDrawerTable.seats} Seats · ${activeDrawerTable.floor || 'Ground Floor'} ${activeDrawerTable.label ? `· "${activeDrawerTable.label}"` : ''}` : ''}
        footer={
          activeDrawerTable && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const num = activeDrawerTable.tableNumber;
                  setActiveDrawerTable(null);
                  navigate(`/pos?table=${num}`);
                }}
                className="btn-primary flex-1 rounded-xl py-2.5 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5"
              >
                <Monitor size={14} /> Open in POS Terminal
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = activeDrawerTable;
                  setActiveDrawerTable(null);
                  handleEditClick(t);
                }}
                className="rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
              >
                Edit
              </button>
            </div>
          )
        }
      >
        {activeDrawerTable && (
          <div className="space-y-5">
            {/* Status card */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Current Status</span>
                <StatusPill status={activeDrawerTable.effectiveStatus} size="md" />
              </div>

              {/* Status fast switcher */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-200">
                {['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(activeDrawerTable._id, st)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      activeDrawerTable.effectiveStatus === st
                        ? 'bg-espresso-950 text-white'
                        : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                    }`}
                  >
                    {STATUS_CONFIG[st]?.label || st}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Tab / Bill */}
            <div className="rounded-2xl border border-stone-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Live Tab Summary</h4>
                <span className="font-display text-lg font-bold text-espresso-950 tabular-nums">
                  {formatMoney(activeDrawerTable.currentBillAmount, currency)}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                {activeDrawerTable.activeOrdersCount || 0} active orders currently assigned to this table.
              </p>
            </div>

            {/* Acrylic Standee QR Code Preview */}
            <div className="rounded-2xl border border-stone-200 p-4 space-y-3 text-center bg-stone-50/40">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Table QR Standee
              </h4>
              <div className="flex justify-center">
                {activeDrawerTable.qrCode ? (
                  <img
                    src={activeDrawerTable.qrCode}
                    alt="QR Standee"
                    className="h-36 w-36 rounded-xl border border-stone-200 bg-white p-2 shadow-xs"
                  />
                ) : (
                  <QrCode size={64} className="text-stone-300" />
                )}
              </div>
              <div className="flex justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => downloadQr(activeDrawerTable)}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => handleRegenerateQr(activeDrawerTable)}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
                >
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ADD / EDIT TABLE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-espresso-950">
                {editingTable ? `Edit Table ${editingTable.tableNumber}` : 'Add New Table'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-stone-400 hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Table Number *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="1, 2, 14..."
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Floor / Zone
                </label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="Ground Floor, Rooftop, Patio..."
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Table Shape
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['square', 'round', 'rectangle'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShape(s)}
                      className={`rounded-xl border py-2 text-xs font-semibold capitalize transition ${
                        shape === s
                          ? 'border-amber-500 bg-amber-50 text-amber-900'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Label / Note (Optional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Window corner, Booth A..."
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
                >
                  {saving ? 'Saving...' : editingTable ? 'Save Table' : 'Create Table'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* TRANSFER TABLE MODAL */}
      {transferModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <section role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-espresso-950">
                Transfer Table {transferModalData.tableNumber}
              </h3>
              <button
                type="button"
                onClick={() => setTransferModalData(null)}
                className="p-1 rounded-xl text-stone-400 hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Move all active orders and guest tab from Table {transferModalData.tableNumber} to another available table.
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Destination Table
              </label>
              <select
                value={targetTableNumber}
                onChange={(e) => setTargetTableNumber(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">Select available table...</option>
                {tables
                  .filter((t) => t.tableNumber !== transferModalData.tableNumber && t.effectiveStatus === 'AVAILABLE')
                  .map((t) => (
                    <option key={t._id} value={t.tableNumber}>
                      Table {t.tableNumber} ({t.seats} seats · {t.floor || 'Ground'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setTransferModalData(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferring || !targetTableNumber}
                className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {transferring ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Universal Confirm Dialog for Delete */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={`Delete Table ${deleteConfirm.table?.tableNumber}?`}
        message="This will permanently remove the table and its QR code. Any past historical orders will remain intact."
        confirmText="Delete Table"
        confirmVariant="danger"
        onConfirm={executeDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, table: null })}
      />
    </div>
  );
}
