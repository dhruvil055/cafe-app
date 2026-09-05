import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      tableNumber: null,
      diningSessionToken: null,

      setTable: (num) => set({ tableNumber: Number(num) }),
      setDiningSession: (token) => set({ diningSessionToken: token || null }),

      addItem: (product, quantity = 1, addons = [], variant = null, specialInstructions = '') => {
        const { items } = get();
        const key = `${product._id}-${JSON.stringify(addons)}-${variant?.name || ''}`;

        const basePrice = variant ? variant.price : product.price;
        const addonTotal = addons.reduce((s, a) => s + a.price, 0);
        const unitPrice = basePrice + addonTotal;

        const existing = items.find(i => i.key === key);
        if (existing) {
          set({
            items: items.map(i =>
              i.key === key
                ? { ...i, quantity: i.quantity + quantity, itemTotal: (i.quantity + quantity) * unitPrice }
                : i
            )
          });
        } else {
          set({
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

      get subtotal() {
        return get().items.reduce((s, i) => s + i.itemTotal, 0);
      },

      get tax() {
        return Math.round(get().items.reduce((s, i) => s + i.itemTotal, 0) * 0.05);
      },

      get total() {
        const sub = get().items.reduce((s, i) => s + i.itemTotal, 0);
        return sub + Math.round(sub * 0.05);
      },

      get itemCount() {
        return get().items.reduce((s, i) => s + i.quantity, 0);
      },
    }),
    {
      name: 'brewhaus-cart',
      partialize: (state) => ({ items: state.items, tableNumber: state.tableNumber, diningSessionToken: state.diningSessionToken }),
    }
  )
);

export default useCartStore;
