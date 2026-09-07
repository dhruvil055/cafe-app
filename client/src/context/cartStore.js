import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      tableNumber: null,
      isQuickCartOpen: false,
      lastAddedItemKey: null,

      setTable: (num) => set({ tableNumber: Number(num) }),

      isScannerOpen: false,
      openScanner: () => set({ isScannerOpen: true }),
      closeScanner: () => set({ isScannerOpen: false }),

      openQuickCart: () => set({ isQuickCartOpen: true }),
      closeQuickCart: () => set({ isQuickCartOpen: false }),
      toggleQuickCart: () => set((state) => ({ isQuickCartOpen: !state.isQuickCartOpen })),

      addItem: (product, quantity = 1, addons = [], variant = null, specialInstructions = '') => {
        const { items, tableNumber } = get();

        // Require scanning table QR before adding any item to cart
        if (!tableNumber) {
          get().openScanner();
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

      clearCart: () => set({ items: [], tableNumber: null }),
      resetTable: () => set({ tableNumber: null }),
    }),
    {
      name: 'brewhaus-cart',
      partialize: (state) => ({
        items: state.items,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        items: Array.isArray(persistedState?.items) ? persistedState.items : [],
        tableNumber: null, // Never automatically restore tableNumber on initial site load/run
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
