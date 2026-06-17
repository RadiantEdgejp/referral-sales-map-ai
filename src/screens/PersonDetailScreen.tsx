import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Bell, CalendarClock } from 'lucide-react-native';
import SectionCard from '../components/SectionCard';
import { scheduleContactNotification } from '../notifications/notificationService';
import { getPeople, updatePerson } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';
import { createDefaultContactDate, formatDateTime } from '../utils/date';

export default function PersonDetailScreen({ route }: ScreenProps<'PersonDetail'>) {
  const [person, setPerson] = useState<Person | null>(null);
  const [selectedDate, setSelectedDate] = useState(createDefaultContactDate());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    getPeople().then((people) => {
      const found = people.find((item) => item.id === route.params.personId) ?? null;
      setPerson(found);
      if (found?.nextContactAt) {
        setSelectedDate(new Date(found.nextContactAt));
      }
    });
  }, [route.params.personId]);

  const onDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }

    if (date) {
      setSelectedDate(date);
    }
  };

  const saveReminder = async () => {
    if (!person) {
      return;
    }

    if (selectedDate.getTime() <= Date.now()) {
      Alert.alert('未来の日時を選んでください', '通知は現在より後の日時に設定してください。');
      return;
    }

    try {
      const notificationId = await scheduleContactNotification(person, selectedDate);
      const updated = {
        ...person,
        nextContactAt: selectedDate.toISOString(),
        notificationId,
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

        <Pressable style={styles.secondaryButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.secondaryButtonText}>次回連絡日時を選ぶ</Text>
        </Pressable>

        {showPicker && (
          <DateTimePicker
            value={selectedDate}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        <Pressable style={styles.primaryButton} onPress={saveReminder}>
          <Bell color="#FFFFFF" size={19} />
          <Text style={styles.primaryButtonText}>この日時で通知を設定</Text>
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
  secondaryButton: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#153E75',
    fontWeight: '900',
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
});
