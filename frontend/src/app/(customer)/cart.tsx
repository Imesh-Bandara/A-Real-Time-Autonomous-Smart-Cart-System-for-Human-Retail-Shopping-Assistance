import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCart } from '../../context/CartContext';
import { theme } from '../../theme/theme';
import { getImageUrl, checkoutOrder, CheckoutResponse } from '../../api/apiService';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Animated checkmark circle component
// ─────────────────────────────────────────────────────────────────────────────
function SuccessRing() {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Ring pop-in
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 150 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      // Checkmark appears
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 120 }),
    ]).start(() => {
      // Gentle infinite pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <Animated.View style={[styles.ringWrap, { opacity, transform: [{ scale }, { scale: pulse }] }]}>
      <LinearGradient colors={['#6EE7B7', '#10B981', '#059669']} style={styles.ringGradient}>
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          <Ionicons name="checkmark" size={64} color="#FFFFFF" />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating particle dots decoration
// ─────────────────────────────────────────────────────────────────────────────
function FloatingDots() {
  const dots = Array.from({ length: 8 }, (_, i) => ({
    translateY: useRef(new Animated.Value(0)).current,
    opacity: useRef(new Animated.Value(0)).current,
    left: 30 + i * ((SW - 60) / 8),
    delay: i * 80,
    size: 6 + (i % 3) * 4,
    color: ['#6EE7B7', '#A78BFA', '#60A5FA', '#F9A8D4'][i % 4],
  }));

  useEffect(() => {
    dots.forEach((dot) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(dot.delay),
          Animated.parallel([
            Animated.timing(dot.opacity, { toValue: 0.7, duration: 400, useNativeDriver: true }),
            Animated.timing(dot.translateY, { toValue: -30, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(dot.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
          Animated.timing(dot.translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            bottom: 80,
            left: dot.left,
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: dot.color,
            opacity: dot.opacity,
            transform: [{ translateY: dot.translateY }],
          }}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Cart Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function CartScreen() {
  const router = useRouter();
  const { cartItems, cartTotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const [isNavigating, setIsNavigating] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null);

  // Success modal entrance animation
  const modalSlide = useRef(new Animated.Value(SH)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  const openSuccessModal = () => {
    setSuccessModalVisible(true);
    Animated.parallel([
      Animated.timing(bgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(modalSlide, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
    ]).start();
  };

  const closeSuccessModal = () => {
    Animated.parallel([
      Animated.timing(bgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(modalSlide, { toValue: SH, duration: 260, useNativeDriver: true }),
    ]).start(() => {
      setSuccessModalVisible(false);
      modalSlide.setValue(SH);
      bgOpacity.setValue(0);
      router.push('/(customer)/shop');
    });
  };

  const handleUpdateQuantity = (productId: number, qty: number) => {
    updateQuantity(productId, qty);
  };

  // ── Trigger order → MQTT (includes shelf + section + all coords via backend) ──
  const handleStartNavigation = async () => {
    if (cartItems.length === 0) return;
    try {
      setIsNavigating(true);
      const productIds = cartItems.map((item) => item.product.id);
      // Backend handles: section coords + shelf coords + MQTT publish
      const result = await checkoutOrder(productIds, 'CART_01');
      setCheckoutResult(result);
      clearCart();
      openSuccessModal();
    } catch (err: any) {
      if (Platform.OS === 'web') {
        alert(`Navigation Error: ${typeof err === 'string' ? err : 'Failed to dispatch route to cart.'}`);
      } else {
        const { Alert } = require('react-native');
        Alert.alert('Navigation Error', typeof err === 'string' ? err : 'Failed to dispatch route to cart.');
      }
    } finally {
      setIsNavigating(false);
    }
  };

  const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  const renderItem = ({ item }: { item: typeof cartItems[0] }) => (
    <View style={styles.cartItem}>
      <View style={styles.imageContainer}>
        {item.product.image_url ? (
          <Image
            source={{ uri: getImageUrl(item.product.image_url) as string }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="cube-outline" size={28} color="#A5B4FC" />
          </View>
        )}
      </View>

      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.product.name}</Text>
        <Text style={styles.itemPrice}>${item.product.price.toFixed(2)} each</Text>
        <Text style={styles.itemSubtotal}>Subtotal: ${item.subtotal.toFixed(2)}</Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
          >
            <Ionicons name="remove" size={16} color="#4F46E5" />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
          >
            <Ionicons name="add" size={16} color="#4F46E5" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeFromCart(item.product.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Cart</Text>
          {itemCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        <FlatList
          data={cartItems}
          keyExtractor={(item) => item.product.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="cart-outline" size={56} color="#A5B4FC" />
              </View>
              <Text style={styles.emptyText}>Your cart is empty</Text>
              <Text style={styles.emptySubText}>
                Browse products and add items to get started.
              </Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => router.push('/(customer)/shop')}
                activeOpacity={0.85}
              >
                <Text style={styles.browseBtnText}>Browse Products</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Footer with order button */}
        {cartItems.length > 0 && (
          <View style={styles.footer}>
            <View style={styles.footerSummary}>
              <View>
                <Text style={styles.footerLabel}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
                <Text style={styles.footerSubLabel}>Ready to dispatch to smart cart</Text>
              </View>
              <Text style={styles.footerTotal}>${cartTotal.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.startNavButton, isNavigating && styles.disabledButton]}
              onPress={handleStartNavigation}
              disabled={isNavigating}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5', '#4338CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.navBtnGradient}
              >
                {isNavigating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                    <Text style={styles.startNavButtonText}>Submit Order</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─────────────────────────────────────────────── */}
      {/* ELEGANT SUCCESS SWEET-ALERT MODAL              */}
      {/* ─────────────────────────────────────────────── */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSuccessModal}
      >
        <Animated.View style={[styles.sweetAlertOverlay, { opacity: bgOpacity }]}>
          <FloatingDots />

          <Animated.View style={[styles.sweetAlertCard, { transform: [{ translateY: modalSlide }] }]}>
            {/* Top gradient bar */}
            <LinearGradient
              colors={['#059669', '#10B981', '#34D399']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sweetAlertTopBar}
            />

            {/* Animated success ring */}
            <View style={styles.sweetAlertIconArea}>
              {successModalVisible && <SuccessRing />}
            </View>

            {/* Main text */}
            <Text style={styles.sweetAlertTitle}>Order Submitted! 🎉</Text>
            <Text style={styles.sweetAlertOrderId}>
              {checkoutResult?.order_id || 'Your order'}
            </Text>
            <Text style={styles.sweetAlertDesc}>
              Your smart cart has received the navigation route and is on its way to collect your items.
            </Text>

            {/* Status pills */}
            <View style={styles.statusPillsRow}>
              <View style={[styles.statusPill, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="wifi" size={14} color="#059669" />
                <Text style={[styles.statusPillText, { color: '#065F46' }]}>
                  {checkoutResult?.mqtt_published ? 'MQTT Published' : 'Order Recorded'}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="cart" size={14} color="#3B82F6" />
                <Text style={[styles.statusPillText, { color: '#1E40AF' }]}>
                  {checkoutResult?.cart_id || 'CART_01'}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="layers" size={14} color="#7C3AED" />
                <Text style={[styles.statusPillText, { color: '#4C1D95' }]}>
                  {checkoutResult?.waypoints?.length ?? 0} Stop{(checkoutResult?.waypoints?.length ?? 0) !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Items summary — just product names, NO coords */}
            <View style={styles.itemsSummaryBox}>
              <Text style={styles.itemsSummaryTitle}>Items in this order</Text>
              {checkoutResult?.waypoints?.flatMap(wp => wp.items).map((item, i) => (
                <View key={i} style={styles.itemSummaryRow}>
                  <View style={styles.itemSummaryDot} />
                  <Text style={styles.itemSummaryText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Order Total</Text>
              <Text style={styles.totalAmount}>${checkoutResult?.total_amount?.toFixed(2) ?? '—'}</Text>
            </View>

            {/* CTA button */}
            <TouchableOpacity
              style={styles.sweetAlertBtn}
              onPress={closeSuccessModal}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sweetAlertBtnGradient}
              >
                <Ionicons name="storefront-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.sweetAlertBtnText}>Continue Shopping</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    paddingTop: 8,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 12px rgba(100,116,139,0.1)' },
    }),
  },
  imageContainer: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: '#F1F5F9',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
  actions: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingLeft: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    padding: 7,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
    marginHorizontal: 10,
    minWidth: 16,
    textAlign: 'center',
  },
  removeBtn: {
    padding: 6,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
    marginBottom: 24,
  },
  browseBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 8 },
      web: { boxShadow: '0 -3px 16px rgba(0,0,0,0.08)' },
    }),
  },
  footerSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  footerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  footerSubLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  footerTotal: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  startNavButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  navBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: 18,
  },
  disabledButton: {
    opacity: 0.65,
  },
  startNavButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── Sweet Alert Modal ──────────────────────────────────────────────────────
  sweetAlertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 30, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sweetAlertCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 0,
    maxHeight: SH * 0.9,
    overflow: 'hidden',
    alignItems: 'center',
  },
  sweetAlertTopBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
    alignSelf: 'center',
  },
  sweetAlertIconArea: {
    marginTop: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  ringWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    ...Platform.select({
      ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 12 },
      web: { boxShadow: '0 10px 40px rgba(16,185,129,0.4)' },
    }),
  },
  ringGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sweetAlertTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  sweetAlertOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.5,
    textAlign: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sweetAlertDesc: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: 20,
  },
  statusPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemsSummaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  itemsSummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemSummaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#6366F1',
    marginRight: 10,
  },
  itemSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  totalRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  totalAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  sweetAlertBtn: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  sweetAlertBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
  },
  sweetAlertBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
