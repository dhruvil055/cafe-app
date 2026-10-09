import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiCard({
  title,
  value,
  previousValue,
  changePercent,
  trend = 'neutral', // 'up' | 'down' | 'neutral'
  semantic = 'healthy', // 'healthy' (green) | 'problem' (red) | 'neutral' (amber/blue)
  icon: Icon,
  subtitle,
  sparklineData = [12, 14, 18, 15, 22, 28, 25, 32],
  loading = false,
}) {
  if (loading) {
    return (
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-20 bg-[var(--border-primary)] rounded animate-pulse" />
          <div className="h-7 w-7 bg-[var(--border-primary)] rounded-lg animate-pulse" />
        </div>
        <div className="h-7 w-28 bg-[var(--border-primary)] rounded mb-2 animate-pulse" />
        <div className="h-3 w-36 bg-[var(--hover-bg)] rounded animate-pulse" />
      </div>
    );
  }

  // Generate SVG path for sparkline
  const min = Math.min(...sparklineData);
  const max = Math.max(...sparklineData);
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const getSemanticColor = () => {
    if (semantic === 'healthy') {
      return {
        badge: 'bg-[var(--success-bg)] text-[var(--success-text)] border-[var(--success-border)]',
        stroke: 'stroke-[var(--success)]',
        icon: 'text-[var(--success)]',
      };
    }
    if (semantic === 'problem') {
      return {
        badge: 'bg-[var(--danger-bg)] text-[var(--danger-text)] border-[var(--danger-border)]',
        stroke: 'stroke-[var(--danger)]',
        icon: 'text-[var(--danger)]',
      };
    }
    return {
      badge: 'bg-[var(--warning-bg)] text-[var(--warning-text)] border-[var(--warning-border)]',
      stroke: 'stroke-amber-600 dark:stroke-amber-400',
      icon: 'text-amber-600 dark:text-amber-400',
    };
  };

  const colors = getSemanticColor();

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="kpi-card hover:border-[var(--border-primary)]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold tracking-wide uppercase text-[var(--text-muted)]">
          {title}
        </span>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${colors.badge}`}>
            <Icon size={16} className={colors.icon} />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className="text-2xl font-black tracking-tight text-[var(--text-primary)] tabular-nums">
          {value}
        </div>

        {/* Sparkline */}
        <div className="hidden sm:block">
          <svg width={width} height={height} className="overflow-visible">
            <polyline
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
              className={colors.stroke}
            />
          </svg>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        {changePercent !== undefined && changePercent !== null ? (
          <div className="flex items-center gap-1 font-semibold">
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${colors.badge}`}
            >
              {trend === 'up' && <TrendingUp size={10} />}
              {trend === 'down' && <TrendingDown size={10} />}
              {trend === 'neutral' && <Minus size={10} />}
              {changePercent > 0 ? `+${changePercent}%` : `${changePercent}%`}
            </span>
            <span className="text-[var(--text-muted)]">vs prev period</span>
          </div>
        ) : (
          <span className="text-[var(--text-muted)]">{subtitle || 'Platform telemetry'}</span>
        )}

        {subtitle && changePercent !== undefined && (
          <span className="text-[var(--text-muted)] truncate max-w-[140px]">{subtitle}</span>
        )}
      </div>
    </motion.div>
  );
}