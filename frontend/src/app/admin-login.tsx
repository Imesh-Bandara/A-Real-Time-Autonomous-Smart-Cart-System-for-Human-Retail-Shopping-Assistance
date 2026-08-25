import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { fetchGoogleOAuthConfig, loginUser, loginWithGoogle, setAuthToken } from '../api/apiService';
import { theme } from '../theme/theme';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { error } = useLocalSearchParams<{ error?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const routeGoogleError = (() => {
    if (error === 'admin_unauthorized') return 'This Google account is not authorized as an admin.';
    if (error === 'failed') return 'Google authentication failed.';
    if (error) return 'Something went wrong. Please try again.';
    return null;
  })();

  const effectiveGoogleError = googleError || routeGoogleError;

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  useEffect(() => {
    if (routeGoogleError) {
      showAlert('Authentication Error', routeGoogleError);
    }
  }, [routeGoogleError]);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const data = await loginUser(email, password, 'admin');
      
      if (data.access_token) {
        setAuthToken(data.access_token);
      }

      if (data.role === 'admin') {
        router.replace('/(admin)');
      } else {
        setAuthToken(null);
        showAlert('Access Denied', 'This account is not authorized as an admin.');
      }
    } catch (err: any) {
      showAlert('Login Error', typeof err === 'string' ? err : JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    let clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    let redirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:8081/google-callback';

    setGoogleError(null);
    setGoogleLoading(true);

    if (!clientId) {
      try {
        const oauthConfig = await fetchGoogleOAuthConfig();
        clientId = oauthConfig.client_id;
        if (!process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI && oauthConfig.redirect_uri) {
          redirectUri = oauthConfig.redirect_uri;
        }
      } catch {
        setGoogleError('Something went wrong. Please try again.');
        showAlert('Config Error', 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID on backend or EXPO_PUBLIC_GOOGLE_CLIENT_ID on frontend.');
        setGoogleLoading(false);
        return;
      }
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('openid profile email')}` +
      `&state=admin`;

    try {
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
        return;
      }

      const WebBrowser = await import('expo-web-browser');
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== 'success' || !result.url) {
        throw new Error('cancelled');
      }

      const parsed = Linking.parse(result.url);
      const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : undefined;
      const oauthError = typeof parsed.queryParams?.error === 'string' ? parsed.queryParams.error : undefined;

      if (oauthError || !code) {
        throw new Error('failed');
      }

      const data = await loginWithGoogle(code, 'admin');
      if (data.access_token) {
        setAuthToken(data.access_token);
      }

      if (data.role !== 'admin') {
        throw new Error('admin_unauthorized');
      }

      router.replace('/(admin)');
    } catch (err: any) {
      const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      let message = 'Something went wrong. Please try again.';
      if (errStr.includes('admin_unauthorized') || errStr.includes('not authorized as an admin')) {
        message = 'This Google account is not authorized as an admin';
      } else if (errStr.includes('failed') || errStr.includes('cancelled')) {
        message = 'Google authentication failed';
      }
      setGoogleError(message);
      showAlert('Authentication Error', message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark-outline" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Admin Console</Text>
          <Text style={styles.subtitle}>Manage smart carts and store inventory.</Text>
        </View>

        <View style={styles.formCard}>
          <Input
            label="Admin Email"
            placeholder="admin@store.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            title="Sign In as Admin"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title={googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
            icon={<Ionicons name="logo-google" size={18} color="#FFFFFF" />}
            onPress={handleGoogleLogin}
            loading={googleLoading}
            style={styles.googleBtn}
          />

          {effectiveGoogleError ? <Text style={styles.googleErrorText}>{effectiveGoogleError}</Text> : null}

          <TouchableOpacity style={styles.portalLink} onPress={() => router.push('/')} activeOpacity={0.7}>
            <Text style={styles.portalLinkText}>Not an Admin? Go to Customer Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#002583',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  title: {
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  loginBtn: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  googleBtn: {
    backgroundColor: '#4285F4',
    marginBottom: theme.spacing.md,
  },
  googleErrorText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  portalLink: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  portalLinkText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    textDecorationLine: 'underline',
  },
});
