import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
  Copy,
  RefreshCw,
  Store,
  Palette,
  MapPin,
  Clock,
  Sparkles,
  QrCode,
  Check,
  ChevronDown,
  Layers,
  UtensilsCrossed,
  Info,
  Tag,
  Phone,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { env } from '../config/env';
import api from '../services/api';

const PAGES = [
  { path: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { path: '/about', label: 'About', icon: Info },
  { path: '/offers', label: 'Offers', icon: Tag },
  { path: '/gallery', label: 'Gallery', icon: Layers },
  { path: '/contact', label: 'Contact', icon: Phone },
  { path: '/cart', label: 'Cart', icon: ShoppingCart },
  { path: '/bill', label: 'Bill', icon: Receipt },
];

export default function UserPanelModal({
  isOpen,
  onClose,
  initialCafe = null,
  allCafes = [],
}) {
  const [selectedCafe, setSelectedCafe] = useState(initialCafe);
  const [viewport, setViewport] = useState('mobile'); // 'mobile' | 'tablet' | 'desktop'
  const [activePage, setActivePage] = useState('/menu');
  const [selectedTable, setSelectedTable] = useState('');
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [frameKey, setFrameKey] = useState(1);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Sync selected café when initialCafe changes
  useEffect(() => {
    if (initialCafe) {
      setSelectedCafe(initialCafe);
    } else if (allCafes.length > 0 && !selectedCafe) {
      setSelectedCafe(allCafes[0]);
    }
  }, [initialCafe, allCafes]);

  // Load tables for selected café
  useEffect(() => {
    if (!selectedCafe?.slug && !selectedCafe?.id) return;
    const identifier = selectedCafe.slug || selectedCafe.id;
    setLoadingTables(true);
    api
      .get(`/public/cafes/${identifier}/tables`)
      .then((res) => {
        const list = res.data?.data?.tables || [];
        setTables(list);
      })
      .catch(() => {
        setTables([]);
      })
      .finally(() => {
        setLoadingTables(false);
      });
  }, [selectedCafe?.slug, selectedCafe?.id]);

  if (!isOpen) return null;

  const customerBaseUrl = (env.customerUrl || 'http://localhost:5173').replace(/\/+$/, '');
  const cafeSlug = selectedCafe?.slug || '';
  
  // Construct the target preview URL
  const queryParams = new URLSearchParams();
  if (cafeSlug) queryParams.set('cafe', cafeSlug);
  if (selectedTable) queryParams.set('table', selectedTable);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const currentPreviewUrl = `${customerBaseUrl}${activePage}${queryString}`;

  const primaryColor =
    selectedCafe?.branding?.primaryColor ||
    selectedCafe?.settings?.primaryColor ||
    selectedCafe?.primaryColor ||
    '#c96b18';
  const accentColor =
    selectedCafe?.branding?.secondaryColor ||
    selectedCafe?.settings?.accentColor ||
    selectedCafe?.accentColor ||
    '#1a0f08';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentPreviewUrl);
    setCopied(true);
    toast.success('User panel URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const reloadIframe = () => {
    setIframeLoading(true);
    setFrameKey((k) => k + 1);
  };

  const getViewportDimensions = () => {
    switch (viewport) {
      case 'mobile':
        return 'w-[380px] h-[720px] rounded-[40px] shadow-2xl border-[10px] border-stone-800';
      case 'tablet':
        return 'w-[740px] h-[780px] rounded-[28px] shadow-2xl border-[12px] border-stone-800';
      case 'desktop':
      default:
        return 'w-full h-[760px] rounded-xl shadow-lg border border-stone-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative flex flex-col w-full max-w-7xl h-[94vh] bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-stone-100"
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50 dark:bg-stone-950/80 border-b border-slate-200 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-2xl shadow-sm overflow-hidden text-white font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {selectedCafe?.settings?.logoUrl || selectedCafe?.logoUrl ? (
                <img
                  src={selectedCafe.settings?.logoUrl || selectedCafe.logoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store size={20} />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-900 dark:text-white">
                  {selectedCafe?.name || selectedCafe?.settings?.cafeName || 'Café'} User Panel
                </h2>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider border"
                  style={{
                    backgroundColor: `${primaryColor}20`,
                    borderColor: `${primaryColor}40`,
                    color: primaryColor,
                  }}
                >
                  {selectedCafe?.slug || 'slug'}
                </span>
                {selectedCafe?.status && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                      selectedCafe.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                    }`}
                  >
                    {selectedCafe.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-stone-400 font-mono mt-0.5 truncate max-w-md">
                {currentPreviewUrl}
              </p>
            </div>
          </div>

          {/* Café Selector if multiple exist */}
          {allCafes.length > 1 && (
            <div className="flex items-center gap-2 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-xl px-3 py-1.5 shadow-2xs">
              <Store size={14} className="text-slate-400 dark:text-stone-400" />
              <select
                value={selectedCafe?.id || selectedCafe?._id || selectedCafe?.slug}
                onChange={(e) => {
                  const target = allCafes.find(
                    (c) =>
                      String(c.id || c._id) === e.target.value || c.slug === e.target.value
                  );
                  if (target) {
                    setSelectedCafe(target);
                    setSelectedTable('');
                    setIframeLoading(true);
                  }
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-stone-200 focus:outline-none cursor-pointer"
              >
                {allCafes.map((c) => (
                  <option
                    key={c.id || c._id || c.slug}
                    value={c.id || c._id || c.slug}
                    className="bg-white dark:bg-stone-900 text-slate-900 dark:text-stone-100"
                  >
                    {c.name || c.settings?.cafeName || c.slug} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-stone-800 hover:bg-slate-200 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 transition"
              title="Copy link to clipboard"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span className="hidden sm:inline">Copy Link</span>
            </button>

            <a
              href={currentPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brew-600 hover:bg-brew-500 text-white transition shadow-sm"
              title="Open customer user panel in new browser tab"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">Open Live</span>
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 dark:text-stone-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-stone-800 transition ml-2"
              title="Close User Panel"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Café Profile Info Bar & Theme Swatches */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-100/70 dark:bg-stone-900/90 border-b border-slate-200 dark:border-stone-800 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-stone-300">
            {/* Theme Colors */}
            <div className="flex items-center gap-2 bg-white dark:bg-stone-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-stone-800 shadow-2xs">
              <Palette size={13} className="text-slate-400 dark:text-stone-400" />
              <span className="text-[11px] text-slate-400 dark:text-stone-400">Palette:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-stone-700 shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                  title={`Primary: ${primaryColor}`}
                />
                <span className="font-mono text-[10px] text-slate-700 dark:text-stone-300">{primaryColor}</span>
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-stone-700 shadow-xs ml-1"
                  style={{ backgroundColor: accentColor }}
                  title={`Accent: ${accentColor}`}
                />
                <span className="font-mono text-[10px] text-slate-700 dark:text-stone-300">{accentColor}</span>
              </div>
            </div>

            {/* Currency & Tax */}
            <div className="text-[11px] text-slate-500 dark:text-stone-400">
              Currency: <span className="font-semibold text-slate-800 dark:text-stone-200">{selectedCafe?.settings?.currency || 'INR'}</span> · Tax:{' '}
              <span className="font-semibold text-slate-800 dark:text-stone-200">{selectedCafe?.settings?.taxRate ?? 5}%</span>
            </div>

            {/* Tagline */}
            {selectedCafe?.settings?.tagline && (
              <div className="hidden md:inline text-[11px] text-slate-500 dark:text-stone-400 italic">
                "{selectedCafe.settings.tagline}"
              </div>
            )}
          </div>

          {/* Quick Page Nav within User Panel */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            <span className="text-[11px] text-slate-400 dark:text-stone-400 mr-1 hidden sm:inline">Page:</span>
            {PAGES.map((pg) => {
              const Icon = pg.icon;
              const isActive = activePage === pg.path;
              return (
                <button
                  key={pg.path}
                  onClick={() => {
                    setActivePage(pg.path);
                    setIframeLoading(true);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                      : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 hover:bg-slate-200/70 dark:hover:bg-stone-800'
                  }`}
                >
                  <Icon size={12} />
                  <span>{pg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Viewport Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 bg-slate-50 dark:bg-stone-950/60 border-b border-slate-200 dark:border-stone-800 text-xs shrink-0">
          {/* Device viewport switcher */}
          <div className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => setViewport('mobile')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                viewport === 'mobile'
                  ? 'bg-slate-100 dark:bg-stone-800 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-200'
              }`}
            >
              <Smartphone size={14} /> Mobile (380px)
            </button>
            <button
              onClick={() => setViewport('tablet')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                viewport === 'tablet'
                  ? 'bg-slate-100 dark:bg-stone-800 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-200'
              }`}
            >
              <Tablet size={14} /> Tablet (740px)
            </button>
            <button
              onClick={() => setViewport('desktop')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                viewport === 'desktop'
                  ? 'bg-slate-100 dark:bg-stone-800 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-200'
              }`}
            >
              <Monitor size={14} /> Full Desktop
            </button>
          </div>

          {/* Table Simulator */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-stone-400">Simulate Diners Table:</span>
            <select
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setIframeLoading(true);
              }}
              className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-stone-200 focus:outline-none focus:border-amber-500 shadow-2xs"
            >
              <option value="">Counter / Takeaway Mode</option>
              {tables.map((tbl) => (
                <option key={tbl.id || tbl.number} value={tbl.number}>
                  Table {tbl.number} ({tbl.name || `Table ${tbl.number}`})
                </option>
              ))}
            </select>

            <button
              onClick={reloadIframe}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-stone-800 text-slate-500 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-800 transition"
              title="Reload preview frame"
            >
              <RefreshCw size={14} className={iframeLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Interactive Iframe Workstation */}
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-stone-950 p-4 flex items-center justify-center relative">
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 dark:bg-stone-950/70 z-10 backdrop-blur-xs">
              <div
                className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${primaryColor} transparent transparent transparent` }}
              />
              <p className="mt-3 text-xs text-slate-200 dark:text-stone-400 font-medium">
                Loading {selectedCafe?.name || 'Café'} User Panel...
              </p>
            </div>
          )}

          <div className={`relative transition-all duration-300 ${getViewportDimensions()} bg-white overflow-hidden shadow-2xl`}>
            {/* Mobile Notch Bar */}
            {viewport === 'mobile' && (
              <div className="absolute top-0 inset-x-0 h-6 bg-stone-900 flex items-center justify-center z-20">
                <div className="w-24 h-4 bg-stone-800 rounded-b-xl" />
              </div>
            )}

            <iframe
              key={frameKey}
              src={currentPreviewUrl}
              title={`${selectedCafe?.name || 'Café'} User Panel Live Preview`}
              className="w-full h-full border-0"
              onLoad={() => setIframeLoading(false)}
            />
          </div>
        </div>

        {/* Bottom Status Footer */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-50 dark:bg-stone-950 border-t border-slate-200 dark:border-stone-800 text-[11px] text-slate-500 dark:text-stone-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Interactive Live Simulation: orders, menu cards, cart, and profile adapt to {selectedCafe?.name}</span>
          </div>

          <div>
            Viewing café ID:{' '}
            <span className="font-mono text-slate-700 dark:text-stone-300">{selectedCafe?.id || selectedCafe?._id || 'N/A'}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
