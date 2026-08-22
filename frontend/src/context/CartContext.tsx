/**
 * CartContext.tsx — Global cart state for Smart Cart app
 *
 * Provides cart state to all screens via React Context.
 * No external state library needed.
 *
 * Features:
 *   - Add/remove/update products
 *   - Stock validation on add & update
 *   - Computed totals (item count, subtotal)
 *   - Clear cart after order submission
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Product } from '../api/apiService';

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

interface CartContextType {
  cartItems: CartItem[];
  cartItemCount: number;       // Total quantity across all items
  cartTotal: number;           // Sum of all subtotals
  uniqueItemCount: number;     // Number of distinct products
  addToCart: (product: Product) => string | null;   // returns error or null
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => string | null;
  clearCart: () => void;
  getItemQuantity: (productId: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = useCallback((product: Product): string | null => {
    const existing = cartItems.find((i) => i.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = currentQty + 1;

    if (newQty > product.stock) {
      return product.stock === 0
        ? `${product.name} is out of stock`
        : `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} of ${product.name} available`;
    }

    setCartItems((prev) => {
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newQty, subtotal: parseFloat((product.price * newQty).toFixed(2)) }
            : item
        );
      }
      return [
        ...prev,
        { product, quantity: 1, subtotal: parseFloat(product.price.toFixed(2)) },
      ];
    });
    return null;
  }, [cartItems]);

  const removeFromCart = useCallback((productId: number) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number): string | null => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return null;
    }
    const item = cartItems.find((i) => i.product.id === productId);
    if (!item) return 'Item not found in cart';

    if (quantity > item.product.stock) {
      return `Only ${item.product.stock} unit${item.product.stock === 1 ? '' : 's'} of ${item.product.name} available`;
    }

    setCartItems((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? {
              ...i,
              quantity,
              subtotal: parseFloat((i.product.price * quantity).toFixed(2)),
            }
          : i
      )
    );
    return null;
  }, [cartItems, removeFromCart]);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const getItemQuantity = useCallback((productId: number): number => {
    return cartItems.find((i) => i.product.id === productId)?.quantity ?? 0;
  }, [cartItems]);

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = parseFloat(cartItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const uniqueItemCount = cartItems.length;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartItemCount,
        cartTotal,
        uniqueItemCount,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
