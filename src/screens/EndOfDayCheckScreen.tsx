import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Bot, CalendarDays, CheckCircle2, FileText, Save } from 'lucide-react-native';
import SectionCard from '../components/SectionCard';
import type { ScreenProps } from '../types/navigation';

export default function EndOfDayCheckScreen({ navigation }: ScreenProps<'EndOfDayCheck'>) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>終業後チェック</Text>
      <Text style={styles.subcopy}>今日の営業データの漏れを確認し、明日のホームに反映します。</Text>

      <SectionCard title="今日やったこと">
        <Checklist label="山本さんに初回LINE" done />
        <Checklist label="佐藤さんと情報交換" done />
        <Checklist label="田中さんに近況LINE" />
      </SectionCard>

      <SectionCard title="未処理・漏れ">
        <AlertLine title="後メモ未入力" count="1件" />
        <AlertLine title="次回連絡日未設定" count="2人" />
        <AlertLine title="人脈カード更新漏れ" count="1人" />
        <AlertLine title="LINEチェックから保存されていない情報" count="2件" />
      </SectionCard>

      <SectionCard title="明日に回すもの">
        <Info label="今日増えた人脈" value="交流会メモ 1件" />
        <Info label="明日のホームに反映" value="田中さんへ情報提供LINE、佐藤さんの商談後メモ更新" />
      </SectionCard>

      <SectionCard title="AIフィードバック">
        <Info label="できたこと" value="初回連絡はできています。" />
        <Info label="足りないこと" value="会話後メモが足りず、次アクション設定が弱いです。" />
        <Info label="注意" value="紹介依頼に進む前に、情報交換と価値提供を1回挟みましょう。" />
        <Info label="活かせていない資産" value="情報源候補から聞いた内容が人脈カードに保存されていません。" />
      </SectionCard>

      <View style={styles.actions}>
        <Action icon={<FileText color="#153E75" size={18} />} label="未入力メモを処理" onPress={() => navigation.navigate('AfterMemo')} />
        <Action icon={<CalendarDays color="#153E75" size={18} />} label="明日に回す" />
      </View>
      <View style={styles.actions}>
        <Action icon={<Save color="#FFFFFF" size={18} />} label="明日の営業地図を作る" primary onPress={() => navigation.navigate('Home')} />
        <Action icon={<CheckCircle2 color="#153E75" size={18} />} label="人脈カード更新" onPress={() => navigation.navigate('Home')} />
      </View>
      <Pressable
        style={styles.coachButton}
        onPress={() => navigation.navigate('CoachChat', { initialPrompt: '今日の営業を振り返って、明日の営業地図に反映すべきことを相談したいです。' })}
      >
        <Bot color="#FFFFFF" size={18} />
        <Text style={styles.coachText}>コーチに相談</Text>
      </Pressable>
    </ScrollView>
  );
}

function Checklist({ label, done }: { label: string; done?: boolean }) {
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkMark, done && styles.doneMark]}>{done ? '完了' : '未完了'}</Text>
      <Text style={styles.checkText}>{label}</Text>
    </View>
  );
}

function AlertLine({ title, count }: { title: string; count: string }) {
  return (
    <View style={styles.alertLine}>
      <Text style={styles.alertTitle}>{title}</Text>
      <Text style={styles.alertCount}>{count}</Text>
    </View>
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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  checkMark: { color: '#92400E', backgroundColor: '#FEF3C7', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '900' },
  doneMark: { color: '#166534', backgroundColor: '#DCFCE7' },
  checkText: { color: '#0F172A', fontWeight: '800' },
  alertLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  alertTitle: { color: '#7C2D12', fontWeight: '900', flex: 1 },
  alertCount: { color: '#C2410C', fontWeight: '900' },
  info: { marginBottom: 10 },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  infoValue: { color: '#0F172A', lineHeight: 21, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 8, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#B8D4FF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButton: { backgroundColor: '#153E75', borderColor: '#153E75' },
  actionText: { color: '#153E75', fontWeight: '900' },
  primaryText: { color: '#FFFFFF' },
  coachButton: { minHeight: 50, borderRadius: 8, backgroundColor: '#153E75', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  coachText: { color: '#FFFFFF', fontWeight: '900' },
});
