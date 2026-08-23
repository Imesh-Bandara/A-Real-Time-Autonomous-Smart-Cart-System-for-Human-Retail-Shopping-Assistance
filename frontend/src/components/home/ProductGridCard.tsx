import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { getImageUrl } from '../../api/apiService';
import { theme } from '../../theme/theme';

interface ProductGridCardProps {
  id: number;
  name: string;
  price: number;
  stock: number;
  description?: string | null;
  imageUrl?: string | null;
  index?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(Pressable);

export const ProductGridCard: React.FC<ProductGridCardProps> = ({
  name,
  price,
  stock,
  imageUrl,
  index = 0,
  isFavorite = false,
  onToggleFavorite,
  onPress,
}) => {
  const resolvedImageUrl = getImageUrl(imageUrl);
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= 10;

  const cardScale = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const heartScale = useSharedValue(1);
  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleHeartPress = () => {
    heartScale.value = withSpring(1.3, { damping: 6, stiffness: 300 }, () => {
      heartScale.value = withSpring(1, { damping: 8 });
    });
    onToggleFavorite?.();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(420)}
      style={styles.wrapper}
    >
      <AnimatedTouchable
        style={[styles.card, cardAnimStyle]}
        onPress={onPress}
        onPressIn={() => {
          cardScale.value = withSpring(0.97, { damping: 14, stiffness: 300 });
        }}
        onPressOut={() => {
          cardScale.value = withSpring(1, { damping: 14, stiffness: 300 });
        }}
      >
        <View style={styles.imageWrap}>
          {resolvedImageUrl ? (
            <Image source={{ uri: resolvedImageUrl }} style={styles.image} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={26} color={theme.colors.textMuted} />
            </View>
          )}

          {isOutOfStock ? (
            <View style={[styles.badge, styles.badgeOut]}>
              <Text style={styles.badgeText}>Sold out</Text>
            </View>
          ) : isLowStock ? (
            <View style={[styles.badge, styles.badgeLow]}>
              <Text style={styles.badgeText}>{stock} left</Text>
            </View>
          ) : null}

          <Animated.View style={[styles.heartWrap, heartAnimStyle]}>
            <TouchableOpacity
              style={styles.heartBtn}
              activeOpacity={0.8}
              onPress={handleHeartPress}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={15}
                color={isFavorite ? theme.colors.error : theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.price}>${price.toFixed(2)}</Text>
      </AnimatedTouchable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '48%',
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 10,
    ...theme.shadows.sm,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    backgroundColor: theme.colors.borderLight,
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 118,
  },
  imagePlaceholder: {
    width: '100%',
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.borderLight,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  badgeLow: {
    backgroundColor: theme.colors.primary,
  },
  badgeOut: {
    backgroundColor: 'rgba(17,24,39,0.75)',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
  },
  heartWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  heartBtn: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  name: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 4,
  },
  price: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
});
