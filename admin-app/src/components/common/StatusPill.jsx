export default function StatusPill({ status, size = 'sm', pulse = false }) {
  const norm = String(status || '').toLowerCase().trim();

  // Status mapping using semantic CSS variables
  const config = {
    // Orders
    pending: { label: 'Received', style: 'pending' },
    confirmed: { label: 'Confirmed', style: 'confirmed' },
    preparing: { label: 'Preparing', style: 'preparing' },
    ready: { label: 'Ready', style: 'ready' },
    completed: { label: 'Served', style: 'completed' },
    cancelled: { label: 'Cancelled', style: 'cancelled' },
    refunded: { label: 'Refunded', style: 'refunded' },

    // Payments
    paid: { label: 'Paid', style: 'paid' },
    unpaid: { label: 'Unpaid', style: 'unpaid' },
    failed: { label: 'Failed', style: 'failed' },

    // Tables
    available: { label: 'Available', style: 'available' },
    occupied: { label: 'Occupied', style: 'occupied' },
    reserved: { label: 'Reserved', style: 'reserved' },
    dirty: { label: 'Needs Cleaning', style: 'dirty' },

    // General / coupons / staff
    active: { label: 'Active', style: 'active' },
    inactive: { label: 'Inactive', style: 'inactive' },
    expired: { label: 'Expired', style: 'expired' },
    draft: { label: 'Draft', style: 'draft' },
    ordered: { label: 'Ordered', style: 'ordered' },
    received: { label: 'Received', style: 'received' },
    suspended: { label: 'Suspended', style: 'suspended' },
    unassigned: { label: 'Unassigned', style: 'unassigned' },
  }[norm] || {
    label: norm.charAt(0).toUpperCase() + norm.slice(1) || 'Unknown',
    style: 'default',
  };

  const sizeClasses = size === 'xs'
    ? 'px-2 py-0.5 text-[10px]'
    : size === 'md'
    ? 'px-3 py-1.5 text-xs'
    : 'px-2.5 py-1 text-[11px]';

  // CSS variable based styles
  const styleMap = {
    pending: 'bg-[var(--status-pending-bg)] text-[var(--status-pending-text)] border-[var(--status-pending-border)]',
    confirmed: 'bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)] border-[var(--status-confirmed-border)]',
    preparing: 'bg-[var(--status-preparing-bg)] text-[var(--status-preparing-text)] border-[var(--status-preparing-border)]',
    ready: 'bg-[var(--status-ready-bg)] text-[var(--status-ready-text)] border-[var(--status-ready-border)]',
    completed: 'bg-[var(--status-completed-bg)] text-[var(--status-completed-text)] border-[var(--status-completed-border)]',
    cancelled: 'bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)] border-[var(--status-cancelled-border)]',
    refunded: 'bg-[var(--status-refunded-bg)] text-[var(--status-refunded-text)] border-[var(--status-refunded-border)]',
    paid: 'bg-[var(--status-paid-bg)] text-[var(--status-paid-text)] border-[var(--status-paid-border)]',
    unpaid: 'bg-[var(--status-unpaid-bg)] text-[var(--status-unpaid-text)] border-[var(--status-unpaid-border)]',
    failed: 'bg-[var(--status-failed-bg)] text-[var(--status-failed-text)] border-[var(--status-failed-border)]',
    available: 'bg-[var(--status-available-bg)] text-[var(--status-available-text)] border-[var(--status-available-border)]',
    occupied: 'bg-[var(--status-occupied-bg)] text-[var(--status-occupied-text)] border-[var(--status-occupied-border)]',
    reserved: 'bg-[var(--status-reserved-bg)] text-[var(--status-reserved-text)] border-[var(--status-reserved-border)]',
    dirty: 'bg-[var(--status-dirty-bg)] text-[var(--status-dirty-text)] border-[var(--status-dirty-border)]',
    active: 'bg-[var(--status-active-bg)] text-[var(--status-active-text)] border-[var(--status-active-border)]',
    inactive: 'bg-[var(--status-inactive-bg)] text-[var(--status-inactive-text)] border-[var(--status-inactive-border)]',
    expired: 'bg-[var(--status-expired-bg)] text-[var(--status-expired-text)] border-[var(--status-expired-border)]',
    draft: 'bg-[var(--status-draft-bg)] text-[var(--status-draft-text)] border-[var(--status-draft-border)]',
    ordered: 'bg-[var(--status-ordered-bg)] text-[var(--status-ordered-text)] border-[var(--status-ordered-border)]',
    received: 'bg-[var(--status-received-bg)] text-[var(--status-received-text)] border-[var(--status-received-border)]',
    suspended: 'bg-[var(--status-suspended-bg)] text-[var(--status-suspended-text)] border-[var(--status-suspended-border)]',
    unassigned: 'bg-[var(--status-unassigned-bg)] text-[var(--status-unassigned-text)] border-[var(--status-unassigned-border)]',
    default: 'bg-[var(--hover-bg)] text-[var(--text-secondary)] border-[var(--border-primary)]',
  };

  const dotColorMap = {
    pending: 'bg-[var(--status-pending-dot)]',
    confirmed: 'bg-[var(--status-confirmed-dot)]',
    preparing: 'bg-[var(--status-preparing-dot)]',
    ready: 'bg-[var(--status-ready-dot)]',
    completed: 'bg-[var(--status-completed-dot)]',
    cancelled: 'bg-[var(--status-cancelled-dot)]',
    refunded: 'bg-[var(--status-refunded-dot)]',
    paid: 'bg-[var(--status-paid-dot)]',
    unpaid: 'bg-[var(--status-unpaid-dot)]',
    failed: 'bg-[var(--status-failed-dot)]',
    available: 'bg-[var(--status-available-dot)]',
    occupied: 'bg-[var(--status-occupied-dot)]',
    reserved: 'bg-[var(--status-reserved-dot)]',
    dirty: 'bg-[var(--status-dirty-dot)]',
    active: 'bg-[var(--status-active-dot)]',
    inactive: 'bg-[var(--status-inactive-dot)]',
    expired: 'bg-[var(--status-expired-dot)]',
    draft: 'bg-[var(--status-draft-dot)]',
    ordered: 'bg-[var(--status-ordered-dot)]',
    received: 'bg-[var(--status-received-dot)]',
    suspended: 'bg-[var(--status-suspended-dot)]',
    unassigned: 'bg-[var(--text-muted)]',
    default: 'bg-[var(--text-muted)]',
  };

  const styleClass = styleMap[config.style] || styleMap.default;
  const dotClass = dotColorMap[config.style] || dotColorMap.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${styleClass} ${sizeClasses}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dotClass} ${pulse ? 'animate-pulse' : ''}`}
      />
      {config.label}
    </span>
  );
}