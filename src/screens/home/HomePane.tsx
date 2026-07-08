import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Info from '../../components/Info';
import MemoField from '../../components/MemoField';
import MiniButton from '../../components/MiniButton';
import Route from '../../components/Route';
import Schedule from '../../components/Schedule';
import Section from '../../components/Section';
import { recordReactionEvent } from '../../logic/groundedEvents';
import { applyNextContact, nextContactDate } from '../../logic/nextContact';
import { dateValue, formatTime, getDueState } from '../../logic/personPriority';
import {
  REACTION_LABELS,
  REACTION_NEXT_CONTACT_DAYS,
  type ReactionKind,
} from '../../logic/relationshipScore';
import type { TodayAction } from '../../logic/todayActions';
import { recordInteraction } from '../../storage/interactionLedger';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';

const REACTION_OPTIONS: Array<{ kind: ReactionKind; hint: string }> = [
  { kind: 'positive', hint: '前向き・話が進んだ' },
  { kind: 'neutral', hint: '普通の反応だった' },
  { kind: 'no_response', hint: '返事・反応がなかった' },
  { kind: 'rejected', hint: '断られた・不要と言われた' },
];

export default function HomePane({
  people,
  actions,
  planUpdated,
  onOpenPerson,
  onPersonUpdated,
}: {
  people: Person[];
  actions: TodayAction[];
  planUpdated: boolean;
  onOpenPerson: (personId?: string) => void;
  onPersonUpdated: (person: Person) => void;
}) {
  const todaySchedule = useMemo(
    () =>
      people
        .filter((person) => getDueState(person) === 'today')
        .sort((a, b) => dateValue(a.nextContactAt) - dateValue(b.nextContactAt)),
    [people],
  );
  const overduePeople = useMemo(
    () => people.filter((person) => getDueState(person) === 'overdue'),
    [people],
  );
  const preMeetingPerson = todaySchedule[0];

  // 完了時のリアクション記録シート（行動＋反応を1操作で台帳に蓄積する）
  const [reactionTarget, setReactionTarget] = useState<TodayAction | null>(null);
  const [reactionMemo, setReactionMemo] = useState('');
  const [recordingReaction, setRecordingReaction] = useState(false);

  const openReactionSheet = (item: TodayAction) => {
    setReactionMemo('');
    setReactionTarget(item);
  };

  const completeWithReaction = async (item: TodayAction, reaction: ReactionKind) => {
    const person = people.find((candidate) => candidate.id === item.personId);
    if (!person || recordingReaction) {
      return;
    }

    setRecordingReaction(true);
    const reactionLabel = REACTION_LABELS[reaction];
    const memoText = reactionMemo.trim();
    const doneLine = `${formatDateTime(new Date().toISOString())} 優先行動「${item.todayTodo}」を完了（反応：${reactionLabel}${memoText ? ` / ${memoText}` : ''}）`;

    try {
      // 1. 行動＋反応を台帳へ記録し、決定的規則でスコアを更新（根拠つき）
      const event = await recordReactionEvent({
        person: {
          ...person,
          additionalMemo: [person.additionalMemo, doneLine].filter(Boolean).join('\n'),
        },
        action: 'task_completed',
        reaction,
        title: `優先行動「${item.todayTodo}」を完了`,
        summary: memoText || `反応：${reactionLabel}`,
        sourceType: 'action_task',
        scale: 'direct',
      });

      // 2. リアクション種別に応じた次回連絡日ルール（好反応→短め、反応なし→長め）
      const days = REACTION_NEXT_CONTACT_DAYS[reaction];
      const { saved, notice } = await applyNextContact(event.saved, nextContactDate(days));

      // 3. 自動提案の理由も台帳に残す（根拠のない日付にしない）
      await recordInteraction({
        person: saved,
        action: 'auto_next_contact',
        title: '次回連絡日を自動設定',
        summary: `反応「${reactionLabel}」だったため、規則（${days}日後 9:00）を適用しました。`,
        sourceType: 'interaction_rule',
        sourceId: event.ledgerRowId,
      });

      onPersonUpdated(saved);
      setReactionTarget(null);
      Alert.alert(
        `反応「${reactionLabel}」を記録しました`,
        [
          `スコア変動：${event.changeSummary}`,
          notice,
          '会話の内容は後メモから入力すると人脈カードに反映されます。',
        ].join('\n'),
      );
    } catch (error) {
      // 保存に失敗した場合は成功表示をしない（CLAUDE.md 4.2）
      Alert.alert('記録に失敗しました', error instanceof Error ? error.message : '反応の記録中にエラーが発生しました。');
    } finally {
      setRecordingReaction(false);
    }
  };

  const postponeAction = async (item: TodayAction) => {
    const person = people.find((candidate) => candidate.id === item.personId);
    if (!person) {
      return;
    }

    try {
      await recordInteraction({
        person,
        action: 'postponed',
        title: `優先行動「${item.todayTodo}」を明日に延期`,
        summary: '次回連絡日を明日 9:00 に再設定しました。',
        sourceType: 'action_task',
      });
      const { saved, notice } = await applyNextContact(person, nextContactDate(1));
      onPersonUpdated(saved);
      Alert.alert('明日に延期しました', notice);
    } catch (error) {
      Alert.alert('延期の記録に失敗しました', error instanceof Error ? error.message : '延期の記録中にエラーが発生しました。');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Section title="今日の営業テーマ">
        <Info label="テーマ" value="次回連絡日が近い人を放置せず、今日の接触を完了する" compact />
        <Info label="今日の狙い" value="売り込みではなく、課題確認と関係構築を優先する" compact />
        <Info label="今日の注意" value="紹介依頼を急がない。まず情報交換を挟む" compact />
        {planUpdated ? <Text style={styles.updatedNotice}>再生成された今日の営業地図です</Text> : null}
      </Section>

      <Section title="今日の優先行動" subtitle="誰に・なぜ・何をするかだけ確認します。">
        {actions.length > 0 ? (
          actions.map((item) => (
            <Pressable key={item.id} style={styles.priorityRow} onPress={() => onOpenPerson(item.personId)}>
              <View style={styles.priorityHeader}>
                <Text style={styles.priorityBadge}>{item.priority}</Text>
                <Text style={styles.rowName}>{item.personName}</Text>
                <Text style={styles.actionType}>{item.actionType}</Text>
              </View>
              <Text style={styles.shortReason}>{item.shortReason}</Text>
              <Text style={styles.todoLine}>今日やること：{item.todayTodo}</Text>
              <View style={styles.rowButtons}>
                <MiniButton label="詳細" onPress={() => onOpenPerson(item.personId)} />
                <MiniButton label="完了" onPress={() => openReactionSheet(item)} />
                <MiniButton label="延期" onPress={() => postponeAction(item)} />
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>まだ人脈カードがありません。人脈タブから最初の1人を追加すると、ここに優先行動が表示されます。</Text>
        )}
      </Section>

      <Section title="今日の予定と通知">
        {todaySchedule.length > 0 ? (
          todaySchedule.map((person) => (
            <Schedule
              key={person.id}
              time={formatTime(person.nextContactAt)}
              title={`${person.name}に連絡`}
              purpose={person.nextAction || person.goal}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>今日が次回連絡日の人はいません。</Text>
        )}
      </Section>

      <Section title="今日進める営業ルート">
        {actions.length > 0 ? (
          actions.map((item) => {
            const person = people.find((candidate) => candidate.id === item.personId);
            return (
              <Route
                key={item.id}
                title={`${item.personName} → ${item.todayTodo}`}
                meta={`${person?.categories.join('・') ?? '分類未設定'} / ${item.actionType}`}
              />
            );
          })
        ) : (
          <Text style={styles.emptyText}>進行中の営業ルートはまだありません。</Text>
        )}
      </Section>

      <Section title="会う前チェック">
        {preMeetingPerson ? (
          <>
            <Info label={preMeetingPerson.name} value={`${formatTime(preMeetingPerson.nextContactAt)} 連絡・接触予定`} />
            <Info label="目的" value={preMeetingPerson.goal} />
            <Info label="最初の質問" value={preMeetingPerson.nextQuestion} />
            <Info label="注意" value={preMeetingPerson.cautions} />
          </>
        ) : (
          <Text style={styles.emptyText}>今日会う予定の人はいません。予定前ナビは相手を選ぶと使えます。</Text>
        )}
      </Section>

      <Section title="会った後に処理するもの">
        {overduePeople.length > 0 ? (
          overduePeople.map((person) => (
            <Route
              key={person.id}
              title={person.name}
              meta={`次回連絡日（${formatDateTime(person.nextContactAt)}）超過。対応したら後メモを入力して次回連絡日を更新`}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>未処理の連絡漏れはありません。</Text>
        )}
      </Section>

      <Section title="今日の営業コーチ指摘">
        <Info label="今週の傾向" value="初回接触はできていますが、会話後に次アクションを決める数が少ないです。" />
        <Info label="今日の改善" value="会話した人は必ず「分類・ゴール・次回連絡日」を決めて終える。" />
      </Section>

      <Modal
        visible={reactionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionTarget(null)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.personPickerSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>相手の反応はどうでしたか？</Text>
                <Text style={styles.sheetSubcopy}>
                  {reactionTarget
                    ? `${reactionTarget.personName}：${reactionTarget.todayTodo}`
                    : ''}
                </Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setReactionTarget(null)}>
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </Pressable>
            </View>

            <MemoField
              label="一言メモ（任意）"
              value={reactionMemo}
              onChangeText={setReactionMemo}
              placeholder="例：資料を見たいと言われた / 既読のまま返信なし"
            />

            {recordingReaction ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#153E75" size="small" />
                <Text style={styles.loadingText}>反応を記録しています...</Text>
              </View>
            ) : (
              REACTION_OPTIONS.map((option) => (
                <Pressable
                  key={option.kind}
                  style={styles.personSelectCard}
                  onPress={() => reactionTarget && completeWithReaction(reactionTarget, option.kind)}
                >
                  <Text style={styles.personSelectName}>{REACTION_LABELS[option.kind]}</Text>
                  <Text style={styles.personSelectMeta}>{option.hint}</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
