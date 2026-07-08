import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Archive, Bell, CalendarClock } from 'lucide-react-native';
import AttachmentTextInput from '../components/AttachmentTextInput';
import SectionCard from '../components/SectionCard';
import { cancelContactNotification, scheduleContactNotification } from '../notifications/notificationService';
import { getPeople, updatePerson } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';
import { formatDateTime } from '../utils/date';

export default function PersonDetailScreen({ navigation, route }: ScreenProps<'PersonDetail'>) {
  const [person, setPerson] = useState<Person | null>(null);
  const [additionalMemo, setAdditionalMemo] = useState('');
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [companyDraft, setCompanyDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState('');

  const archivePerson = async () => {
    if (!person) {
      return;
    }

    await cancelContactNotification(person.notificationId);
    await updatePerson({
      ...person,
      archivedAt: new Date().toISOString(),
      notificationId: undefined,
      additionalMemo,
    });
    setArchiveConfirmOpen(false);
    navigation.goBack();
  };

  useEffect(() => {
    getPeople().then((people) => {
      const found = people.find((item) => item.id === route.params.personId) ?? null;
      setPerson(found);
      setAdditionalMemo(found?.additionalMemo ?? '');
      setCompanyDraft(found?.company ?? '');
      setRoleDraft(found?.role ?? '');
    });
  }, [route.params.personId]);

  const saveCompanyRole = async () => {
    if (!person) {
      return;
    }
    const updated = {
      ...person,
      company: companyDraft.trim() || undefined,
      role: roleDraft.trim() || undefined,
    };
    try {
      const saved = await updatePerson(updated);
      setPerson(saved);
      Alert.alert('会社・役職を保存しました');
    } catch (error) {
      Alert.alert('保存に失敗しました', error instanceof Error ? error.message : '会社・役職の保存中にエラーが発生しました。');
    }
  };

  const createReminderDate = (type: 'tomorrow' | 'threeDays' | 'week' | 'none') => {
    if (type === 'none') {
      return null;
    }

    const date = new Date();
    const days = type === 'tomorrow' ? 1 : type === 'threeDays' ? 3 : 7;
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    return date;
  };

  const saveReminder = async (type: 'tomorrow' | 'threeDays' | 'week' | 'none') => {
    if (!person) {
      return;
    }

    if (type === 'none') {
      const updated = {
        ...person,
        nextContactAt: undefined,
        additionalMemo,
      };
      await updatePerson(updated);
      setPerson(updated);
      Alert.alert('通知なしにしました', '次回連絡通知は設定されていません。');
      return;
    }

    const selectedDate = createReminderDate(type);
    if (!selectedDate) {
      return;
    }

    try {
      const notificationId = await scheduleContactNotification(person, selectedDate);
      const updated = {
        ...person,
        nextContactAt: selectedDate.toISOString(),
        notificationId,
        additionalMemo,
      };
      await updatePerson(updated);
      setPerson(updated);
      Alert.alert('通知を設定しました', formatDateTime(selectedDate.toISOString()));
    } catch (error) {
      Alert.alert('通知を設定できませんでした', error instanceof Error ? error.message : '通知設定を確認してください。');
    }
  };

  if (!person) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>人物データを読み込んでいます。</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.name}>{person.name}</Text>
        {person.company || person.role ? (
          <Text style={styles.companyLine}>{[person.company, person.role].filter(Boolean).join('・')}</Text>
        ) : null}
        <Text style={styles.industry}>{person.industry}</Text>
        <View style={styles.tags}>
          {person.categories.map((category) => (
            <Text key={category} style={styles.tag}>
              {category}
            </Text>
          ))}
        </View>
      </View>

      <SectionCard title="会社・役職">
        <Text style={styles.fieldLabel}>会社名</Text>
        <TextInput
          value={companyDraft}
          onChangeText={setCompanyDraft}
          placeholder="例：〇〇美容室"
          placeholderTextColor="#94A3B8"
          style={styles.textField}
        />
        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>役職</Text>
        <TextInput
          value={roleDraft}
          onChangeText={setRoleDraft}
          placeholder="例：代表"
          placeholderTextColor="#94A3B8"
          style={styles.textField}
        />
        <Pressable style={styles.primaryButton} onPress={saveCompanyRole}>
          <Text style={styles.primaryButtonText}>会社・役職を保存</Text>
        </Pressable>
      </SectionCard>

      <Info title="関係性" body={person.relationship} />
      <SectionCard title="可能性スコア">
        <Score label="顧客可能性" value={person.customerPotential} />
        <Score label="紹介元可能性" value={person.referrerPotential} />
        <Score label="紹介先可能性" value={person.referralTargetPotential} />
        <Score label="情報源価値" value={person.informationValue} />
        <Score label="将来候補度" value={person.futurePotential} />
      </SectionCard>
      <Info title="初回切り口" body={person.openingTalk} />
      <Info title="次に聞く質問" body={person.nextQuestion} />
      <Info title="ゴール" body={person.goal} />

      <SectionCard title="ゴールまでの道筋">
        {person.roadmap.map((step, index) => (
          <Text key={step} style={styles.step}>
            {index + 1}. {step}
          </Text>
        ))}
      </SectionCard>

      <Info title="次アクション" body={person.nextAction} />
      <Info title="LINE文" body={person.lineMessage} />
      <Info title="メール文" body={person.emailMessage} />
      <Info title="注意点" body={person.cautions} />

      <SectionCard title="次回連絡日・通知設定">
        <View style={styles.reminderBox}>
          <CalendarClock color="#153E75" size={20} />
          <View style={styles.reminderTextBox}>
            <Text style={styles.reminderLabel}>設定中の日時</Text>
            <Text style={styles.reminderValue}>{formatDateTime(person.nextContactAt)}</Text>
          </View>
        </View>

        <View style={styles.reminderButtons}>
          <ReminderButton label="明日 9:00" onPress={() => saveReminder('tomorrow')} />
          <ReminderButton label="3日後 9:00" onPress={() => saveReminder('threeDays')} />
          <ReminderButton label="1週間後 9:00" onPress={() => saveReminder('week')} />
          <ReminderButton label="通知なし" onPress={() => saveReminder('none')} muted />
        </View>
      </SectionCard>

      <SectionCard title="追加メモ">
        <AttachmentTextInput
          value={additionalMemo}
          onChangeText={setAdditionalMemo}
          placeholder="次に会った時の印象、紹介できそうな人、気づいたことなど"
          minHeight={108}
        />
        <Pressable
          style={styles.primaryButton}
          onPress={async () => {
            const updated = { ...person, additionalMemo };
            await updatePerson(updated);
            setPerson(updated);
            Alert.alert('追加メモを保存しました');
          }}
        >
          <Text style={styles.primaryButtonText}>追加メモを保存</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="アーカイブ">
        <Text style={styles.paragraph}>
          今後の営業対象から外します。過去のメモ・履歴データは削除されず、一覧・検索・相手選択には表示されなくなります。
        </Text>
        <Pressable style={styles.archiveButton} onPress={() => setArchiveConfirmOpen(true)}>
          <Archive color="#B91C1C" size={18} />
          <Text style={styles.archiveButtonText}>アーカイブする</Text>
        </Pressable>
      </SectionCard>

      <Modal
        visible={archiveConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setArchiveConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{person.name}をアーカイブしますか？</Text>
            <Text style={styles.modalBody}>
              一覧・検索・相手選択から非表示になります。過去のメモや履歴データは削除されません。設定済みの次回連絡通知は解除されます。
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setArchiveConfirmOpen(false)}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmButton} onPress={archivePerson}>
                <Text style={styles.modalConfirmText}>アーカイブする</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <SectionCard title={title}>
      <Text style={styles.paragraph}>{body}</Text>
    </SectionCard>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreBar, { width: `${value}%` }]} />
      </View>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

function ReminderButton({
  label,
  muted,
  onPress,
}: {
  label: string;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.reminderButton, muted && styles.mutedButton]} onPress={onPress}>
      {!muted && <Bell color="#FFFFFF" size={16} />}
      <Text style={[styles.reminderButtonText, muted && styles.mutedButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  muted: {
    color: '#64748B',
  },
  hero: {
    backgroundColor: '#153E75',
    borderRadius: 8,
    padding: 18,
    marginBottom: 12,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  companyLine: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
  },
  industry: {
    color: '#DBEAFE',
    fontWeight: '700',
    marginTop: 4,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  fieldLabelSpaced: {
    marginTop: 12,
  },
  textField: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tag: {
    backgroundColor: '#FFFFFF',
    color: '#153E75',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
  paragraph: {
    color: '#334155',
    lineHeight: 22,
  },
  step: {
    color: '#334155',
    lineHeight: 23,
    marginBottom: 4,
  },
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EAF2FF',
    borderRadius: 8,
    padding: 12,
  },
  reminderTextBox: {
    flex: 1,
  },
  reminderLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  reminderValue: {
    color: '#0F172A',
    fontWeight: '900',
    marginTop: 2,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#153E75',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  reminderButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  reminderButton: {
    width: '48%',
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#153E75',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  mutedButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  mutedButtonText: {
    color: '#334155',
  },
  archiveButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
  },
  archiveButtonText: {
    color: '#B91C1C',
    fontWeight: '900',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  modalBody: {
    color: '#334155',
    lineHeight: 21,
    marginTop: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  modalCancelText: {
    color: '#334155',
    fontWeight: '900',
  },
  modalConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  scoreLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900',
    width: 92,
  },
  scoreTrack: {
    flex: 1,
    height: 9,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  scoreBar: {
    height: '100%',
    backgroundColor: '#0F766E',
  },
  scoreValue: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
    width: 26,
    textAlign: 'right',
  },
});
