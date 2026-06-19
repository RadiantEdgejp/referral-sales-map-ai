import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bot, Bell, MessageSquare, Save } from 'lucide-react-native';
import AttachmentTextInput from '../components/AttachmentTextInput';
import SectionCard from '../components/SectionCard';
import { getPeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';

const FALLBACK_QUESTIONS = [
  '最近、採用と集客どちらが大変ですか？',
  '周りの経営者も同じ悩みを持っていますか？',
  '今後どんな人と繋がれると助かりますか？',
];

export default function AfterMemoScreen({ navigation, route }: ScreenProps<'AfterMemo'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [memo, setMemo] = useState('');
  const questions = route.params?.questions?.length ? route.params.questions : FALLBACK_QUESTIONS;

  useEffect(() => {
    getPeople().then(setPeople);
  }, []);

  const person = people.find((item) => item.id === route.params?.personId) ?? people[0];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>後メモ</Text>
      <Text style={styles.subcopy}>予定前ナビで決めた質問の回答を入れて、人脈カードを育てます。</Text>

      <SectionCard title="予定前ナビで決めた質問">
        {questions.map((question) => (
          <View key={question} style={styles.answerBlock}>
            <Text style={styles.question}>{question}</Text>
            <AttachmentTextInput
              value={answers[question] ?? ''}
              onChangeText={(value) => setAnswers((current) => ({ ...current, [question]: value }))}
              placeholder="相手の回答を入力"
              minHeight={74}
              compact
            />
          </View>
        ))}
      </SectionCard>

      <SectionCard title="営業データとして記録するもの">
        <AttachmentTextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="話した内容、悩み、温度感、紹介できそうな人、違和感、断られた理由、次回連絡タイミングなど"
          minHeight={128}
        />
      </SectionCard>

      <SectionCard title="AIの人脈カード更新案">
        <Info label="分類変更案" value="紹介元候補 / 情報源候補を維持。顧客候補はまだ弱い。" />
        <Info label="ゴール変更案" value="情報交換を継続し、2回目以降に紹介依頼の余地を見る。" />
        <Info label="次アクション" value="3日以内に会話で出た課題に関する情報を1つ送る。" />
        <Info label="次回連絡日" value="3日後 9:00" />
        <Info label="次回聞くべき質問" value="周りにも同じ採用課題を持つ経営者さんはいますか？" />
        <Info label="LINE文案" value="今日はありがとうございました。採用の話、とても参考になりました。関連しそうな情報を見つけたのでまた送ります。" />
      </SectionCard>

      <View style={styles.actions}>
        <Action icon={<Save color="#FFFFFF" size={18} />} label="人脈カードを更新" primary onPress={() => person && navigation.navigate('PersonDetail', { personId: person.id })} />
        <Action icon={<Bell color="#153E75" size={18} />} label="次回通知を設定" />
      </View>
      <View style={styles.actions}>
        <Action icon={<MessageSquare color="#153E75" size={18} />} label="LINE文を作る" onPress={() => navigation.navigate('LineCheck', { personId: person?.id })} />
        <Action icon={<Bot color="#153E75" size={18} />} label="コーチに相談" onPress={() => navigation.navigate('CoachChat', { initialPrompt: '商談後メモから、人脈カード更新と次アクションを相談したいです。' })} />
      </View>
      <Pressable style={styles.doneButton} onPress={() => navigation.navigate('EndOfDayCheck')}>
        <Text style={styles.doneText}>今日の処理完了</Text>
      </Pressable>
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

function Action({ icon, label, primary, onPress }: { icon: ReactNode; label: string; primary?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={[styles.actionButton, primary && styles.primaryButton]} onPress={onPress}>
      {icon}
      <Text style={[styles.actionText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 16, paddingBottom: 32 },
  title: { color: '#0F172A', fontSize: 24, fontWeight: '900' },
  subcopy: { color: '#64748B', fontWeight: '800', lineHeight: 20, marginTop: 4, marginBottom: 14 },
  answerBlock: { marginBottom: 12 },
  question: { color: '#153E75', fontWeight: '900', lineHeight: 20, marginBottom: 6 },
  info: { marginBottom: 10 },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  infoValue: { color: '#0F172A', lineHeight: 21, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 8, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#B8D4FF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButton: { backgroundColor: '#153E75', borderColor: '#153E75' },
  actionText: { color: '#153E75', fontWeight: '900' },
  primaryText: { color: '#FFFFFF' },
  doneButton: { minHeight: 50, borderRadius: 8, backgroundColor: '#166534', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#FFFFFF', fontWeight: '900' },
});
