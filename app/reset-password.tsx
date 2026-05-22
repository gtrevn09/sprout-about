import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import { markResetTokenUsed, updateUserPassword, validateResetToken } from '@/lib/database';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const userIdNum = Number(userId);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setError('');

    if (code.trim().length !== 6) {
      setError('Please enter the 6-digit code from your email.');
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

    if (!userIdNum) {
      setError('Invalid reset link. Please request a new code.');
      return;
    }

    setLoading(true);
    const tokenId = validateResetToken(userIdNum, code.trim());
    if (!tokenId) {
      setLoading(false);
      setError('Invalid or expired code. Please request a new one.');
      return;
    }

    await updateUserPassword(userIdNum, password);
    markResetTokenUsed(tokenId);
    setLoading(false);

    Alert.alert('Password reset!', 'Your password has been updated. Please log in.', [
      { text: 'Log In', onPress: () => router.replace('/login') },
    ]);
  }

  return (
    <GardenBackground variant="auth" style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ThemedText style={styles.icon}>🌱</ThemedText>
        <ThemedText type="title" style={styles.heading}>Reset password</ThemedText>
        <ThemedText style={styles.sub}>
          Enter the 6-digit code we emailed you, then choose a new password.
        </ThemedText>

        <TextInput
          style={styles.input}
          placeholder="6-digit code"
          placeholderTextColor="#888"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#888"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable style={styles.btnPrimary} onPress={handleReset} disabled={loading}>
          <ThemedText style={styles.btnPrimaryText}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/forgot-password')}
          style={styles.linkRow}
        >
          <ThemedText style={styles.link}>Didn't get a code? Send again</ThemedText>
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
