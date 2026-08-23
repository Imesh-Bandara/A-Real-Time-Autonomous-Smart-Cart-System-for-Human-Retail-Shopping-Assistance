import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchProducts, Product } from '../../api/apiService';
import { ProductCard } from '../../components/ProductCard';
import { theme } from '../../theme/theme';
import { Input } from '../../components/ui/Input';
import { useCart } from '../../context/CartContext';
import {
  FilterSheet,
  ShopFilters,
  DEFAULT_FILTERS,
  applyShopFilters,
  countActiveFilters,
} from '../../components/shop/FilterSheet';

export default function ShopScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const { addToCart, removeFromCart, getItemQuantity } = useCart();

  const showAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await fetchProducts();
      setProducts(data);
    } catch (err: any) {
      showAlert('Error', typeof err === 'string' ? err : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAddToCart = (product: Product) => {
    const error = addToCart(product);
    if (error) {
      showAlert('Notice', error);
    }
  };

  const visibleProducts = useMemo(
    () => applyShopFilters(products, searchQuery, filters),
    [products, searchQuery, filters]
  );
  const activeFilterCount = countActiveFilters(filters);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Shop Catalog</Text>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Input
                placeholder="Search products, brands..."
                style={styles.search}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
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
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={visibleProducts}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {products.length === 0
                    ? 'No products available yet.'
                    : 'No products match your search or filters.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <ProductCard
                id={item.id}
                name={item.name}
                price={item.price}
                stock={item.stock}
                imageUrl={item.image_url}
                description={item.description}
                cartCount={getItemQuantity(item.id)}
                onAdd={() => handleAddToCart(item)}
                onRemove={() => removeFromCart(item.id)}
              />
            )}
          />
        )}
      </View>

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApply={setFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  search: {
    marginBottom: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
  },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.medium,
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyState: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    marginTop: theme.spacing.xl,
  },
  emptyText: {
    color: theme.colors.textSecondary,
  },
});
