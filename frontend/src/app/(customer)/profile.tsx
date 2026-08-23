import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Share,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { setAuthToken, fetchProfile, UserProfile } from '../../api/apiService';

interface MenuItem {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const showAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const data = await fetchProfile();
          if (!cancelled) setProfile(data);
        } catch (err: any) {
          if (!cancelled) {
            showAlert('Error', typeof err === 'string' ? err : 'Failed to load profile.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleLogout = () => {
    setAuthToken(null);
    if (Platform.OS === 'web') {
      window.location.href = '/';
    } else {
      router.push('/');
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission needed', 'Allow photo library access to update your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleInviteFriends = async () => {
    try {
      await Share.share({
        message: 'Shop smarter with Smart Cart — check it out!',
      });
    } catch {
      showAlert('Error', 'Could not open the share sheet.');
    }
  };

  const handleHelpCenter = () => {
    Linking.openURL('mailto:support@smartcart.example?subject=Smart%20Cart%20Support');
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Edit Profile',
      icon: 'person-outline',
      onPress: () => router.push('/(customer)/edit-profile'),
    },
    {
      label: 'Payment Method',
      icon: 'card-outline',
      onPress: () => showAlert('Coming soon', 'Payment methods aren’t available yet.'),
    },
    {
      label: 'Language',
      icon: 'globe-outline',
      onPress: () => showAlert('Coming soon', 'Language settings aren’t available yet.'),
    },
    {
      label: 'Order History',
      icon: 'time-outline',
      onPress: () => router.push('/(customer)/orders'),
    },
    {
      label: 'Invite Friends',
      icon: 'person-add-outline',
      onPress: handleInviteFriends,
    },
    {
      label: 'Help Center',
      icon: 'help-circle-outline',
      onPress: handleHelpCenter,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.75}
          onPress={() => (router.canGoBack() ? router.back() : router.push('/(customer)'))}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarBlock}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={44} color={theme.colors.primaryLight} />
              </View>
            )}
            <TouchableOpacity style={styles.avatarEditBtn} activeOpacity={0.8} onPress={handlePickAvatar}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <Text style={styles.userName}>{profile?.name || 'Add your name'}</Text>
              <Text style={styles.userEmail}>{profile?.email}</Text>
            </>
          )}
        </View>

        <View style={styles.menuList}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, index < menuItems.length - 1 && styles.menuRowSpacing]}
              activeOpacity={0.75}
              onPress={item.onPress}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 130,
  },
  avatarBlock: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    marginBottom: theme.spacing.md,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.borderLight,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.infoBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
    ...theme.shadows.sm,
  },
  userName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  menuList: {
    gap: 10,
    marginBottom: theme.spacing.xl,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.large,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    gap: 12,
    ...theme.shadows.sm,
  },
  menuRowSpacing: {},
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.infoBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.errorBackground,
    paddingVertical: 14,
    borderRadius: theme.radius.large,
  },
  logoutBtnText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
});
