import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('fertilizer-reminders', {
      name: 'Fertilizer Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleTreatmentReminder(
  plantName: string,
  plantId: number,
  date: Date
): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to Treat!',
      body: `It's time to apply a treatment to ${plantName}!`,
      sound: 'default',
      data: { plantId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
  return id;
}

export async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function scheduleFertilizerReminder(
  plantName: string,
  plantId: number,
  date: Date
): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to Fertilize!',
      body: `It's time to fertilize ${plantName}!`,
      sound: 'default',
      data: { plantId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
  return id;
}
