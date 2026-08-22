import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { fetchAdminOrders, Order } from '../../api/apiService';
import { theme } from '../../theme/theme';
import { AdminSectionHeader } from '../../components/admin/AdminSectionHeader';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminOrders();
      setOrders(data);
    } catch (err: any) {
      Platform.OS === 'web' 
        ? alert(`Error: ${typeof err === 'string' ? err : 'Could not load orders'}`) 
        : Alert.alert('Error', typeof err === 'string' ? err : 'Could not load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={[theme.colors.heroStart, theme.colors.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroText}>
              <Text style={styles.heroOverline}>ORDERS</Text>
              <Text style={styles.heroTitle}>Order management</Text>
              <Text style={styles.heroSubtitle}>Track and fulfill customer orders</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContent}>
          <View style={styles.block}>
            <AdminSectionHeader overline="TODAY" title="Order summary" />
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.summaryValue, { color: '#4F46E5' }]}>37</Text>
                <Text style={styles.summaryLabel}>Total orders</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>28</Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </View>
            </View>
          </View>

          <AdminSectionHeader 
            title="Recent Orders" 
            actionLabel="Refresh" 
            onAction={loadOrders} 
          />

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : orders.length > 0 ? (
            orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>Order #{order.id}</Text>
                    <Text style={styles.orderEmail}>{order.user_email || 'Customer'}</Text>
                  </View>
                  <View style={styles.statusGroup}>
                    <View style={[styles.statusBadge, { backgroundColor: order.status === 'completed' ? theme.colors.successBackground : theme.colors.infoBackground }]}>
                      <Text style={[styles.statusText, { color: order.status === 'completed' ? theme.colors.success : theme.colors.info }]}>
                        {order.status}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: order.mqtt_status === 'published' ? theme.colors.successBackground : (order.mqtt_status === 'failed' ? theme.colors.errorBackground : theme.colors.infoBackground) }]}>
                      <Text style={[styles.statusText, { color: order.mqtt_status === 'published' ? theme.colors.success : (order.mqtt_status === 'failed' ? theme.colors.error : theme.colors.info) }]}>
                        MQTT: {order.mqtt_status}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.orderFooter}>
                  <Text style={styles.itemCount}>{order.item_count} items</Text>
                  <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleString()}</Text>
                  <Text style={styles.orderTotal}>${order.total_amount.toFixed(2)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No orders found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingBottom: 40 },
  heroSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'android' ? theme.spacing.md : theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  heroText: { flex: 1, paddingTop: 2 },
  heroOverline: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: theme.typography.letterSpacing.caps,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: '#FFF',
    letterSpacing: theme.typography.letterSpacing.tight,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255,255,255,0.65)',
  },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  block: { marginBottom: theme.spacing.xl },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginTop: 14,
    marginBottom: 6,
  },
  orderCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  orderId: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  orderEmail: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  statusText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    textTransform: 'uppercase',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  itemCount: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  orderDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  orderTotal: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  center: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
