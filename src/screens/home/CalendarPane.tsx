import { Pressable, ScrollView, Text } from 'react-native';
import Section from '../../components/Section';
import type { PersistedActionTask } from '../../storage/actionTaskStorage';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';

type EventItem = {
  id: string;
  personId: string;
  salesRouteId: string;
  title: string;
  startAt: string;
  endAt: string;
  purpose: string;
  status: string;
};

export default function CalendarPane({ people, events, tasks, onAdd, onOpenTask, onOpenPerson }: {
  people: Person[];
  events: EventItem[];
  tasks: PersistedActionTask[];
  onAdd: () => void;
  onOpenTask: (task: PersistedActionTask) => void;
  onOpenPerson: (personId?: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Section title="予定とカレンダー" subtitle="保存済みの予定を開始時刻順に表示します。">
        <Pressable style={styles.fullPrimaryButton} onPress={onAdd}><Text style={styles.fullPrimaryText}>予定を追加</Text></Pressable>
        {events.length === 0 ? <Text style={styles.emptyText}>予定はまだありません。</Text> : events.map((event) => {
          const person = people.find((candidate) => candidate.id === event.personId);
          const preTask = tasks.find((task) => task.calendarEventId === event.id && task.actionType === 'pre_meeting');
          return (
            <Pressable key={event.id} style={styles.priorityRow} onPress={() => preTask ? onOpenTask(preTask) : onOpenPerson(event.personId)}>
              <Text style={styles.rowName}>{event.title}</Text>
              <Text style={styles.rowMeta}>{formatDateTime(event.startAt)} - {formatDateTime(event.endAt)}</Text>
              <Text style={styles.shortReason}>{person?.name ?? '人物情報なし'} / {event.purpose}</Text>
              <Text style={styles.todoLine}>{preTask ? '予定前ナビを開く' : '人物詳細を開く'}</Text>
            </Pressable>
          );
        })}
      </Section>
    </ScrollView>
  );
}
