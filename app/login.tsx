import { useAuth } from '@/context/auth';
import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { loginUser } from '../lib/database';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    const result = await loginUser(username.trim(), password);
    setLoading(false);
    if (result.success && result.userId) {
      await login(result.userId);
      router.replace('/(tabs)/home');
    } else {
      setError(result.error ?? 'Login failed.');
    }
  }

  return (
    <GardenBackground variant="auth" style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ThemedText type="title" style={[styles.heading, styles.headingGreen]}>Welcome back</ThemedText>
        <ThemedText style={styles.sub}>Log in to your Sprout About account.</ThemedText>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#888"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
          <ThemedText style={styles.btnPrimaryText}>
            {loading ? 'Logging in…' : 'Log In'}
          </ThemedText>
        </Pressable>

        <Pressable onPress={() => router.push('/forgot-password')} style={styles.linkRow}>
          <ThemedText style={styles.link}>Forgot password?</ThemedText>
        </Pressable>

        <Pressable onPress={() => router.push('/register')} style={styles.linkRow}>
          <ThemedText style={styles.link}>Don't have an account? Sign up</ThemedText>
        </Pressable>
      </KeyboardAvoidingView>
    </GardenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  heading: { marginBottom: 6 },
  headingGreen: { color: '#3a7d44' },
  sub: { color: '#666', marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 14,
    color: '#11181C',
    backgroundColor: '#f9f9f9',
  },
  error: { color: '#c0392b', marginBottom: 12, fontSize: 14 },
  btnPrimary: {
    backgroundColor: '#3a7d44',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow: { marginTop: 24, alignItems: 'center' },
  link: { color: '#3a7d44', fontSize: 15 },
});
