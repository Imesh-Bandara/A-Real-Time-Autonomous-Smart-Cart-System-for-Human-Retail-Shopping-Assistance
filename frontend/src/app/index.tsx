import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Alert,
  Image,
  Animated,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { loginUser, setAuthToken } from '../api/apiService';
import { theme } from '../theme/theme';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [percent, setPercent] = useState(0);
  
  // Animation value for the progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progressAnim.addListener(({ value }) => {
      setPercent(Math.floor(value));
    });

    // Animate the progress bar over 2.5 seconds
    Animated.timing(progressAnim, {
      toValue: 100,
      duration: 2500,
      useNativeDriver: false,
    }).start();

    // Hide splash screen after 3 seconds
    const timer = setTimeout(() => {
      setIsSplashVisible(false);
    }, 3000);

    return () => {
      progressAnim.removeAllListeners();
      clearTimeout(timer);
    };
  }, []);

  const showAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const data = await loginUser(email, password);
      
      // Store JWT token
      if (data.access_token) {
        setAuthToken(data.access_token);
      }

      if (data.role === 'admin') {
        router.replace('/(admin)');
      } else if (data.role === 'customer') {
        router.replace('/(customer)');
      } else {
        showAlert('Error', `Unrecognized role: "${data.role}"`);
      }
    } catch (err: any) {
      showAlert('Login Error', typeof err === 'string' ? err : JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  // Demo helper for development
  const fillDemo = (type: 'admin' | 'customer') => {
    if (type === 'admin') {
      setEmail('admin@test.com');
      setPassword('admin123');
    } else {
      setEmail('user@test.com');
      setPassword('user123');
    }
  };

  if (isSplashVisible) {
    const widthInterpolated = progressAnim.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        
        <View style={styles.splashContent}>
          <Image 
            source={require('../../images/logo.png')} 
            style={styles.splashLogo} 
            resizeMode="contain"
          />
          <Text style={styles.splashTitle}>Smart Cart</Text>
          <Text style={styles.splashSubtitle}>Smarter shopping. Simpler living.</Text>
        </View>

        <View style={styles.splashBottom}>
          <Text style={styles.progressText}>{percent}%</Text>
          <View style={styles.progressContainer}>
            <Animated.View style={[styles.progressBar, { width: widthInterpolated }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="cart-outline" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Smart Cart</Text>
          <Text style={styles.subtitle}>Smarter shopping. Simpler living.</Text>
        </View>

        <View style={styles.formCard}>
          <Input
            label="Email Address"
            placeholder="Enter your email"
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

          <Text style={styles.forgotPassword}>Forgot password?</Text>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          <Text style={styles.registerText}>
            Don't have an account? <Text style={styles.registerLink}>Create one</Text>
          </Text>
        </View>

        {/* Development Demo Login Helpers */}
        {__DEV__ && (
          <View style={styles.devBox}>
            <Text style={styles.devTitle}>DEV: Quick Login</Text>
            <View style={styles.devButtons}>
              <Button title="Admin" variant="outline" size="small" onPress={() => fillDemo('admin')} />
              <View style={{ width: 10 }} />
              <Button title="Customer" variant="outline" size="small" onPress={() => fillDemo('customer')} />
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 40,
  },
  splashLogo: {
    width: 120,
    height: 120,
    marginBottom: theme.spacing.lg,
  },
  splashTitle: {
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.heavy,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  splashSubtitle: {
    fontSize: theme.typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: theme.typography.weights.medium,
  },
  splashBottom: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 60,
  },
  progressText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  progressContainer: {
    width: '60%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
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
    backgroundColor: theme.colors.primary,
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
  },
  formCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  forgotPassword: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semiBold,
    textAlign: 'right',
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  loginBtn: {
    marginBottom: theme.spacing.lg,
  },
  registerText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
  },
  registerLink: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  devBox: {
    marginTop: 40,
    alignItems: 'center',
  },
  devTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  devButtons: {
    flexDirection: 'row',
  },
});