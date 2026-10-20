import React, { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { Button } from '../../components/ui/Button';
import { PickupOtpCard } from '../../components/order/PickupOtpCard';
import { PickupDetailsCard } from '../../components/order/PickupDetailsCard';
import { useOrderPolling } from '../../hooks/useOrderPolling';
import { usePickupEtaAlert } from '../../hooks/usePickupEtaAlert';
import { alertOrderStatusOnce } from '../../services/orderAlerts';
import {
  formatTime,
  getShoppingState,
  getShoppingStateLabel,
  isShoppingFinished,
  parseOrderNumber,
} from '../../utils/orderFormat';

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  completed: { fg: theme.colors.success, bg: theme.colors.successBackground },
  needs_attention: { fg: theme.colors.error, bg: theme.colors.errorBackground },
  picking: { fg: theme.colors.warning, bg: theme.colors.warningBackground },
};
const DEFAULT_STATUS_COLOR = { fg: theme.colors.info, bg: theme.colors.infoBackground };

const EVENT_LABELS: Record<string, string> = {
  payment_received: 'Payment received',
  order_received: 'Cart received your order',
  picking: 'Picking',
  picked: 'Picked',
  pick_failed: 'Could not pick',
  unknown_item: 'Unknown item detected',
  order_done: 'Cart finished shopping',
  order_failed: 'Cart could not finish',
  completed: 'Ready for pickup',
  needs_attention: 'Needs attention',
  waiting: 'Waiting for cart',
  otp_verified: 'OTP verified at cart',
  otp_locked: 'OTP locked',
};

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = parseOrderNumber(id ?? null);
  const { order, events, loading, error, reload } = useOrderPolling(orderId, { withEvents: true });
  usePickupEtaAlert(order);

  const goHome = useCallback(() => router.replace('/(customer)'), [router]);
  const goToPayment = useCallback(() => {
    if (orderId) router.replace({ pathname: '/(customer)/payment', params: { id: String(orderId) } });
  }, [orderId, router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome])
  );

  // "Shopping finished" / "needs attention" alert, once per order
  const shoppingState = order ? getShoppingState(order) : null;
  useEffect(() => {
    if (order && isShoppingFinished(shoppingState)) {
      alertOrderStatusOnce(order);
    }
  }, [order?.id, shoppingState]);

  const header = (
    <View style={styles.header}>
      <View style={styles.headerBtn} />
      <Text style={styles.headerTitle}>Order Confirmation</Text>
      <TouchableOpacity onPress={goHome} style={styles.headerBtn} accessibilityLabel="Close">
        <Ionicons name="close" size={26} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );

  if (loading && !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!orderId || !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.stateTitle}>{orderId ? 'Could not load this order' : 'No order selected'}</Text>
          {!!error && <Text style={styles.stateText}>{error}</Text>}
          {!!orderId && <Button title="Try Again" onPress={reload} style={styles.stateBtn} />}
          <Button title="Back to Home" variant="outline" onPress={goHome} style={styles.stateBtn} />
        </View>
      </SafeAreaView>
    );
  }

  const isPaid = order.payment_status === 'paid';
  const state = getShoppingState(order);
  const isFinal = isShoppingFinished(state);
  const statusColor = STATUS_COLORS[state] ?? DEFAULT_STATUS_COLOR;
  const orderCode = order.order_code || `ORD_${String(order.id).padStart(4, '0')}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success */}
        <View style={styles.heroCard}>
          <Ionicons
            name={isPaid ? 'checkmark-circle' : 'time-outline'}
            size={56}
            color={isPaid ? theme.colors.success : theme.colors.warning}
          />
          <Text style={styles.heroTitle}>{isPaid ? 'Payment Successful' : 'Payment Pending'}</Text>
          <Text style={styles.heroOrder}>{orderCode}</Text>
        </View>

        {/* Live shopping state */}
        <View style={[styles.statusLine, { backgroundColor: statusColor.bg }]}>
          {isFinal ? (
            <Ionicons name={state === 'completed' ? 'bag-check' : 'warning'} size={20} color={statusColor.fg} />
          ) : (
            <ActivityIndicator size="small" color={statusColor.fg} />
          )}
          <View style={styles.flex1}>
            <Text style={[styles.statusLineText, { color: statusColor.fg }]}>{getShoppingStateLabel(state)}</Text>
            {state === 'needs_attention' && (
              <Text style={[styles.statusLineSub, { color: statusColor.fg }]}>
                Some items could not be collected, please see staff.
              </Text>
            )}
            {!isFinal && <Text style={[styles.statusLineSub, { color: statusColor.fg }]}>Updates automatically</Text>}
          </View>
        </View>
        {!!error && <Text style={styles.pollError}>Connection issue: {error}. Retrying…</Text>}

        <PickupOtpCard order={order} onPayPress={goToPayment} />
        <PickupDetailsCard order={order} />

        {/* Progress */}
        {events.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cart Progress</Text>
            {events.slice(-6).map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <Text style={styles.eventText} numberOfLines={2}>
                  {EVENT_LABELS[event.state] ?? event.state}
                  {event.item ? `: ${event.item}` : ''}
                </Text>
                <Text style={styles.eventTime}>{formatTime(event.created_at)}</Text>
              </View>
            ))}
          </View>
        )}

        <Button title="Back to Home" size="large" onPress={goHome} icon={<Ionicons name="home" size={18} color="#FFFFFF" />} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: Platform.OS === 'android' ? 36 : theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text,
  },
  content: { padding: theme.spacing.md, paddingBottom: 130 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  stateTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  stateText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  stateBtn: { marginTop: theme.spacing.md, alignSelf: 'stretch' },
  heroCard: { alignItems: 'center', paddingVertical: theme.spacing.md },
  heroTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  heroOrder: {
    marginTop: 6,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    backgroundColor: theme.colors.promoBackground,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.large,
    marginBottom: theme.spacing.md,
  },
  statusLineText: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.heavy },
  statusLineSub: { fontSize: theme.typography.sizes.xs, marginTop: 2, fontWeight: theme.typography.weights.medium },
  pollError: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
    marginTop: -8,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primaryLight },
  eventText: { flex: 1, fontSize: theme.typography.sizes.sm, color: theme.colors.text },
  eventTime: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
});
