/**
 * useOrderPolling.ts — Loads an order and re-fetches it every few seconds while the screen
 * is focused. Stops when shopping_state is completed / needs_attention or the screen loses focus.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchOrder, fetchOrderEvents, Order, OrderEvent } from '../api/apiService';
import { getShoppingState, isShoppingFinished } from '../utils/orderFormat';

export const ORDER_POLL_INTERVAL_MS = 5000;

interface Options {
  poll?: boolean;          // false = load once on focus, no interval
  withEvents?: boolean;    // also load GET /api/orders/<id>/events
}

export function useOrderPolling(orderId: number | null, { poll = true, withEvents = false }: Options = {}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadedIdRef = useRef<number | null>(null);

  // Tab screens stay mounted: reset when navigated to a different order
  useEffect(() => {
    if (loadedIdRef.current !== orderId) {
      loadedIdRef.current = orderId;
      setOrder(null);
      setEvents([]);
      setError(null);
      setLoading(true);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      if (!orderId) {
        setLoading(false);
        return undefined;
      }
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const tick = async () => {
        let keepPolling = poll;
        try {
          const data = await fetchOrder(orderId);
          if (cancelled) return;
          setOrder(data);
          setError(null);
          if (withEvents) {
            fetchOrderEvents(orderId)
              .then((list) => !cancelled && setEvents(list))
              .catch(() => undefined); // progress list is optional
          }
          if (isShoppingFinished(getShoppingState(data))) keepPolling = false;
        } catch (err) {
          if (cancelled) return;
          setError(typeof err === 'string' ? err : 'Could not load order details.');
        } finally {
          if (!cancelled) setLoading(false);
        }
        if (!cancelled && keepPolling) timer = setTimeout(tick, ORDER_POLL_INTERVAL_MS);
      };

      tick();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, [orderId, poll, withEvents, reloadKey])
  );

  const reload = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  return { order, events, loading, error, reload, setOrder };
}
