import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  change,
  changeLabel = 'vs yesterday',
  accentColor = 'brand',
  onClick,
  badge,
}) {
  const isPositive = typeof change === 'number' && change > 0;
  const isNegative = typeof change === 'number' && change < 0;
  const isNeutral = typeof change === 'number' && change === 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs transition-all hover:shadow-sm ${
        onClick ? 'cursor-pointer hover:border-stone-300' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              {label}
            </span>
            {badge && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                {badge}
              </span>
            )}
          </div>

          <div className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 tabular-nums">
            {value}
          </div>

          {sublabel && (
            <div className="mt-1 text-xs text-stone-500 truncate">
              {sublabel}
            </div>
          )}
        </div>

        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-700 border border-stone-200/60 shadow-2xs">
            <Icon size={20} className="text-stone-700" />
          </div>
        )}
      </div>

      {typeof change === 'number' && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
          <div className={`flex items-center gap-1 font-semibold ${
            isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-stone-500'
          }`}>
            {isPositive && <TrendingUp size={14} />}
            {isNegative && <TrendingDown size={14} />}
            {isNeutral && <Minus size={14} />}
            <span>{isPositive ? '+' : ''}{change}%</span>
          </div>
          <span className="text-[11px] text-stone-400 font-medium">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
