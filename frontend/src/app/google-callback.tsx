import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { loginWithGoogle, setAuthToken } from '../api/apiService';
import { theme } from '../theme/theme';

export default function GoogleCallbackScreen() {
  const router = useRouter();
  const { code, state, error: oauthError } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();

  useEffect(() => {
    const handleCallback = async () => {
      const targetRole = state === 'admin' ? 'admin' : 'customer';
      const fallbackRoute = targetRole === 'admin' ? '/admin-login' : '/';

      if (oauthError) {
        console.error('[Google OAuth] OAuth redirect error parameter:', oauthError);
        router.replace(`${fallbackRoute}?error=failed`);
        return;
      }

      if (!code) {
        console.error('[Google OAuth] Missing authorization code');
        router.replace(`${fallbackRoute}?error=failed`);
        return;
      }

      try {
        console.log(`[Google OAuth] Authenticating code for role "${targetRole}"...`);
        const data = await loginWithGoogle(code, targetRole);
        
        if (data.access_token) {
          setAuthToken(data.access_token);
        }

        if (targetRole === 'admin') {
          if (data.role === 'admin') {
            router.replace('/(admin)');
          } else {
            router.replace('/admin-login?error=admin_unauthorized');
          }
        } else {
          router.replace('/(customer)');
        }
      } catch (err: any) {
        console.error('[Google OAuth] Backend verification failed:', err);
        // Extract backend error message if possible
        let errCode = 'failed';
        const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
        if (errStr.includes('admin_unauthorized') || errStr.includes('not authorized as an admin')) {
          errCode = 'admin_unauthorized';
        }
        router.replace(`${fallbackRoute}?error=${errCode}`);
      }
    };

    handleCallback();
  }, [code, state, oauthError, router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>Connecting to Google...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
});
