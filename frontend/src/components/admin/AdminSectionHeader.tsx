import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

interface AdminSectionHeaderProps {
  overline?: string;
  title: string;
  subtitle?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function AdminSectionHeader({
  overline,
  title,
  subtitle,
  onAction,
  actionLabel = 'View all',
}: AdminSectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textBlock}>
        {overline ? <Text style={styles.overline}>{overline}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onAction ? (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md + 4,
  },
  textBlock: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  overline: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.primaryLight,
    letterSpacing: theme.typography.letterSpacing.caps,
    marginBottom: 6,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingTop: 18,
  },
  actionLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.primary,
  },
});
