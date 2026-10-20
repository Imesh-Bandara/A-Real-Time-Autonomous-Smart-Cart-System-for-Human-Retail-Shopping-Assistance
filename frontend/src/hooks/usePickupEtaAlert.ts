/**
 * usePickupEtaAlert.ts — Alerts the customer when the estimated pickup time is over.
 *  - Schedules a local notification for order.pickup_eta (works while the app is closed).
 *  - While the screen is open, shows an in-app alert when the time passes (or right away
 *    if it already passed), once per order, unless shopping already finished.
 */
import { useEffect, useRef } from 'react';
import { Order } from '../api/apiService';
import { alertPickupTimePassedOnce, schedulePickupReminder } from '../services/orderAlerts';
import { getShoppingState, parseServerDate } from '../utils/orderFormat';

export function usePickupEtaAlert(order: Order | null) {
  const latestOrder = useRef<Order | null>(order);
  latestOrder.current = order;

  const orderId = order?.id;
  const eta = order?.pickup_eta ?? null;
  const isPaid = order?.payment_status === 'paid';
  const state = order ? getShoppingState(order) : null;

  // Keep the scheduled notification in sync (cancelled once shopping finishes)
  useEffect(() => {
    if (order) schedulePickupReminder(order);
  }, [orderId, eta, isPaid, state]);

  // In-app alert when the estimate passes while this screen is mounted
  useEffect(() => {
    const etaDate = parseServerDate(eta);
    if (!orderId || !isPaid || !etaDate) return undefined;
    const fire = () => {
      if (latestOrder.current) alertPickupTimePassedOnce(latestOrder.current);
    };
    const delay = etaDate.getTime() - Date.now();
    if (delay <= 0) {
      fire();
      return undefined;
    }
    const timer = setTimeout(fire, delay + 1000);
    return () => clearTimeout(timer);
  }, [orderId, eta, isPaid]);
}
