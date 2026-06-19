import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, CalendarClock } from 'lucide-react-native';
import AttachmentTextInput from '../components/AttachmentTextInput';
import SectionCard from '../components/SectionCard';
import { scheduleContactNotification } from '../notifications/notificationService';
import { getPeople, updatePerson } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';
import { formatDateTime } from '../utils/date';

export default function PersonDetailScreen({ route }: ScreenProps<'PersonDetail'>) {
  const [person, setPerson] = useState<Person | null>(null);
  const [additionalMemo, setAdditionalMemo] = useState('');

  useEffect(() => {
    getPeople().then((people) => {
      const found = people.find((item) => item.id === route.params.personId) ?? null;
      setPerson(found);
      setAdditionalMemo(found?.additionalMemo ?? '');
    });
  }, [route.params.personId]);

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
        <Text style={styles.industry}>{person.industry}</Text>
        <View style={styles.tags}>
          {person.categories.map((category) => (
            <Text key={category} style={styles.tag}>
              {category}
            </Text>
          ))}
        </View>
      </View>

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
  industry: {
    color: '#DBEAFE',
    fontWeight: '700',
    marginTop: 4,
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
