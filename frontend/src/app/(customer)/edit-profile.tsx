import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { fetchProfile, updateProfile } from '../../api/apiService';

export default function EditProfileScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  useEffect(() => {
    (async () => {
      try {
        const profile = await fetchProfile();
        setName(profile.name ?? '');
        setEmail(profile.email);
      } catch (err: any) {
        showAlert('Error', typeof err === 'string' ? err : 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const wantsPasswordChange = currentPassword || newPassword || confirmPassword;

  const handleSave = async () => {
    if (!email.trim()) {
      showAlert('Missing email', 'Email address cannot be empty.');
      return;
    }

    if (wantsPasswordChange) {
      if (!currentPassword) {
        showAlert('Current password required', 'Enter your current password to set a new one.');
        return;
      }
      if (newPassword.length < 6) {
        showAlert('Password too short', 'New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        showAlert('Passwords don’t match', 'New password and confirmation must match.');
        return;
      }
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim(),
        ...(wantsPasswordChange
          ? { current_password: currentPassword, new_password: newPassword }
          : {}),
      });
      showAlert('Saved', 'Your profile has been updated.');
      router.push('/(customer)/profile');
    } catch (err: any) {
      showAlert('Update failed', typeof err === 'string' ? err : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.75}
          onPress={() => router.push('/(customer)/profile')}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Basic Info</Text>
          <Input
            label="Full Name"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Input
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
            Change Password <Text style={styles.sectionOptional}>(optional)</Text>
          </Text>
          <Input
            label="Current Password"
            placeholder="••••••••"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Input
            label="New Password"
            placeholder="••••••••"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <Input
            label="Confirm New Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      )}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 130,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm + 2,
  },
  sectionTitleSpaced: {
    marginTop: theme.spacing.md,
  },
  sectionOptional: {
    fontWeight: theme.typography.weights.regular,
    color: theme.colors.textMuted,
  },
  saveBtn: {
    marginTop: theme.spacing.md,
  },
});
