# Hyperframes Composition Brief: Brewhaus Café

## Objective
Create a short launch-style brag video for Brewhaus Café — a premium café ordering system with QR-based table ordering, live order tracking, and a complete admin panel.

## Output
- Composition directory: `brag-output-2026-09-30-120000/composition/`
- Rendered video: `brag-output-2026-09-30-120000/brag.mp4`
- Format: Landscape — 1920×1080
- Duration: 20 seconds

## Source Material
- Project root: `C:\cafe-app-main`
- Primary files read: `client/index.html`, `client/src/index.css`, `client/tailwind.config.js`, `client/src/App.jsx`, `client/src/pages/customer/MenuPage.jsx`, `client/src/pages/customer/CheckoutPage.jsx`, `client/src/pages/customer/OrderConfirmPage.jsx`, `README.md`
- Product name: Brewhaus Café
- Tagline / strongest claim: "Scan → table auto-detected → order delivered to seat"
- Key UI or visual moment to recreate: Hero video backdrop with QR scan CTA → Menu grid with framermotion stagger → ProductModal with variants/add-ons → Checkout payment toggle → OrderConfirm live status progress bar with confetti
- Copy that must appear verbatim:
  - "Fine Coffee & Dining"
  - "Brewhaus Cafe"
  - "Scan. Sip. Sorted."
  - "Table 03 connected!"
  - "Your menu, your way"
  - "Add-ons? Variants? Done."
  - "Pay your way"
  - "Live tracking. Real receipts."

## Creative Direction
- Tone preset: `polished`
- Creative direction: "Quiet premium café film — the video equivalent of a perfectly pulled espresso shot."
- Interpretation: Elegant, restrained, premium. Slow enough to read every line. Warm color palette throughout. No flashy effects — only thoughtful micro-interactions that mirror the real product. Music bed low and jazzy. SFX minimal, warm, organic (wood, glass, soft drops).
- Angle: A customer walks into Brewhaus, scans their table QR, and the rest is pure craft — browsing, customizing, paying, tracking. Every interaction feels intentional. The video doesn't shout; it invites.
- Hook: Hero video (BrewHaus.mp4) with espresso gradient overlay, "Fine Coffee & Dining" → "Brewhaus Cafe" in Cormorant Garamond. Phone sweeps in, scans QR, "Table 03 connected!" pill slides up.
- Outro / punchline: Logo lockup (☕ in espresso circle) + "Brewhaus Café" in Cormorant Garamond + "Scan. Sip. Sorted." in Manrope. Fade to black.
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract filler visuals (geometric shapes, particle systems)
  - Unrelated visual redesign (the video must look like the actual app)

## Visual Identity
- Background: `cream` #FAF6F0
- Surface: `white` #FFFFFF, `foam` #F0E8D8
- Primary/Brand: `brew-500` #d4862a (golden amber)
- Primary Dark: `brew-600` #b96a20
- Text Primary: `espresso-900` #1a0f08
- Text Muted: `espresso-400` #a37445
- Accent Green: `green-500` #22c55e (table connected)
- Accent Amber: `amber-500` #f59e0b (scan QR)
- Error: `red-500` #ef4444
- Display font: `Cormorant Garamond` (wght 600, 700) — headings, hero, logo
- Body font: `Manrope` (wght 400, 500, 600, 700) — UI, buttons, body
- Mono font: `JetBrains Mono` (wght 600) — prices, order numbers, totals
- Visual references from the project:
  - `/client/public/BrewHaus.mp4` — hero background video
  - `/client/public/images/hero-poster.webp` — hero poster frame
  - MenuCard component (image, price in JetBrains Mono, popular badge, quick-add button)
  - ProductModal (variant/add-on selection, quantity stepper)
  - Checkout payment method cards (Razorpay vs Cash)
  - OrderConfirm confetti header, status progress bar, PDF download
  - Lucide icons: ShoppingCart, ScanLine, Search, Leaf, Star, CreditCard, Banknote, CheckCircle2, Download, UtensilsCrossed, Clock, Loader2

## Storyboard
Use the storyboard in `brag-output-2026-09-30-120000/brag-plan.md` as the creative contract.

Scene summary:
1. **Hook** — 2.0s — Hero video + QR scan animation + "Table 03 connected!" pill + "Scan. Sip. Sorted."
2. **Reveal** — 3.0s — Menu grid stagger entrance (8 cards), category chips, search filter
3. **Highlight 1: Add to Cart** — 4.0s — ProductModal slide up, variant/add-on selection, quick-add, cart badge spring, QuickCartDrawer slide
4. **Highlight 2: Checkout** — 4.0s — Payment method cards toggle (Razorpay highlight), order summary, pay button
5. **Highlight 3: Live Status** — 4.0s — Confetti header, check circle spring, status progress bar (5 segments fill), receipt download
6. **Outro** — 3.0s — Logo lockup, "Brewhaus Café", "Scan. Sip. Sorted.", fade to black

## Audio
- Audio role: Warm bed — subtle, jazzy coffee-shop atmosphere
- Audio arc: Music fades in on hook (0.0s), holds steady through highlights, begins fade at 17.0s, ends at 20.0s. SFX punctuate key interactions.
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (1:58, steady and clean — best for `polished` tone)
- Music treatment: Volume 0.18 (low, per `polished` tone guidance). Fade in 0.5s at start. Fade out 2.0s starting at 17.0s. Duck to 0.12 under any major reveal if needed.
- Music cue guidance: Use bundled preset at `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`. Major reveals (hook at 0.0s, order confirm at 13.0s, logo at 17.0s) may shift toward nearest strong cues within ±0.15s. Sequential card entrances (menu grid at 2.0s) may snap to consecutive beats within ±0.10s.
- Audio-reactive treatment: Subtle; use music RMS/bass to make the hero video overlay warmth and the menu card presence breathe. No waveform/equalizer visuals. No strobing.
- Audio-coupled moments:
  - Hook (0.0s) — Hero video + text reveal (beat-locked to strong cue)
  - Reveal (2.0s) — Menu card stagger (beat-grid: snap to consecutive beats)
  - Highlight 1 (5.0s) — Modal slide + cart badge spring (SFX: card-place + drop)
  - Highlight 2 (9.0s) — Payment card select (SFX: switch/click)
  - Highlight 3 (13.0s) — Confetti + progress ticks (SFX: chips-collide + glass clink)
  - Outro (17.0s) — Logo thud (SFX: impactSoft_medium)
- SFX selection guidance:
  - Polished tone → 2-3 very subtle SFX (per tone → SFX energy table)
  - Prefer low/medium HF risk files: `interface/drop_001.ogg` for gentle reveals, `casino/card-place-1.ogg` for card-like entrances, `impact/impactGlass_light_001.ogg` for delicate progress ticks, `impact/impactSoft_medium_000.ogg` for logo thud
  - SFX volume: 0.65 (polished)
- SFX analysis guidance: `skills/brag/assets/sfx/sfx-analysis.md` (use lower high-frequency-risk sounds)
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: Copy chosen music and any Hyperframes-selected SFX into `brag-output-2026-09-30-120000/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s. Use only 1-3 strong cue locks in a 15-25s video unless the edit clearly benefits from more.
- Use SFX to support motion and interaction: card sounds for card-like reveals, short announcement cues for major payoffs, key/click sounds for text or user actions, and restraint when the edit is already busy.
- Honor planned music treatment such as fade-outs, ducking, beat-aligned reveals, or letting a final SFX ring over the music, using the best Hyperframes-supported implementation.
- When music is present and the treatment is not `none`, consider Hyperframes audio-reactive workflow: extract audio data and use RMS/frequency bands for subtle, brand-specific motion. Good targets are glow, depth, background warmth, card presence, title emphasis, or other existing visual elements. Avoid waveform/equalizer visuals, musical-note graphics, generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.