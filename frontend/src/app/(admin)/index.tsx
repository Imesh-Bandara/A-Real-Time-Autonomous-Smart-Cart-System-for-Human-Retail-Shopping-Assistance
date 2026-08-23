import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../theme/theme';
import { fetchProducts, Product } from '../../api/apiService';
import { AdminSectionHeader } from '../../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../../components/admin/AdminStatCard';

const QUICK_LINKS = [
  {
    label: 'Inventory',
    icon: 'cube-outline' as const,
    route: '/(admin)/inventory',
    color: '#002583',
    bg: '#E6EAF7',
  },
  {
    label: 'Orders',
    icon: 'receipt-outline' as const,
    route: '/(admin)/orders',
    color: '#DB2777',
    bg: '#FDF2F8',
  },
  {
    label: 'Smart Carts',
    icon: 'cart-outline' as const,
    route: '/(admin)/smart-carts',
    color: '#0284C7',
    bg: '#F0F9FF',
  },
  {
    label: 'Robots',
    icon: 'hardware-chip-outline' as const,
    route: '/(admin)/robot-status',
    color: '#059669',
    bg: '#ECFDF5',
  },
];

const SYSTEM_STATUS = [
  { name: 'Backend API', status: 'Online', ok: true },
  { name: 'Robot Fleet', status: '3 Online', ok: true },
  { name: 'Inventory Sync', status: 'Up to date', ok: true },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function AdminDashboard() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      console.log('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock > 0 && p.stock <= 10),
    [products]
  );
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={[theme.colors.heroStart, theme.colors.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.topRow}>
                <View style={styles.rolePill}>
                  <Text style={styles.roleText}>ADMIN CONSOLE</Text>
                </View>
              </View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>Store management</Text>
            </View>
            <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(450)} style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{products.length}</Text>
              <Text style={styles.heroStatLabel}>Products</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{lowStockProducts.length}</Text>
              <Text style={styles.heroStatLabel}>Low stock</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>37</Text>
              <Text style={styles.heroStatLabel}>Orders</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={styles.bodyContent}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <>
              <Animated.View entering={FadeInDown.delay(140).duration(450)} style={styles.block}>
                <AdminSectionHeader overline="OVERVIEW" title="Key metrics" />
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    label="Total products"
                    value={products.length}
                    icon="cube-outline"
                    color="#002583"
                    background="#E6EAF7"
                  />
                  <AdminStatCard
                    label="Low stock items"
                    value={lowStockProducts.length}
                    icon="alert-circle-outline"
                    color="#D97706"
                    background="#FFFBEB"
                  />
                  <AdminStatCard
                    label="Out of stock"
                    value={outOfStockCount}
                    icon="close-circle-outline"
                    color="#DC2626"
                    background="#FEF2F2"
                  />
                  <AdminStatCard
                    label="Active carts"
                    value={3}
                    icon="cart-outline"
                    color="#059669"
                    background="#ECFDF5"
                  />
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(180).duration(450)} style={styles.block}>
                <AdminSectionHeader overline="NAVIGATE" title="Quick access" />
                <View style={styles.quickLinksCard}>
                  {QUICK_LINKS.map((link) => (
                    <TouchableOpacity
                      key={link.label}
                      style={styles.quickLink}
                      activeOpacity={0.75}
                      onPress={() => router.push(link.route as any)}
                    >
                      <View style={[styles.quickLinkIcon, { backgroundColor: link.bg }]}>
                        <Ionicons name={link.icon} size={20} color={link.color} />
                      </View>
                      <Text style={styles.quickLinkLabel}>{link.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>

              {lowStockProducts.length > 0 && (
                <Animated.View entering={FadeInDown.delay(220).duration(450)} style={styles.block}>
                  <AdminSectionHeader
                    overline="ALERTS"
                    title="Inventory warnings"
                    subtitle="Items that need restocking soon"
                    onAction={() => router.push('/(admin)/inventory')}
                  />
                  <View style={styles.alertList}>
                    {lowStockProducts.slice(0, 4).map((product, index) => (
                      <View
                        key={product.id}
                        style={[
                          styles.alertRow,
                          index < Math.min(lowStockProducts.length, 4) - 1 && styles.alertRowBorder,
                        ]}
                      >
                        <View style={styles.alertIcon}>
                          <Ionicons name="warning-outline" size={16} color={theme.colors.warning} />
                        </View>
                        <View style={styles.alertInfo}>
                          <Text style={styles.alertName}>{product.name}</Text>
                          <Text style={styles.alertMeta}>Only {product.stock} units left</Text>
                        </View>
                        <Text style={styles.alertPrice}>${product.price.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}

              <Animated.View entering={FadeInDown.delay(260).duration(450)} style={styles.blockLast}>
                <AdminSectionHeader overline="SYSTEM" title="Service status" />
                <View style={styles.statusList}>
                  {SYSTEM_STATUS.map((item, index) => (
                    <View
                      key={item.name}
                      style={[
                        styles.statusRow,
                        index < SYSTEM_STATUS.length - 1 && styles.statusRowBorder,
                      ]}
                    >
                      <View style={styles.statusLeft}>
                        <View style={[styles.statusDot, item.ok && styles.statusDotOk]} />
                        <Text style={styles.statusName}>{item.name}</Text>
                      </View>
                      <Text style={styles.statusValue}>{item.status}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'android' ? theme.spacing.md : theme.spacing.sm,
    paddingBottom: theme.spacing.xl + 4,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  block: {
    marginBottom: theme.spacing.xl,
  },
  blockLast: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg + 4,
  },
  headerLeft: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
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
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  roleText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    letterSpacing: theme.typography.letterSpacing.caps,
  },
  greeting: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 4,
  },
  userName: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    color: '#FFF',
    letterSpacing: theme.typography.letterSpacing.tight,
    lineHeight: 34,
  },
  notificationBtn: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
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
  loadingState: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickLinksCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  quickLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickLinkLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  alertList: {
    backgroundColor: theme.colors.warningBackground,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: '#FDE68A',
    overflow: 'hidden',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 16,
  },
  alertRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.small,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  alertInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  alertName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 3,
  },
  alertMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.warning,
    fontWeight: theme.typography.weights.medium,
  },
  alertPrice: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  statusList: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 16,
  },
  statusRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
  },
  statusDotOk: {
    backgroundColor: theme.colors.success,
  },
  statusName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  statusValue: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.success,
  },
});
