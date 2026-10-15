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
  ScrollView,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchProducts,
  addProduct,
  deleteProduct,
  getImageUrl,
  fetchShelves,
  assignProductShelf,
  Product,
  Shelf,
} from '../../api/apiService';
import { theme } from '../../theme/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AdminSectionHeader } from '../../components/admin/AdminSectionHeader';

export default function AdminInventory() {
  const router = useRouter();
  const navigation = useNavigation();

  const [products, setProducts] = useState<Product[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Product Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState('');
  const [selectedSection, setSelectedSection] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Edit Product Shelf Location State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editShelfId, setEditShelfId] = useState<string>('');
  const [editSection, setEditSection] = useState<number>(1);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const showAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setStock('');
    setSelectedShelfId('');
    setSelectedSection(1);
    setDescription('');
    setImageUri(null);
    setImageName(null);
    setImageType(null);
    setIsAdding(false);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const [productsData, shelvesData] = await Promise.all([
        fetchProducts(),
        fetchShelves(false).catch(() => []),
      ]);
      setProducts(productsData);
      setShelves(shelvesData);
    } catch (e: any) {
      console.log('Failed to fetch catalog', e);
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
        shelf_id: selectedShelfId || null,
        shelf_section: selectedShelfId ? selectedSection : null,
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

  const handleOpenEditLocation = (product: Product) => {
    setEditingProduct(product);
    setEditShelfId(product.shelf_id || '');
    setEditSection(product.shelf_section || 1);
    setEditModalVisible(true);
  };

  const handleSaveLocation = async () => {
    if (!editingProduct) return;
    try {
      setIsSavingLocation(true);
      const res = await assignProductShelf(
        editingProduct.id,
        editShelfId || null,
        editShelfId ? editSection : null
      );
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? res.product : p))
      );
      setEditModalVisible(false);
      showAlert(
        'Location Updated',
        res.product.shelf_id
          ? `${res.product.name} location updated to ${res.product.shelf_id} (Section ${res.product.shelf_section})`
          : `${res.product.name} is now unassigned from shelves.`
      );
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to update shelf location');
    } finally {
      setIsSavingLocation(false);
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
            onPress={() => (navigation as any).openDrawer?.()}
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

        <View style={styles.shelfLinkBanner}>
          <View style={styles.shelfLinkLeft}>
            <Ionicons name="layers" size={16} color="#C4B5FD" />
            <Text style={styles.shelfLinkText}>
              {shelves.length} shelves mapped with cart coordinates
            </Text>
          </View>
          <TouchableOpacity
            style={styles.shelfLinkBtn}
            onPress={() => router.push('/(admin)/shelves')}
            activeOpacity={0.8}
          >
            <Text style={styles.shelfLinkBtnText}>Shelf & Map</Text>
            <Ionicons name="arrow-forward" size={12} color="#FFF" />
          </TouchableOpacity>
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

            <Text style={styles.shelfSelectorLabel}>Assign Shelf Location</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfChipsRow}
            >
              <TouchableOpacity
                style={[styles.shelfChip, !selectedShelfId && styles.shelfChipActive]}
                onPress={() => setSelectedShelfId('')}
                activeOpacity={0.8}
              >
                <Text style={[styles.shelfChipText, !selectedShelfId && styles.shelfChipTextActive]}>
                  Unassigned
                </Text>
              </TouchableOpacity>
              {shelves.map((s) => {
                const isActive = selectedShelfId === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.shelfChip, isActive && styles.shelfChipActive]}
                    onPress={() => setSelectedShelfId(s.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="layers"
                      size={12}
                      color={isActive ? '#FFF' : '#6366F1'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.shelfChipText, isActive && styles.shelfChipTextActive]}>
                      {s.id}: {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedShelfId ? (
              <View style={styles.sectionSelectWrap}>
                <Text style={styles.shelfSelectorLabel}>
                  Shelf Section (1 to 5)
                </Text>
                <View style={styles.sectionRow}>
                  {[1, 2, 3, 4, 5].map((sec) => {
                    const isSecActive = selectedSection === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        style={[styles.sectionChip, isSecActive && styles.sectionChipActive]}
                        onPress={() => setSelectedSection(sec)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.sectionChipNumber, isSecActive && styles.sectionChipNumberActive]}>
                          {sec}
                        </Text>
                        <Text style={[styles.sectionChipLabel, isSecActive && styles.sectionChipLabelActive]}>
                          Sec {sec}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

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
                  
                  <TouchableOpacity
                    style={item.shelf || item.shelf_id ? styles.shelfBadge : styles.shelfBadgeUnassigned}
                    onPress={() => handleOpenEditLocation(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="layers"
                      size={11}
                      color={item.shelf || item.shelf_id ? '#4F46E5' : '#D97706'}
                    />
                    <Text
                      style={item.shelf || item.shelf_id ? styles.shelfBadgeText : styles.shelfBadgeTextUnassigned}
                      numberOfLines={1}
                    >
                      {item.shelf_id
                        ? `${item.shelf_id} • Sec ${item.shelf_section ?? 1}${item.shelf?.name ? ` (${item.shelf.name.replace(/Shelf [A-Z] - /, '')})` : ''}`
                        : 'No shelf • Tap to set'}
                    </Text>
                    <Ionicons
                      name="pencil"
                      size={10}
                      color={item.shelf || item.shelf_id ? '#6366F1' : '#D97706'}
                      style={{ marginLeft: 3 }}
                    />
                  </TouchableOpacity>

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
                  <View style={styles.actionBtnRow}>
                    <TouchableOpacity
                      style={styles.editLocBtn}
                      onPress={() => handleOpenEditLocation(item)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="navigate-outline" size={13} color="#4F46E5" />
                      <Text style={styles.editLocBtnText}>Shelf</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(item.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* EDIT SHELF & SECTION MODAL */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleGroup}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="location" size={20} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Edit Shelf Location</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {editingProduct?.name} (${editingProduct?.price?.toFixed(2)})
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionLabel}>1. Select Physical Shelf</Text>
              <View style={styles.shelfOptionsGrid}>
                <TouchableOpacity
                  style={[
                    styles.shelfOptionCard,
                    !editShelfId && styles.shelfOptionCardActive,
                  ]}
                  onPress={() => setEditShelfId('')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color={!editShelfId ? '#4F46E5' : theme.colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.shelfOptionTitle,
                      !editShelfId && styles.shelfOptionTitleActive,
                    ]}
                  >
                    Unassigned
                  </Text>
                  <Text style={styles.shelfOptionSub}>No waypoint</Text>
                </TouchableOpacity>

                {shelves.map((s) => {
                  const isSelected = editShelfId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.shelfOptionCard,
                        isSelected && styles.shelfOptionCardActive,
                      ]}
                      onPress={() => setEditShelfId(s.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="navigate"
                        size={18}
                        color={isSelected ? '#4F46E5' : '#6B7280'}
                      />
                      <Text
                        style={[
                          styles.shelfOptionTitle,
                          isSelected && styles.shelfOptionTitleActive,
                        ]}
                      >
                        {s.id}
                      </Text>
                      <Text style={styles.shelfOptionSub} numberOfLines={1}>
                        {s.name.replace(/Shelf [A-Z] - /, '')}
                      </Text>
                      <Text style={styles.shelfOptionCoords}>
                        ({s.x_coord}m, {s.y_coord}m)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {editShelfId ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.modalSectionLabel}>
                    2. Select Shelf Section (1 to 5)
                  </Text>
                  <Text style={styles.modalSectionHelp}>
                    Each shelf is divided into 5 physical sections. The autonomous cart will guide the shopper directly to this section.
                  </Text>
                  <View style={styles.modalSectionsRow}>
                    {[1, 2, 3, 4, 5].map((sec) => {
                      const isSecSelected = editSection === sec;
                      return (
                        <TouchableOpacity
                          key={sec}
                          style={[
                            styles.modalSecBox,
                            isSecSelected && styles.modalSecBoxActive,
                          ]}
                          onPress={() => setEditSection(sec)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.modalSecNumberCircle,
                              isSecSelected && styles.modalSecNumberCircleActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.modalSecNumber,
                                isSecSelected && styles.modalSecNumberActive,
                              ]}
                            >
                              {sec}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.modalSecTitle,
                              isSecSelected && styles.modalSecTitleActive,
                            ]}
                          >
                            Sec {sec}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  isSavingLocation && styles.modalSaveBtnDisabled,
                ]}
                onPress={handleSaveLocation}
                disabled={isSavingLocation}
                activeOpacity={0.85}
              >
                {isSavingLocation ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-sharp" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSaveText}>Save Location</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  shelfLinkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  shelfLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  shelfLinkText: {
    color: '#FFF',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  shelfLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  shelfLinkBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
  },
  shelfSelectorLabel: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shelfChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  shelfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    marginRight: 8,
  },
  shelfChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  shelfChipText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  shelfChipTextActive: {
    color: '#FFF',
    fontWeight: theme.typography.weights.bold,
  },
  shelfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    gap: 4,
    marginBottom: 6,
    maxWidth: '90%',
  },
  shelfBadgeText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: theme.typography.weights.medium,
  },
  shelfBadgeUnassigned: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    gap: 4,
    marginBottom: 6,
  },
  shelfBadgeTextUnassigned: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: theme.typography.weights.medium,
  },
  sectionSelectWrap: {
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  sectionChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.medium,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  sectionChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  sectionChipNumber: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  sectionChipNumberActive: {
    color: '#FFFFFF',
  },
  sectionChipLabel: {
    fontSize: 10,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sectionChipLabelActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: theme.radius.small,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 3,
  },
  editLocBtnText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: '#4F46E5',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: 20,
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: theme.radius.pill,
  },
  modalScroll: {
    paddingVertical: 14,
  },
  modalSectionLabel: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalSectionHelp: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  shelfOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shelfOptionCard: {
    width: '48%',
    padding: 12,
    borderRadius: theme.radius.medium,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  shelfOptionCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  shelfOptionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginTop: 4,
  },
  shelfOptionTitleActive: {
    color: '#4F46E5',
  },
  shelfOptionSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  shelfOptionCoords: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalSectionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  modalSecBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: theme.radius.medium,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  modalSecBoxActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  modalSecNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalSecNumberCircleActive: {
    backgroundColor: '#4F46E5',
  },
  modalSecNumber: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  modalSecNumberActive: {
    color: '#FFFFFF',
  },
  modalSecTitle: {
    fontSize: 10,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  modalSecTitleActive: {
    color: '#4F46E5',
    fontWeight: theme.typography.weights.bold,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.medium,
  },
  modalCancelText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.medium,
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
});
