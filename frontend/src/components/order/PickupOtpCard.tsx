/**
 * PickupOtpCard — the customer's pickup OTP (same code the cart shows on its OLED display).
 * Unpaid: "Pay to get your pickup OTP" button. Paid: fetches GET /api/orders/<id>/otp.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { fetchOrderOtp, Order, OrderOtp } from '../../api/apiService';
import { theme } from '../../theme/theme';
import { Button } from '../ui/Button';
import { formatCartLabel, formatDateTime, formatOtp } from '../../utils/orderFormat';

interface Props {
  order: Order;
  onPayPress: () => void;
}

type OtpState =
  | { kind: 'loading' }
  | { kind: 'ready'; otp: OrderOtp }
  | { kind: 'unavailable'; icon: React.ComponentProps<typeof Ionicons>['name']; message: string; canRetry: boolean };

export function PickupOtpCard({ order, onPayPress }: Props) {
  const isPaid = order.payment_status === 'paid';
  const cartLabel = formatCartLabel(order.cart_id);
  const [state, setState] = useState<OtpState>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);

  // Re-fetch when payment completes or the OTP gets locked
  useEffect(() => {
    if (!isPaid) return undefined;
    let active = true;
    setState({ kind: 'loading' });
    fetchOrderOtp(order.id).then((result) => {
      if (!active) return;
      if (result.ok) {
        setState({ kind: 'ready', otp: result.data });
      } else if (result.reason === 'locked') {
        setState({ kind: 'unavailable', icon: 'lock-closed', message: result.message, canRetry: false });
      } else if (result.reason === 'expired') {
        setState({ kind: 'unavailable', icon: 'time-outline', message: result.message, canRetry: false });
      } else if (result.status === 401 || result.status === 422 || result.status === 403) {
        setState({ kind: 'unavailable', icon: 'person-circle-outline', message: result.message, canRetry: false });
      } else {
        setState({ kind: 'unavailable', icon: 'cloud-offline-outline', message: result.message, canRetry: true });
      }
    });
    return () => {
      active = false;
    };
  }, [order.id, isPaid, order.otp_locked, reloadKey]);

  const handleCopy = useCallback(async (otp: string) => {
    try {
      await Clipboard.setStringAsync(otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the OTP is still visible on screen
    }
  }, []);

  if (!isPaid) {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <Ionicons name="key-outline" size={28} color={theme.colors.primary} />
        <Text style={styles.mutedText}>Pay for this order to get the OTP you will match with {cartLabel}.</Text>
        <Button
          title="Pay to get your pickup OTP"
          onPress={onPayPress}
          style={styles.fullWidth}
          icon={<Ionicons name="card-outline" size={18} color="#FFFFFF" />}
        />
      </View>
    );
  }

  if (state.kind === 'loading') {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.mutedText}>Loading your OTP…</Text>
      </View>
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <Ionicons name={state.icon} size={28} color={theme.colors.error} />
        <Text style={styles.mutedText}>{state.message}</Text>
        {state.canRetry && (
          <Button title="Try Again" variant="outline" onPress={() => setReloadKey((k) => k + 1)} style={styles.fullWidth} />
        )}
      </View>
    );
  }

  const { otp } = state;
  return (
    <View style={styles.card}>
      <View style={styles.cartBadge}>
        <Ionicons name="cart" size={16} color={theme.colors.primaryDark} />
        <Text style={styles.cartBadgeText}>{cartLabel}</Text>
      </View>
      <Text style={styles.label}>Your OTP - match it with the code on {cartLabel}</Text>
      <Text
        style={styles.digits}
        adjustsFontSizeToFit
        numberOfLines={1}
        selectable
        accessibilityLabel={`One time password ${otp.otp.split('').join(' ')}`}
      >
        {formatOtp(otp.otp)}
      </Text>
      <TouchableOpacity style={styles.copyBtn} onPress={() => handleCopy(otp.otp)} activeOpacity={0.8}>
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={theme.colors.primaryDark} />
        <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
      </TouchableOpacity>
      <Text style={styles.expiry}>
        {otp.expires_at ? `Valid until ${formatDateTime(otp.expires_at)}. ` : ''}Do not share it with anyone else.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.xxl,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 3,
    borderColor: theme.colors.accent,
    ...theme.shadows.lg,
  },
  cardMuted: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    gap: 10,
  },
  mutedText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  fullWidth: { alignSelf: 'stretch' },
  cartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  cartBadgeText: {
    color: theme.colors.primaryDark,
    fontWeight: theme.typography.weights.heavy,
    fontSize: theme.typography.sizes.md,
  },
  label: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semiBold,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  digits: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    letterSpacing: 6,
    marginVertical: theme.spacing.sm,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  copyBtnText: { color: theme.colors.primaryDark, fontWeight: theme.typography.weights.bold, fontSize: theme.typography.sizes.sm },
  expiry: {
    color: '#C7D2FE',
    fontSize: theme.typography.sizes.xs,
    marginTop: theme.spacing.md,
    textAlign: 'center',
    lineHeight: 16,
  },
});
