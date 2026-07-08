import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Info from '../../components/Info';
import Section from '../../components/Section';
import { getDueState, priorityScore } from '../../logic/personPriority';
import { scheduleContactNotification } from '../../notifications/notificationService';
import { saveEndOfDayCheck } from '../../storage/flowLogStorage';
import { updatePerson } from '../../storage/personStorage';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';

const END_OF_DAY_REMINDER_OPTIONS = [
  { label: '明日 9:00', days: 1 },
  { label: '3日後 9:00', days: 3 },
  { label: '1週間後 9:00', days: 7 },
];

function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function summarizeNames(people: Person[], limit = 3) {
  const names = people.slice(0, limit).map((person) => person.name);
  const rest = people.length - names.length;
  return rest > 0 ? `${names.join('・')} 他${rest}名` : names.join('・');
}

export default function EndOfDayPane({
  people,
  onPersonUpdated,
  onAfter,
  onHome,
  onCoach,
}: {
  people: Person[];
  onPersonUpdated: (person: Person) => void;
  onAfter: () => void;
  onHome: () => void;
  onCoach: (initialPrompt: string) => void;
}) {
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<Person | null>(null);
  const [reminderNotice, setReminderNotice] = useState('');

  const today = new Date();
  const updatedToday = useMemo(
    () => people.filter((person) => person.updatedAt && isSameCalendarDay(new Date(person.updatedAt), today)),
    [people],
  );
  const memoMissing = useMemo(() => people.filter((person) => !person.additionalMemo), [people]);
  const contactDateMissing = useMemo(() => people.filter((person) => !person.nextContactAt), [people]);
  const actionMissing = useMemo(() => people.filter((person) => !person.nextAction), [people]);
  const overduePeople = useMemo(() => people.filter((person) => getDueState(person) === 'overdue'), [people]);
  const gapCount = useMemo(
    () => new Set([...memoMissing, ...contactDateMissing, ...actionMissing].map((person) => person.id)).size,
    [actionMissing, contactDateMissing, memoMissing],
  );
  const tomorrowPriorities = useMemo(
    () => [...people].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 3),
    [people],
  );

  const applyReminder = async (days: number) => {
    if (!reminderTarget) {
      return;
    }

    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);

    let notificationId = reminderTarget.notificationId;
    let notice = `${reminderTarget.name}の次回連絡日を ${formatDateTime(date.toISOString())} に設定しました`;
    try {
      notificationId = await scheduleContactNotification(reminderTarget, date);
    } catch {
      notice += '（通知は設定できませんでした）';
    }

    const saved = await updatePerson({
      ...reminderTarget,
      nextContactAt: date.toISOString(),
      notificationId,
    });
    onPersonUpdated(saved);
    setReminderTarget(null);
    setReminderNotice(notice);
  };

  if (people.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="終業後チェック" subtitle="今日の営業を整理し、明日の営業地図に反映する">
          <Text style={styles.emptyText}>まだ人脈カードがありません。人脈タブから最初の1人を追加すると、ここで1日の漏れを確認できます。</Text>
        </Section>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.paneHeaderRow}>
        <View style={styles.paneHeaderText}>
          <Text style={styles.paneTitle}>終業後チェック</Text>
          <Text style={styles.paneSubcopy}>今日の営業を整理し、明日の営業地図に反映する</Text>
          <Text style={styles.dateText}>{`${today.getMonth() + 1}月${today.getDate()}日`}</Text>
        </View>
        <View style={styles.paneHeaderActions}>
          <Pressable style={styles.smallOutlineButton} onPress={onHome}>
            <Text style={styles.smallOutlineText}>明日</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.endSummaryGrid}>
        <EndSummaryCard label="今日更新した人脈カード" value={`${updatedToday.length}件`} />
        <EndSummaryCard label="連絡日超過" value={`${overduePeople.length}件`} warning />
        <EndSummaryCard label="入力漏れのある人" value={`${gapCount}件`} danger />
        <EndSummaryCard label="人脈カード合計" value={`${people.length}件`} />
      </View>

      <Section title="未処理チェック" subtitle="営業データとして保存されていないものを潰します。">
        {memoMissing.length > 0 ? (
          <UnprocessedCard
            type="後メモ未入力"
            target={summarizeNames(memoMissing)}
            body={`${memoMissing.length}件の人脈カードに、会話後のメモがまだ入力されていません。`}
            reason="会話内容を記録しないと、相手の課題・温度感・紹介可能性が人脈カードに蓄積されません。"
            button="後メモを入力"
            onPress={onAfter}
          />
        ) : null}
        {contactDateMissing.length > 0 ? (
          <UnprocessedCard
            type="次回連絡日未設定"
            target={summarizeNames(contactDateMissing)}
            body={`${contactDateMissing.length}件の人脈カードに次回連絡日が設定されていません。`}
            reason="次回連絡日がないと、将来候補が放置される可能性があります。"
            button="通知を設定"
            onPress={() => setReminderTarget(contactDateMissing[0])}
          />
        ) : null}
        {actionMissing.length > 0 ? (
          <UnprocessedCard
            type="次アクション未設定"
            target={summarizeNames(actionMissing)}
            body={`${actionMissing.length}件の人脈カードで、次に何をするかが決まっていません。`}
            reason="次アクションがないと、情報源候補として活かせません。"
            button="後メモで次アクションを作る"
            onPress={onAfter}
          />
        ) : null}
        {memoMissing.length === 0 && contactDateMissing.length === 0 && actionMissing.length === 0 ? (
          <Text style={styles.emptyText}>未処理はありません。すべての人脈カードに記録・次回連絡日・次アクションが揃っています。</Text>
        ) : null}
      </Section>

      <Section title="今日の人脈カード更新" subtitle="今日、追加・更新された人脈カードを確認します。">
        {updatedToday.length > 0 ? (
          updatedToday.map((person) => (
            <CardUpdateRow
              key={person.id}
              name={person.name}
              status="更新済み"
              body={`・次アクション：${person.nextAction || '未設定'}\n・次回連絡：${formatDateTime(person.nextContactAt)}`}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>今日更新された人脈カードはまだありません。</Text>
        )}
      </Section>

      <Section title="今日の営業フィードバック">
        <Info
          label="今日の状況"
          value={
            updatedToday.length > 0
              ? `今日は${updatedToday.length}件の人脈カードを更新できています。会話や返信を営業データに残せています。`
              : '今日はまだ人脈カードの更新がありません。会話やLINEのやり取りがあれば、後メモ・文面確認から記録しましょう。'
          }
        />
        <Info
          label="今日の改善点"
          value={
            gapCount > 0
              ? `入力漏れのある人脈カードが${gapCount}件あります。特に${memoMissing.length > 0 ? `後メモ未入力（${memoMissing.length}件）` : `次回連絡日・次アクションの未設定（${contactDateMissing.length + actionMissing.length}件）`}を先に潰すのが安全です。`
              : '入力漏れはありません。この状態を毎日維持しましょう。'
          }
        />
        <Info label="科学的根拠" value="会話直後は記憶が新しく、相手の課題や温度感を正確に記録しやすい。時間が空くほど情報が抜け、次アクションの精度が落ちやすい。" />
        <Pressable
          style={styles.secondaryCta}
          onPress={() =>
            onCoach(
              `今日は人脈カードを${updatedToday.length}件更新しました。後メモ未入力が${memoMissing.length}件、次回連絡日未設定が${contactDateMissing.length}件あります。明日からどう改善すべきか相談したいです。`,
            )
          }
        >
          <Text style={styles.secondaryCtaText}>営業コーチに相談</Text>
        </Pressable>
      </Section>

      <Section title="明日に回すもの" subtitle="連絡日を過ぎている人を、明日以降の行動に変えます。">
        {overduePeople.length > 0 ? (
          overduePeople.map((person) => (
            <TomorrowCarryRow
              key={person.id}
              name={person.name}
              unfinished={person.nextAction || '次アクション未設定'}
              reason={`次回連絡日（${formatDateTime(person.nextContactAt)}）を過ぎている`}
              tomorrow="連絡日を設定し直して追客漏れを防ぐ"
              primary="通知を設定"
              secondary="後メモを入力"
              onPrimary={() => setReminderTarget(person)}
              onSecondary={onAfter}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>連絡日を過ぎている人はいません。</Text>
        )}
      </Section>

      <Section title="明日のホーム反映" subtitle="現在の人脈カードから、明日のホームに出る優先行動を確認します。">
        <View style={styles.navSummaryCard}>
          <Info
            label="明日の優先行動"
            value={
              tomorrowPriorities.length > 0
                ? tomorrowPriorities
                    .map((person, index) => `${index + 1}. ${person.name}：${person.nextAction || '次アクションを決める'}`)
                    .join('\n')
                : '対象の人脈カードがありません。'
            }
            compact
          />
          <Info
            label="明日の注意"
            value={gapCount > 0 ? '新規提案より、今日得た情報の整理と追客漏れ防止を優先する' : '入力漏れがない状態です。次の接触の質を上げることに集中する'}
            compact
          />
        </View>
        <Pressable style={styles.primaryCta} onPress={onHome}>
          <Text style={styles.primaryCtaText}>明日のホームを確認する</Text>
        </Pressable>
      </Section>

      <Pressable
        style={[styles.fullPrimaryButton, saving && styles.buttonDisabled]}
        disabled={saving}
        onPress={async () => {
          if (saving) return;
          setSaving(true);
          try {
            // 終業後チェックのスナップショットを end_of_day_checks へ永続化する（Issue #17）
            await saveEndOfDayCheck({
              updatedContactNames: updatedToday.map((person) => person.name),
              memoMissingNames: memoMissing.map((person) => person.name),
              contactDateMissingNames: contactDateMissing.map((person) => person.name),
              actionMissingNames: actionMissing.map((person) => person.name),
              overdueNames: overduePeople.map((person) => person.name),
              tomorrowPriorities: tomorrowPriorities.map(
                (person) => `${person.name}：${person.nextAction || '次アクションを決める'}`,
              ),
              feedback:
                gapCount > 0
                  ? `入力漏れのある人脈カードが${gapCount}件。後メモ未入力${memoMissing.length}件、次回連絡日未設定${contactDateMissing.length}件、次アクション未設定${actionMissing.length}件。`
                  : '入力漏れなし。',
            });
            setCompleted(true);
          } catch (error) {
            // 保存に失敗した場合は完了扱いにしない（CLAUDE.md 4.2）
            Alert.alert('保存に失敗しました', error instanceof Error ? error.message : '終業後チェックの保存中にエラーが発生しました。');
          } finally {
            setSaving(false);
          }
        }}
      >
        <Text style={styles.fullPrimaryText}>{saving ? '保存中...' : '終業後チェックを完了する'}</Text>
      </Pressable>
      {completed ? <Text style={styles.successNotice}>終業後チェックを完了しました。ホームは常に最新の人脈カードから生成されます。</Text> : null}
      {reminderNotice ? <Text style={styles.successNotice}>{reminderNotice}</Text> : null}

      <Modal visible={reminderTarget !== null} transparent animationType="fade" onRequestClose={() => setReminderTarget(null)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.personPickerSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>次回連絡日を設定</Text>
                <Text style={styles.sheetSubcopy}>{reminderTarget ? `${reminderTarget.name}の次回連絡日と通知を設定します。` : ''}</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setReminderTarget(null)}>
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </Pressable>
            </View>
            {END_OF_DAY_REMINDER_OPTIONS.map((option) => (
              <Pressable key={option.label} style={styles.personSelectCard} onPress={() => applyReminder(option.days)}>
                <Text style={styles.personSelectName}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
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

function UnprocessedCard({
  type,
  target,
  body,
  reason,
  button,
  onPress,
}: {
  type: string;
  target: string;
  body: string;
  reason: string;
  button: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.unprocessedCard}>
      <View style={styles.unprocessedHeader}>
        <Text style={styles.unprocessedType}>{type}</Text>
        <Text style={styles.unprocessedTarget}>{target}</Text>
      </View>
      <Text style={styles.referenceSummaryText}>{body}</Text>
      <Text style={styles.referenceSummaryCaution}>なぜ必要か：{reason}</Text>
      <Pressable style={styles.primaryCtaWide} onPress={onPress}>
        <Text style={styles.primaryCtaText}>{button}</Text>
      </Pressable>
    </View>
  );
}

function CardUpdateRow({
  name,
  status,
  body,
  actionLabel,
  onPress,
}: {
  name: string;
  status: string;
  body: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.cardUpdateRow}>
      <View style={styles.personSelectTop}>
        <Text style={styles.personSelectName}>{name}</Text>
        <Text style={styles.endStatusPill}>{status}</Text>
      </View>
      <Text style={styles.referenceSummaryText}>{body}</Text>
      {actionLabel && onPress ? (
        <Pressable style={styles.secondaryCta} onPress={onPress}>
          <Text style={styles.secondaryCtaText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TomorrowCarryRow({
  name,
  unfinished,
  reason,
  tomorrow,
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: {
  name: string;
  unfinished: string;
  reason: string;
  tomorrow: string;
  primary: string;
  secondary: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <View style={styles.tomorrowRow}>
      <Text style={styles.personSelectName}>{name}</Text>
      <Text style={styles.rowMeta}>未完了内容：{unfinished}</Text>
      <Text style={styles.rowMeta}>明日に回す理由：{reason}</Text>
      <Text style={styles.todoLine}>明日の行動：{tomorrow}</Text>
      <View style={styles.inlineActions}>
        <Pressable style={styles.primaryCta} onPress={onPrimary}>
          <Text style={styles.primaryCtaText}>{primary}</Text>
        </Pressable>
        <Pressable style={styles.secondaryCta} onPress={onSecondary}>
          <Text style={styles.secondaryCtaText}>{secondary}</Text>
        </Pressable>
      </View>
    </View>
  );
}
