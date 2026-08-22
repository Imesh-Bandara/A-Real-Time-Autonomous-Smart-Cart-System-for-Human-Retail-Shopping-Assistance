import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme/theme';

export type BadgeStatus =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'default';

interface StatusBadgeProps {
  label: string;
  status?: BadgeStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status = 'default',
}) => {
  const getStyles = () => {
    switch (status) {
      case 'success':
        return {
          bg: theme.colors.successBackground,
          text: theme.colors.success,
        };
      case 'warning':
        return {
          bg: theme.colors.warningBackground,
          text: theme.colors.warning,
        };
      case 'error':
        return {
          bg: theme.colors.errorBackground,
          text: theme.colors.error,
        };
      case 'info':
        return {
          bg: '#DBEAFE',
          text: theme.colors.info,
        };
      case 'default':
      default:
        return {
          bg: theme.colors.background,
          text: theme.colors.textSecondary,
        };
    }
  };

  const colors = getStyles();

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: theme.typography.fontFamily,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
