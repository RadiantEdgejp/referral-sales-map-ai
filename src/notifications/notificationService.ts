import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Person } from '../types/person';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelContactNotification(notificationId?: string) {
  if (!notificationId) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // 通知が既に配信済み・削除済みの場合は無視する
  }
}

export async function scheduleContactNotification(person: Person, date: Date) {
  const granted = await requestNotificationPermission();
  if (!granted) {
    throw new Error('通知が許可されていません。スマホの設定から通知を許可してください。');
  }

  if (person.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(person.notificationId);
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('contact-reminders', {
      name: '次回連絡リマインダー',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${person.name}に連絡する時間です`,
      body: person.nextAction,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: Platform.OS === 'android' ? 'contact-reminders' : undefined,
    },
  });
}
