import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '../api/apiService';

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  stock: number;
  description?: string | null;
  imageUrl?: string | null;
  cartCount?: number;
  onAdd?: () => void;
  onRemove?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
  compact?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  price,
  stock,
  description,
  imageUrl,
  cartCount = 0,
  onAdd,
  onRemove,
  onDelete,
  isAdmin = false,
  compact = false,
}) => {
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 10;
  const resolvedImageUrl = getImageUrl(imageUrl);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[styles.card, compact && styles.compactCard]}
    >
      {resolvedImageUrl ? (
        <Image
          source={{ uri: resolvedImageUrl }}
          style={[styles.productImage, compact && styles.compactImage]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.imagePlaceholder, compact && styles.compactImage]}>
          <Ionicons name="image-outline" size={compact ? 28 : 36} color="#94A3B8" />
        </View>
      )}

      <View style={[styles.headerRow, compact && styles.compactHeaderRow]}>
        <View style={styles.titleContainer}>
          <Text style={[styles.productTitle, compact && styles.compactTitle]} numberOfLines={1}>
            {name}
          </Text>
          {description ? (
            <Text
              style={[styles.productDescription, compact && styles.compactDescription]}
              numberOfLines={compact ? 2 : 3}
            >
              {description}
            </Text>
          ) : null}
          <Text style={[styles.productPrice, compact && styles.compactPrice]}>
            ${price.toFixed(2)}
          </Text>
        </View>

        <View
          style={[
            styles.badge,
            isOutOfStock
              ? styles.badgeOut
              : isLowStock
              ? styles.badgeLow
              : styles.badgeIn,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isOutOfStock
                ? styles.badgeTextOut
                : isLowStock
                ? styles.badgeTextLow
                : styles.badgeTextIn,
            ]}
          >
            {isOutOfStock ? 'Out of Stock' : `${stock} Left`}
          </Text>
        </View>
      </View>

      {!compact && (
        <View style={styles.footerRow}>
          {isAdmin ? (
            <AnimatedPressable
              style={[styles.deleteButton, animatedStyle]}
              onPress={onDelete}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Text style={styles.deleteButtonText}>Remove Item</Text>
            </AnimatedPressable>
          ) : (
            <View style={styles.cartActionWrapper}>
              {cartCount > 0 ? (
                <View style={styles.quantityStepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={onRemove}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>

                  <Text style={styles.quantityText}>{cartCount}</Text>

                  <TouchableOpacity
                    style={[styles.stepperBtn, isOutOfStock && styles.disabledBtn]}
                    onPress={onAdd}
                    disabled={isOutOfStock}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <AnimatedPressable
                  style={[styles.addToCartButton, isOutOfStock && styles.disabledBtn, animatedStyle]}
                  onPress={onAdd}
                  disabled={isOutOfStock}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                >
                  <LinearGradient
                    colors={isOutOfStock ? ['#94A3B8', '#94A3B8'] : ['#001A5C', '#002583']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addToCartGradient}
                  >
                    <Text style={styles.addToCartText}>
                      {isOutOfStock ? 'Unavailable' : '+ Add to Cart'}
                    </Text>
                  </LinearGradient>
                </AnimatedPressable>
              )}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F8FAFC',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 10px 30px rgba(100, 116, 139, 0.1)',
      },
    }),
  },
  compactCard: {
    width: 180,
    padding: 12,
    marginBottom: 0,
    marginRight: 12,
  },
  productImage: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
  },
  compactImage: {
    height: 110,
    marginBottom: 10,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  compactHeaderRow: {
    marginBottom: 0,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  productTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  compactTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 8,
  },
  compactDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#002583',
  },
  compactPrice: {
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeIn: { backgroundColor: '#F0FDF4' },
  badgeLow: { backgroundColor: '#FFFBEB' },
  badgeOut: { backgroundColor: '#FEF2F2' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextIn: { color: '#16A34A' },
  badgeTextLow: { color: '#D97706' },
  badgeTextOut: { color: '#DC2626' },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cartActionWrapper: {
    width: '100%',
    alignItems: 'flex-end',
  },
  addToCartButton: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#002583', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 4 },
      web: { boxShadow: '0px 6px 15px rgba(0, 37, 131, 0.3)' },
    }),
  },
  addToCartGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0px 2px 5px rgba(0,0,0,0.05)' },
    }),
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 20,
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
