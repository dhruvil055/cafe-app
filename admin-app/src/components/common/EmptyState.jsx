export default function EmptyState({
  icon: Icon,
  title = 'No items found',
  description = 'There are no records to display here yet.',
  action,
  actionLabel,
  onAction,
  secondaryAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200/90 bg-white/70 py-16 px-6 text-center backdrop-blur-xs">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 shadow-inner">
          <Icon size={28} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-espresso-950">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-stone-500 leading-relaxed">
        {description}
      </p>
      {(action || (actionLabel && onAction)) && (
        <div className="mt-5 flex items-center gap-3">
          {action ? (
            action
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
            >
              {actionLabel}
            </button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
