import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme/theme';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AdminSectionHeader } from '../../components/admin/AdminSectionHeader';

const CARTS = [
  {
    id: 'SC-01',
    status: 'success' as const,
    label: 'Online',
    location: 'Aisle 4',
    battery: '87%',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    id: 'SC-02',
    status: 'warning' as const,
    label: 'Charging',
    location: 'Base Station',
    battery: '12%',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    id: 'SC-03',
    status: 'error' as const,
    label: 'Offline',
    location: 'Unknown',
    battery: '—',
    color: '#DC2626',
    bg: '#FEF2F2',
  },
];

export default function SmartCartsManagement() {

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={[theme.colors.heroStart, theme.colors.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroText}>
              <Text style={styles.heroOverline}>FLEET</Text>
              <Text style={styles.heroTitle}>Smart cart management</Text>
              <Text style={styles.heroSubtitle}>Monitor cart status and battery levels</Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>3</Text>
              <Text style={styles.heroStatLabel}>Total</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>1</Text>
              <Text style={styles.heroStatLabel}>Online</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>1</Text>
              <Text style={styles.heroStatLabel}>Offline</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContent}>
          <AdminSectionHeader overline="ACTIVE" title="Fleet overview" subtitle="Real-time cart telemetry" />

          {CARTS.map((cart, index) => (
            <View
              key={cart.id}
              style={[styles.card, index < CARTS.length - 1 && { marginBottom: theme.spacing.md }]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.cartIcon, { backgroundColor: cart.bg }]}>
                    <Ionicons name="cart-outline" size={18} color={cart.color} />
                  </View>
                  <Text style={styles.cardTitle}>Cart {cart.id}</Text>
                </View>
                <StatusBadge status={cart.status} label={cart.label} />
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
                  <Text style={styles.detailText}>{cart.location}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="battery-half-outline" size={14} color={theme.colors.textMuted} />
                  <Text style={styles.detailText}>{cart.battery}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingBottom: 40 },
  heroSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'android' ? theme.spacing.md : theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
  },
  heroText: { flex: 1, paddingTop: 2 },
  heroOverline: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: theme.typography.letterSpacing.caps,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: '#FFF',
    letterSpacing: theme.typography.letterSpacing.tight,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255,255,255,0.65)',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: theme.spacing.md,
  },
  heroStatItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroStatValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: '#FFF',
    marginBottom: 4,
  },
  heroStatLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: 'rgba(255,255,255,0.65)',
  },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontWeight: theme.typography.weights.semiBold,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
  },
  detailRow: { flexDirection: 'row', gap: 20 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
  },
});
