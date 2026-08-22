import React from 'react';
import { Drawer } from 'expo-router/drawer';
import { theme } from '../../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { setAuthToken } from '../../api/apiService';

export default function AdminLayout() {
  const router = useRouter();

  const handleLogout = () => {
    setAuthToken(null);
    if (Platform.OS === 'web') {
      window.location.href = '/';
    } else {
      router.push('/');
    }
  };

  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: theme.typography.weights.bold,
          fontSize: theme.typography.sizes.md,
        },
        headerRight: () => (
          <TouchableOpacity 
            onPress={handleLogout} 
            style={{ marginRight: 16, padding: 8 }}
          >
            <Ionicons name="log-out-outline" size={24} color={theme.colors.error} />
          </TouchableOpacity>
        ),
        drawerActiveBackgroundColor: '#EEF2FF',
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.textSecondary,
        drawerLabelStyle: {
          fontWeight: theme.typography.weights.medium,
          fontSize: theme.typography.sizes.sm,
          marginLeft: -8,
        },
        drawerStyle: {
          backgroundColor: theme.colors.card,
          width: 280,
        },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: 'Dashboard',
          title: 'Dashboard',
          drawerIcon: ({ color }) => (
            <Ionicons name="stats-chart-outline" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="inventory"
        options={{
          drawerLabel: 'Inventory',
          title: 'Inventory Manager',
          drawerIcon: ({ color }) => (
            <Ionicons name="cube-outline" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="orders"
        options={{
          drawerLabel: 'Orders',
          title: 'Orders',
          drawerIcon: ({ color }) => (
            <Ionicons name="receipt-outline" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="smart-carts"
        options={{
          drawerLabel: 'Smart Carts',
          title: 'Smart Carts',
          drawerIcon: ({ color }) => (
            <Ionicons name="cart-outline" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="robot-status"
        options={{
          drawerLabel: 'Robot Status',
          title: 'Robot Research Status',
          drawerIcon: ({ color }) => (
            <Ionicons name="hardware-chip-outline" size={20} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}
