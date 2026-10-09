import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  Search,
  SlidersHorizontal,
  Layers,
  UtensilsCrossed,
  Info,
  Tag,
  Phone,
  Receipt,
  ShoppingCart,
  Grid,
  Shield,
  ArrowRight,
  TrendingUp,
  Download,
  Eye,
  Sliders,
  Maximize2,
  Minimize2,
  RotateCw,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { env } from '../config/env';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';

const PAGES = [
  { path: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { path: '/about', label: 'About', icon: Info },
  { path: '/offers', label: 'Offers', icon: Tag },
  { path: '/gallery', label: 'Gallery', icon: Layers },
  { path: '/contact', label: 'Contact', icon: Phone },
  { path: '/cart', label: 'Cart', icon: ShoppingCart },
  { path: '/bill', label: 'Bill', icon: Receipt },
  { path: '/orders', label: 'Orders', icon: Clock },
];

export default function UserPanelPage() {
  const currentTenant = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCafeSlug = searchParams.get('cafe') || searchParams.get('cafeSlug');

  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'gallery'
  const [cafes, setCafes] = useState([]);
  const [loadingCafes, setLoadingCafes] = useState(true);
  const [selectedCafe, setSelectedCafe] = useState(null);

  const [viewport, setViewport] = useState('mobile'); // 'mobile' | 'tablet' | 'desktop'
  const [scale, setScale] = useState(1);
  const [isLandscape, setIsLandscape] = useState(false);
  const [activePage, setActivePage] = useState('/menu');
  const [selectedTable, setSelectedTable] = useState('');
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [frameKey, setFrameKey] = useState(1);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Gallery search & filters
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryFilter, setGalleryFilter] = useState('all'); // 'all' | 'active' | 'suspended'

  // Fetch all cafés
  useEffect(() => {
    let isMounted = true;
    setLoadingCafes(true);

    // Try fetching all cafés from the API
    api
      .get('/cafes')
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data?.cafes || res.data?.cafes || [];
        setCafes(list);

        // Resolve initially selected café
        if (queryCafeSlug) {
          const match = list.find((c) => c.slug === queryCafeSlug);
          if (match) setSelectedCafe(match);
          else if (list.length > 0) setSelectedCafe(list[0]);
        } else if (currentTenant?.slug) {
          const match = list.find((c) => c.slug === currentTenant.slug);
          if (match) setSelectedCafe(match);
          else if (list.length > 0) setSelectedCafe(list[0]);
        } else if (list.length > 0) {
          setSelectedCafe(list[0]);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // Fallback to current tenant if /cafes list unavailable
        if (currentTenant?.slug) {
          const fallbackList = [
            {
              id: currentTenant.id,
              name: currentTenant.name,
              slug: currentTenant.slug,
              status: currentTenant.status || 'active',
              branding: {
                primaryColor: currentTenant.primaryColor || '#c96b18',
                secondaryColor: currentTenant.accentColor || '#1a0f08',
              },
              settings: currentTenant,
              tableCount: 1,
              productCount: 1,
            },
          ];
          setCafes(fallbackList);
          setSelectedCafe(fallbackList[0]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingCafes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [queryCafeSlug, currentTenant]);

  // Load tables whenever selected café changes
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

  const customerBaseUrl = (env.customerUrl || 'http://localhost:5173').replace(/\/+$/, '');
  const cafeSlug = selectedCafe?.slug || '';

  // Construct target user panel preview URL
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

  const handleSelectCafe = (cafe) => {
    setSelectedCafe(cafe);
    setSelectedTable('');
    setIframeLoading(true);
    setSearchParams({ cafe: cafe.slug });
  };

  const getViewportStyles = () => {
    if (viewport === 'mobile') {
      return isLandscape
        ? { width: '740px', height: '390px', borderRadius: '40px', border: '10px solid #1c1917' }
        : { width: '390px', height: '780px', borderRadius: '44px', border: '12px solid #1c1917' };
    }
    if (viewport === 'tablet') {
      return isLandscape
        ? { width: '960px', height: '680px', borderRadius: '28px', border: '12px solid #1c1917' }
        : { width: '740px', height: '880px', borderRadius: '28px', border: '12px solid #1c1917' };
    }
    return { width: '100%', height: '820px', borderRadius: '16px', border: '1px solid #e7e5e4' };
  };

  // Filtered gallery cafés
  const filteredCafes = cafes.filter((c) => {
    const matchesSearch =
      (c.name || '').toLowerCase().includes(gallerySearch.toLowerCase()) ||
      (c.slug || '').toLowerCase().includes(gallerySearch.toLowerCase()) ||
      (c.settings?.address || '').toLowerCase().includes(gallerySearch.toLowerCase());
    const matchesFilter =
      galleryFilter === 'all' ||
      (galleryFilter === 'active' && c.status === 'active') ||
      (galleryFilter === 'suspended' && c.status !== 'active');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brew-500/15 text-brew-600 font-bold">
              <Smartphone size={22} />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-espresso-900">
                User Panel & Storefront Showcase
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Live interactive customer experience for all cafés matching their individual branding and profile
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Simulator vs All Cafés Grid */}
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'simulator'
                ? 'bg-white text-espresso-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Smartphone size={14} />
            <span>Interactive Simulator</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'gallery'
                ? 'bg-white text-espresso-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Grid size={14} />
            <span>All Cafés Showcase ({cafes.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: INTERACTIVE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-4">
          {/* Café Selector & Profile Banner */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Café Dropdown Selector */}
              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                  Selected Café:
                </div>
                <div className="relative min-w-[240px]">
                  <select
                    value={selectedCafe?.slug || ''}
                    onChange={(e) => {
                      const match = cafes.find((c) => c.slug === e.target.value);
                      if (match) handleSelectCafe(match);
                    }}
                    className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50 pl-3.5 pr-8 py-2 text-xs sm:text-sm font-semibold text-espresso-900 focus:border-brew-500 focus:outline-none focus:ring-1 focus:ring-brew-500 cursor-pointer shadow-2xs"
                  >
                    {cafes.map((c) => (
                      <option key={c.id || c.slug} value={c.slug}>
                        {c.name || c.settings?.cafeName || c.slug} ({c.slug}) — {c.status}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400">
                    <ChevronDown size={14} />
                  </div>
                </div>

                {selectedCafe && (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      selectedCafe.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {selectedCafe.status}
                  </span>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
                  title="Copy customer link"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
                  title="View QR Code for this café"
                >
                  <QrCode size={14} />
                  <span>Show QR</span>
                </button>

                <a
                  href={currentPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brew-600 hover:bg-brew-500 text-white transition shadow-sm"
                  title="Open live customer user panel in new browser tab"
                >
                  <ExternalLink size={14} />
                  <span>Open Live Site</span>
                </a>
              </div>
            </div>

            {/* Profile Snapshot Bar */}
            {selectedCafe && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-stone-100 text-xs">
                {/* Branding colors */}
                <div className="flex items-center gap-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
                  <Palette size={16} className="text-stone-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase font-semibold">Theme Palette</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-stone-300 shadow-2xs"
                        style={{ backgroundColor: primaryColor }}
                        title={`Primary: ${primaryColor}`}
                      />
                      <span className="font-mono text-[11px] font-semibold text-stone-800">{primaryColor}</span>
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-stone-300 shadow-2xs ml-1"
                        style={{ backgroundColor: accentColor }}
                        title={`Accent: ${accentColor}`}
                      />
                      <span className="font-mono text-[11px] font-semibold text-stone-800">{accentColor}</span>
                    </div>
                  </div>
                </div>

                {/* Subdomain */}
                <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
                  <div className="text-[10px] text-stone-400 uppercase font-semibold">Customer Subdomain</div>
                  <div className="font-mono text-[11px] text-brew-700 font-bold truncate mt-0.5">
                    {selectedCafe.slug}.localhost:5173
                  </div>
                </div>

                {/* Currency & Tax */}
                <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
                  <div className="text-[10px] text-stone-400 uppercase font-semibold">Pricing & GST</div>
                  <div className="font-semibold text-stone-800 mt-0.5">
                    {selectedCafe.settings?.currency || 'INR'} · Tax {selectedCafe.settings?.taxRate ?? 5}%
                  </div>
                </div>

                {/* Tables & Items */}
                <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
                  <div className="text-[10px] text-stone-400 uppercase font-semibold">Capacity & Catalog</div>
                  <div className="font-semibold text-stone-800 mt-0.5">
                    {selectedCafe.tableCount ?? tables.length ?? 0} Tables · {selectedCafe.productCount ?? 0} Menu Items
                  </div>
                </div>

                {/* Address or Tagline */}
                <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/60 truncate">
                  <div className="text-[10px] text-stone-400 uppercase font-semibold">Location / Tagline</div>
                  <div className="text-stone-700 truncate mt-0.5">
                    {selectedCafe.settings?.address || selectedCafe.settings?.tagline || 'Artisanal Dining Experience'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Simulator Controls & Canvas */}
          <div className="bg-stone-900 rounded-3xl p-4 sm:p-6 border border-stone-800 text-stone-100 shadow-xl space-y-4">
            {/* Viewport & Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-950/80 p-3 rounded-2xl border border-stone-800">
              {/* Device Selector */}
              <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setViewport('mobile');
                    setIsLandscape(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    viewport === 'mobile'
                      ? 'bg-stone-800 text-amber-400 shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Smartphone size={14} />
                  <span>Mobile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setViewport('tablet');
                    setIsLandscape(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    viewport === 'tablet'
                      ? 'bg-stone-800 text-amber-400 shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Tablet size={14} />
                  <span>Tablet</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setViewport('desktop');
                    setIsLandscape(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    viewport === 'desktop'
                      ? 'bg-stone-800 text-amber-400 shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Monitor size={14} />
                  <span>Desktop</span>
                </button>

                {viewport !== 'desktop' && (
                  <button
                    type="button"
                    onClick={() => setIsLandscape((prev) => !prev)}
                    className={`p-1.5 rounded-lg text-xs transition border border-stone-700/60 ${
                      isLandscape ? 'bg-amber-500/20 text-amber-300' : 'text-stone-400 hover:text-stone-200'
                    }`}
                    title="Rotate Device Orientation"
                  >
                    <RotateCw size={13} />
                  </button>
                )}
              </div>

              {/* Table Selector Simulator */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 hidden md:inline">Simulate Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setIframeLoading(true);
                  }}
                  className="bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200 focus:border-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Takeaway / Counter (No Table)</option>
                  {tables.map((t) => (
                    <option key={t.id || t.number} value={t.number}>
                      Table {t.number} ({t.name || `Table ${t.number}`})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={reloadIframe}
                  className="p-2 rounded-xl border border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
                  title="Reload Live User Panel"
                >
                  <RefreshCw size={14} className={iframeLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Page Route Shortcuts */}
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {PAGES.map((pg) => {
                  const Icon = pg.icon;
                  const isActive = activePage === pg.path;
                  return (
                    <button
                      key={pg.path}
                      type="button"
                      onClick={() => {
                        setActivePage(pg.path);
                        setIframeLoading(true);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                      }`}
                    >
                      <Icon size={12} />
                      <span>{pg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current URL Bar */}
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-stone-950/50 rounded-xl border border-stone-800 text-xs font-mono text-stone-400">
              <div className="flex items-center gap-2 truncate">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">{currentPreviewUrl}</span>
              </div>
              <span className="text-[11px] text-stone-500 uppercase tracking-wider shrink-0">
                {viewport} mode ({isLandscape ? 'Landscape' : 'Portrait'})
              </span>
            </div>

            {/* The Embedded Live Workstation Canvas */}
            <div className="min-h-[760px] bg-stone-950 rounded-2xl p-4 sm:p-8 flex items-center justify-center relative overflow-auto border border-stone-800/80">
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/75 z-20 backdrop-blur-xs">
                  <div
                    className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: `${primaryColor} transparent transparent transparent` }}
                  />
                  <p className="mt-3 text-xs text-stone-400 font-medium">
                    Rendering {selectedCafe?.name || 'Café'} User Panel...
                  </p>
                </div>
              )}

              <div
                style={getViewportStyles()}
                className="relative bg-white shadow-2xl overflow-hidden transition-all duration-300"
              >
                {/* Mobile Camera Notch */}
                {viewport === 'mobile' && !isLandscape && (
                  <div className="absolute top-0 inset-x-0 h-6 bg-stone-900 flex items-center justify-center z-30 pointer-events-none">
                    <div className="w-24 h-4 bg-stone-800 rounded-b-xl" />
                  </div>
                )}

                <iframe
                  key={frameKey}
                  src={currentPreviewUrl}
                  title={`${selectedCafe?.name || 'Café'} Customer Web Experience`}
                  className="w-full h-full border-0"
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL CAFES SHOWCASE GALLERY */}
      {activeTab === 'gallery' && (
        <div className="space-y-4">
          {/* Gallery Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-3 text-stone-400" />
              <input
                type="text"
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                placeholder="Search cafés by name, subdomain slug, city..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:border-brew-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 font-medium">Status:</span>
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => setGalleryFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    galleryFilter === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  All ({cafes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryFilter('active')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    galleryFilter === 'active' ? 'bg-white text-emerald-700 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Active ({cafes.filter((c) => c.status === 'active').length})
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryFilter('suspended')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    galleryFilter === 'suspended' ? 'bg-white text-red-700 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Suspended ({cafes.filter((c) => c.status !== 'active').length})
                </button>
              </div>
            </div>
          </div>

          {/* Grid of Cafés */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCafes.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-stone-200">
                <Store size={40} className="mx-auto text-stone-300 mb-3" />
                <h3 className="text-base font-bold text-stone-800">No Cafés Found</h3>
                <p className="text-xs text-stone-500 mt-1">Try adjusting your search or status filter.</p>
              </div>
            ) : (
              filteredCafes.map((c) => {
                const cPrimary =
                  c.branding?.primaryColor || c.settings?.primaryColor || c.primaryColor || '#c96b18';
                const cAccent =
                  c.branding?.secondaryColor || c.settings?.accentColor || c.accentColor || '#1a0f08';
                const directUrl = `${customerBaseUrl}/menu?cafe=${c.slug}`;

                return (
                  <div
                    key={c.id || c.slug}
                    className="flex flex-col bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                  >
                    {/* Color Banner Header */}
                    <div
                      className="h-24 p-4 flex items-center justify-between relative overflow-hidden"
                      style={{ backgroundColor: cPrimary }}
                    >
                      <div className="absolute inset-0 bg-black/15" />
                      <div className="relative z-10 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-espresso-900 font-bold overflow-hidden border border-white/40">
                          {c.settings?.logoUrl || c.logoUrl ? (
                            <img src={c.settings?.logoUrl || c.logoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg" style={{ color: cPrimary }}>
                              {c.name?.charAt(0) || 'C'}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-white text-base leading-tight drop-shadow-xs">
                            {c.name || c.settings?.cafeName}
                          </h3>
                          <span className="font-mono text-[11px] text-white/80">@{c.slug}</span>
                        </div>
                      </div>

                      <span
                        className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.status === 'active'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-red-500 text-white shadow-xs'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        {/* Theme Swatch & Currency */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-stone-400 text-[11px]">Palette:</span>
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-stone-300 shadow-2xs"
                              style={{ backgroundColor: cPrimary }}
                              title={`Primary: ${cPrimary}`}
                            />
                            <span className="font-mono text-[11px] text-stone-600">{cPrimary}</span>
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-stone-300 shadow-2xs ml-1"
                              style={{ backgroundColor: cAccent }}
                              title={`Accent: ${cAccent}`}
                            />
                            <span className="font-mono text-[11px] text-stone-600">{cAccent}</span>
                          </div>

                          <div className="font-semibold text-stone-700 text-[11px]">
                            {c.settings?.currency || 'INR'} · GST {c.settings?.taxRate ?? 5}%
                          </div>
                        </div>

                        {/* Location / Tagline */}
                        <p className="text-xs text-stone-600 line-clamp-2 min-h-[32px]">
                          {c.settings?.tagline ||
                            c.settings?.address ||
                            `Official online user panel and digital ordering storefront for ${c.name}.`}
                        </p>

                        {/* Quick Stats */}
                        <div className="flex items-center justify-between py-2 border-y border-stone-100 text-xs text-stone-600">
                          <div>
                            <span className="font-bold text-stone-900">{c.tableCount ?? 0}</span> Tables
                          </div>
                          <div>
                            <span className="font-bold text-stone-900">{c.productCount ?? 0}</span> Menu Items
                          </div>
                          <div className="capitalize text-stone-500">Plan: {c.plan || 'Starter'}</div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectCafe(c);
                            setActiveTab('simulator');
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-brew-600 hover:bg-brew-500 text-white transition shadow-sm"
                        >
                          <Eye size={13} />
                          <span>Simulate User Panel</span>
                        </button>

                        <a
                          href={directUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition"
                          title="Open live customer website in new tab"
                        >
                          <ExternalLink size={15} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* QR Code Inspection Modal */}
      {showQrModal && selectedCafe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 text-center space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm">{selectedCafe.name} Storefront QR</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col items-center">
              {/* Fallback QR generator using standard API */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                  currentPreviewUrl
                )}`}
                alt={`${selectedCafe.name} QR Code`}
                className="w-48 h-48 rounded-xl bg-white p-2 shadow-xs"
              />
              <p className="text-xs font-mono text-stone-500 mt-3 break-all max-w-xs">{currentPreviewUrl}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 transition"
              >
                Copy Link
              </button>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                  currentPreviewUrl
                )}`}
                download={`${selectedCafe.slug}-qr.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-brew-600 hover:bg-brew-500 text-white transition shadow-sm"
              >
                Download QR
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
