import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import MiniButton from '../../components/MiniButton';
import Section from '../../components/Section';
import { completeActionTask, postponeActionTask, type PersistedActionTask } from '../../storage/actionTaskStorage';
import { requiresWorkflowSave } from '../../storage/actionTaskCore';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';

type CalendarItem = {
  id: string;
  personId: string;
  salesRouteId: string;
  title: string;
  startAt: string;
  endAt: string;
  purpose: string;
  status: string;
};

function priorityLabel(value: string) {
  if (value === 'high') return '最優先';
  if (value === 'low') return '通常';
  return '重要';
}

function actionLabel(value: string) {
  if (value === 'pre_meeting') return '予定前ナビ';
  if (value === 'after_memo') return '後メモ';
  if (value === 'follow_up') return '連絡';
  return value || '営業アクション';
}

export default function HomePane({
  people,
  tasks,
  events,
  planUpdated,
  onOpenPerson,
  onOpenTask,
  onAddSchedule,
  onReload,
  loading,
  loadError,
}: {
  people: Person[];
  tasks: PersistedActionTask[];
  events: CalendarItem[];
  planUpdated: boolean;
  onOpenPerson: (personId?: string) => void;
  onOpenTask: (task: PersistedActionTask) => void;
  onAddSchedule: () => void;
  onReload: () => Promise<void>;
  loading: boolean;
  loadError: string;
}) {
  const complete = async (task: PersistedActionTask) => {
    try {
      await completeActionTask(task.id);
      await onReload();
      Alert.alert('完了しました', '今日やることを完了にしました。');
    } catch (error) {
      Alert.alert('完了に失敗しました', error instanceof Error ? error.message : 'もう一度お試しください。');
    }
  };

  const postpone = async (task: PersistedActionTask) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    try {
      await postponeActionTask(task.id, tomorrow);
      await onReload();
      Alert.alert('明日に延期しました', '期限を明日9:00へ変更しました。');
    } catch (error) {
      Alert.alert('延期に失敗しました', error instanceof Error ? error.message : 'もう一度お試しください。');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loadError ? (
        <Section title="営業データを読み込めませんでした">
          <Text style={styles.errorNotice}>{loadError}</Text>
          <Pressable style={styles.primaryCta} onPress={() => void onReload()}>
            <Text style={styles.primaryCtaText}>再試行</Text>
          </Pressable>
        </Section>
      ) : null}
      {loading ? <Text style={styles.emptyText}>最新データを読み込み中...</Text> : null}
      <Section title="今日の営業テーマ">
        <Text style={styles.shortReason}>期限が来ている行動を上から処理し、会話後の情報を人脈カードへ残す。</Text>
        {planUpdated ? <Text style={styles.updatedNotice}>最新のタスクと予定を読み込みました</Text> : null}
      </Section>

      <Pressable style={styles.fullPrimaryButton} onPress={onAddSchedule}>
        <Text style={styles.fullPrimaryText}>今日の予定を追加</Text>
      </Pressable>

      <Section title="今日やること" subtitle="保存済みの営業タスクを期限順に表示しています。">
        {tasks.length === 0 ? <Text style={styles.emptyText}>今日までに対応するタスクはありません。</Text> : tasks.map((task) => {
          const person = people.find((candidate) => candidate.id === task.personId);
          return (
            <Pressable key={task.id} style={styles.priorityRow} onPress={() => onOpenTask(task)}>
              <View style={styles.priorityHeader}>
                <Text style={styles.priorityBadge}>{priorityLabel(task.priority)}</Text>
                <Text style={styles.rowName}>{person?.name ?? '人物情報なし'}</Text>
                <Text style={styles.actionType}>{actionLabel(task.actionType)}</Text>
              </View>
              <Text style={styles.shortReason}>{task.reason || task.todayGoal}</Text>
              <Text style={styles.todoLine}>次の一手：{task.nextStep || task.title}</Text>
              <Text style={styles.rowMeta}>期限：{formatDateTime(task.dueDate)}</Text>
              <View style={styles.rowButtons}>
                <MiniButton label="開く" onPress={() => onOpenTask(task)} />
                {!requiresWorkflowSave(task) ? <MiniButton label="完了" onPress={() => complete(task)} /> : null}
                <MiniButton label="延期" onPress={() => postpone(task)} />
                <MiniButton label="人物" onPress={() => onOpenPerson(task.personId)} />
              </View>
            </Pressable>
          );
        })}
      </Section>

      <Section title="予定" subtitle="Supabaseに保存されている予定です。">
        {events.length === 0 ? <Text style={styles.emptyText}>予定はまだありません。</Text> : events.slice(0, 10).map((event) => {
          const person = people.find((candidate) => candidate.id === event.personId);
          return (
            <Pressable key={event.id} style={styles.priorityRow} onPress={() => {
              const task = tasks.find((candidate) => candidate.calendarEventId === event.id && candidate.actionType === 'pre_meeting');
              if (task) onOpenTask(task); else onOpenPerson(event.personId);
            }}>
              <Text style={styles.rowName}>{event.title}</Text>
              <Text style={styles.rowMeta}>{person?.name ?? '人物情報なし'} / {formatDateTime(event.startAt)}</Text>
              <Text style={styles.shortReason}>{event.purpose}</Text>
            </Pressable>
          );
        })}
      </Section>
    </ScrollView>
  );
}
