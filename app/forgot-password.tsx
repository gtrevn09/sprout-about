import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import { createPasswordResetToken, getUserByEmail } from '@/lib/database';
import { sendPasswordResetEmail } from '@/lib/email';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const user = getUserByEmail(trimmed);

    if (user) {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      createPasswordResetToken(user.id, code, expiresAt);
      const result = await sendPasswordResetEmail(trimmed, user.username, code);
      setLoading(false);
      if (!result.success) {
        setError(result.error ?? 'Failed to send email. Please try again.');
        return;
      }
    } else {
      setLoading(false);
    }

    router.push({ pathname: '/reset-password', params: { userId: String(user?.id ?? 0) } });
  }

  return (
    <GardenBackground variant="auth" style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ThemedText style={styles.icon}>🔑</ThemedText>
        <ThemedText type="title" style={styles.heading}>Forgot password?</ThemedText>
        <ThemedText style={styles.sub}>
          Enter the email address on your account and we'll send you a reset code.
        </ThemedText>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable style={styles.btnPrimary} onPress={handleSend} disabled={loading}>
          <ThemedText style={styles.btnPrimaryText}>
            {loading ? 'Sending…' : 'Send Reset Code'}
          </ThemedText>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.linkRow}>
          <ThemedText style={styles.link}>Back to Log In</ThemedText>
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
  icon: { fontSize: 44, lineHeight: 56, textAlign: 'center', marginBottom: 12 },
  heading: { color: '#3a7d44', marginBottom: 8, textAlign: 'center' },
  sub: { color: '#666', marginBottom: 28, textAlign: 'center', lineHeight: 22 },
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
