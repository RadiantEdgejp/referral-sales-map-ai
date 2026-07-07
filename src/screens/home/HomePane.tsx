import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Info from '../../components/Info';
import MiniButton from '../../components/MiniButton';
import Route from '../../components/Route';
import Schedule from '../../components/Schedule';
import Section from '../../components/Section';
import { dateValue, formatTime, getDueState } from '../../logic/personPriority';
import type { TodayAction } from '../../logic/todayActions';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';

export default function HomePane({
  people,
  actions,
  planUpdated,
  onOpenPerson,
}: {
  people: Person[];
  actions: TodayAction[];
  planUpdated: boolean;
  onOpenPerson: (personId?: string) => void;
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
                <MiniButton label="詳細" />
                <MiniButton label="完了" />
                <MiniButton label="延期" />
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
    </ScrollView>
  );
}
