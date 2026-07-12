import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bot,
  CalendarDays,
  ClipboardPenLine,
  House,
  MessageSquareText,
  Moon,
  UsersRound,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { dateValue, formatTime, getDueState, matchesIndustryFilter, sortPeople } from '../logic/personPriority';
import type { SortMode } from '../logic/personPriority';
import { getAfterMemoHandoffForEvent, getCalendarEvents, getOpenActionTasks, type PersistedActionTask } from '../storage/actionTaskStorage';
import { getPeople } from '../storage/personStorage';
import type { SalesFlowIds } from '../storage/salesFlowStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person, PersonCategory } from '../types/person';
import AfterMemoPane from './home/AfterMemoPane';
import CalendarPane from './home/CalendarPane';
import EndOfDayPane from './home/EndOfDayPane';
import HomeHeader from './home/HomeHeader';
import HomePane from './home/HomePane';
import LineCheckPane from './home/LineCheckPane';
import PeoplePane from './home/PeoplePane';
import PreMeetingPane from './home/PreMeetingPane';
import ScheduleModal from './home/ScheduleModal';
import { homeStyles as styles } from './home/homeStyles';
import type { AfterMemoHandoff, MainTab } from './home/types';

const NAV_ITEMS: Array<{ tab: MainTab; Icon: LucideIcon; label: string; hint: string }> = [
  { tab: 'home', Icon: House, label: 'ホーム', hint: 'ホーム' },
  { tab: 'people', Icon: UsersRound, label: '人脈', hint: '人脈カード' },
  { tab: 'calendar', Icon: CalendarDays, label: '予定', hint: '予定とカレンダー' },
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
  const [tasks, setTasks] = useState<PersistedActionTask[]>([]);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof getCalendarEvents>>>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [flowContext, setFlowContext] = useState<Pick<SalesFlowIds, 'salesRouteId' | 'calendarEventId'> | undefined>(undefined);

  const loadData = useCallback(async () => {
    const [stored, storedTasks, storedEvents] = await Promise.all([
      getPeople(),
      getOpenActionTasks(),
      getCalendarEvents(),
    ]);
    setPeople(stored);
    setTasks(storedTasks);
    setEvents(storedEvents);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData().catch((error) => {
        Alert.alert('営業データの読込に失敗しました', error instanceof Error ? error.message : 'もう一度お試しください。');
      });
    }, [loadData]),
  );

  const activePeople = useMemo(() => people.filter((person) => !person.archivedAt), [people]);
  const handlePersonUpdated = useCallback((updated: Person) => {
    setPeople((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const firstTaskPersonId = tasks[0]?.personId;
  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return activePeople
      .filter((person) => {
        const matchesQuery =
          !normalized ||
          [
            person.name,
            person.company ?? '',
            person.role ?? '',
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

  const openTask = async (task: PersistedActionTask) => {
    setFocusPersonId(task.personId);
    setFlowContext({
      salesRouteId: task.salesRouteId,
      calendarEventId: task.calendarEventId,
    });
    if (task.targetScreen === 'AfterMemo' || task.actionType === 'after_memo') {
      try {
        const savedNav = await getAfterMemoHandoffForEvent(task.calendarEventId);
        setAfterHandoff({
          personId: task.personId,
          questions: savedNav.questions,
          preMeetingNavRowId: savedNav.preMeetingNavRowId,
          salesRouteId: task.salesRouteId,
          calendarEventId: task.calendarEventId,
          afterMemoTaskId: task.id,
        });
        setActiveTab('after');
      } catch (error) {
        Alert.alert('後メモを開けません', error instanceof Error ? error.message : '先に予定前ナビを保存してください。');
      }
      return;
    }
    setActiveTab('pre');
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
            tasks={tasks}
            events={events}
            planUpdated={planUpdated}
            onOpenPerson={openPerson}
            onOpenTask={openTask}
            onAddSchedule={() => setScheduleOpen(true)}
            onReload={loadData}
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
        ) : activeTab === 'calendar' ? (
          <CalendarPane
            people={activePeople}
            events={events}
            tasks={tasks}
            onAdd={() => setScheduleOpen(true)}
            onOpenTask={openTask}
            onOpenPerson={openPerson}
          />
        ) : activeTab === 'pre' ? (
          <PreMeetingPane
            people={activePeople}
            initialPersonId={focusPersonId ?? firstTaskPersonId}
            salesRouteId={flowContext?.salesRouteId}
            calendarEventId={flowContext?.calendarEventId}
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
            personId={focusPersonId ?? firstTaskPersonId}
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
            personId={focusPersonId ?? firstTaskPersonId}
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
        <ScheduleModal
          visible={scheduleOpen}
          people={activePeople}
          onClose={() => setScheduleOpen(false)}
          onSaved={(person, flow, openPreMeeting) => {
            setScheduleOpen(false);
            setFocusPersonId(person.id);
            setFlowContext(flow);
            loadData().catch(() => undefined);
            Alert.alert('予定を保存しました', '予定前ナビと後メモのタスクを作成しました。');
            if (openPreMeeting) setActiveTab('pre');
          }}
        />
      </View>
    </SafeAreaView>
  );
}
