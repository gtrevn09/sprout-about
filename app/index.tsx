import { useAuth } from '@/context/auth';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { initDatabase } from '../lib/database';

export default function LandingScreen() {
  const router = useRouter();
  const { userId, isLoading } = useAuth();

  useEffect(() => {
    initDatabase();
  }, []);

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(tabs)/home');
    }
  }, [isLoading, userId]);

  return (
    <ImageBackground
      source={require('@/assets/images/sprout-about.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>Sprout About</ThemedText>
          <ThemedText type="subtitle" style={styles.tagline}>
            Track and nurture your garden's growth.
          </ThemedText>
          <ThemedText style={styles.about}>
            Organize your garden beds, log each plant's progress with photos, and never miss a fertilizing schedule — all stored privately on your device.
          </ThemedText>

          <View style={styles.buttons}>
            <Pressable style={styles.btnPrimary} onPress={() => router.push('/login')}>
              <ThemedText style={styles.btnPrimaryText}>Log In</ThemedText>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={() => router.push('/register')}>
              <ThemedText style={styles.btnSecondaryText}>Sign Up</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.50)',
    justifyContent: 'flex-end',
    paddingBottom: 80,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  tagline: {
    color: '#d4edda',
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '400',
  },
  about: {
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 40,
  },
  buttons: {
    width: '100%',
    gap: 14,
  },
  btnPrimary: {
    backgroundColor: '#3a7d44',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  btnSecondaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
