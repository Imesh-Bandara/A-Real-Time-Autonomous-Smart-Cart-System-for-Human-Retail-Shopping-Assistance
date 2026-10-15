import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme/theme';
import {
  fetchShelves,
  createShelf,
  updateShelf,
  deleteShelf,
  assignProductShelf,
  fetchProducts,
  fetchShelfSections,
  updateShelfSection,
  Shelf,
  ShelfSection,
  Product,
} from '../../api/apiService';

const { width } = Dimensions.get('window');

export default function ShelfManagementScreen() {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State for Shelf Create / Edit
  const [shelfModalVisible, setShelfModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formShelfId, setFormShelfId] = useState('');
  const [formShelfName, setFormShelfName] = useState('');
  const [formX, setFormX] = useState('');
  const [formY, setFormY] = useState('');
  const [formTheta, setFormTheta] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State for Product-to-Shelf Assignment
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedShelfForAssign, setSelectedShelfForAssign] = useState<Shelf | null>(null);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [assigningProductId, setAssigningProductId] = useState<number | null>(null);

  // Modal State for Section Coordinate Editing
  const [sectionModalVisible, setSectionModalVisible] = useState(false);
  const [sectionModalShelf, setSectionModalShelf] = useState<Shelf | null>(null);
  const [sectionCoords, setSectionCoords] = useState<ShelfSection[]>([]);
  const [editingSectionNum, setEditingSectionNum] = useState<number | null>(null);
  const [secFormX, setSecFormX] = useState('');
  const [secFormY, setSecFormY] = useState('');
  const [secFormTheta, setSecFormTheta] = useState('0');
  const [isSavingSection, setIsSavingSection] = useState(false);

  const showAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [shelvesData, productsData] = await Promise.all([
        fetchShelves(true),
        fetchProducts(),
      ]);
      setShelves(shelvesData);
      setProducts(productsData);
    } catch (err: any) {
      showAlert('Error', typeof err === 'string' ? err : 'Failed to load shelf data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setFormShelfId('');
    setFormShelfName('');
    setFormX('');
    setFormY('');
    setFormTheta('0');
    setShelfModalVisible(true);
  };

  const handleOpenEditModal = (shelf: Shelf) => {
    setIsEditing(true);
    setFormShelfId(shelf.id);
    setFormShelfName(shelf.name);
    setFormX(shelf.x_coord.toString());
    setFormY(shelf.y_coord.toString());
    setFormTheta((shelf.orientation_theta ?? 0).toString());
    setShelfModalVisible(true);
  };

  const handleSaveShelf = async () => {
    const id = formShelfId.trim().toUpperCase();
    const name = formShelfName.trim();
    const x = parseFloat(formX);
    const y = parseFloat(formY);
    const theta = parseFloat(formTheta || '0');

    if (!id || !name) {
      showAlert('Validation Error', 'Shelf ID and Name are required.');
      return;
    }
    if (isNaN(x) || isNaN(y)) {
      showAlert('Validation Error', 'Valid numerical X and Y coordinates (in meters) are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing) {
        await updateShelf(id, {
          name,
          x_coord: x,
          y_coord: y,
          orientation_theta: isNaN(theta) ? 0 : theta,
        });
        showAlert('Success', `Shelf '${id}' updated successfully!`);
      } else {
        await createShelf({
          id,
          name,
          x_coord: x,
          y_coord: y,
          orientation_theta: isNaN(theta) ? 0 : theta,
        });
        showAlert('Success', `Shelf '${id}' created successfully!`);
      }
      setShelfModalVisible(false);
      loadData();
    } catch (err: any) {
      showAlert('Error', typeof err === 'string' ? err : 'Failed to save shelf.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShelf = (shelf: Shelf) => {
    const confirmDelete = async () => {
      try {
        await deleteShelf(shelf.id);
        showAlert('Deleted', `Shelf '${shelf.id}' has been removed.`);
        loadData();
      } catch (err: any) {
        showAlert('Error', typeof err === 'string' ? err : 'Failed to delete shelf.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete shelf '${shelf.name}' (${shelf.id})? Any assigned items will become unassigned.`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Confirm Delete',
        `Delete shelf '${shelf.name}' (${shelf.id})? Assigned products will be unlinked.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const handleOpenAssignModal = (shelf: Shelf) => {
    setSelectedShelfForAssign(shelf);
    setSearchProductQuery('');
    setAssignModalVisible(true);
  };

  const handleAssignProductSection = async (
    product: { id: number; name?: string; shelf_id?: string | null },
    targetShelfId: string,
    section: number = 1
  ) => {
    try {
      setAssigningProductId(product.id);
      await assignProductShelf(product.id, targetShelfId, section);
      await loadData();
    } catch (err: any) {
      showAlert('Error', typeof err === 'string' ? err : 'Failed to update product section.');
    } finally {
      setAssigningProductId(null);
    }
  };

  const handleOpenSectionModal = async (shelf: Shelf) => {
    setSectionModalShelf(shelf);
    setSectionModalVisible(true);
    setEditingSectionNum(null);
    try {
      const sections = await fetchShelfSections(shelf.id);
      setSectionCoords(sections);
    } catch {
      // Fall back to shelf.sections if API fails
      setSectionCoords(shelf.sections || []);
    }
  };

  const handleStartEditSection = (sec: ShelfSection) => {
    setEditingSectionNum(sec.section_number);
    setSecFormX(sec.x_coord.toString());
    setSecFormY(sec.y_coord.toString());
    setSecFormTheta((sec.orientation_theta ?? 0).toString());
  };

  const handleSaveSectionCoords = async () => {
    if (!sectionModalShelf || editingSectionNum === null) return;
    const x = parseFloat(secFormX);
    const y = parseFloat(secFormY);
    const theta = parseFloat(secFormTheta || '0');
    if (isNaN(x) || isNaN(y)) {
      showAlert('Validation', 'X and Y must be valid numbers.');
      return;
    }
    try {
      setIsSavingSection(true);
      const res = await updateShelfSection(sectionModalShelf.id, editingSectionNum, {
        x_coord: x,
        y_coord: y,
        orientation_theta: isNaN(theta) ? 0 : theta,
      });
      setSectionCoords(res.sections);
      setEditingSectionNum(null);
      // Refresh main list so section dots update
      loadData();
    } catch (err: any) {
      showAlert('Error', typeof err === 'string' ? err : 'Failed to save section coordinates.');
    } finally {
      setIsSavingSection(false);
    }
  };

  const handleUnassignProduct = async (product: { id: number; name?: string }) => {
    try {
      setAssigningProductId(product.id);
      await assignProductShelf(product.id, null, null);
      await loadData();
    } catch (err: any) {
      showAlert('Error', typeof err === 'string' ? err : 'Failed to unassign product.');
    } finally {
      setAssigningProductId(null);
    }
  };

  const handleToggleProductShelf = async (
    product: { id: number; name?: string; shelf_id?: string | null },
    targetShelfId: string,
    section: number = 1
  ) => {
    try {
      setAssigningProductId(product.id);
      const newShelfId = product.shelf_id === targetShelfId ? null : targetShelfId;
      await assignProductShelf(product.id, newShelfId, newShelfId ? section : null);
      await loadData();
    } catch (err: any) {
      showAlert('Error', typeof err === 'string' ? err : 'Failed to update product shelf.');
    } finally {
      setAssigningProductId(null);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchProductQuery.trim()) return products;
    const q = searchProductQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchProductQuery]);

  const totalAssignedProducts = useMemo(() => {
    return products.filter((p) => p.shelf_id).length;
  }, [products]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <LinearGradient
          colors={['#312E81', '#4F46E5', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroPretitle}>CartMate Retail Navigation</Text>
              <Text style={styles.heroTitle}>Shelf & Location Manager</Text>
              <Text style={styles.heroSubtitle}>
                Customize physical shelf coordinates & assign store items for autonomous cart pathfinding.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addShelfBtn}
              onPress={handleOpenCreateModal}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color="#312E81" style={{ marginRight: 6 }} />
              <Text style={styles.addShelfBtnText}>New Shelf</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{shelves.length}</Text>
              <Text style={styles.statLabel}>Configured Shelves</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalAssignedProducts}</Text>
              <Text style={styles.statLabel}>Mapped Products</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{products.length - totalAssignedProducts}</Text>
              <Text style={styles.statLabel}>Unassigned Items</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 2D Supermarket Map Floorplan Visualizer */}
        <View style={styles.mapCard}>
          <View style={styles.mapHeaderRow}>
            <View style={styles.mapTitleGroup}>
              <Ionicons name="map" size={18} color="#4F46E5" />
              <Text style={styles.mapCardTitle}>Supermarket Floor Plan (Store Map Meters)</Text>
            </View>
            <Text style={styles.mapCoordLegend}>Origin (0m, 0m) = Store Entrance</Text>
          </View>

          <View style={styles.mapCanvas}>
            {/* Grid overlay lines */}
            <View style={styles.gridLineHorizontal1} />
            <View style={styles.gridLineHorizontal2} />
            <View style={styles.gridLineVertical1} />
            <View style={styles.gridLineVertical2} />

            {/* Entrance pin */}
            <View style={styles.entrancePin}>
              <Ionicons name="enter-outline" size={12} color="#16A34A" />
              <Text style={styles.entrancePinText}>Entrance</Text>
            </View>

            {/* Shelf Markers on Map */}
            {shelves.map((shelf) => {
              // Normalize coordinates to percentage inside the box for preview
              // Assumes typical store dimension 0 to 6 meters
              const leftPercent = Math.min(Math.max((shelf.x_coord / 6.5) * 85, 10), 85);
              const topPercent = Math.min(Math.max((shelf.y_coord / 5.5) * 75, 10), 80);

              return (
                <TouchableOpacity
                  key={shelf.id}
                  style={[
                    styles.shelfPin,
                    { left: `${leftPercent}%`, top: `${topPercent}%` },
                  ]}
                  onPress={() => handleOpenEditModal(shelf)}
                  activeOpacity={0.8}
                >
                  <View style={styles.shelfPinIcon}>
                    <Text style={styles.shelfPinInitial}>{shelf.id.replace('SHELF_', '')}</Text>
                  </View>
                  <View style={styles.shelfPinTooltip}>
                    <Text style={styles.shelfPinTooltipTitle}>{shelf.id}</Text>
                    <Text style={styles.shelfPinTooltipCoord}>
                      ({shelf.x_coord}m, {shelf.y_coord}m)
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Shelves List */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>Physical Shelf Directory</Text>
          <Text style={styles.sectionSubheading}>
            Select a shelf to edit its navigation waypoints or reassign existing products.
          </Text>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={{ marginTop: 8, color: theme.colors.textSecondary }}>Loading shelves...</Text>
            </View>
          ) : shelves.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No Shelves Configured</Text>
              <Text style={styles.emptyDesc}>Tap '+ New Shelf' above to add your first physical shelf coordinate.</Text>
            </View>
          ) : (
            shelves.map((shelf) => {
              const assignedCount = shelf.products?.length ?? shelf.product_count ?? 0;

              return (
                <View key={shelf.id} style={styles.shelfCard}>
                  {/* Shelf Card Header */}
                  <View style={styles.shelfCardHeader}>
                    <View style={styles.shelfBadgeGroup}>
                      <View style={styles.shelfIdBadge}>
                        <Ionicons name="navigate-sharp" size={14} color="#FFFFFF" />
                        <Text style={styles.shelfIdBadgeText}>{shelf.id}</Text>
                      </View>
                      <View style={styles.coordBadge}>
                        <Ionicons name="location-outline" size={12} color="#4338CA" />
                        <Text style={styles.coordBadgeText}>
                          X: {shelf.x_coord}m • Y: {shelf.y_coord}m ({shelf.orientation_theta ?? 0}°)
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.shelfActionRow}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleOpenEditModal(shelf)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="create-outline" size={18} color="#4F46E5" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionIconBtn, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => handleDeleteShelf(shelf)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Shelf Title */}
                  <Text style={styles.shelfName}>{shelf.name}</Text>

                  {/* 5 Physical Shelf Sections */}
                  <View style={styles.assignedSection}>
                    <View style={styles.assignedHeader}>
                      <View>
                        <Text style={styles.assignedLabel}>
                          Shelf Partition ({assignedCount} items across 5 sections)
                        </Text>
                        <Text style={styles.assignedSubLabel}>
                          Section 1 (Front/Top) to Section 5 (Back/Bottom)
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.manageProductsBtn, { backgroundColor: '#EEF2FF', borderColor: '#6366F1' }]}
                          onPress={() => handleOpenSectionModal(shelf)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="navigate" size={14} color="#4F46E5" style={{ marginRight: 4 }} />
                          <Text style={[styles.manageProductsBtnText, { color: '#4F46E5' }]}>Section Coords</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.manageProductsBtn}
                          onPress={() => handleOpenAssignModal(shelf)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="swap-horizontal" size={14} color="#4F46E5" style={{ marginRight: 4 }} />
                          <Text style={styles.manageProductsBtnText}>Assign Items</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.sectionsContainer}>
                      {[1, 2, 3, 4, 5].map((sec) => {
                        const secItems = (shelf.products || []).filter(
                          (p) => (p.shelf_section || 1) === sec
                        );
                        // Show section coordinate badge from shelf.sections
                        const secCoord = (shelf.sections || []).find(s => s.section_number === sec);
                        return (
                          <View key={sec} style={styles.sectionRowItem}>
                            <View style={styles.sectionTagWrap}>
                              <View style={styles.sectionPill}>
                                <Text style={styles.sectionPillText}>Section {sec}</Text>
                              </View>
                              {secCoord && (
                                <Text style={styles.sectionCoordBadge}>
                                  ({secCoord.x_coord}m, {secCoord.y_coord}m)
                                </Text>
                              )}
                              <Text style={styles.sectionItemMeta}>
                                {secItems.length} {secItems.length === 1 ? 'item' : 'items'}
                              </Text>
                            </View>

                            <View style={styles.sectionItemsFlex}>
                              {secItems.length > 0 ? (
                                secItems.map((prod) => (
                                  <View key={prod.id} style={styles.productPillWithActions}>
                                    <View style={styles.productPillMain}>
                                      <Ionicons name="cube-outline" size={13} color="#4F46E5" />
                                      <Text style={styles.productPillText} numberOfLines={1}>{prod.name}</Text>
                                      <Text style={styles.productPillPrice}>${prod.price.toFixed(2)}</Text>
                                    </View>
                                    {/* Quick Section Shift Buttons */}
                                    <View style={styles.moveSecRow}>
                                      {[1, 2, 3, 4, 5].map((targetSec) => (
                                        <TouchableOpacity
                                          key={targetSec}
                                          style={[
                                            styles.moveSecPill,
                                            targetSec === sec && styles.moveSecPillActive,
                                          ]}
                                          onPress={() => handleAssignProductSection(prod, shelf.id, targetSec)}
                                          disabled={targetSec === sec}
                                        >
                                          <Text
                                            style={[
                                              styles.moveSecPillText,
                                              targetSec === sec && styles.moveSecPillTextActive,
                                            ]}
                                          >
                                            {targetSec}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                      <TouchableOpacity
                                        style={styles.unassignCrossBtn}
                                        onPress={() => handleUnassignProduct(prod)}
                                        activeOpacity={0.7}
                                      >
                                        <Ionicons name="close" size={12} color="#DC2626" />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ))
                              ) : (
                                <Text style={styles.emptySecNotice}>Empty section slot</Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* CREATE / EDIT SHELF MODAL */}
      <Modal
        visible={shelfModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShelfModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {isEditing ? `Edit ${formShelfId}` : 'Add Physical Shelf'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Configure map coordinate targets for autonomous CartMate robot pathfinding.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShelfModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Shelf ID */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Shelf Identifier (Primary Key)</Text>
                <TextInput
                  style={[styles.input, isEditing && styles.disabledInput]}
                  placeholder="e.g. SHELF_A, SHELF_D"
                  value={formShelfId}
                  onChangeText={setFormShelfId}
                  editable={!isEditing}
                  autoCapitalize="characters"
                />
                {isEditing && (
                  <Text style={styles.helperText}>Shelf ID is fixed. To change it, create a new shelf.</Text>
                )}
              </View>

              {/* Shelf Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Shelf Display Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Shelf A - Fruits & Vegetables"
                  value={formShelfName}
                  onChangeText={setFormShelfName}
                />
              </View>

              {/* Coordinates (X, Y) */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Map X Coord (m)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1.5"
                    keyboardType="numeric"
                    value={formX}
                    onChangeText={setFormX}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Map Y Coord (m)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2.0"
                    keyboardType="numeric"
                    value={formY}
                    onChangeText={setFormY}
                  />
                </View>
              </View>

              {/* Heading Orientation */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Orientation Theta (Degrees: 0°, 90°, 180°, 270°)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 0.0"
                  keyboardType="numeric"
                  value={formTheta}
                  onChangeText={setFormTheta}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShelfModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveShelf}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Create Shelf'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PRODUCT SHELF ASSIGNMENT MODAL */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Items to {selectedShelfForAssign?.id}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedShelfForAssign?.name} ({selectedShelfForAssign?.x_coord}m, {selectedShelfForAssign?.y_coord}m)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search filter for products */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products to place on this shelf..."
                value={searchProductQuery}
                onChangeText={setSearchProductQuery}
              />
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
              {filteredProducts.map((prod) => {
                const isAssignedHere = prod.shelf_id === selectedShelfForAssign?.id;
                const isBusy = assigningProductId === prod.id;

                return (
                  <View key={prod.id} style={styles.assignItemRow}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.assignItemName}>{prod.name}</Text>
                      <Text style={styles.assignItemDetails}>
                        ${prod.price.toFixed(2)} • Location:{' '}
                        <Text style={{ fontWeight: '700', color: isAssignedHere ? '#16A34A' : '#4F46E5' }}>
                          {prod.shelf_id ? `${prod.shelf_id} (Sec ${prod.shelf_section ?? 1})` : 'Unassigned'}
                        </Text>
                      </Text>

                      {/* 5 Section Assignment Buttons */}
                      <View style={styles.assignModalSecWrap}>
                        <Text style={styles.assignModalSecHint}>Assign to Section:</Text>
                        <View style={styles.assignModalSecChips}>
                          {[1, 2, 3, 4, 5].map((sec) => {
                            const isCurSec = isAssignedHere && (prod.shelf_section || 1) === sec;
                            return (
                              <TouchableOpacity
                                key={sec}
                                style={[
                                  styles.assignModalSecChip,
                                  isCurSec && styles.assignModalSecChipActive,
                                ]}
                                onPress={() =>
                                  selectedShelfForAssign &&
                                  handleAssignProductSection(prod, selectedShelfForAssign.id, sec)
                                }
                                disabled={isBusy}
                                activeOpacity={0.75}
                              >
                                <Text
                                  style={[
                                    styles.assignModalSecChipText,
                                    isCurSec && styles.assignModalSecChipTextActive,
                                  ]}
                                >
                                  Sec {sec}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                    {isAssignedHere ? (
                      <TouchableOpacity
                        style={styles.removeFromShelfBtn}
                        onPress={() => handleUnassignProduct(prod)}
                        disabled={isBusy}
                        activeOpacity={0.8}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Text style={styles.removeFromShelfBtnText}>Remove</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveBtn, { width: '100%' }]}
                onPress={() => setAssignModalVisible(false)}
              >
                <Text style={styles.saveBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SECTION COORDINATES MANAGEMENT MODAL */}
      <Modal
        visible={sectionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setSectionModalVisible(false); setEditingSectionNum(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Section Coordinates</Text>
                <Text style={styles.modalSubtitle}>
                  {sectionModalShelf?.name} — set precise x/y/θ per section
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setSectionModalVisible(false); setEditingSectionNum(null); }}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Info banner */}
              <View style={styles.secCoordsInfoBox}>
                <Ionicons name="information-circle-outline" size={16} color="#4338CA" style={{ marginRight: 6 }} />
                <Text style={styles.secCoordsInfoText}>
                  Each section has its own navigation target. The cart will stop at these exact
                  coordinates when collecting items from that section. Tap ✏️ Edit to customize.
                </Text>
              </View>

              {sectionCoords.map((sec) => {
                const isEditing = editingSectionNum === sec.section_number;
                return (
                  <View key={sec.section_number} style={styles.secCoordsRow}>
                    {/* Section Label */}
                    <View style={styles.secCoordsLabelRow}>
                      <View style={[styles.sectionPill, { marginBottom: 0 }]}>
                        <Text style={styles.sectionPillText}>Section {sec.section_number}</Text>
                      </View>
                      {!isEditing && (
                        <TouchableOpacity
                          style={styles.secCoordsEditBtn}
                          onPress={() => handleStartEditSection(sec)}
                        >
                          <Ionicons name="create-outline" size={15} color="#4F46E5" />
                          <Text style={styles.secCoordsEditBtnText}>Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Display row */}
                    {!isEditing ? (
                      <View style={styles.secCoordsDisplay}>
                        <Text style={styles.secCoordChip}>X: {sec.x_coord}m</Text>
                        <Text style={styles.secCoordChip}>Y: {sec.y_coord}m</Text>
                        <Text style={styles.secCoordChip}>θ: {sec.orientation_theta}°</Text>
                      </View>
                    ) : (
                      <View style={styles.secCoordsEditForm}>
                        <View style={styles.formRow}>
                          <View style={[styles.formGroup, { flex: 1, marginRight: 6 }]}>
                            <Text style={styles.formLabel}>X (m)</Text>
                            <TextInput
                              style={styles.input}
                              value={secFormX}
                              onChangeText={setSecFormX}
                              keyboardType="numeric"
                              placeholder="e.g. 1.5"
                            />
                          </View>
                          <View style={[styles.formGroup, { flex: 1, marginHorizontal: 6 }]}>
                            <Text style={styles.formLabel}>Y (m)</Text>
                            <TextInput
                              style={styles.input}
                              value={secFormY}
                              onChangeText={setSecFormY}
                              keyboardType="numeric"
                              placeholder="e.g. 2.0"
                            />
                          </View>
                          <View style={[styles.formGroup, { flex: 1, marginLeft: 6 }]}>
                            <Text style={styles.formLabel}>θ (°)</Text>
                            <TextInput
                              style={styles.input}
                              value={secFormTheta}
                              onChangeText={setSecFormTheta}
                              keyboardType="numeric"
                              placeholder="e.g. 0"
                            />
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={[styles.cancelBtn, { flex: 1 }]}
                            onPress={() => setEditingSectionNum(null)}
                            disabled={isSavingSection}
                          >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.saveBtn, { flex: 1 }]}
                            onPress={handleSaveSectionCoords}
                            disabled={isSavingSection}
                          >
                            {isSavingSection ? (
                              <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                              <Text style={styles.saveBtnText}>Save Section</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveBtn, { width: '100%' }]}
                onPress={() => { setSectionModalVisible(false); setEditingSectionNum(null); }}
              >
                <Text style={styles.saveBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  heroSection: {
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  heroPretitle: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: '#E0E7FF',
    fontSize: 13,
    marginTop: 6,
    maxWidth: 300,
    lineHeight: 18,
  },
  addShelfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
    }),
  },
  addShelfBtnText: {
    color: '#312E81',
    fontWeight: '800',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  mapCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.lg,
    marginTop: -16,
    borderRadius: 20,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadows.sm,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginLeft: 6,
  },
  mapCoordLegend: {
    fontSize: 11,
    color: '#64748B',
  },
  mapCanvas: {
    height: 140,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  gridLineHorizontal1: {
    position: 'absolute',
    top: '33%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  gridLineHorizontal2: {
    position: 'absolute',
    top: '66%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  gridLineVertical1: {
    position: 'absolute',
    left: '33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  gridLineVertical2: {
    position: 'absolute',
    left: '66%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  entrancePin: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  entrancePinText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    marginLeft: 3,
  },
  shelfPin: {
    position: 'absolute',
    alignItems: 'center',
  },
  shelfPinIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3 },
      web: { boxShadow: '0 2px 5px rgba(79, 70, 229, 0.4)' },
    }),
  },
  shelfPinInitial: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  shelfPinTooltip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    alignItems: 'center',
  },
  shelfPinTooltipTitle: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  shelfPinTooltipCoord: {
    color: '#94A3B8',
    fontSize: 8,
  },
  sectionContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSubheading: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: theme.spacing.lg,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
  },
  shelfCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: theme.spacing.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadows.sm,
  },
  shelfCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shelfBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shelfIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shelfIdBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  coordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  coordBadgeText: {
    color: '#4338CA',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  shelfActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shelfName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  assignedSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  assignedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manageProductsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  manageProductsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  productPillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  productPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 4,
  },
  productPillPrice: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  emptyProductsBox: {
    paddingVertical: 6,
  },
  emptyProductsText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
      web: { boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    maxWidth: 320,
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  disabledInput: {
    backgroundColor: '#E2E8F0',
    color: '#64748B',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontWeight: '700',
    color: '#475569',
    fontSize: 13,
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 13,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  assignItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  assignItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  assignItemDetails: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  toggleAssignBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  toggleAssignedActive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  toggleAssignInactive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  toggleAssignBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleAssignedActiveText: {
    color: '#DC2626',
  },
  toggleAssignInactiveText: {
    color: '#4F46E5',
  },
  assignedSubLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sectionsContainer: {
    marginTop: 10,
    gap: 8,
  },
  sectionRowItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  sectionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  sectionItemMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionItemsFlex: {
    gap: 6,
  },
  productPillWithActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  productPillMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  moveSecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moveSecPill: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  moveSecPillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  moveSecPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  moveSecPillTextActive: {
    color: '#FFFFFF',
  },
  unassignCrossBtn: {
    padding: 3,
    marginLeft: 2,
  },
  emptySecNotice: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94A3B8',
    paddingVertical: 2,
  },
  assignModalSecWrap: {
    marginTop: 6,
  },
  assignModalSecHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  assignModalSecChips: {
    flexDirection: 'row',
    gap: 5,
  },
  assignModalSecChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  assignModalSecChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  assignModalSecChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  assignModalSecChipTextActive: {
    color: '#FFFFFF',
  },
  removeFromShelfBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFromShelfBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  // Section coordinate badge inline under each section pill
  sectionCoordBadge: {
    fontSize: 10,
    color: '#6366F1',
    fontWeight: '600',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
    marginRight: 4,
  },
  // Section coords modal styles
  secCoordsInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  secCoordsInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#3730A3',
    lineHeight: 18,
  },
  secCoordsRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secCoordsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  secCoordsEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  secCoordsEditBtnText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
  },
  secCoordsDisplay: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  secCoordChip: {
    backgroundColor: '#E0E7FF',
    color: '#3730A3',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  secCoordsEditForm: {
    marginTop: 4,
  },
});

