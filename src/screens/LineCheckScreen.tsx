import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bot, Clipboard, FileText, MessageCircle, Save } from 'lucide-react-native';
import AttachmentTextInput from '../components/AttachmentTextInput';
import FilterChip from '../components/FilterChip';
import SectionCard from '../components/SectionCard';
import { getPeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';

type Mode = 'send' | 'receive';

export default function LineCheckScreen({ navigation, route }: ScreenProps<'LineCheck'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [mode, setMode] = useState<Mode>('send');
  const [text, setText] = useState(route.params?.draft ?? '');

  useEffect(() => {
    getPeople().then(setPeople);
  }, []);

  const person = people.find((item) => item.id === route.params?.personId) ?? people[0];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>LINEチェック</Text>
      <Text style={styles.subcopy}>文章添削だけでなく、LINE上の会話を人脈カードに吸収します。</Text>

      <Text style={styles.label}>チェック種別</Text>
      <View style={styles.modeRow}>
        <FilterChip label="送信前チェック" selected={mode === 'send'} onPress={() => setMode('send')} />
        <FilterChip label="受信後の蓄積" selected={mode === 'receive'} onPress={() => setMode('receive')} />
      </View>

      <Text style={styles.label}>LINE文・相手の発言</Text>
      <AttachmentTextInput
        value={text}
        onChangeText={setText}
        placeholder="送る文、相手から来た文、スクショ内容、音声入力メモなど"
        minHeight={140}
        backgroundColor="#FFFFFF"
      />

      {mode === 'send' ? (
        <SectionCard title="送信前チェック">
          <Metric label="売り込み感" value="中。保険の話題はまだ出さない方が安全。" />
          <Metric label="圧の強さ" value="やや弱め。質問を1つに絞ると返信しやすい。" />
          <Metric label="返信しやすさ" value="良い。相手の業界課題を聞く形になっている。" />
          <Metric label="相手メリット" value="情報交換の姿勢があり、売り込み感を下げられる。" />
          <Metric label="今送っていいか" value="送ってよい。紹介依頼はまだ入れない。" />
          <Metric label="修正文" value="先日はありがとうございました。最近、美容業界の採用まわりでどんな悩みが多いか、少し教えていただけませんか？" />
        </SectionCard>
      ) : (
        <SectionCard title="受信後のデータ蓄積">
          <Metric label="相手の温度感" value="中。返信意欲はあるが、商談化はまだ早い。" />
          <Metric label="相手の課題" value="採用とスタッフ定着に課題あり。" />
          <Metric label="断り理由" value="保険の話にはまだ関心が薄い。" />
          <Metric label="興味の方向" value="同業経営者の事例、採用成功例、固定費見直し。" />
          <Metric label="紹介可能性" value="美容業界の経営者人脈を持つ可能性あり。" />
          <Metric label="次に聞く質問" value="周りにも採用で困っているサロン経営者さんはいますか？" />
          <Metric label="返信文" value="教えていただきありがとうございます。採用の話、他の経営者さんにも多い悩みなんですね。" />
          <Metric label="人脈カード更新案" value="情報源候補を強める。次回連絡日は3日後。" />
        </SectionCard>
      )}

      <View style={styles.actions}>
        <Action icon={<Clipboard color="#153E75" size={18} />} label="修正文をコピー" />
        <Action icon={<MessageCircle color="#153E75" size={18} />} label="返信文を作る" />
      </View>
      <View style={styles.actions}>
        <Action icon={<Save color="#FFFFFF" size={18} />} label="人脈カードに保存" primary onPress={() => person && navigation.navigate('PersonDetail', { personId: person.id })} />
        <Action icon={<FileText color="#153E75" size={18} />} label="後メモに送る" onPress={() => navigation.navigate('AfterMemo', { personId: person?.id })} />
      </View>
      <Pressable
        style={styles.coachButton}
        onPress={() => navigation.navigate('CoachChat', { initialPrompt: 'LINEのやり取りから、次に何を聞くべきか相談したいです。' })}
      >
        <Bot color="#FFFFFF" size={18} />
        <Text style={styles.coachText}>コーチに相談</Text>
      </Pressable>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
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
  label: { color: '#0F172A', fontWeight: '900', marginBottom: 8, marginTop: 10 },
  modeRow: { flexDirection: 'row', marginBottom: 8 },
  metric: { marginBottom: 10 },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  metricValue: { color: '#0F172A', lineHeight: 21, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 8, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#B8D4FF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButton: { backgroundColor: '#153E75', borderColor: '#153E75' },
  actionText: { color: '#153E75', fontWeight: '900' },
  primaryText: { color: '#FFFFFF' },
  coachButton: { minHeight: 50, borderRadius: 8, backgroundColor: '#153E75', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  coachText: { color: '#FFFFFF', fontWeight: '900' },
});
