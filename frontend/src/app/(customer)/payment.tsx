import React, { useCallback, useRef, useState } from 'react';
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
import { payOrder } from '../../api/apiService';
import { theme } from '../../theme/theme';
import { Button } from '../../components/ui/Button';
import { useOrderPolling } from '../../hooks/useOrderPolling';
import { requestNotificationPermission } from '../../services/orderAlerts';
import { formatCartLabel, parseOrderNumber } from '../../utils/orderFormat';

export default function PaymentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = parseOrderNumber(id ?? null);
  const { order, loading, error: loadError, reload } = useOrderPolling(orderId, { poll: false });

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const payingRef = useRef(false); // blocks double taps before the re-render disables the button

  const goBack = useCallback(() => {
    router.replace('/(customer)/orders');
  }, [router]);

  const goToConfirmation = useCallback(() => {
    if (!orderId) return;
    router.replace({ pathname: '/(customer)/order-confirmation', params: { id: String(orderId) } });
  }, [orderId, router]);

  // Android hardware back returns to the orders list (the order stays saved there)
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack])
  );

  const handlePay = async () => {
    if (!orderId || payingRef.current) return;
    payingRef.current = true;
    setPaying(true);
    setPayError(null);
    try {
      await payOrder(orderId); // the OTP is fetched from GET /api/orders/<id>/otp on the next screen
      requestNotificationPermission(); // ask now so the "shopping finished" alert can be delivered
      goToConfirmation();
    } catch (err) {
      setPayError(typeof err === 'string' ? err : 'Payment failed. Please try again.');
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={goBack} style={styles.headerBtn} accessibilityLabel="Back to orders">
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Payment</Text>
      <View style={styles.headerBtn} />
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
          {!!loadError && <Text style={styles.stateText}>{loadError}</Text>}
          {!!orderId && <Button title="Try Again" onPress={reload} style={styles.stateBtn} />}
          <Button title="Go to My Orders" variant="outline" onPress={goBack} style={styles.stateBtn} />
        </View>
      </SafeAreaView>
    );
  }

  const isPaid = order.payment_status === 'paid';
  const orderCode = order.order_code || `ORD_${String(order.id).padStart(4, '0')}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order summary */}
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <View style={styles.flexShrink}>
              <Text style={styles.label}>Order</Text>
              <Text style={styles.orderCode}>{orderCode}</Text>
            </View>
            <View style={styles.cartChip}>
              <Ionicons name="cart" size={14} color={theme.colors.info} />
              <Text style={styles.cartChipText}>{formatCartLabel(order.cart_id)}</Text>
            </View>
          </View>
          {!!order.session_code && <Text style={styles.sessionText}>Session {order.session_code}</Text>}
        </View>

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({order.item_count})</Text>
          {(order.items ?? []).length === 0 ? (
            <Text style={styles.stateText}>No items found for this order.</Text>
          ) : (
            order.items!.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.product_name} <Text style={styles.itemQty}>× {item.quantity}</Text>
                </Text>
                <Text style={styles.itemSubtotal}>${item.subtotal.toFixed(2)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>${order.total_amount.toFixed(2)}</Text>
          </View>
        </View>

        {isPaid ? (
          <View style={[styles.notice, { backgroundColor: theme.colors.successBackground }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={[styles.noticeText, { color: theme.colors.success }]}>This order is already paid.</Text>
          </View>
        ) : (
          <View style={[styles.notice, { backgroundColor: theme.colors.infoBackground }]}>
            <Ionicons name="information-circle" size={20} color={theme.colors.info} />
            <Text style={[styles.noticeText, { color: theme.colors.info }]}>
              Demo payment: no card is charged.
            </Text>
          </View>
        )}

        {!!payError && (
          <View style={[styles.notice, { backgroundColor: theme.colors.errorBackground }]}>
            <Ionicons name="close-circle" size={20} color={theme.colors.error} />
            <Text style={[styles.noticeText, { color: theme.colors.error }]}>{payError}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {isPaid ? (
          <Button title="View Pickup Details" size="large" onPress={goToConfirmation} />
        ) : (
          <Button
            title={payError ? 'Retry Payment' : `Pay Now  $${order.total_amount.toFixed(2)}`}
            size="large"
            loading={paying}
            disabled={paying}
            onPress={handlePay}
            icon={!paying ? <Ionicons name="lock-closed" size={18} color="#FFFFFF" /> : undefined}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
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
  content: { padding: theme.spacing.md, paddingBottom: 200 },
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
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  flexShrink: { flexShrink: 1 },
  label: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.caps,
    fontWeight: theme.typography.weights.semiBold,
  },
  orderCode: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.primary,
    marginTop: 2,
  },
  sessionText: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  cartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.infoBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  cartChipText: { color: theme.colors.info, fontWeight: theme.typography.weights.bold, fontSize: theme.typography.sizes.sm },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    gap: 12,
  },
  itemName: { flex: 1, fontSize: theme.typography.sizes.md, color: theme.colors.text, fontWeight: theme.typography.weights.medium },
  itemQty: { color: theme.colors.textSecondary, fontWeight: theme.typography.weights.regular },
  itemSubtotal: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: theme.spacing.md },
  totalLabel: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.bold, color: theme.colors.textSecondary },
  totalAmount: { fontSize: theme.typography.sizes.xxl, fontWeight: theme.typography.weights.heavy, color: theme.colors.text },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: theme.radius.medium,
    marginBottom: theme.spacing.md,
  },
  noticeText: { flex: 1, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semiBold },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 106 : 98, // sits above the floating tab bar
    paddingHorizontal: theme.spacing.md,
  },
});
