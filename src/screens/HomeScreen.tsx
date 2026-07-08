import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bot,
  ClipboardPenLine,
  Compass,
  House,
  MessageSquareText,
  Moon,
  UsersRound,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { MOCK_PEOPLE } from '../data/mockPeople';
import { dateValue, formatTime, getDueState, matchesIndustryFilter, sortPeople } from '../logic/personPriority';
import type { SortMode } from '../logic/personPriority';
import { createTodayActions } from '../logic/todayActions';
import { getPeople, savePeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person, PersonCategory } from '../types/person';
import AfterMemoPane from './home/AfterMemoPane';
import EndOfDayPane from './home/EndOfDayPane';
import HomeHeader from './home/HomeHeader';
import HomePane from './home/HomePane';
import LineCheckPane from './home/LineCheckPane';
import PeoplePane from './home/PeoplePane';
import PreMeetingPane from './home/PreMeetingPane';
import { homeStyles as styles } from './home/homeStyles';
import type { AfterMemoHandoff, MainTab } from './home/types';

const NAV_ITEMS: Array<{ tab: MainTab; Icon: LucideIcon; label: string; hint: string }> = [
  { tab: 'home', Icon: House, label: 'ホーム', hint: 'ホーム' },
  { tab: 'people', Icon: UsersRound, label: '人脈', hint: '人脈カード' },
  { tab: 'pre', Icon: Compass, label: '予定前', hint: '予定前ナビ' },
  { tab: 'after', Icon: ClipboardPenLine, label: '後メモ', hint: '後メモ' },
  { tab: 'line', Icon: MessageSquareText, label: '文確認', hint: 'LINE文チェック' },
  { tab: 'end', Icon: Moon, label: '終了後', hint: '終業後チェック' },
];

const COACH_PREFILL =
  '今日の営業で、会話後に分類・ゴール・次回連絡日を決める精度を上げたいです。どう動けばいいですか？';

export default function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'すべて' | PersonCategory>('すべて');
  const [industry, setIndustry] = useState('すべて');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [planUpdated, setPlanUpdated] = useState(false);
  const [focusPersonId, setFocusPersonId] = useState<string | undefined>(undefined);
  const [afterHandoff, setAfterHandoff] = useState<AfterMemoHandoff | undefined>(undefined);

  const loadPeople = useCallback(async () => {
    const stored = await getPeople();
    const missingMocks = MOCK_PEOPLE.filter(
      (mockPerson) => !stored.some((person) => person.id === mockPerson.id),
    );

    if (missingMocks.length > 0) {
      const merged = [...missingMocks, ...stored];
      await savePeople(merged);
      setPeople(merged);
      return;
    }

    setPeople(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPeople();
    }, [loadPeople]),
  );

  const activePeople = useMemo(() => people.filter((person) => !person.archivedAt), [people]);
  const handlePersonUpdated = useCallback((updated: Person) => {
    setPeople((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const actions = useMemo(() => createTodayActions(activePeople), [activePeople]);
  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return activePeople
      .filter((person) => {
        const matchesQuery =
          !normalized ||
          [
            person.name,
            person.industry,
            person.categories.join(' '),
            person.rawMemo,
            person.nextAction,
            person.cautions,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalized);
        const matchesCategory = category === 'すべて' || person.categories.includes(category);
        const matchesIndustry = industry === 'すべて' || matchesIndustryFilter(person, industry);

        return matchesQuery && matchesCategory && matchesIndustry;
      })
      .sort((a, b) => sortPeople(a, b, sortMode));
  }, [activePeople, category, industry, query, sortMode]);

  const openPerson = (personId?: string) => {
    if (personId) {
      navigation.navigate('PersonDetail', { personId });
    }
  };

  const goToTab = (tab: MainTab, personId?: string) => {
    if (personId) {
      setFocusPersonId(personId);
    }
    setActiveTab(tab);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <HomeHeader
          activeTab={activeTab}
          planUpdated={planUpdated}
          onNotice={() => {
            const dueToday = activePeople
              .filter((person) => getDueState(person) === 'today')
              .sort((a, b) => dateValue(a.nextContactAt) - dateValue(b.nextContactAt));
            Alert.alert(
              '今日の通知',
              dueToday.length > 0
                ? dueToday.map((person) => `${formatTime(person.nextContactAt)} ${person.name}：${person.nextAction || person.goal}`).join('\n')
                : '今日の通知はありません。',
            );
          }}
          onRefresh={() => {
            setPlanUpdated(true);
            Alert.alert('今日の計画を更新しました', '人脈カードの最新データから営業地図を再生成しました。');
          }}
          onAdd={() => navigation.navigate('AddPerson')}
        />

        {activeTab === 'home' ? (
          <HomePane
            people={activePeople}
            actions={actions}
            planUpdated={planUpdated}
            onOpenPerson={openPerson}
            onPersonUpdated={handlePersonUpdated}
          />
        ) : activeTab === 'people' ? (
          <PeoplePane
            people={filteredPeople}
            query={query}
            category={category}
            industry={industry}
            sortMode={sortMode}
            onChangeQuery={setQuery}
            onChangeCategory={setCategory}
            onChangeIndustry={setIndustry}
            onChangeSort={setSortMode}
            onOpenPerson={(person) => openPerson(person.id)}
            onAddPerson={() => navigation.navigate('AddPerson')}
            onLineCheck={(person) => goToTab('line', person.id)}
            onPersonUpdated={handlePersonUpdated}
          />
        ) : activeTab === 'pre' ? (
          <PreMeetingPane
            people={activePeople}
            initialPersonId={focusPersonId ?? actions[0]?.personId}
            onAfter={(personId, handoff) => {
              setAfterHandoff(handoff);
              goToTab('after', personId);
            }}
            onLine={(personId) => goToTab('line', personId)}
            onPersonUpdated={handlePersonUpdated}
            onAddPerson={() => navigation.navigate('AddPerson')}
            onOpenPerson={openPerson}
            onOpenCoach={(initialPrompt) => navigation.navigate('CoachChat', { initialPrompt })}
          />
        ) : activeTab === 'after' ? (
          <AfterMemoPane
            people={activePeople}
            personId={focusPersonId ?? actions[0]?.personId}
            handoff={afterHandoff}
            onPersonUpdated={handlePersonUpdated}
            onLine={(personId) => goToTab('line', personId)}
            onEnd={() => setActiveTab('end')}
            onOpenPerson={openPerson}
            onCoach={(initialPrompt) => navigation.navigate('CoachChat', { initialPrompt })}
          />
        ) : activeTab === 'line' ? (
          <LineCheckPane
            people={activePeople}
            personId={focusPersonId ?? actions[0]?.personId}
            onPersonUpdated={handlePersonUpdated}
            onAfter={(personId) => goToTab('after', personId)}
            onOpenPerson={openPerson}
            onCoach={(initialPrompt) => navigation.navigate('CoachChat', { initialPrompt })}
          />
        ) : (
          <EndOfDayPane
            people={activePeople}
            onPersonUpdated={handlePersonUpdated}
            onAfter={() => setActiveTab('after')}
            onHome={() => setActiveTab('home')}
            onCoach={(initialPrompt) => navigation.navigate('CoachChat', { initialPrompt })}
          />
        )}

        <View style={styles.bottomNav}>
          {NAV_ITEMS.map((item) => (
            <Pressable key={item.tab} accessibilityLabel={item.hint} style={styles.navItem} onPress={() => setActiveTab(item.tab)}>
              <View style={[styles.navIconButton, activeTab === item.tab && styles.navIconButtonActive]}>
                <item.Icon color={activeTab === item.tab ? '#0F172A' : '#94A3B8'} size={22} strokeWidth={activeTab === item.tab ? 2.5 : 2} />
              </View>
              <Text style={[styles.navLabel, activeTab === item.tab && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab !== 'pre' && activeTab !== 'after' && activeTab !== 'line' ? (
          <View style={styles.floatingActions}>
            <Pressable
              style={[styles.floatingButton, styles.coachButton]}
              onPress={() => navigation.navigate('CoachChat', { initialPrompt: COACH_PREFILL })}
            >
              <Bot color="#153E75" size={20} />
              <Text style={styles.coachButtonText}>営業コーチ</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
