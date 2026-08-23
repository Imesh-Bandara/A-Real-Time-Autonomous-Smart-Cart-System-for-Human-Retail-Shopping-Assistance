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
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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

// Screen-local brand gradients — deep navy through bright royal blue,
// and a very soft blue-to-lavender tint for the promo surface.
const HERO_GRADIENT = ['#000E38', '#0B3FC4'] as const;
const PROMO_GRADIENT = ['#EEF1FC', '#E6E1FB'] as const;
const LAVENDER = '#6D5BD0';
const BRIGHT_BLUE = '#2F6FED';

const CATEGORIES = [
  { label: 'Fruits', icon: 'nutrition' as const, bg: '#FF9F5A' },
  { label: 'Vegetables', icon: 'leaf' as const, bg: '#2ECC9B' },
  { label: 'Dairy', icon: 'water' as const, bg: '#38C6E8' },
  { label: 'Snacks', icon: 'fast-food' as const, bg: '#F5677D' },
  { label: 'Beverages', icon: 'wine' as const, bg: '#B478E8' },
];

const QUICK_ACTIONS = [
  { label: 'Shop', icon: 'storefront' as const, route: '/(customer)/shop', bg: '#22BFAE' },
  { label: 'Cart', icon: 'cart' as const, route: '/(customer)/cart', bg: '#9B72E8' },
  { label: 'Orders', icon: 'receipt' as const, route: '/(customer)/orders', bg: '#F7B84B' },
  { label: 'Profile', icon: 'person' as const, route: '/(customer)/profile', bg: '#4CC2F1' },
];

const SPOTLIGHT_COLORS = ['#002583', '#DB2777', '#0284C7'];

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

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

  const gridProducts = products.slice(0, 8);
  const inStockCount = products.filter((p) => p.stock > 0).length;

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <LinearGradient
          colors={HERO_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View pointerEvents="none" style={styles.glowTopRight} />
          <View pointerEvents="none" style={styles.glowBottomLeft} />

          <Animated.View entering={FadeInDown.duration(450)} style={styles.brandRow}>
            <View style={styles.brandMarkRow}>
              <View style={styles.brandMark}>
                <Ionicons name="cart" size={17} color="#FFFFFF" />
              </View>
              <Text style={styles.brandName}>Smart Cart Store</Text>
            </View>

            <TouchableOpacity activeOpacity={0.8} style={styles.notificationWrap}>
              <BlurView intensity={35} tint="dark" style={styles.notificationBlur}>
                <Ionicons name="notifications-outline" size={18} color="#FFF" />
                <View style={styles.notificationDot} />
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(50).duration(450)} style={styles.greetingBlock}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>
              Welcome back, <Text style={styles.userNameEmphasis}>Alex</Text>
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(450)} style={styles.statsGlassWrap}>
            <BlurView intensity={28} tint="dark" style={styles.statsGlass}>
              <View style={styles.statItem}>
                <Ionicons name="cube-outline" size={16} color="rgba(255,255,255,0.75)" />
                <Text style={styles.statValue}>{products.length}</Text>
                <Text style={styles.statLabel}>Products</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="checkmark-done-circle-outline" size={16} color="rgba(255,255,255,0.75)" />
                <Text style={styles.statValue}>{inStockCount}</Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="flash" size={16} color="#C9BFFF" />
                <Text style={[styles.statValue, styles.statValueEmphasis]}>Free</Text>
                <Text style={styles.statLabel}>Delivery</Text>
              </View>
            </BlurView>
          </Animated.View>
        </LinearGradient>

        {/* Floating search bar — overlaps the hero's rounded edge */}
        <Animated.View
          entering={FadeInDown.delay(110).duration(450)}
          style={styles.floatingSearchWrap}
        >
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
            <View style={styles.searchDivider} />
            <TouchableOpacity style={styles.filterBtn} activeOpacity={0.75} onPress={goToShop}>
              <Ionicons name="options-outline" size={17} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.bodyContent}>
          {/* Promo */}
          <Animated.View entering={FadeInDown.delay(140).duration(450)} style={styles.block}>
            <TouchableOpacity activeOpacity={0.92} onPress={goToShop}>
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
                  <Text style={styles.promoTitle}>Discover fresh arrivals</Text>
                  <Text style={styles.promoSubtitle}>
                    Curated essentials delivered to your smart cart
                  </Text>
                </View>
                <View style={styles.promoArrow}>
                  <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick actions */}
          <Animated.View entering={FadeInDown.delay(180).duration(450)} style={styles.block}>
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
                      { backgroundColor: cat.bg, shadowColor: cat.bg },
                      isSelected && styles.categoryCardActive,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedCategory(isSelected ? null : cat.label)}
                  >
                    <Ionicons name={cat.icon} size={28} color="#FFFFFF" />
                    <Text style={styles.categoryLabel}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Product discovery grid */}
          <Animated.View entering={FadeInDown.delay(260).duration(450)} style={styles.block}>
            <SectionHeader
              overline="DISCOVER"
              title="Popular today"
              subtitle="Trending picks from your store"
              onSeeAll={goToShop}
            />

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : gridProducts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {gridProducts.map((product, index) => (
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
    paddingBottom: 130,
  },
  heroSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl + 6,
    borderBottomLeftRadius: theme.radius.xxl,
    borderBottomRightRadius: theme.radius.xxl,
    overflow: 'hidden',
  },
  glowTopRight: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -90,
    left: -60,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(109,91,208,0.22)',
  },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  block: {
    marginBottom: theme.spacing.xl,
  },
  blockLast: {
    marginBottom: theme.spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  brandMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  notificationWrap: {
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
  },
  notificationBlur: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C9BFFF',
    borderWidth: 1.5,
    borderColor: '#001240',
  },
  greetingBlock: {
    marginBottom: theme.spacing.lg + 6,
  },
  greeting: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255,255,255,0.62)',
    fontWeight: theme.typography.weights.regular,
    marginBottom: 4,
  },
  userName: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.medium,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: theme.typography.letterSpacing.tight,
    lineHeight: 34,
  },
  userNameEmphasis: {
    fontWeight: theme.typography.weights.heavy,
    color: '#FFFFFF',
  },
  statsGlassWrap: {
    borderRadius: theme.radius.large,
    overflow: 'hidden',
  },
  statsGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingVertical: theme.spacing.md + 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: '#FFF',
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  statValueEmphasis: {
    color: '#D8CFFF',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.medium,
    color: 'rgba(255,255,255,0.6)',
  },
  floatingSearchWrap: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: -26,
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    gap: 10,
    ...theme.shadows.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.regular,
    padding: 0,
  },
  searchDivider: {
    width: 1,
    height: 22,
    backgroundColor: theme.colors.border,
  },
  filterBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  promoArrow: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.medium,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
    ...theme.shadows.md,
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
    paddingTop: 18,
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
    gap: 12,
    paddingVertical: 4,
  },
  categoryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 108,
    gap: 8,
    borderRadius: theme.radius.xxl,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 8,
  },
  categoryCardActive: {
    borderColor: 'rgba(255,255,255,0.85)',
    shadowOpacity: 0.45,
  },
  categoryLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
