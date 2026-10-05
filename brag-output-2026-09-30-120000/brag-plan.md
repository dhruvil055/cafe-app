# Brewhaus Café — Brag Video Plan

## Project Identity

| Question | Answer |
|---|---|
| **App name** | Brewhaus Café |
| **One-line description** | A full-stack MERN café ordering system with QR-based table ordering, Razorpay payments, and a complete admin panel — all wrapped in a premium coffee-shop aesthetic. |
| **Repository** | C:\cafe-app-main |

## 9-Question Rubric

### 1. What is the app?
**Brewhaus Café** — A production-ready café ordering system where customers scan a table QR code, browse a beautiful menu with search/filter, add items with variants/add-ons, checkout via Razorpay or cash, and track their order live with a downloadable PDF receipt. Admins get a full dashboard: live orders, menu CRUD, category management, and bulk QR table generation.

### 2. What is the funniest or most impressive claim?
> **"Scan → table auto-detected → order delivered to seat"**
>
> The QR-based table ordering is the killer feature — no manual table entry, no waiter needed. Scan, sit, sip. The "Waking up café server, please hold on a moment..." cold-start message is also delightfully honest.

### 3. What is the visual hook?
The **hero video backdrop** (BrewHaus.mp4) with espresso-950 gradient overlay, "Fine Coffee & Dining" tagline in Cormorant Garamond display font, and the live table-connection pill that animates in ("Table 03 connected!"). The warm coffee palette: `brew-500 #d4862a` (golden amber), `espresso-900 #1a0f08` (deep brown), `cream #FAF6F0` (off-white), `foam #F0E8D8` (warm beige).

### 4. What should be shown from the actual UI?
1. **Hero** — Video background + "Scan Table QR to Order" CTA
2. **Menu grid** — MenuCard with image, price in JetBrains Mono, popular badge, quick-add button (lock → plus when table set)
3. **ProductModal** — Variant/add-on selection, quantity stepper
4. **Checkout** — Payment method cards (Razorpay vs Cash), order summary
5. **OrderConfirm** — Live status progress bar (Received → Confirmed → Preparing → Ready → Done), confetti header, PDF receipt download
6. **Admin Dashboard** — Stats cards, live orders table with status badges

### 5. What is the shortest satisfying video?
**20 seconds** — Just enough for:
- Hook (2s): Hero video + QR scan animation
- Reveal (3s): Menu grid with framermotion staggered entrance
- Highlight 1 (4s): Quick-add → cart badge bounce → open cart
- Highlight 2 (4s): Checkout payment toggle → Razorpay modal
- Highlight 3 (4s): OrderConfirm live status progress + confetti
- Outro (3s): Logo + "Brewhaus Café — Scan. Sip. Sorted."

### 6. What tone fits best?
**Preset: `polished`** — This is a serious, production-grade product with premium aesthetics. The warm coffee palette, serif display font, and thoughtful micro-interactions deserve an elegant, premium feel.

**Creative direction:** *"Quiet premium café film — the video equivalent of a perfectly pulled espresso shot."*

### 7. What should the audio feel like?
- **Music:** Warm, jazzy coffee-shop bed — light piano, soft brushes, subtle double bass. Low in mix (~-18dB), fades out on outro.
- **SFX:** Tasteful, motion-matched —
  - QR scan "beep" (soft, not harsh)
  - Card stagger "pop" on menu entrance
  - Cart badge spring bounce
  - Payment toggle click
  - Status progress "tick" sounds
  - Confetti burst whoosh
  - Final logo "thud" (warm, low)
- **Voice:** None (not requested)

### 8. What should the share caption say?
> **Brewhaus Café — where QR ordering meets craft coffee. ☕ Scan. Sip. Sorted.**

### 9. What's the user flow worth showing?
**Entry → Key Action → Result:**
1. **Entry:** Customer scans table QR → lands on `/menu?table=3` → "Table 03 connected!" pill appears
2. **Key Action:** Browse menu → tap item → add-ons modal → quick-add → cart badge bounces → open cart → checkout → choose Razorpay → pay → success
3. **Result:** OrderConfirm page with live status progress bar animating, confetti celebration, PDF receipt download

---

## Beat-by-Beat Storyboard (20s Total)

| Beat | Time | Scene | Visual | Text Overlay | SFX | Transition |
|---|---|---|---|---|---|---|
| **0. Hook** | 0.0–2.0s | Hero video | Full-screen `BrewHaus.mp4` with espresso gradient overlay. "Fine Coffee & Dining" → "Brewhaus Cafe" in Cormorant Garamond. QR scan animation: phone sweeps in, scans, "Table 03 connected!" pill slides up. | "Scan. Sip. Sorted." (appears at 1.5s, holds) | QR beep (0.8s), warm piano chord (1.5s) | Hard cut to menu |
| **1. Reveal** | 2.0–5.0s | Menu grid | 8 MenuCards stagger in (framer-motion `layout` + `initial/animate`). Popular badge pulses. Category chips scroll. Search bar types "latte" → filters. | "Your menu, your way" (2.5s, holds 2s) | Stagger pops (8×, 0.1s apart), keyboard taps | Cross-dissolve |
| **2. Highlight 1: Add to Cart** | 5.0–9.0s | ProductModal → Cart | Tap card → ProductModal slides up (variants, add-ons, qty stepper). Tap "+" → quick-add. Cart badge springs from 0→1 (spring: stiffness 500, damping 25). Tap cart button → QuickCartDrawer slides from bottom. | "Add-ons? Variants? Done." (5.5s, holds 2s) | Modal whoosh, stepper clicks, badge spring, drawer slide | Match cut on cart icon |
| **3. Highlight 2: Checkout** | 9.0–13.0s | Checkout page | Payment method cards: Razorpay (CreditCard icon) vs Cash (Banknote). Tap Razorpay → card highlights (espresso-900 bg, cream text). Order summary with JetBrains Mono prices. "Pay ₹247" button press. | "Pay your way" (9.5s, holds 2s) | Card select thunk, price counter tick | Match cut on payment |
| **4. Highlight 3: Live Status** | 13.0–17.0s | OrderConfirm | Confetti header (emojis floating). Green check circle spring-in. Status progress bar: 5 segments fill left→right with "tick" each. "Ready to Serve!" badge. PDF receipt download button. | "Live tracking. Real receipts." (13.5s, holds 2s) | Confetti whoosh, 5× progress ticks, download click | Cross-dissolve |
| **5. Outro** | 17.0–20.0s | Logo lockup | Cream background. Brewhaus logo (☕ in espresso circle). "Brewhaus Café" in Cormorant Garamond. "Scan. Sip. Sorted." in Manrope. URL: `brewhaus.cafe` (fictional). Fade to black. | — | Final warm piano chord + low logo thud | Fade to black |

---

## Visual Identity (for composition brief)

### Colors
- **Background:** `cream` #FAF6F0
- **Surface:** `white` #FFFFFF, `foam` #F0E8D8
- **Primary/Brand:** `brew-500` #d4862a (golden amber)
- **Primary Dark:** `brew-600` #b96a20
- **Text Primary:** `espresso-900` #1a0f08
- **Text Muted:** `espresso-400` #a37445
- **Accent Green:** `green-500` #22c55e (table connected)
- **Accent Amber:** `amber-500` #f59e0b (scan QR)
- **Error:** `red-500` #ef4444

### Typography
- **Display:** `Cormorant Garamond` (wght 600, 700) — headings, hero, logo
- **Body:** `Manrope` (wght 400, 500, 600, 700) — UI, buttons, body
- **Mono:** `JetBrains Mono` (wght 600) — prices, order numbers, totals

### Key Visual Assets
- `/client/public/BrewHaus.mp4` — hero background video
- `/client/public/images/hero-poster.webp` — hero poster frame
- Menu item images from Unsplash (auto-optimized)
- Lucide icons: ShoppingCart, ScanLine, Search, Leaf, Star, CreditCard, Banknote, CheckCircle2, Download, UtensilsCrossed, Clock, Loader2

---

## Composition Brief (for Hyperframes)

### Format
- **Aspect:** Landscape (1920×1080)
- **Duration:** 20 seconds
- **FPS:** 30

### Audio
- **Music:** Select from bundled tracks — prefer `happy-beats-business-moves-vol-1` or similar warm/jazzy
- **SFX:** As specified in beat table
- **Voice:** None

### Scenes (Hyperframes clips)
Each beat = one clip on its own track, sequential with cross-dissolves where noted.

### Validation Gates
- `npx hyperframes check` passes (zero errors)
- Render produces `brag.mp4` + `brag.jpg` (best frame)
- `share-copy.txt` written

---

## Next Steps
1. Read `references/step-3-compose.md` and `references/audio.md`
2. Write composition brief → `<output-dir>/composition/`
3. Run `npx hyperframes check`
4. Render → `brag.mp4`
5. Pick poster frame → `brag.jpg`
6. Write `share-copy.txt`