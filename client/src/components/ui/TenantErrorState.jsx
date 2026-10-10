import React from 'react';
import { Coffee, AlertTriangle, RefreshCw, QrCode } from 'lucide-react';

export function TenantNotFoundScreen({ message }) {
  return (
    <main
      id="tenant-not-found-screen"
      role="main"
      className="flex min-h-screen flex-col items-center justify-center bg-radial from-[#22120a] to-[#0e0704] px-6 text-center text-[#FAF6F0]"
    >
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#d4862a]/30 bg-gradient-to-b from-[#d4862a]/20 to-transparent shadow-2xl backdrop-blur-md">
        <Coffee className="h-10 w-10 text-[#d4862a]" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/95 text-xs font-bold text-white shadow-md">
          ?
        </span>
      </div>

      <p className="font-mono text-xs uppercase tracking-widest text-brew-400 font-semibold">404 Not Found</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#FAF6F0] sm:text-4xl">
        Café Not Found
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-300">
        {message || 'We could not find any active café registered at this web address. Please scan your café table QR code or ask café staff for their ordering link.'}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-cream backdrop-blur-sm transition hover:bg-white/20 active:scale-95 shadow-md"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    </main>
  );
}

export function TenantSuspendedScreen({ message }) {
  return (
    <main
      id="tenant-suspended-screen"
      role="main"
      className="flex min-h-screen flex-col items-center justify-center bg-radial from-[#22120a] to-[#0e0704] px-6 text-center text-[#FAF6F0]"
    >
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/20 to-transparent shadow-2xl backdrop-blur-md">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
      </div>

      <p className="font-mono text-xs uppercase tracking-widest text-amber-400 font-semibold">Account Inactive</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#FAF6F0] sm:text-4xl">
        Ordering Temporarily Paused
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-300">
        {message || 'Online table ordering for this café is temporarily paused. Please place your order directly with the counter or wait staff.'}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-cream backdrop-blur-sm transition hover:bg-white/20 active:scale-95 shadow-md"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Check Again</span>
        </button>
      </div>
    </main>
  );
}
