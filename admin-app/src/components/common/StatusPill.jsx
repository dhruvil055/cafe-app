export default function StatusPill({ status, size = 'sm', pulse = false }) {
  const norm = String(status || '').toLowerCase().trim();

  // Status mapping
  const config = {
    // Orders
    pending: { label: 'Received', bg: 'bg-amber-50 text-amber-800 border-amber-200/80', dot: 'bg-amber-500' },
    confirmed: { label: 'Confirmed', bg: 'bg-blue-50 text-blue-800 border-blue-200/80', dot: 'bg-blue-500' },
    preparing: { label: 'Preparing', bg: 'bg-purple-50 text-purple-800 border-purple-200/80', dot: 'bg-purple-500' },
    ready: { label: 'Ready', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80', dot: 'bg-emerald-500' },
    completed: { label: 'Served', bg: 'bg-stone-100 text-stone-700 border-stone-200', dot: 'bg-stone-400' },
    cancelled: { label: 'Cancelled', bg: 'bg-red-50 text-red-800 border-red-200/80', dot: 'bg-red-500' },
    refunded: { label: 'Refunded', bg: 'bg-rose-50 text-rose-800 border-rose-200/80', dot: 'bg-rose-500' },

    // Payments
    paid: { label: 'Paid', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    unpaid: { label: 'Unpaid', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    failed: { label: 'Failed', bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },

    // Tables
    available: { label: 'Available', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    occupied: { label: 'Occupied', bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
    reserved: { label: 'Reserved', bg: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
    dirty: { label: 'Needs Cleaning', bg: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' },

    // General / coupons / staff
    active: { label: 'Active', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    inactive: { label: 'Inactive', bg: 'bg-stone-100 text-stone-600 border-stone-200', dot: 'bg-stone-400' },
    expired: { label: 'Expired', bg: 'bg-stone-100 text-stone-600 border-stone-200', dot: 'bg-stone-400' },
    draft: { label: 'Draft', bg: 'bg-stone-100 text-stone-600 border-stone-200', dot: 'bg-stone-400' },
    ordered: { label: 'Ordered', bg: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
    received: { label: 'Received', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  }[norm] || {
    label: norm.charAt(0).toUpperCase() + norm.slice(1) || 'Unknown',
    bg: 'bg-stone-100 text-stone-700 border-stone-200',
    dot: 'bg-stone-400',
  };

  const sizeClasses = size === 'xs'
    ? 'px-2 py-0.5 text-[10px]'
    : size === 'md'
    ? 'px-3 py-1.5 text-xs'
    : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${config.bg} ${sizeClasses}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot} ${pulse ? 'animate-pulse' : ''}`}
      />
      {config.label}
    </span>
  );
}
