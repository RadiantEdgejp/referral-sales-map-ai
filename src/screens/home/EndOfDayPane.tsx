import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Info from '../../components/Info';
import Section from '../../components/Section';
import {
  carryActionTasksToTomorrow,
  completeEndOfDayCheck,
  loadEndOfDayReconciliation,
  type EndOfDayReconciliation,
  type EndOfDayTask,
} from '../../storage/endOfDayStorage';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';

function personName(data: EndOfDayReconciliation, contactId: string | null) {
  if (!contactId) return '人物未設定';
  return data.contactNames[contactId] ?? 'アーカイブ済みの人物';
}

function buildFeedback(data: EndOfDayReconciliation) {
  const unresolved =
    data.eventsMissingAfterMemo.length +
    data.unsavedAfterMemos.length +
    data.unsavedMessageChecks.length +
    data.contactsMissingNextContact.length +
    data.unresolvedDataGaps.length;
  return unresolved > 0
    ? `完了${data.completedTasks.length}件、未完了${data.incompleteTasks.length}件です。記録・保存の未処理が${unresolved}件あるため、明日の新規行動より先に回収します。`
    : `完了${data.completedTasks.length}件、未完了${data.incompleteTasks.length}件です。今日の記録漏れはありません。`;
}

export default function EndOfDayPane({
  onAfter,
  onHome,
  onCoach,
}: {
  people: Person[];
  onPersonUpdated: (person: Person) => void;
  onAfter: (target: { personId: string; salesRouteId?: string; calendarEventId?: string }) => void;
  onHome: () => void;
  onCoach: (initialPrompt: string) => void;
}) {
  const [data, setData] = useState<EndOfDayReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [carryingTaskIds, setCarryingTaskIds] = useState<Set<string>>(new Set());
  const [carriedTaskIds, setCarriedTaskIds] = useState<string[]>([]);
  const [successNotice, setSuccessNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const loaded = await loadEndOfDayReconciliation();
      setData(loaded);
      setCarriedTaskIds(loaded.carriedTaskIds);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '終業後チェックを取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unresolvedCount = useMemo(() => {
    if (!data) return 0;
    return (
      data.eventsMissingAfterMemo.length +
      data.unsavedAfterMemos.length +
      data.unsavedMessageChecks.length +
      data.contactsMissingNextContact.length +
      data.unresolvedDataGaps.length
    );
  }, [data]);

  const carryTask = async (task: EndOfDayTask) => {
    if (carryingTaskIds.has(task.id)) return;
    setCarryingTaskIds((current) => new Set(current).add(task.id));
    setSuccessNotice('');
    try {
      const ids = await carryActionTasksToTomorrow([task.id]);
      setCarriedTaskIds((current) => [...new Set([...current, ...ids])]);
      setSuccessNotice(`「${task.title}」を明日9:00へ回しました。`);
      await load();
    } catch (error) {
      Alert.alert('明日に回せませんでした', error instanceof Error ? error.message : '保存中にエラーが発生しました。');
    } finally {
      setCarryingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  };

  const finish = async () => {
    if (!data || saving) return;
    setSaving(true);
    setSuccessNotice('');
    try {
      await completeEndOfDayCheck(data, carriedTaskIds, buildFeedback(data));
      setSuccessNotice(`終業後チェックを保存しました。明日へ回したタスクは${carriedTaskIds.length}件です。`);
    } catch (error) {
      Alert.alert('保存に失敗しました', error instanceof Error ? error.message : '終業後チェックを保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="終業後チェック" subtitle="今日の営業データを照合しています">
          <Text style={styles.emptyText}>読み込み中...</Text>
        </Section>
      </ScrollView>
    );
  }

  if (!data || loadError) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="終業後チェック" subtitle="今日の営業データを取得できませんでした">
          <Text style={styles.errorNotice}>{loadError || '不明なエラーが発生しました。'}</Text>
          <Pressable style={styles.primaryCta} onPress={() => void load()}>
            <Text style={styles.primaryCtaText}>再試行</Text>
          </Pressable>
        </Section>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.paneHeaderRow}>
        <View style={styles.paneHeaderText}>
          <Text style={styles.paneTitle}>終業後チェック</Text>
          <Text style={styles.paneSubcopy}>今日の実データを確認し、未完了だけを明日へ引き継ぐ</Text>
          <Text style={styles.dateText}>{data.date}</Text>
        </View>
        <Pressable style={styles.smallOutlineButton} onPress={() => void load()}>
          <Text style={styles.smallOutlineText}>再読込</Text>
        </Pressable>
      </View>

      <View style={styles.endSummaryGrid}>
        <EndSummaryCard label="完了タスク" value={`${data.completedTasks.length}件`} />
        <EndSummaryCard label="未完了タスク" value={`${data.incompleteTasks.length}件`} warning={data.incompleteTasks.length > 0} />
        <EndSummaryCard label="完了した予定" value={`${data.completedEvents.length}件`} />
        <EndSummaryCard label="入力・保存漏れ" value={`${unresolvedCount}件`} danger={unresolvedCount > 0} />
      </View>

      <Section title="今日の営業結果" subtitle="今日完了したタスクと予定を、保存済みデータから表示します">
        {data.completedTasks.map((task) => (
          <DataRow
            key={`task-${task.id}`}
            title={personName(data, task.contactId)}
            badge="タスク完了"
            body={`${task.title}\n更新：${formatDateTime(task.updatedAt)}`}
          />
        ))}
        {data.completedEvents.map((event) => (
          <DataRow
            key={`event-${event.id}`}
            title={personName(data, event.contactId)}
            badge="予定終了"
            body={`${event.title}\n終了：${formatDateTime(event.endAt)}`}
          />
        ))}
        {data.completedTasks.length === 0 && data.completedEvents.length === 0 ? (
          <Text style={styles.emptyText}>今日完了したタスク・予定はありません。</Text>
        ) : null}
      </Section>

      <Section title="未処理チェック" subtitle="予定・後メモ・文面確認・抜け漏れの実状態です">
        {data.eventsMissingAfterMemo.map((event) => (
          <UnprocessedCard
            key={`event-memo-${event.id}`}
            type="後メモ未入力"
            target={personName(data, event.contactId)}
            body={`「${event.title}」は終了していますが、保存済み後メモが紐づいていません。`}
            button="後メモを入力"
            onPress={() => onAfter({
              personId: event.contactId,
              salesRouteId: event.salesRouteId ?? undefined,
              calendarEventId: event.id,
            })}
          />
        ))}
        {data.unsavedAfterMemos.map((memo) => (
          <UnprocessedCard
            key={`memo-${memo.id}`}
            type="後メモ未保存"
            target={personName(data, memo.contactId)}
            body={memo.summary || '整理結果はありますが、人脈カードに保存されていません。'}
            button="後メモを確認"
            onPress={() => onAfter({
              personId: memo.contactId,
              salesRouteId: memo.salesRouteId ?? undefined,
              calendarEventId: memo.calendarEventId ?? undefined,
            })}
          />
        ))}
        {data.unsavedMessageChecks.map((check) => (
          <UnprocessedCard
            key={`message-${check.id}`}
            type="文面確認未保存"
            target={personName(data, check.contactId)}
            body={`${check.checkType || '文面確認'}の生成結果が人脈カードに保存されていません。`}
          />
        ))}
        {data.contactsMissingNextContact.map((contact) => (
          <UnprocessedCard
            key={`contact-date-${contact.id}`}
            type="次回連絡日未設定"
            target={contact.name}
            body="次回連絡日が保存されていないため、追客タスクの期限を判断できません。"
          />
        ))}
        {data.unresolvedDataGaps.map((gap) => (
          <UnprocessedCard
            key={`gap-${gap.id}`}
            type="抜け漏れ"
            target={personName(data, gap.contactId)}
            body={`${gap.title}（重要度：${gap.severity || '未設定'}）`}
          />
        ))}
        {unresolvedCount === 0 ? <Text style={styles.emptyText}>入力・保存漏れはありません。</Text> : null}
      </Section>

      <Section title="明日に回すもの" subtitle="未完了のActionTaskだけを明日9:00へ変更し、操作履歴を残します">
        {data.incompleteTasks.map((task) => {
          const carrying = carryingTaskIds.has(task.id);
          return (
            <View key={task.id} style={styles.tomorrowRow}>
              <Text style={styles.personSelectName}>{personName(data, task.contactId)}</Text>
              <Text style={styles.todoLine}>{task.title}</Text>
              <Text style={styles.rowMeta}>現在の期限：{formatDateTime(task.dueDate)}</Text>
              <Pressable
                style={[styles.primaryCta, carrying && styles.buttonDisabled]}
                disabled={carrying}
                onPress={() => void carryTask(task)}
              >
                <Text style={styles.primaryCtaText}>{carrying ? '保存中...' : '明日に回す'}</Text>
              </Pressable>
            </View>
          );
        })}
        {data.incompleteTasks.length === 0 ? <Text style={styles.emptyText}>今日までの未完了タスクはありません。</Text> : null}
      </Section>

      <Section title="今日の営業フィードバック">
        <Info label="実データからの確認結果" value={buildFeedback(data)} />
        <Pressable
          style={styles.secondaryCta}
          onPress={() => onCoach(`${buildFeedback(data)} 明日は何を優先すべきですか？`)}
        >
          <Text style={styles.secondaryCtaText}>営業コーチに相談</Text>
        </Pressable>
      </Section>

      <Pressable style={[styles.fullPrimaryButton, saving && styles.buttonDisabled]} disabled={saving} onPress={() => void finish()}>
        <Text style={styles.fullPrimaryText}>{saving ? '保存中...' : '終業後チェックを完了する'}</Text>
      </Pressable>
      {successNotice ? <Text style={styles.successNotice}>{successNotice}</Text> : null}

      <Pressable style={styles.secondaryCta} onPress={onHome}>
        <Text style={styles.secondaryCtaText}>ホームへ戻る</Text>
      </Pressable>
    </ScrollView>
  );
}

function EndSummaryCard({ label, value, warning, danger }: { label: string; value: string; warning?: boolean; danger?: boolean }) {
  return (
    <View style={[styles.endSummaryCard, warning && styles.endSummaryWarning, danger && styles.endSummaryDanger]}>
      <Text style={styles.endSummaryValue}>{value}</Text>
      <Text style={styles.endSummaryLabel}>{label}</Text>
    </View>
  );
}

function DataRow({ title, badge, body }: { title: string; badge: string; body: string }) {
  return (
    <View style={styles.cardUpdateRow}>
      <View style={styles.personSelectTop}>
        <Text style={styles.personSelectName}>{title}</Text>
        <Text style={styles.endStatusPill}>{badge}</Text>
      </View>
      <Text style={styles.referenceSummaryText}>{body}</Text>
    </View>
  );
}

function UnprocessedCard({
  type,
  target,
  body,
  button,
  onPress,
}: {
  type: string;
  target: string;
  body: string;
  button?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.unprocessedCard}>
      <View style={styles.unprocessedHeader}>
        <Text style={styles.unprocessedType}>{type}</Text>
        <Text style={styles.unprocessedTarget}>{target}</Text>
      </View>
      <Text style={styles.referenceSummaryText}>{body}</Text>
      {button && onPress ? (
        <Pressable style={styles.primaryCtaWide} onPress={onPress}>
          <Text style={styles.primaryCtaText}>{button}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
