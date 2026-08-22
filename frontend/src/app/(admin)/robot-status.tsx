import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme/theme';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AdminSectionHeader } from '../../components/admin/AdminSectionHeader';

const SENSORS = [
  { label: 'LiDAR', status: 'Active', ok: true, color: '#059669', bg: '#ECFDF5' },
  { label: 'Camera (CV)', status: 'Tracking', ok: true, color: '#0284C7', bg: '#F0F9FF' },
  { label: 'Robot Arm', status: 'Standby', ok: false, color: '#D97706', bg: '#FFFBEB' },
  { label: 'Load Cells', status: 'Calibrated', ok: true, color: '#7C3AED', bg: '#F5F3FF' },
];

export default function RobotStatus() {

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
              <Text style={styles.heroOverline}>ROBOTICS</Text>
              <Text style={styles.heroTitle}>Research status</Text>
              <Text style={styles.heroSubtitle}>Cyber-physical system metrics</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContent}>
          <View style={styles.block}>
            <AdminSectionHeader overline="UNIT" title="Smart Cart #SC-01" />
            <View style={styles.robotCard}>
              <View style={styles.robotCardHeader}>
                <View style={styles.robotIcon}>
                  <Ionicons name="hardware-chip-outline" size={22} color={theme.colors.primary} />
                </View>
                <StatusBadge status="success" label="Connected" />
              </View>

              {[
                { label: 'Battery', value: '87%' },
                { label: 'Current task', value: 'Navigating to Aisle 4' },
                { label: 'Product picking', value: 'Idle' },
              ].map((metric, index, arr) => (
                <View
                  key={metric.label}
                  style={[styles.metricRow, index < arr.length - 1 && styles.metricRowBorder]}
                >
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={styles.metricValue}>{metric.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.block}>
            <AdminSectionHeader
              overline="TELEMETRY"
              title="Sensor status"
              subtitle="Live component health checks"
            />
            <View style={styles.sensorGrid}>
              {SENSORS.map((sensor) => (
                <View key={sensor.label} style={[styles.sensorBox, { backgroundColor: sensor.bg }]}>
                  <Text style={styles.sensorLabel}>{sensor.label}</Text>
                  <Text style={[styles.sensorStatus, { color: sensor.color }]}>{sensor.status}</Text>
                </View>
              ))}
            </View>
          </View>
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
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
  },
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
  robotCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  robotCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  robotIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.promoBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  metricRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  metricLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  metricValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semiBold,
    maxWidth: '55%',
    textAlign: 'right',
  },
  sensorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sensorBox: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sensorLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 8,
  },
  sensorStatus: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  },
});
