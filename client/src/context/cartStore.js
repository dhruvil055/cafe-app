import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      tableNumber: null,
      diningSessionToken: null,
      sessionExpired: false,
      isQuickCartOpen: false,
      lastAddedItemKey: null,
      isScannerOpen: false,

      setTable: (num) => set({ tableNumber: Number(num) }),

      setDiningSession: (token) => set({
        diningSessionToken: token || null,
        // Receiving a fresh token clears the expired state
        sessionExpired: false,
      }),

      setSessionExpired: (flag) => set({ sessionExpired: Boolean(flag) }),

      /**
       * Invalidates the session (e.g. on expiry detected from backend).
       * Clears the token and marks expired, but keeps cart items so the user
       * can re-scan and continue without re-adding everything.
       */
      invalidateSession: () => set({
        diningSessionToken: null,
        sessionExpired: true,
      }),

      openQuickCart: () => set({ isQuickCartOpen: true }),
      closeQuickCart: () => set({ isQuickCartOpen: false }),
      toggleQuickCart: () => set((state) => ({ isQuickCartOpen: !state.isQuickCartOpen })),
      openScanner: () => set({ isScannerOpen: true }),
      closeScanner: () => set({ isScannerOpen: false }),

      addItem: (product, quantity = 1, addons = [], variant = null, specialInstructions = '') => {
        const { items, tableNumber, diningSessionToken, sessionExpired } = get();

        // Enforce table QR scan requirement before adding to cart
        if (!tableNumber || !diningSessionToken || sessionExpired) {
          set({ isScannerOpen: true });
          return false;
        }

        const key = `${product._id}-${JSON.stringify(addons)}-${variant?.name || ''}`;

        const basePrice = variant ? variant.price : product.price;
        const addonTotal = addons.reduce((s, a) => s + a.price, 0);
        const unitPrice = basePrice + addonTotal;

        const existing = items.find(i => i.key === key);
        if (existing) {
          set({
            isQuickCartOpen: true,
            lastAddedItemKey: key,
            items: items.map(i =>
              i.key === key
                ? { ...i, quantity: i.quantity + quantity, itemTotal: (i.quantity + quantity) * unitPrice }
                : i
            )
          });
        } else {
          set({
            isQuickCartOpen: true,
            lastAddedItemKey: key,
            items: [...items, {
              key,
              product: product._id,
              name: product.name,
              price: unitPrice,
              image: product.image,
              quantity,
              addons,
              variant,
              specialInstructions,
              itemTotal: unitPrice * quantity,
            }]
          });
        }
        return true;
      },

      removeItem: (key) =>
        set({ items: get().items.filter(i => i.key !== key) }),

      updateQuantity: (key, qty) => {
        if (qty <= 0) {
          set({ items: get().items.filter(i => i.key !== key) });
          return;
        }
        set({
          items: get().items.map(i =>
            i.key === key ? { ...i, quantity: qty, itemTotal: qty * i.price } : i
          )
        });
      },

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'brewhaus-cart',
      partialize: (state) => ({
        items: state.items,
        tableNumber: state.tableNumber,
        diningSessionToken: state.diningSessionToken,
        // sessionExpired is NOT persisted — always recheck on fresh load
      }),
    }
  )
);

/**
 * Reactive item count selector — use this in components for always-correct count.
 * Usage: const count = useCartStore(cartItemCount);
 */
export const cartItemCount = (state) =>
  state.items.reduce((s, i) => s + i.quantity, 0);

/**
 * Reactive subtotal selector
 * Usage: const sub = useCartStore(cartSubtotal);
 */
export const cartSubtotal = (state) =>
  state.items.reduce((s, i) => s + i.itemTotal, 0);


export default useCartStore;
