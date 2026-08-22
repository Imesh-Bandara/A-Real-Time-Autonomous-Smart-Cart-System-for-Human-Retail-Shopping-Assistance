import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../theme/theme';
import { fetchProducts, Product } from '../../api/apiService';
import { HomeProductTile } from '../../components/home/HomeProductTile';

const CATEGORIES = [
  { label: 'Fruits', icon: 'nutrition-outline' as const, color: '#EA580C', bg: '#FFF7ED' },
  { label: 'Vegetables', icon: 'leaf-outline' as const, color: '#16A34A', bg: '#F0FDF4' },
  { label: 'Dairy', icon: 'water-outline' as const, color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Snacks', icon: 'fast-food-outline' as const, color: '#DB2777', bg: '#FDF2F8' },
  { label: 'Beverages', icon: 'wine-outline' as const, color: '#7C3AED', bg: '#F5F3FF' },
];

const QUICK_ACTIONS = [
  { label: 'Shop', icon: 'storefront-outline' as const, route: '/(customer)/shop', color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Cart', icon: 'cart-outline' as const, route: '/(customer)/cart', color: '#DB2777', bg: '#FDF2F8' },
  { label: 'Orders', icon: 'receipt-outline' as const, route: '/(customer)/orders', color: '#0284C7', bg: '#F0F9FF' },
  { label: 'Profile', icon: 'person-outline' as const, route: '/(customer)/profile', color: '#059669', bg: '#ECFDF5' },
];

const SPOTLIGHT_COLORS = ['#4F46E5', '#DB2777', '#0284C7'];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function SectionHeader({
  overline,
  title,
  subtitle,
  onSeeAll,
}: {
  overline?: string;
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        {overline ? <Text style={styles.overline}>{overline}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {onSeeAll ? (
        <TouchableOpacity style={styles.seeAllBtn} onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={styles.seeAll}>View all</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function CustomerHome() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await fetchProducts();
        setProducts(data);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const popularProducts = products.slice(0, 8);
  const inStockCount = products.filter((p) => p.stock > 0).length;

  const filteredSpotlight = useMemo(() => {
    return products.filter((p) => p.stock > 0).slice(0, 3);
  }, [products]);

  const goToShop = () => router.push('/(customer)/shop');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <LinearGradient
          colors={[theme.colors.heroStart, theme.colors.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.locationText}>Smart Cart Store</Text>
              </View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>Welcome back, Alex</Text>
            </View>
            <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(450)} style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
            <TextInput
              placeholder="Search products..."
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={goToShop}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{products.length}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{inStockCount}</Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Free</Text>
              <Text style={styles.statLabel}>Delivery</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={styles.bodyContent}>
          {/* Promo */}
          <Animated.View entering={FadeInDown.delay(140).duration(450)} style={styles.block}>
            <TouchableOpacity style={styles.promoCard} activeOpacity={0.9} onPress={goToShop}>
              <View style={styles.promoAccent} />
              <View style={styles.promoTextBlock}>
                <Text style={styles.promoOverline}>WEEKLY SELECTION</Text>
                <Text style={styles.promoTitle}>Discover fresh arrivals</Text>
                <Text style={styles.promoSubtitle}>
                  Curated essentials delivered to your smart cart
                </Text>
              </View>
              <View style={styles.promoArrow}>
                <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick actions */}
          <Animated.View entering={FadeInDown.delay(180).duration(450)} style={styles.block}>
            <SectionHeader overline="NAVIGATE" title="Quick access" />
            <View style={styles.quickActionsCard}>
              {QUICK_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={styles.quickAction}
                  activeOpacity={0.75}
                  onPress={() => router.push(action.route as any)}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: action.bg }]}>
                    <Ionicons name={action.icon} size={20} color={action.color} />
                  </View>
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Categories */}
          <Animated.View entering={FadeInDown.delay(220).duration(450)} style={styles.block}>
            <SectionHeader overline="BROWSE" title="Shop by category" onSeeAll={goToShop} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.label;
                return (
                  <TouchableOpacity
                    key={cat.label}
                    style={[
                      styles.categoryCard,
                      { backgroundColor: isSelected ? cat.color : cat.bg },
                      isSelected && styles.categoryCardActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => setSelectedCategory(isSelected ? null : cat.label)}
                  >
                    <View
                      style={[
                        styles.categoryIconWrap,
                        { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#FFFFFF' },
                      ]}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={20}
                        color={isSelected ? '#FFF' : cat.color}
                      />
                    </View>
                    <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Popular products */}
          <Animated.View entering={FadeInDown.delay(260).duration(450)} style={styles.block}>
            <SectionHeader
              overline="COLLECTION"
              title="Popular products"
              subtitle="Most browsed items this week"
              onSeeAll={goToShop}
            />

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : popularProducts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {popularProducts.map((product, index) => (
                  <HomeProductTile
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    stock={product.stock}
                    description={product.description}
                    imageUrl={product.image_url}
                    index={index}
                    onPress={goToShop}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="basket-outline" size={32} color={theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>No products available</Text>
                <Text style={styles.emptyText}>New items will appear here soon.</Text>
              </View>
            )}
          </Animated.View>

          {/* Fresh picks */}
          {!loading && filteredSpotlight.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(450)} style={styles.block}>
              <SectionHeader
                overline="RECOMMENDED"
                title="Editor's picks"
                subtitle="Hand-selected for quality and value"
              />

              <View style={styles.spotlightList}>
                {filteredSpotlight.map((product, index) => (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.spotlightCard,
                      index < filteredSpotlight.length - 1 && styles.spotlightCardBorder,
                    ]}
                    activeOpacity={0.75}
                    onPress={goToShop}
                  >
                    <View
                      style={[
                        styles.spotlightIndex,
                        { backgroundColor: `${SPOTLIGHT_COLORS[index]}18` },
                      ]}
                    >
                      <Text style={[styles.spotlightIndexText, { color: SPOTLIGHT_COLORS[index] }]}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                    </View>
                    <View style={styles.spotlightInfo}>
                      <Text style={styles.spotlightName}>{product.name}</Text>
                      {product.description ? (
                        <Text style={styles.spotlightDesc} numberOfLines={1}>
                          {product.description}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.spotlightPrice}>${product.price.toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Smart cart */}
          <Animated.View entering={FadeInDown.delay(340).duration(450)} style={styles.blockLast}>
            <View style={styles.smartCartCard}>
              <View style={styles.smartCartIcon}>
                <Ionicons name="cart-outline" size={22} color={theme.colors.success} />
              </View>
              <View style={styles.smartCartText}>
                <Text style={styles.smartCartTitle}>Smart Cart</Text>
                <Text style={styles.smartCartSubtitle}>
                  Real-time tracking for a seamless shopping experience
                </Text>
              </View>
              <TouchableOpacity style={styles.smartCartBtn} activeOpacity={0.8} onPress={goToShop}>
                <Text style={styles.smartCartBtnText}>Open</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
    paddingBottom: 110,
  },
  heroSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  locationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  greeting: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: theme.typography.weights.regular,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.medium,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    marginBottom: theme.spacing.lg + 4,
    gap: 10,
    ...theme.shadows.md,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.regular,
    padding: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: theme.spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: '#FFF',
    marginBottom: 4,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  statLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: 'rgba(255,255,255,0.65)',
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.promoBackground,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  promoAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.colors.primary,
  },
  promoTextBlock: {
    flex: 1,
    paddingLeft: 8,
  },
  promoOverline: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.primary,
    letterSpacing: theme.typography.letterSpacing.caps,
    marginBottom: 8,
  },
  promoTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    letterSpacing: theme.typography.letterSpacing.tight,
    marginBottom: 6,
  },
  promoSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  promoArrow: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
    ...theme.shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md + 4,
  },
  sectionHeaderText: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  overline: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.primaryLight,
    letterSpacing: theme.typography.letterSpacing.caps,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingTop: 18,
  },
  seeAll: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.primary,
  },
  quickActionsCard: {
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
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  horizontalList: {
    gap: 12,
    paddingVertical: 4,
  },
  categoryCard: {
    alignItems: 'center',
    width: 88,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryCardActive: {
    borderColor: 'transparent',
    ...theme.shadows.sm,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#FFF',
  },
  loadingState: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyState: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginTop: 14,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  spotlightList: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  spotlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 18,
  },
  spotlightCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  spotlightIndex: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  spotlightIndexText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  },
  spotlightInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  spotlightName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  spotlightDesc: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  spotlightPrice: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  smartCartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.smartCartBackground,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    ...theme.shadows.sm,
  },
  smartCartIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.medium,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  smartCartText: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  smartCartTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 5,
  },
  smartCartSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  smartCartBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.success,
  },
  smartCartBtnText: {
    color: '#FFF',
    fontWeight: theme.typography.weights.semiBold,
    fontSize: theme.typography.sizes.xs,
  },
});
