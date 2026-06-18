import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bot, ClipboardList, FileText } from 'lucide-react-native';
import FilterChip from '../components/FilterChip';
import SectionCard from '../components/SectionCard';
import { getPeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';

const PURPOSES = ['初回接触', '情報交換', '商談', '紹介依頼前', '追客', '関係構築'];

const QUESTIONS = [
  '最近、採用と集客どちらが大変ですか？',
  '周りの経営者も同じ悩みを持っていますか？',
  '今後どんな人と繋がれると助かりますか？',
];

export default function PreMeetingNavScreen({ navigation, route }: ScreenProps<'PreMeetingNav'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState(route.params?.personId ?? '');
  const [purpose, setPurpose] = useState(route.params?.purpose ?? '情報交換');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    getPeople().then((items) => {
      setPeople(items);
      if (!personId && items[0]) {
        setPersonId(items[0].id);
      }
    });
  }, [personId]);

  const person = useMemo(() => people.find((item) => item.id === personId), [people, personId]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>予定前ナビ</Text>
      <Text style={styles.subcopy}>人脈カードの情報を見ながら、会う前の質問と到達点を決めます。</Text>

      <Text style={styles.label}>今日会う人</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {people.map((item) => (
          <FilterChip key={item.id} label={item.name} selected={personId === item.id} onPress={() => setPersonId(item.id)} />
        ))}
      </ScrollView>

      <Text style={styles.label}>目的</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {PURPOSES.map((item) => (
          <FilterChip key={item} label={item} selected={purpose === item} onPress={() => setPurpose(item)} />
        ))}
      </ScrollView>

      <Text style={styles.label}>追加メモ</Text>
      <TextInput
        value={memo}
        onChangeText={setMemo}
        placeholder="今日聞きたいこと、相手の返信、紹介者情報など"
        placeholderTextColor="#94A3B8"
        multiline
        textAlignVertical="top"
        style={styles.input}
      />

      <SectionCard title="参照している人脈カード情報">
        <Info label="分類" value={person?.categories.join('、') ?? '未選択'} />
        <Info label="前回の次アクション" value={person?.nextAction ?? '未設定'} />
        <Info label="注意点" value={person?.cautions ?? '未設定'} />
      </SectionCard>

      <SectionCard title="今日のナビ">
        <Info label="今日の目的" value={`${purpose}を通じて、相手の課題と次の接点を明確にする`} />
        <Info label="今日の到達点" value="分類・ゴール・次アクション・次回連絡日を更新できる状態にする" />
        <Info label="最初の切り口" value={person?.openingTalk ?? '相手の最近の状況から入る'} />
        <Info label="聞くべき質問" value={QUESTIONS.join('\n')} />
        <Info label="深掘り質問" value="その悩みは、周りの経営者にも多いですか？" />
        <Info label="聞いてはいけないこと" value="初回から保険や紹介依頼を強く出さない" />
        <Info label="売るべきか、聞くべきか" value="今日は売るより聞く。情報交換を優先する。" />
        <Info label="紹介依頼していい段階か" value="まだ早い。役立つ情報を渡した後、2回目以降に検討。" />
        <Info label="会話後に記録すべき項目" value="回答、課題、温度感、紹介できそうな人、次アクション、次回連絡日" />
      </SectionCard>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton}>
          <ClipboardList color="#153E75" size={18} />
          <Text style={styles.secondaryText}>質問をコピー</Text>
        </Pressable>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('AfterMemo', { personId, questions: QUESTIONS })}
        >
          <FileText color="#FFFFFF" size={18} />
          <Text style={styles.primaryText}>後メモへ進む</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => personId && navigation.navigate('PersonDetail', { personId })}>
          <Text style={styles.secondaryText}>人脈カードを見る</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate('CoachChat', {
              initialPrompt: `${person?.name ?? 'この人'}との${purpose}前に、何を聞くべきか相談したいです。`,
            })
          }
        >
          <Bot color="#153E75" size={18} />
          <Text style={styles.secondaryText}>コーチに相談</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 16, paddingBottom: 32 },
  title: { color: '#0F172A', fontSize: 24, fontWeight: '900' },
  subcopy: { color: '#64748B', fontWeight: '800', lineHeight: 20, marginTop: 4, marginBottom: 14 },
  label: { color: '#0F172A', fontWeight: '900', marginBottom: 8, marginTop: 10 },
  row: { flexGrow: 0, marginBottom: 4 },
  input: {
    minHeight: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7DEE8',
    borderRadius: 8,
    padding: 12,
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 12,
  },
  info: { marginBottom: 10 },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  infoValue: { color: '#0F172A', lineHeight: 21, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2, marginBottom: 10 },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#153E75',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#B8D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  secondaryText: { color: '#153E75', fontWeight: '900' },
});
