import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { getImageUrl } from '../../api/apiService';
import { theme } from '../../theme/theme';

interface HomeProductTileProps {
  id: number;
  name: string;
  price: number;
  stock: number;
  description?: string | null;
  imageUrl?: string | null;
  index?: number;
  onPress?: () => void;
}

export const HomeProductTile: React.FC<HomeProductTileProps> = ({
  name,
  price,
  stock,
  description,
  imageUrl,
  index = 0,
  onPress,
}) => {
  const resolvedImageUrl = getImageUrl(imageUrl);
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= 10;

  return (
    <Animated.View entering={FadeInRight.delay(index * 60).duration(400)}>
      <TouchableOpacity
        style={styles.tile}
        activeOpacity={0.88}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.imageWrap}>
          {resolvedImageUrl ? (
            <Image source={{ uri: resolvedImageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={24} color={theme.colors.textMuted} />
            </View>
          )}
          {isLowStock && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Limited</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : (
            <View style={styles.descriptionSpacer} />
          )}
          <View style={styles.footer}>
            <Text style={styles.price}>${price.toFixed(2)}</Text>
            <View style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}>
              <Ionicons name="add" size={16} color="#FFF" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tile: {
    width: 170,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  imageWrap: {
    position: 'relative',
    backgroundColor: theme.colors.borderLight,
  },
  image: {
    width: '100%',
    height: 116,
  },
  imagePlaceholder: {
    width: '100%',
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.borderLight,
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  name: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    letterSpacing: theme.typography.letterSpacing.tight,
    marginBottom: 6,
  },
  description: {
    fontSize: theme.typography.sizes.xs,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    minHeight: 34,
  },
  descriptionSpacer: {
    height: 34,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: theme.colors.textMuted,
  },
});
