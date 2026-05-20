import { AuthProvider } from '@/context/auth';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

function NotificationHandler() {
  const router = useRouter();
  const handledId = useRef<string | null>(null);

  function navigate(response: Notifications.NotificationResponse) {
    const notifId = response.notification.request.identifier;
    if (notifId === handledId.current) return;
    handledId.current = notifId;
    const plantId = response.notification.request.content.data?.plantId;
    if (plantId) {
      router.push({
        pathname: '/plant/[id]',
        params: { id: String(plantId), showConfirm: '1' },
      });
    }
  }

  useEffect(() => {
    // App opened from a killed state by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const notifAge = Date.now() - response.notification.date * 1000;
      if (notifAge < 30 * 60 * 1000) navigate(response); // only if < 30 min old
    });

    // App running or backgrounded
    const sub = Notifications.addNotificationResponseReceivedListener(navigate);
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Log In' }} />
          <Stack.Screen name="register" options={{ title: 'Sign Up' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="bed/[id]" options={{ title: 'Garden Bed' }} />
          <Stack.Screen name="plant/[id]" options={{ title: 'Plant Details' }} />
        </Stack>
        <NotificationHandler />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
