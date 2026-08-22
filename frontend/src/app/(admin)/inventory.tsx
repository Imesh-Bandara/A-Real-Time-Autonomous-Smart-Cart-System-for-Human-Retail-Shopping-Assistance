import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Platform,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

import { Ionicons } from '@expo/vector-icons';
import { fetchProducts, addProduct, deleteProduct, getImageUrl, Product } from '../../api/apiService';
import { theme } from '../../theme/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AdminSectionHeader } from '../../components/admin/AdminSectionHeader';

export default function AdminInventory() {

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const showAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setStock('');
    setDescription('');
    setImageUri(null);
    setImageName(null);
    setImageType(null);
    setIsAdding(false);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await fetchProducts();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission needed', 'Please allow access to your photo library to upload product images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageName(asset.fileName || `product-${Date.now()}.jpg`);
      setImageType(asset.mimeType || 'image/jpeg');
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !price || !stock) {
      showAlert('Missing fields', 'Please fill in name, price, and stock.');
      return;
    }

    try {
      await addProduct({
        name: name.trim(),
        price,
        stock,
        description: description.trim() || null,
        imageUri,
        imageName,
        imageType,
      });
      resetForm();
      loadProducts();
      showAlert('Success', 'Product saved');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to add product');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProduct(id);
      loadProducts();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to delete product');
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ListHeader = (
    <View>
      <LinearGradient
        colors={[theme.colors.heroStart, theme.colors.heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        <View style={styles.heroHeader}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => (navigation as any).openDrawer?.() || navigation.dispatch?.({ type: 'OPEN_DRAWER' })}
            activeOpacity={0.8}
          >
            <Ionicons name="menu-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.heroText}>
            <Text style={styles.heroOverline}>INVENTORY</Text>
            <Text style={styles.heroTitle}>Product manager</Text>
            <Text style={styles.heroSubtitle}>{products.length} items in catalog</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => (isAdding ? resetForm() : setIsAdding(true))}
            activeOpacity={0.85}
          >
            <Ionicons name={isAdding ? 'close' : 'add'} size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
          <TextInput
            placeholder="Search inventory..."
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </LinearGradient>

      <View style={styles.bodyContent}>
        {isAdding && (
          <View style={styles.addForm}>
            <AdminSectionHeader overline="NEW ITEM" title="Add product" />
            <Input label="Name" value={name} onChangeText={setName} />
            <Input
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Brief product description..."
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }}
            />
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input label="Price" value={price} onChangeText={setPrice} keyboardType="numeric" />
              </View>
              <View style={styles.halfInput}>
                <Input label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
              </View>
            </View>

            <Text style={styles.imageLabel}>Product image</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <View style={styles.uploadIconWrap}>
                    <Ionicons name="cloud-upload-outline" size={22} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.imagePlaceholderText}>Tap to upload image</Text>
                </View>
              )}
            </TouchableOpacity>
            {imageUri && (
              <Button
                title="Remove image"
                variant="secondary"
                size="small"
                onPress={() => {
                  setImageUri(null);
                  setImageName(null);
                  setImageType(null);
                }}
                style={{ marginBottom: theme.spacing.md }}
              />
            )}
            <Button title="Save product" onPress={handleSave} />
          </View>
        )}

        <AdminSectionHeader
          overline="CATALOG"
          title="All products"
          subtitle={`Showing ${filteredProducts.length} items`}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading && products.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={32} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptyText}>Add your first product using the + button above.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = item.stock <= 0 ? 'error' : item.stock <= 10 ? 'warning' : 'success';
            const label = item.stock <= 0 ? 'Out of stock' : item.stock <= 10 ? 'Low stock' : 'In stock';
            const imageUrl = getImageUrl(item.image_url);

            return (
              <View style={styles.rowCard}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.rowImage} />
                ) : (
                  <View style={styles.rowImagePlaceholder}>
                    <Ionicons name="image-outline" size={20} color={theme.colors.textMuted} />
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.rowDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <Text style={styles.rowPrice}>${item.price.toFixed(2)}</Text>
                  <StatusBadge status={status} label={label} />
                </View>
                <View style={styles.rowActions}>
                  <Text style={styles.stockText}>{item.stock} units</Text>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 40 },
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
  addBtn: {
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
    gap: 10,
    ...theme.shadows.md,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    padding: 0,
  },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  addForm: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.large,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfInput: { flex: 1 },
  imageLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  imagePicker: {
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.borderLight,
  },
  imagePreview: {
    width: '100%',
    height: 180,
  },
  imagePlaceholder: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.promoBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  rowCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  rowImage: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.medium,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.borderLight,
  },
  rowImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.medium,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowInfo: { flex: 1, paddingRight: 8 },
  rowName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  rowDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: 6,
    lineHeight: 16,
  },
  rowPrice: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    marginBottom: 8,
  },
  rowActions: { alignItems: 'flex-end' },
  stockText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.errorBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    marginHorizontal: theme.spacing.lg,
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
});
