import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

export type SortOption = 'recommended' | 'price_asc' | 'price_desc' | 'name_asc';
export type AvailabilityOption = 'all' | 'in_stock' | 'out_of_stock';

export interface ShopFilters {
  sortBy: SortOption;
  categories: string[];
  priceBucket: string | null;
  availability: AvailabilityOption;
  offers: string[];
  dietary: string[];
}

export const DEFAULT_FILTERS: ShopFilters = {
  sortBy: 'recommended',
  categories: [],
  priceBucket: null,
  availability: 'all',
  offers: [],
  dietary: [],
};

export const PRICE_BUCKETS = [
  { key: 'under10', label: 'Under $10', min: 0, max: 10 },
  { key: '10to25', label: '$10 – $25', min: 10, max: 25 },
  { key: '25to50', label: '$25 – $50', min: 25, max: 50 },
  { key: '50plus', label: '$50+', min: 50, max: Infinity },
];

export const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'name_asc', label: 'Name: A to Z' },
];

export const CATEGORY_OPTIONS = [
  { label: 'Fruits', icon: 'nutrition' as const, color: '#FF9F5A' },
  { label: 'Vegetables', icon: 'leaf' as const, color: '#2ECC9B' },
  { label: 'Dairy', icon: 'water' as const, color: '#38C6E8' },
  { label: 'Snacks', icon: 'fast-food' as const, color: '#F5677D' },
  { label: 'Beverages', icon: 'wine' as const, color: '#B478E8' },
];

const OFFER_OPTIONS = ['On Sale', 'Best Deals', 'Buy 1 Get 1', 'Discounts'];
const DIETARY_OPTIONS = ['Organic', 'Vegan', 'Sugar Free', 'Gluten Free', 'Halal'];

function countActive(f: ShopFilters): number {
  let n = 0;
  if (f.sortBy !== 'recommended') n += 1;
  n += f.categories.length;
  if (f.priceBucket) n += 1;
  if (f.availability !== 'all') n += 1;
  n += f.offers.length;
  n += f.dietary.length;
  return n;
}

function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && { backgroundColor: color || theme.colors.primary, borderColor: color || theme.colors.primary }]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? '#FFFFFF' : color || theme.colors.textSecondary} />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ShopFilters;
  onApply: (filters: ShopFilters) => void;
}

export const FilterSheet: React.FC<FilterSheetProps> = ({ visible, onClose, filters, onApply }) => {
  const [draft, setDraft] = useState<ShopFilters>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const toggleInList = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const handleReset = () => setDraft(DEFAULT_FILTERS);

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filter &amp; Sort</Text>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.75} onPress={onClose}>
              <Ionicons name="close" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Section title="Sort By">
              <View style={styles.sortList}>
                {SORT_OPTIONS.map((opt) => {
                  const selected = draft.sortBy === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={styles.sortRow}
                      activeOpacity={0.7}
                      onPress={() => setDraft((d) => ({ ...d, sortBy: opt.key }))}
                    >
                      <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                        {selected && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.sortLabel, selected && styles.sortLabelActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            <Section title="Categories">
              <View style={styles.chipRow}>
                {CATEGORY_OPTIONS.map((cat) => (
                  <Chip
                    key={cat.label}
                    label={cat.label}
                    icon={cat.icon}
                    color={cat.color}
                    selected={draft.categories.includes(cat.label)}
                    onPress={() =>
                      setDraft((d) => ({ ...d, categories: toggleInList(d.categories, cat.label) }))
                    }
                  />
                ))}
              </View>
            </Section>

            <Section title="Price Range">
              <View style={styles.chipRow}>
                {PRICE_BUCKETS.map((bucket) => (
                  <Chip
                    key={bucket.key}
                    label={bucket.label}
                    selected={draft.priceBucket === bucket.key}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        priceBucket: d.priceBucket === bucket.key ? null : bucket.key,
                      }))
                    }
                  />
                ))}
              </View>
            </Section>

            <Section title="Availability">
              <View style={styles.chipRow}>
                <Chip
                  label="In Stock"
                  selected={draft.availability === 'in_stock'}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      availability: d.availability === 'in_stock' ? 'all' : 'in_stock',
                    }))
                  }
                />
                <Chip
                  label="Out of Stock"
                  selected={draft.availability === 'out_of_stock'}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      availability: d.availability === 'out_of_stock' ? 'all' : 'out_of_stock',
                    }))
                  }
                />
              </View>
            </Section>

            <Section title="Offers" note="Coming soon — no active promotions yet">
              <View style={styles.chipRow}>
                {OFFER_OPTIONS.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    selected={draft.offers.includes(label)}
                    onPress={() => setDraft((d) => ({ ...d, offers: toggleInList(d.offers, label) }))}
                  />
                ))}
              </View>
            </Section>

            <Section title="Dietary Preferences" note="Coming soon — product tagging not available yet">
              <View style={styles.chipRow}>
                {DIETARY_OPTIONS.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    selected={draft.dietary.includes(label)}
                    onPress={() => setDraft((d) => ({ ...d, dietary: toggleInList(d.dietary, label) }))}
                  />
                ))}
              </View>
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} activeOpacity={0.8} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Reset All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={handleApply}>
              <Text style={styles.applyBtnText}>
                Apply Filters{countActive(draft) > 0 ? ` (${countActive(draft)})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export function applyShopFilters(
  products: { id: number; name: string; price: number; stock: number; description?: string | null }[],
  searchQuery: string,
  filters: ShopFilters
) {
  const q = searchQuery.trim().toLowerCase();
  const bucket = PRICE_BUCKETS.find((b) => b.key === filters.priceBucket);

  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    Fruits: ['apple', 'banana', 'orange', 'grape', 'mango', 'berry', 'fruit', 'pear', 'melon'],
    Vegetables: ['carrot', 'potato', 'tomato', 'onion', 'vegetable', 'veggie', 'broccoli', 'spinach', 'pepper'],
    Dairy: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'egg'],
    Snacks: ['chips', 'popcorn', 'cookie', 'biscuit', 'snack', 'chocolate', 'candy', 'crisp'],
    Beverages: ['cola', 'soda', 'juice', 'water', 'drink', 'beverage', 'tea', 'coffee'],
  };

  let result = products.filter((p) => {
    const haystack = `${p.name} ${p.description ?? ''}`.toLowerCase();

    if (q && !haystack.includes(q)) return false;

    if (filters.categories.length > 0) {
      const matchesAnyCategory = filters.categories.some((cat) =>
        (CATEGORY_KEYWORDS[cat] ?? []).some((kw) => haystack.includes(kw))
      );
      if (!matchesAnyCategory) return false;
    }

    if (bucket && (p.price < bucket.min || p.price >= bucket.max)) return false;

    if (filters.availability === 'in_stock' && p.stock <= 0) return false;
    if (filters.availability === 'out_of_stock' && p.stock > 0) return false;

    return true;
  });

  switch (filters.sortBy) {
    case 'price_asc':
      result = [...result].sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      result = [...result].sort((a, b) => b.price - a.price);
      break;
    case 'name_asc':
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      break;
  }

  return result;
}

export { countActive as countActiveFilters };

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    maxHeight: '85%',
    paddingTop: 10,
    ...theme.shadows.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.lg + 4,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm + 2,
  },
  sectionNote: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },
  sortList: {
    gap: 4,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 12,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: theme.colors.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  sortLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  sortLabelActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.semiBold,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 30 : theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.medium,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  applyBtn: {
    flex: 2,
    height: 48,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  applyBtnText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
});
