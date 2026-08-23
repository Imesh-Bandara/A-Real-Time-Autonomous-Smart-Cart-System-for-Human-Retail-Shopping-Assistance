import React from 'react';
import { Tabs } from 'expo-router';
import { theme } from '../../theme/theme';
import { useCart } from '../../context/CartContext';
import { Platform, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const NAV_DARK = '#0D1226';
const ICON_ACTIVE_COLOR = NAV_DARK;
const ICON_INACTIVE_COLOR = 'rgba(255,255,255,0.55)';

function TabIcon({
  outline,
  filled,
  focused,
}: {
  outline: IoniconName;
  filled: IoniconName;
  focused: boolean;
}) {
  return (
    <View style={[navStyles.iconPill, focused && navStyles.iconPillActive]}>
      <Ionicons
        name={focused ? filled : outline}
        size={18}
        color={focused ? ICON_ACTIVE_COLOR : ICON_INACTIVE_COLOR}
      />
    </View>
  );
}

export default function CustomerLayout() {
  const { cartItemCount } = useCart();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          backgroundColor: NAV_DARK,
          borderTopWidth: 0,
          borderRadius: theme.radius.xxl,
          marginHorizontal: theme.spacing.lg,
          marginBottom: Platform.OS === 'ios' ? 26 : 18,
          height: 72,
          paddingHorizontal: theme.spacing.sm,
          paddingTop: 10,
          paddingBottom: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.28,
          shadowRadius: 20,
          elevation: 10,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: theme.typography.weights.semiBold,
          marginTop: 4,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="home-outline" filled="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="search-outline" filled="search" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="cart-outline" filled="cart" focused={focused} />
          ),
          tabBarBadge: cartItemCount > 0 ? cartItemCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.accent,
            color: theme.colors.primaryDark,
            fontSize: 10,
            fontWeight: theme.typography.weights.bold,
          },
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="receipt-outline" filled="receipt" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="person-outline" filled="person" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="review-order"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="order-status"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}

const navStyles = StyleSheet.create({
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: '#FFFFFF',
  },
});
