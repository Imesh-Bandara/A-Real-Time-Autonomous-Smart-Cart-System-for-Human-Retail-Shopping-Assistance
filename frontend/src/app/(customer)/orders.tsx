import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchOrders, Order } from '../../api/apiService';
import { theme } from '../../theme/theme';
import { Button } from '../../components/ui/Button';
import { ORDER_POLL_INTERVAL_MS } from '../../hooks/useOrderPolling';
import { alertOrderStatusOnce } from '../../services/orderAlerts';
import {
  getShoppingState,
  getShoppingStateLabel,
  isReadyForPickup,
  isShoppingFinished,
  parseServerDate,
  READY_FOR_PICKUP_LABEL,
} from '../../utils/orderFormat';

// Orders older than this are not polled even if the cart never reported back
const ACTIVE_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

const isActiveOrder = (order: Order) => {
  if (isShoppingFinished(getShoppingState(order))) return false;
  const created = parseServerDate(order.created_at);
  return !!created && Date.now() - created.getTime() < ACTIVE_ORDER_WINDOW_MS;
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const activeIdsRef = useRef<Set<number>>(new Set()); // orders seen active while polling
  const router = useRouter();

  // Load on focus; while an active order exists, re-fetch every 5 s until it finishes
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const tick = async () => {
        let keepPolling = false;
        try {
          const data = await fetchOrders();
          if (cancelled) return;
          setOrders(data);
          setError(null);
          data.forEach((order) => {
            if (isActiveOrder(order)) {
              activeIdsRef.current.add(order.id);
              keepPolling = true;
            } else if (activeIdsRef.current.has(order.id) && isShoppingFinished(getShoppingState(order))) {
              activeIdsRef.current.delete(order.id);
              alertOrderStatusOnce(order);
            }
          });
        } catch (err) {
          if (cancelled) return;
          setError(typeof err === 'string' ? err : 'Could not load your orders.');
          keepPolling = activeIdsRef.current.size > 0;
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
    }, [reloadKey])
  );

  const retry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>My Orders</Text>
        {loading && orders.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : error && orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>Could not load orders</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Button title="Try Again" onPress={retry} style={{ marginTop: theme.spacing.lg }} />
          </View>
        ) : orders.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {!!error && <Text style={styles.inlineError}>Connection issue: {error}</Text>}
            {orders.map((order) => (
              <TouchableOpacity 
                key={order.id} 
                style={styles.orderCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/(customer)/order-status?id=${order.id}`)}
              >
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>Order #{order.id}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: order.status === 'completed' ? theme.colors.successBackground : theme.colors.infoBackground }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: order.status === 'completed' ? theme.colors.success : theme.colors.info }
                    ]}>
                      {order.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderFooter}>
                  <Text style={styles.itemCount}>{order.item_count} items</Text>
                  <Text style={styles.orderTotal}>${order.total_amount.toFixed(2)}</Text>
                </View>
                {isReadyForPickup(order) ? (
                  <View style={styles.liveRow}>
                    <Ionicons name="bag-check" size={18} color={theme.colors.success} />
                    <Text style={[styles.liveText, styles.readyText]}>{READY_FOR_PICKUP_LABEL}</Text>
                  </View>
                ) : isActiveOrder(order) && (
                  <View style={styles.liveRow}>
                    <ActivityIndicator size="small" color={theme.colors.info} />
                    <Text style={styles.liveText}>{getShoppingStateLabel(getShoppingState(order))}</Text>
                  </View>
                )}
                {order.payment_status !== undefined && (
                  <View style={styles.actionRow}>
                    {order.payment_status === 'paid' ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, isReadyForPickup(order) && styles.actionBtnReady]}
                        onPress={() =>
                          router.push({ pathname: '/(customer)/order-confirmation', params: { id: String(order.id) } })
                        }
                      >
                        <Ionicons
                          name="key-outline"
                          size={16}
                          color={isReadyForPickup(order) ? '#FFFFFF' : theme.colors.primary}
                        />
                        <Text style={[styles.actionBtnText, isReadyForPickup(order) && { color: '#FFFFFF' }]}>
                          Pickup & OTP
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnPrimary]}
                        onPress={() =>
                          router.push({ pathname: '/(customer)/payment', params: { id: String(order.id) } })
                        }
                      >
                        <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Make Payment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>When you place an order, it will appear here.</Text>
            <Button
              title="Start Shopping"
              onPress={() => router.push('/(customer)/shop')}
              style={{ marginTop: theme.spacing.lg }}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, padding: theme.spacing.lg },
  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  orderCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  orderId: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  orderDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  statusText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semiBold,
    textTransform: 'capitalize',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  itemCount: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  orderTotal: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  center: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 120, // clear the floating tab bar
  },
  inlineError: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
  },
  liveText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.info,
    fontWeight: theme.typography.weights.semiBold,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  actionBtnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  actionBtnReady: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  readyText: {
    color: theme.colors.success,
    fontWeight: theme.typography.weights.bold,
  },
  actionBtnText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
});
