import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '../../theme/theme';
import { fetchProducts, Product } from '../../api/apiService';
import { ProductGridCard } from '../../components/home/ProductGridCard';
import {
  FilterSheet,
  ShopFilters,
  DEFAULT_FILTERS,
  applyShopFilters,
  countActiveFilters,
} from '../../components/shop/FilterSheet';

const PROMO_GRADIENT = ['#EEF1FC', '#E6E1FB'] as const;
const LAVENDER = '#6D5BD0';
const BRIGHT_BLUE = '#2F6FED';

const PROMO_SLIDES = [
  {
    title: 'Discover fresh arrivals',
    subtitle: 'Curated essentials delivered to your smart cart',
  },
  {
    title: 'Free delivery every day',
    subtitle: 'No minimum order, no hidden fees',
  },
  {
    title: 'New products weekly',
    subtitle: 'Fresh picks added to the catalog often',
  },
];

const CATEGORIES = [
  { label: 'Fruits', icon: 'nutrition' as const, color: '#FF9F5A', bg: '#FFF1E6' },
  { label: 'Vegetables', icon: 'leaf' as const, color: '#2ECC9B', bg: '#E8FBF4' },
  { label: 'Dairy', icon: 'water' as const, color: '#38C6E8', bg: '#E8F9FE' },
  { label: 'Snacks', icon: 'fast-food' as const, color: '#F5677D', bg: '#FEEBEE' },
  { label: 'Beverages', icon: 'wine' as const, color: '#B478E8', bg: '#F5EBFE' },
];

const QUICK_ACTIONS = [
  { label: 'Shop', icon: 'storefront' as const, route: '/(customer)/shop', bg: '#22BFAE' },
  { label: 'Cart', icon: 'cart' as const, route: '/(customer)/cart', bg: '#9B72E8' },
  { label: 'Orders', icon: 'receipt' as const, route: '/(customer)/orders', bg: '#F7B84B' },
  { label: 'Profile', icon: 'person' as const, route: '/(customer)/profile', bg: '#4CC2F1' },
];

const SPOTLIGHT_COLORS = ['#002583', '#DB2777', '#0284C7'];

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
          <Text style={styles.seeAll}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function QuickActionItem({
  action,
  onPress,
}: {
  action: (typeof QUICK_ACTIONS)[number];
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.quickActionTile, animStyle]}>
      <Pressable
        style={[
          styles.quickActionTouch,
          { backgroundColor: action.bg, shadowColor: action.bg },
        ]}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.92, { damping: 12, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        }}
      >
        <Ionicons name={action.icon} size={26} color="#FFFFFF" />
        <Text style={styles.quickActionLabel}>{action.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function CustomerHome() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [promoIndex, setPromoIndex] = useState(0);
  const promoScrollRef = useRef<ScrollView>(null);
  const [shopFilters, setShopFilters] = useState<ShopFilters>(DEFAULT_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

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

  const dealProducts = useMemo(
    () => applyShopFilters(products, searchQuery, shopFilters).slice(0, 6),
    [products, searchQuery, shopFilters]
  );
  const activeFilterCount = countActiveFilters(shopFilters);

  const filteredSpotlight = useMemo(() => {
    return products.filter((p) => p.stock > 0).slice(0, 3);
  }, [products]);

  const goToShop = () => router.push('/(customer)/shop');

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const promoCardWidth = windowWidth - theme.spacing.lg * 2;

  const handlePromoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / promoCardWidth);
    if (index !== promoIndex) setPromoIndex(index);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Animated.Text entering={FadeInDown.duration(400)} style={styles.customerGreeting}>
            Hi, <Text style={styles.customerGreetingBold}>Alex</Text> 👋
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(40).duration(400)} style={styles.locationRow}>
            <View style={styles.locationTextBlock}>
              <Text style={styles.locationLabel}>LOCATION</Text>
              <TouchableOpacity style={styles.locationValueRow} activeOpacity={0.7}>
                <Ionicons name="location" size={15} color={theme.colors.primary} />
                <Text style={styles.locationValue}>Smart Cart Store</Text>
                <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity activeOpacity={0.8} style={styles.notificationBtn}>
              <Ionicons name="notifications-outline" size={18} color={theme.colors.text} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
              <TextInput
                placeholder="Search products, brands..."
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={goToShop}
              />
            </View>
            <TouchableOpacity
              style={styles.filterBtn}
              activeOpacity={0.8}
              onPress={() => setFilterSheetVisible(true)}
            >
              <Ionicons name="options-outline" size={18} color="#FFFFFF" />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.bodyContent}>
          {/* Promo carousel */}
          <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.block}>
            <ScrollView
              ref={promoScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handlePromoScroll}
              style={{ marginHorizontal: -theme.spacing.lg }}
              contentContainerStyle={{ paddingHorizontal: theme.spacing.lg }}
            >
              {PROMO_SLIDES.map((slide, i) => (
                <TouchableOpacity
                  key={slide.title}
                  activeOpacity={0.92}
                  onPress={goToShop}
                  style={{ width: promoCardWidth, marginRight: i < PROMO_SLIDES.length - 1 ? 0 : 0 }}
                >
                  <LinearGradient
                    colors={PROMO_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.promoCard}
                  >
                    <View pointerEvents="none" style={styles.promoShapeA} />
                    <View pointerEvents="none" style={styles.promoShapeB} />
                    <Ionicons
                      name="bag-handle-outline"
                      size={96}
                      color="rgba(0,37,131,0.08)"
                      style={styles.promoIllustration}
                    />

                    <View style={styles.promoTextBlock}>
                      <Text style={styles.promoOverline}>WEEKLY SELECTION</Text>
                      <Text style={styles.promoTitle}>{slide.title}</Text>
                      <Text style={styles.promoSubtitle}>{slide.subtitle}</Text>
                      <View style={styles.promoShopBtn}>
                        <Text style={styles.promoShopBtnText}>Shop Now</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.dotsRow}>
              {PROMO_SLIDES.map((slide, i) => (
                <View
                  key={slide.title}
                  style={[styles.dot, i === promoIndex && styles.dotActive]}
                />
              ))}
            </View>
          </Animated.View>

          {/* Quick actions */}
          <Animated.View entering={FadeInDown.delay(160).duration(450)} style={styles.block}>
            <SectionHeader overline="NAVIGATE" title="Quick access" />
            <View style={styles.quickActionsRow}>
              {QUICK_ACTIONS.map((action) => (
                <QuickActionItem
                  key={action.label}
                  action={action}
                  onPress={() => router.push(action.route as any)}
                />
              ))}
            </View>
          </Animated.View>

          {/* Categories */}
          <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.block}>
            <SectionHeader title="Category" onSeeAll={goToShop} />
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
                    style={styles.categoryItem}
                    activeOpacity={0.8}
                    onPress={() => setSelectedCategory(isSelected ? null : cat.label)}
                  >
                    <View
                      style={[
                        styles.categoryCircle,
                        { backgroundColor: cat.bg },
                        isSelected && { borderColor: cat.color },
                      ]}
                    >
                      <Ionicons name={cat.icon} size={26} color={cat.color} />
                    </View>
                    <Text style={styles.categoryLabel}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Best deal grid */}
          <Animated.View entering={FadeInDown.delay(240).duration(450)} style={styles.block}>
            <SectionHeader title="Best Deal" onSeeAll={goToShop} />

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : dealProducts.length > 0 ? (
              <View style={styles.dealGrid}>
                {dealProducts.map((product, index) => (
                  <ProductGridCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    stock={product.stock}
                    description={product.description}
                    imageUrl={product.image_url}
                    index={index}
                    isFavorite={favorites.has(product.id)}
                    onToggleFavorite={() => toggleFavorite(product.id)}
                    onPress={goToShop}
                  />
                ))}
              </View>
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
            <Animated.View entering={FadeInDown.delay(280).duration(450)} style={styles.block}>
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
          <Animated.View entering={FadeInDown.delay(320).duration(450)} style={styles.blockLast}>
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

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={shopFilters}
        onApply={setShopFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 130,
  },
  headerSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  block: {
    marginBottom: theme.spacing.xl,
  },
  blockLast: {
    marginBottom: theme.spacing.md,
  },
  customerGreeting: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.md + 2,
  },
  customerGreetingBold: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.bold,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  locationTextBlock: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    letterSpacing: theme.typography.letterSpacing.caps,
    marginBottom: 4,
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    borderWidth: 1.5,
    borderColor: theme.colors.card,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 13 : 11,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.regular,
    padding: 0,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primaryDark,
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  promoShapeA: {
    position: 'absolute',
    top: -40,
    right: 30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  promoShapeB: {
    position: 'absolute',
    bottom: -50,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(109,91,208,0.12)',
  },
  promoIllustration: {
    position: 'absolute',
    right: 8,
    bottom: -12,
  },
  promoTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  promoOverline: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: LAVENDER,
    letterSpacing: theme.typography.letterSpacing.caps,
    marginBottom: 8,
  },
  promoTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    letterSpacing: theme.typography.letterSpacing.tight,
    marginBottom: 6,
  },
  promoSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  promoShopBtn: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
  },
  promoShopBtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: theme.colors.primary,
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
    color: BRIGHT_BLUE,
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
    paddingTop: 4,
  },
  seeAll: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.primary,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickActionTile: {
    flex: 1,
  },
  quickActionTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
    borderRadius: theme.radius.xxl,
    gap: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 8,
  },
  quickActionLabel: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  horizontalList: {
    gap: 18,
    paddingVertical: 4,
  },
  categoryItem: {
    alignItems: 'center',
    width: 74,
  },
  categoryCircle: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    textAlign: 'center',
  },
  dealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
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
    borderRadius: theme.radius.xl,
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
    borderRadius: theme.radius.xl,
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
