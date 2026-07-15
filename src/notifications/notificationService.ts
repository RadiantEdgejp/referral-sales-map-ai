import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { MeetingReminderPlanEntry } from '../logic/meetingReminders';
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
  // expo-notifications の権限API（getPermissionsAsync/requestPermissionsAsync）は
  // Web版では解決しないPromiseを返すことがあり、呼び出し元の await を無期限に
  // ハングさせてしまう（catchでは救えない）。Web版はそもそもローカル通知未対応
  // （CLAUDE.md 8章のモバイルQR経路が本来の通知配信経路）なので、ここで即座に
  // 未許可として扱い、呼び出し元の「通知は設定できなかったが日付は保存する」
  // というフォールバック処理へ落とす。
  if (Platform.OS === 'web') {
    return false;
  }

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
    throw new Error(
      Platform.OS === 'web'
        ? 'Web版は端末へのプッシュ通知に対応していません。次回連絡日はカードに保存されます。'
        : '通知が許可されていません。スマホの設定から通知を許可してください。',
    );
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

export type ScheduleMeetingRemindersResult = {
  scheduledIds: string[];
  granted: boolean;
};

/**
 * 予定前・予定後のルーティン通知をまとめて予約する。
 *
 * 予定連絡リマインダー（scheduleContactNotification）と違い、ここでは権限が無くても
 * 例外を投げない。予定の保存自体は既に成功しており、通知はあくまで「あれば嬉しい」
 * 付加価値なので、権限拒否やWeb環境で保存フローを巻き添えにしてはいけない。
 * 呼び出し元は結果を見てログするだけで、失敗しても業務データは一貫している。
 */
export async function scheduleMeetingReminders(
  entries: MeetingReminderPlanEntry[],
): Promise<ScheduleMeetingRemindersResult> {
  if (entries.length === 0) {
    return { scheduledIds: [], granted: false };
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return { scheduledIds: [], granted: false };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meeting-reminders', {
      name: '予定前後リマインダー',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const scheduledIds: string[] = [];
  for (const entry of entries) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: entry.title,
          body: entry.body,
          sound: true,
          data: entry.data,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: entry.fireAt,
          channelId: Platform.OS === 'android' ? 'meeting-reminders' : undefined,
        },
      });
      scheduledIds.push(id);
    } catch {
      // 1件の予約失敗で残りを巻き添えにしない。保存済み業務データには影響しない。
    }
  }

  return { scheduledIds, granted: true };
}
