import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchOrder, Order } from '../../api/apiService';
import { theme } from '../../theme/theme';
import { Button } from '../../components/ui/Button';

export default function OrderStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const showAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  useEffect(() => {
    if (!id) return;

    const loadOrder = async () => {
      try {
        setLoading(true);
        const data = await fetchOrder(Number(id));
        setOrder(data);
      } catch (err: any) {
        showAlert('Error', typeof err === 'string' ? err : 'Could not load order details');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Order not found.</Text>
        <Button title="Go to Dashboard" onPress={() => router.replace('/(customer)')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Ionicons 
          name="close" 
          size={28} 
          color={theme.colors.text} 
          onPress={() => router.replace('/(customer)')} 
        />
        <Text style={styles.title}>Order Status</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={60} color={theme.colors.success} />
          </View>
          <Text style={styles.successTitle}>Order Submitted 🎉</Text>
          <Text style={styles.orderId}>Order #{order.id}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status Updates</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: theme.colors.primary }]} />
            <Text style={styles.statusText}>Order Status: <Text style={styles.statusValue}>{order.status}</Text></Text>
          </View>
          <View style={styles.statusRow}>
            <View 
              style={[
                styles.statusDot, 
                { backgroundColor: order.mqtt_status === 'failed' ? theme.colors.error : theme.colors.info }
              ]} 
            />
            <Text style={styles.statusText}>Smart Cart: <Text style={styles.statusValue}>{order.mqtt_status}</Text></Text>
          </View>
          
          {order.mqtt_status === 'failed' && (
            <Text style={styles.errorMsg}>Smart Cart communication is temporarily unavailable.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({order.item_count})</Text>
          {order.items?.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.product_name} × {item.quantity}</Text>
              <Text style={styles.itemPrice}>${item.subtotal.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text,
  },
  errorText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  content: {
    padding: theme.spacing.lg,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.successBackground,
    borderRadius: theme.radius.large,
    padding: theme.spacing.xxl,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successIcon: {
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.success,
    marginBottom: 4,
  },
  orderId: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.success,
    fontWeight: theme.typography.weights.semiBold,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: theme.spacing.sm,
  },
  statusText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
  },
  statusValue: {
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  errorMsg: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  itemName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  itemPrice: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.primary,
  },
});
