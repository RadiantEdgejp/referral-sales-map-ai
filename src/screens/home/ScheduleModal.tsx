import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ContactPickerModal from '../../components/ContactPickerModal';
import { createScheduledSalesFlow, type SalesFlowIds } from '../../storage/salesFlowStorage';
import type { Person } from '../../types/person';

function defaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function toDate(date: string, time: string): Date | null {
  const parsed = new Date(`${date.trim()}T${time.trim()}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function ScheduleModal({
  visible,
  people,
  onClose,
  onSaved,
}: {
  visible: boolean;
  people: Person[];
  onClose: () => void;
  onSaved: (person: Person, flow: SalesFlowIds, openPreMeeting: boolean) => void;
}) {
  const [personId, setPersonId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [title, setTitle] = useState('情報交換');
  const [eventType, setEventType] = useState('meeting');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('14:00');
  const [method, setMethod] = useState('対面');
  const [location, setLocation] = useState('');
  const [purpose, setPurpose] = useState('相手の現状と課題を確認する');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = useMemo(() => people.find((person) => person.id === personId), [people, personId]);

  const save = async (openPreMeeting: boolean) => {
    if (saving) return;
    const startAt = toDate(date, startTime);
    const endAt = toDate(date, endTime);
    if (!selected) return setError('相手を選んでください。');
    if (!startAt || !endAt) return setError('日付と時刻を YYYY-MM-DD / HH:mm 形式で入力してください。');
    if (!title.trim() || !purpose.trim()) return setError('予定名と目的を入力してください。');
    setSaving(true);
    setError('');
    try {
      const flow = await createScheduledSalesFlow({
        person: selected,
        title: title.trim(),
        eventType: eventType.trim() || 'meeting',
        startAt,
        endAt,
        purpose: purpose.trim(),
        meetingMethod: method.trim(),
        location: location.trim(),
        memo: memo.trim(),
        reminderAt: new Date(startAt.getTime() - 60 * 60 * 1000),
      });
      onSaved(selected, flow, openPreMeeting);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '予定の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.page}>
        <View style={s.header}><Text style={s.heading}>予定を追加</Text><Pressable onPress={onClose}><Text style={s.close}>閉じる</Text></Pressable></View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>相手</Text>
          <Pressable style={s.select} onPress={() => setPickerOpen(true)}><Text style={s.selectText}>{selected ? `${selected.name} / ${selected.company || selected.industry}` : '人脈カードから選ぶ'}</Text></Pressable>
          {[
            ['予定名', title, setTitle, '例: 情報交換'],
            ['予定種別', eventType, setEventType, 'meeting / call / line'],
            ['日付', date, setDate, 'YYYY-MM-DD'],
            ['開始時刻', startTime, setStartTime, 'HH:mm'],
            ['終了時刻', endTime, setEndTime, 'HH:mm'],
            ['方法', method, setMethod, '対面 / オンライン / 電話'],
            ['場所', location, setLocation, '任意'],
            ['目的', purpose, setPurpose, 'この予定で確認すること'],
          ].map(([label, value, setter, placeholder]) => (
            <View key={label as string}><Text style={s.label}>{label as string}</Text><TextInput style={s.input} value={value as string} onChangeText={setter as (text: string) => void} placeholder={placeholder as string} /></View>
          ))}
          <Text style={s.label}>メモ</Text><TextInput style={[s.input, s.memo]} value={memo} onChangeText={setMemo} multiline placeholder="当日確認したいことや相手の状況" />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable disabled={saving} style={[s.primary, saving && s.disabled]} onPress={() => save(false)}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>保存</Text>}</Pressable>
          <Pressable disabled={saving} style={s.secondary} onPress={() => save(true)}><Text style={s.secondaryText}>保存して予定前ナビへ進む</Text></Pressable>
        </ScrollView>
        <ContactPickerModal visible={pickerOpen} people={people} selectedPersonId={personId} onSelect={(person) => { setPersonId(person?.id ?? ''); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} title="予定の相手を選ぶ" />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' }, header: { alignItems: 'center', backgroundColor: '#fff', borderBottomColor: '#E2E8F0', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 16 }, heading: { color: '#0F172A', fontSize: 20, fontWeight: '900' }, close: { color: '#153E75', fontWeight: '900' }, content: { padding: 16, paddingBottom: 48 }, label: { color: '#334155', fontSize: 13, fontWeight: '900', marginBottom: 6, marginTop: 12 }, input: { backgroundColor: '#fff', borderColor: '#CBD5E1', borderRadius: 8, borderWidth: 1, color: '#0F172A', minHeight: 48, paddingHorizontal: 12 }, memo: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }, select: { backgroundColor: '#fff', borderColor: '#153E75', borderRadius: 8, borderWidth: 1, minHeight: 50, justifyContent: 'center', paddingHorizontal: 12 }, selectText: { color: '#153E75', fontWeight: '900' }, primary: { alignItems: 'center', backgroundColor: '#153E75', borderRadius: 8, justifyContent: 'center', marginTop: 24, minHeight: 52 }, primaryText: { color: '#fff', fontWeight: '900' }, secondary: { alignItems: 'center', borderColor: '#153E75', borderRadius: 8, borderWidth: 1, justifyContent: 'center', marginTop: 10, minHeight: 52 }, secondaryText: { color: '#153E75', fontWeight: '900' }, error: { color: '#B91C1C', fontWeight: '800', marginTop: 12 }, disabled: { opacity: 0.6 },
});
