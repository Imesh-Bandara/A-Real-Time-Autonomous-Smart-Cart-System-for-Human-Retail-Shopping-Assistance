/**
 * PickupDetailsCard — customer name, shopping session, order time, cart and pickup time.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../api/apiService';
import { theme } from '../../theme/theme';
import {
  formatCartLabel,
  formatDateTime,
  formatTime,
  isReadyForPickup,
  READY_FOR_PICKUP_LABEL,
} from '../../utils/orderFormat';

function DetailRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.detailTextWrap}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export function PickupDetailsCard({ order }: { order: Order }) {
  const ready = isReadyForPickup(order);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Pickup Details</Text>
      <DetailRow icon="person-outline" label="Customer" value={order.customer_name || 'Guest'} />
      <DetailRow icon="pricetag-outline" label="Shopping session" value={order.session_code || '—'} />
      <DetailRow icon="calendar-outline" label="Order placed" value={formatDateTime(order.created_at)} />
      <DetailRow icon="cart-outline" label="Cart" value={formatCartLabel(order.cart_id)} />
      {ready ? (
        <View style={[styles.pickupBox, styles.pickupBoxReady]}>
          <Ionicons name="bag-check" size={20} color={theme.colors.success} />
          <Text style={[styles.pickupText, styles.pickupTextReady]}>
            {READY_FOR_PICKUP_LABEL}
            <Text style={styles.pickupEstimate}> at {formatCartLabel(order.cart_id)}. Match your OTP with the cart.</Text>
          </Text>
        </View>
      ) : (
        <View style={styles.pickupBox}>
          <Ionicons name="time" size={20} color={theme.colors.primaryDark} />
          <Text style={styles.pickupText}>
            {order.pickup_eta
              ? `You can pick your order at ${formatTime(order.pickup_eta)}`
              : 'Pickup time will be shown once your cart starts.'}
            {!!order.pickup_eta && <Text style={styles.pickupEstimate}> (estimated)</Text>}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.promoBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextWrap: { flex: 1 },
  detailLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary },
  detailValue: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.semiBold,
    marginTop: 1,
  },
  pickupBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.warningBackground,
    borderRadius: theme.radius.medium,
    padding: 12,
    marginTop: theme.spacing.sm,
  },
  pickupText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primaryDark,
  },
  pickupEstimate: { fontWeight: theme.typography.weights.regular, color: theme.colors.textSecondary },
  pickupBoxReady: { backgroundColor: theme.colors.successBackground },
  pickupTextReady: { color: theme.colors.success },
});
