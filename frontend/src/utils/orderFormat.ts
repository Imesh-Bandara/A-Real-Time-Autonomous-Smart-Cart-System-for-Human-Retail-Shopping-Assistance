/**
 * orderFormat.ts — Display helpers for orders, pickup times, carts and OTPs
 */

import type { Order, ShoppingState } from '../api/apiService';

// Cart progress comes from order.shopping_state (order.status is not changed by the cart)
export const SHOPPING_STATE_LABELS: Record<ShoppingState, string> = {
  waiting: 'Waiting for your cart to start',
  picking: 'Shopping in progress',
  completed: 'Ready for pickup',
  needs_attention: 'Needs attention',
};

// States after which polling stops
export const FINAL_SHOPPING_STATES: ShoppingState[] = ['completed', 'needs_attention'];

export const getShoppingState = (order: Pick<Order, 'shopping_state'>): ShoppingState =>
  order.shopping_state ?? 'waiting';

export const isShoppingFinished = (state?: ShoppingState | null) =>
  !!state && FINAL_SHOPPING_STATES.includes(state);

export const getShoppingStateLabel = (state?: ShoppingState | null) =>
  (state && SHOPPING_STATE_LABELS[state]) || 'Processing';

export const READY_FOR_PICKUP_LABEL = 'Your order is ready to pick up';

/**
 * Ready for pickup when the cart reported 'completed', or when a paid order's estimated
 * pickup time has passed (and the cart has not flagged a problem).
 */
export const isReadyForPickup = (order: Pick<Order, 'shopping_state' | 'payment_status' | 'pickup_eta'>) => {
  const state = getShoppingState(order);
  if (state === 'completed') return true;
  if (state === 'needs_attention' || order.payment_status !== 'paid') return false;
  const eta = parseServerDate(order.pickup_eta);
  return !!eta && eta.getTime() <= Date.now();
};

/** Parses backend timestamps. Older fields have no timezone suffix but are stored in UTC. */
export const parseServerDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (value?: string | null): string => {
  const date = parseServerDate(value);
  if (!date) return '—';
  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatTime = (value?: string | null): string => {
  const date = parseServerDate(value);
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/** 'CART_01' -> 'Cart 01' */
export const formatCartLabel = (cartId?: string | null): string => {
  if (!cartId) return 'Cart';
  const match = /^CART[_-]?(.+)$/i.exec(cartId.trim());
  return match ? `Cart ${match[1]}` : cartId;
};

/** '123456' -> '123 456' */
export const formatOtp = (otp: string): string =>
  otp.length === 6 ? `${otp.slice(0, 3)} ${otp.slice(3)}` : otp;

/** 'ORD_0002' -> 2, 2 -> 2 */
export const parseOrderNumber = (value?: string | number | null): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const digits = value.replace(/^ORD_/i, '');
  const parsed = parseInt(digits, 10);
  return isNaN(parsed) ? null : parsed;
};
