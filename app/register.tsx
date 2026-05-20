import { useAuth } from '@/context/auth';
import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { registerUser } from '../lib/database';

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError('');
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const result = await registerUser(username.trim(), password);
    setLoading(false);
    if (result.success && result.userId) {
      await login(result.userId);
      router.replace('/(tabs)/home');
    } else {
      setError(result.error ?? 'Registration failed.');
    }
  }

  return (
    <GardenBackground variant="auth" style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ThemedText type="title" style={[styles.heading, styles.headingGreen]}>Create account</ThemedText>
        <ThemedText style={styles.sub}>Start tracking your garden with Sprout About.</ThemedText>

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
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#888"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable style={styles.btnPrimary} onPress={handleRegister} disabled={loading}>
          <ThemedText style={styles.btnPrimaryText}>
            {loading ? 'Creating account…' : 'Sign Up'}
          </ThemedText>
        </Pressable>

        <Pressable onPress={() => router.push('/login')} style={styles.linkRow}>
          <ThemedText style={styles.link}>Already have an account? Log in</ThemedText>
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
