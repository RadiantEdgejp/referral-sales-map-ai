import { cancelContactNotification, scheduleContactNotification } from '../notifications/notificationService';
import { updatePerson } from '../storage/personStorage';
import type { Person } from '../types/person';
import { formatDateTime } from '../utils/date';

export function nextContactDate(daysLater: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + daysLater);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export async function applyNextContact(
  person: Person,
  date: Date,
): Promise<{ saved: Person; notice: string }> {
  let notificationId = person.notificationId;
  let notice = `${formatDateTime(date.toISOString())} に${person.name}への連絡通知を設定しました。`;
  try {
    notificationId = await scheduleContactNotification(person, date);
  } catch {
    notice = `次回連絡日を ${formatDateTime(date.toISOString())} に設定しました（通知は設定できませんでした）。`;
  }

  const saved = await updatePerson({
    ...person,
    nextContactAt: date.toISOString(),
    notificationId,
  });
  return { saved, notice };
}

export async function clearNextContact(person: Person): Promise<Person> {
  await cancelContactNotification(person.notificationId);
  return updatePerson({
    ...person,
    nextContactAt: undefined,
    notificationId: undefined,
  });
}
