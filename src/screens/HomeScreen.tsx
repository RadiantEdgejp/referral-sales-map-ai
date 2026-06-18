import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, Bot, CalendarClock, Plus, RefreshCw, Search, UserPlus, X } from 'lucide-react-native';
import FilterChip from '../components/FilterChip';
import PersonCard from '../components/PersonCard';
import { MOCK_PEOPLE } from '../data/mockPeople';
import { getPeople, savePeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person, PersonCategory } from '../types/person';

type MainTab = 'home' | 'people';
type SortMode = 'priority' | 'nextContact' | 'newest' | 'referrer';
type ModalState =
  | { type: 'none' }
  | { type: 'action'; item: TodayAction }
  | { type: 'schedule'; item: ScheduleItem }
  | { type: 'route'; item: RouteItem }
  | { type: 'meeting'; item: MeetingCheck }
  | { type: 'postMeeting' }
  | { type: 'notifications' }
  | { type: 'addAction' };

type TodayAction = {
  id: string;
  priority: string;
  personName: string;
  personId: string;
  actionType: string;
  shortReason: string;
  todayTodo: string;
  purpose: string;
  whyToday: string;
  evidence: string;
  question: string;
  message: string;
};

type ScheduleItem = {
  id: string;
  time: string;
  personName: string;
  personId: string;
  title: string;
  purpose: string;
  kind: 'line' | 'meeting';
};

type RouteItem = {
  id: string;
  personName: string;
  personId: string;
  theme: string;
  routeType: string;
  current: string;
  todayStep: string;
  goal: string;
  nextMove: string;
};

type MeetingCheck = {
  personName: string;
  personId: string;
  time: string;
  purpose: string;
  question: string;
  caution: string;
};

const CATEGORIES: Array<'すべて' | PersonCategory> = [
  'すべて',
  '顧客候補',
  '紹介元候補',
  '紹介先候補',
  '情報源候補',
  '将来候補',
];

const INDUSTRIES = ['すべて', '美容', '不動産', '保険', '飲食', '士業', '経営者', '採用', 'その他'];

const SORTS: Array<{ label: string; value: SortMode }> = [
  { label: '優先順', value: 'priority' },
  { label: '次回連絡日が近い順', value: 'nextContact' },
  { label: '新しく追加した順', value: 'newest' },
  { label: '紹介元可能性が高い順', value: 'referrer' },
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
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [planUpdated, setPlanUpdated] = useState(false);

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

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return people
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
  }, [category, industry, people, query, sortMode]);

  const actions = useMemo(() => createTodayActions(people), [people]);
  const schedules = useMemo(() => createScheduleItems(people), [people]);
  const routes = useMemo(() => createRouteItems(people), [people]);
  const meeting = useMemo(() => createMeetingCheck(people), [people]);

  const openPerson = (personId?: string) => {
    if (personId) {
      navigation.navigate('PersonDetail', { personId });
    }
  };

  const complete = () => {
    Alert.alert('完了にしました', '今日の行動から完了扱いにする想定のUIです。');
    setModal({ type: 'none' });
  };

  const postpone = () => {
    Alert.alert('延期しました', '明日以降の営業計画へ回す想定のUIです。');
    setModal({ type: 'none' });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.screenName}>ホーム</Text>
            <Text style={styles.appName}>今日の営業地図</Text>
            <Text style={styles.dateText}>6月19日</Text>
            <Text style={styles.subcopy}>営業開始前に、今日の方向性を確認する</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={() => setModal({ type: 'notifications' })}>
              <Bell color="#153E75" size={20} />
            </Pressable>
            <Pressable
              style={styles.iconButton}
              onPress={() => {
                setPlanUpdated(true);
                Alert.alert('今日の計画を更新しました', 'モックの行動リストを再生成しました。');
              }}
            >
              <RefreshCw color="#153E75" size={20} />
            </Pressable>
            <Pressable style={styles.iconButtonDark} onPress={() => setModal({ type: 'addAction' })}>
              <UserPlus color="#FFFFFF" size={20} />
            </Pressable>
          </View>
        </View>

        <View style={styles.tabBar}>
          <TabButton label="ホーム" selected={activeTab === 'home'} onPress={() => setActiveTab('home')} />
          <TabButton label="人脈カード" selected={activeTab === 'people'} onPress={() => setActiveTab('people')} />
        </View>

        {activeTab === 'home' ? (
          <HomePane
            actions={actions}
            schedules={schedules}
            routes={routes}
            meeting={meeting}
            planUpdated={planUpdated}
            onOpenModal={setModal}
            onOpenPeople={() => setActiveTab('people')}
            onOpenPreMeeting={() => navigation.navigate('PreMeetingNav', { personId: actions[0]?.personId, purpose: '初回接触' })}
            onOpenAfterMemo={() => navigation.navigate('AfterMemo', { personId: actions[0]?.personId })}
            onOpenLineCheck={() => navigation.navigate('LineCheck', { personId: actions[0]?.personId })}
            onOpenEndOfDay={() => navigation.navigate('EndOfDayCheck')}
            onOpenCoach={() => navigation.navigate('CoachChat', { initialPrompt: COACH_PREFILL })}
          />
        ) : (
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
          />
        )}

        <View style={styles.floatingActions}>
          <Pressable
            style={[styles.floatingButton, styles.coachButton]}
            onPress={() => navigation.navigate('CoachChat', { initialPrompt: COACH_PREFILL })}
          >
            <Bot color="#153E75" size={20} />
            <Text style={styles.coachButtonText}>営業コーチ</Text>
          </Pressable>
          <Pressable style={[styles.floatingButton, styles.addButton]} onPress={() => setModal({ type: 'addAction' })}>
            <Plus color="#FFFFFF" size={20} />
            <Text style={styles.addButtonText}>今日やることを追加</Text>
          </Pressable>
        </View>

        <HomeModal
          modal={modal}
          schedules={schedules}
          onClose={() => setModal({ type: 'none' })}
          onComplete={complete}
          onPostpone={postpone}
          onOpenPerson={openPerson}
          onOpenCoach={() => navigation.navigate('CoachChat', { initialPrompt: COACH_PREFILL })}
        />
      </View>
    </SafeAreaView>
  );
}

function HomePane({
  actions,
  schedules,
  routes,
  meeting,
  planUpdated,
  onOpenModal,
  onOpenPeople,
  onOpenPreMeeting,
  onOpenAfterMemo,
  onOpenLineCheck,
  onOpenEndOfDay,
  onOpenCoach,
}: {
  actions: TodayAction[];
  schedules: ScheduleItem[];
  routes: RouteItem[];
  meeting: MeetingCheck;
  planUpdated: boolean;
  onOpenModal: (modal: ModalState) => void;
  onOpenPeople: () => void;
  onOpenPreMeeting: () => void;
  onOpenAfterMemo: () => void;
  onOpenLineCheck: () => void;
  onOpenEndOfDay: () => void;
  onOpenCoach: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <Section title="今日の営業テーマ">
        <InfoBlock label="テーマ" value="紹介直後の人を放置せず、初回接触を完了する" compact />
        <InfoBlock label="今日の狙い" value="売り込みではなく、課題確認と関係構築を優先する" compact />
        <InfoBlock label="今日の注意" value="紹介依頼を急がない。まず情報交換を挟む" compact />
        <InfoBlock
          label="根拠"
          value="紹介直後は相手の記憶と紹介者の信頼が残るため、初回接触が遅いほど反応率が下がりやすい"
          compact
        />
        {planUpdated ? <Text style={styles.updatedNotice}>今日の計画を更新済み</Text> : null}
      </Section>

      <Section title="営業データを育てる今日のループ" subtitle="予定前に質問を決め、会話後に回答を入れ、LINEと終業後チェックで人脈カードへ戻します。">
        <LoopStep index="1" title="予定前ナビ" body="人脈カード・過去メモ・追加メモから、今日聞く質問を決める" onPress={onOpenPreMeeting} />
        <LoopStep index="2" title="後メモ" body="予定前ナビで決めた質問の回答を入れ、人脈カード更新案を作る" onPress={onOpenAfterMemo} />
        <LoopStep index="3" title="LINEチェック" body="LINEの送受信から温度感・課題・次アクションを吸収する" onPress={onOpenLineCheck} />
        <LoopStep index="4" title="終業後チェック" body="未入力・更新漏れを確認し、翌日のホームへ反映する" onPress={onOpenEndOfDay} />
      </Section>

      <Section title="今日の優先行動" subtitle="短い行カードで、誰に・なぜ・何をするかだけ確認します。">
        {actions.map((item) => (
          <PriorityRow
            key={item.id}
            item={item}
            onPress={() => onOpenModal({ type: 'action', item })}
            onComplete={() => Alert.alert('完了にしました', `${item.personName}の行動を完了扱いにしました。`)}
            onPostpone={() => Alert.alert('延期しました', `${item.personName}の行動を延期しました。`)}
          />
        ))}
      </Section>

      <Section title="今日の予定と通知" subtitle="今日通知が来る営業アクションだけを時系列で確認します。">
        {schedules.map((item) => (
          <ScheduleRow key={item.id} item={item} onPress={() => onOpenModal({ type: 'schedule', item })} />
        ))}
      </Section>

      <Section title="今日進める営業ルート">
        {routes.map((item) => (
          <RouteRow key={item.id} item={item} onPress={() => onOpenModal({ type: 'route', item })} />
        ))}
      </Section>

      <Section title="会う前チェック">
        <Pressable style={styles.prepCard} onPress={() => onOpenModal({ type: 'meeting', item: meeting })}>
          <Text style={styles.rowName}>{meeting.personName}</Text>
          <Text style={styles.rowMeta}>{meeting.time} 情報交換</Text>
          <InfoBlock label="目的" value={meeting.purpose} compact />
          <InfoBlock label="最初の質問" value={meeting.question} compact />
          <InfoBlock label="注意" value={meeting.caution} compact />
          <Text style={styles.linkText}>商談前ナビを開く</Text>
        </Pressable>
      </Section>

      <Section title="会った後に処理するもの">
        <Text style={styles.bodyText}>今日、記録が必要になる予定：</Text>
        <PostMeetingLine title="佐藤さん" body="13:00の情報交換後にメモ入力" />
        <PostMeetingLine title="山本さん" body="返信が来たら分類と次回連絡日を更新" />
        <Pressable style={styles.secondaryCta} onPress={() => onOpenModal({ type: 'postMeeting' })}>
          <Text style={styles.secondaryCtaText}>商談後メモを開く</Text>
        </Pressable>
      </Section>

      <Section title="今日の営業コーチ指摘">
        <InfoBlock
          label="今週の傾向"
          value="初回接触はできていますが、会話後に次アクションを決める数が少ないです。"
        />
        <InfoBlock
          label="今日の改善"
          value="会話した人は必ず「分類・ゴール・次回連絡日」を決めて終える。"
        />
        <InfoBlock
          label="根拠"
          value="会話直後に記録しないと、相手の課題・温度感・紹介可能性の情報が落ちやすい。記憶が新しいうちに次アクションを固定することで、追客漏れを減らせる。"
        />
        <Pressable style={styles.primaryCta} onPress={onOpenCoach}>
          <Bot color="#FFFFFF" size={18} />
          <Text style={styles.primaryCtaText}>営業コーチに相談する</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function PeoplePane({
  people,
  query,
  category,
  industry,
  sortMode,
  onChangeQuery,
  onChangeCategory,
  onChangeIndustry,
  onChangeSort,
  onOpenPerson,
  onAddPerson,
}: {
  people: Person[];
  query: string;
  category: 'すべて' | PersonCategory;
  industry: string;
  sortMode: SortMode;
  onChangeQuery: (value: string) => void;
  onChangeCategory: (value: 'すべて' | PersonCategory) => void;
  onChangeIndustry: (value: string) => void;
  onChangeSort: (value: SortMode) => void;
  onOpenPerson: (person: Person) => void;
  onAddPerson: () => void;
}) {
  return (
    <FlatList
      data={people}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PersonCard person={item} onPress={() => onOpenPerson(item)} />}
      ListHeaderComponent={
        <>
          <View style={styles.searchBox}>
            <Search color="#64748B" size={20} />
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="名前・業種・メモで検索"
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
          </View>

          <Text style={styles.filterTitle}>分類</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {CATEGORIES.map((item) => (
              <FilterChip key={item} label={item} selected={category === item} onPress={() => onChangeCategory(item)} />
            ))}
          </ScrollView>

          <Text style={styles.filterTitle}>業種</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {INDUSTRIES.map((item) => (
              <FilterChip key={item} label={item} selected={industry === item} onPress={() => onChangeIndustry(item)} />
            ))}
          </ScrollView>

          <Text style={styles.filterTitle}>並び替え</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {SORTS.map((item) => (
              <FilterChip
                key={item.value}
                label={item.label}
                selected={sortMode === item.value}
                onPress={() => onChangeSort(item.value)}
              />
            ))}
          </ScrollView>

          <View style={styles.summary}>
            <Text style={styles.summaryText}>人脈カード {people.length}件</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>まだ人脈カードがありません。</Text>
          <Text style={styles.emptyText}>最近会った人を1人だけ、雑に入力してみましょう。</Text>
          <Pressable style={styles.emptyButton} onPress={onAddPerson}>
            <Text style={styles.emptyButtonText}>人物を追加する</Text>
          </Pressable>
        </View>
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function HomeModal({
  modal,
  schedules,
  onClose,
  onComplete,
  onPostpone,
  onOpenPerson,
  onOpenCoach,
}: {
  modal: ModalState;
  schedules: ScheduleItem[];
  onClose: () => void;
  onComplete: () => void;
  onPostpone: () => void;
  onOpenPerson: (personId?: string) => void;
  onOpenCoach: () => void;
}) {
  const visible = modal.type !== 'none';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{getModalTitle(modal)}</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X color="#0F172A" size={20} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {modal.type === 'action' ? (
              <ActionDetail item={modal.item} onComplete={onComplete} onPostpone={onPostpone} onOpenPerson={onOpenPerson} onOpenCoach={onOpenCoach} />
            ) : null}
            {modal.type === 'schedule' ? (
              <ScheduleDetail item={modal.item} onOpenPerson={onOpenPerson} onClose={onClose} />
            ) : null}
            {modal.type === 'route' ? (
              <RouteDetail item={modal.item} onOpenPerson={onOpenPerson} onOpenCoach={onOpenCoach} onClose={onClose} />
            ) : null}
            {modal.type === 'meeting' ? <MeetingDetail item={modal.item} onClose={onClose} /> : null}
            {modal.type === 'postMeeting' ? <PostMeetingDetail onClose={onClose} /> : null}
            {modal.type === 'notifications' ? (
              <NotificationDetail schedules={schedules} onSelect={(item) => Alert.alert(item.title, item.purpose)} />
            ) : null}
            {modal.type === 'addAction' ? <AddActionDetail onClose={onClose} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ActionDetail({
  item,
  onComplete,
  onPostpone,
  onOpenPerson,
  onOpenCoach,
}: {
  item: TodayAction;
  onComplete: () => void;
  onPostpone: () => void;
  onOpenPerson: (personId?: string) => void;
  onOpenCoach: () => void;
}) {
  return (
    <>
      <InfoBlock label="今日の目的" value={item.purpose} />
      <InfoBlock label="なぜ今日やるのか" value={item.whyToday} />
      <InfoBlock label="科学的根拠" value={item.evidence} />
      <InfoBlock label="聞く質問" value={item.question} />
      <InfoBlock label="送る文" value={item.message} />
      <View style={styles.modalButtonGrid}>
        <ModalButton label="完了" primary onPress={onComplete} />
        <ModalButton label="延期" onPress={onPostpone} />
        <ModalButton label="人物詳細を見る" onPress={() => onOpenPerson(item.personId)} />
        <ModalButton label="営業コーチに相談" onPress={onOpenCoach} />
      </View>
    </>
  );
}

function ScheduleDetail({
  item,
  onOpenPerson,
  onClose,
}: {
  item: ScheduleItem;
  onOpenPerson: (personId?: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <InfoBlock label="時間" value={item.time} />
      <InfoBlock label="人物" value={item.personName} />
      <InfoBlock label="目的" value={item.purpose} />
      <View style={styles.modalButtonGrid}>
        <ModalButton label={item.kind === 'meeting' ? '商談前ナビを開く' : '送る文を見る'} primary onPress={() => Alert.alert(item.title, item.purpose)} />
        <ModalButton label="人物詳細を見る" onPress={() => onOpenPerson(item.personId)} />
        <ModalButton label="閉じる" onPress={onClose} />
      </View>
    </>
  );
}

function RouteDetail({
  item,
  onOpenPerson,
  onOpenCoach,
  onClose,
}: {
  item: RouteItem;
  onOpenPerson: (personId?: string) => void;
  onOpenCoach: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <InfoBlock label="このルートのゴール" value={item.goal} />
      <InfoBlock label="現在地" value={item.current} />
      <InfoBlock label="今日進める段階" value={item.todayStep} />
      <InfoBlock label="次の一手" value={item.nextMove} />
      <View style={styles.modalButtonGrid}>
        <ModalButton label="関連人物を見る" primary onPress={() => onOpenPerson(item.personId)} />
        <ModalButton label="商談前ナビを開く" onPress={onClose} />
        <ModalButton label="営業コーチに相談" onPress={onOpenCoach} />
      </View>
    </>
  );
}

function MeetingDetail({ item, onClose }: { item: MeetingCheck; onClose: () => void }) {
  return (
    <>
      <InfoBlock label="目的" value={item.purpose} />
      <InfoBlock label="最初の質問" value={item.question} />
      <InfoBlock label="注意" value={item.caution} />
      <ModalButton label="商談前ナビを開く" primary onPress={onClose} />
    </>
  );
}

function PostMeetingDetail({ onClose }: { onClose: () => void }) {
  return (
    <>
      <InfoBlock label="話した内容" value="今日の商談後に入力" />
      <InfoBlock label="相手の課題" value="採用・集客・資産形成などを記録" />
      <InfoBlock label="分類" value="顧客候補 / 紹介元候補 / 情報源候補を更新" />
      <InfoBlock label="ゴール" value="次回連絡、紹介依頼、情報交換などを固定" />
      <InfoBlock label="次アクション" value="次に何を送るか、何を聞くかを決める" />
      <InfoBlock label="次回連絡日" value="通知対象にする日時を設定" />
      <InfoBlock label="注意点" value="売り込み感、紹介依頼の早さ、相手の温度感を記録" />
      <ModalButton label="メモ入力を開始" primary onPress={onClose} />
    </>
  );
}

function NotificationDetail({ schedules, onSelect }: { schedules: ScheduleItem[]; onSelect: (item: ScheduleItem) => void }) {
  return (
    <>
      {schedules.map((item) => (
        <Pressable key={item.id} style={styles.notificationRow} onPress={() => onSelect(item)}>
          <Text style={styles.notificationTime}>{item.time}</Text>
          <View style={styles.notificationBody}>
            <Text style={styles.rowName}>{item.title}</Text>
            <Text style={styles.rowMeta}>目的：{item.purpose}</Text>
          </View>
        </Pressable>
      ))}
    </>
  );
}

function AddActionDetail({ onClose }: { onClose: () => void }) {
  return (
    <>
      <InfoBlock label="追加する想定" value="今日だけ実行する営業行動を追加します。" />
      <InfoBlock label="例" value="紹介直後の人に初回LINE / 商談前の質問確認 / 会話後メモ入力" />
      <ModalButton label="今日やることを追加" primary onPress={onClose} />
    </>
  );
}

function PriorityRow({
  item,
  onPress,
  onComplete,
  onPostpone,
}: {
  item: TodayAction;
  onPress: () => void;
  onComplete: () => void;
  onPostpone: () => void;
}) {
  return (
    <Pressable style={styles.priorityRow} onPress={onPress}>
      <View style={styles.priorityHeader}>
        <Text style={styles.priorityBadge}>{item.priority}</Text>
        <Text style={styles.rowName}>{item.personName}</Text>
        <Text style={styles.actionType}>{item.actionType}</Text>
      </View>
      <Text style={styles.shortReason}>{item.shortReason}</Text>
      <Text style={styles.todoLine}>今日やること：{item.todayTodo}</Text>
      <View style={styles.rowButtons}>
        <RowButton label="詳細" onPress={onPress} />
        <RowButton label="完了" onPress={onComplete} />
        <RowButton label="延期" onPress={onPostpone} />
      </View>
    </Pressable>
  );
}

function ScheduleRow({ item, onPress }: { item: ScheduleItem; onPress: () => void }) {
  return (
    <Pressable style={styles.scheduleRow} onPress={onPress}>
      <Text style={styles.scheduleTime}>{item.time}</Text>
      <View style={styles.scheduleBody}>
        <Text style={styles.rowName}>{item.title}</Text>
        <Text style={styles.rowMeta}>目的：{item.purpose}</Text>
      </View>
    </Pressable>
  );
}

function RouteRow({ item, onPress }: { item: RouteItem; onPress: () => void }) {
  return (
    <Pressable style={styles.routeRow} onPress={onPress}>
      <Text style={styles.rowName}>
        {item.personName} → {item.theme}
      </Text>
      <Text style={styles.rowMeta}>ルート種別：{item.routeType}</Text>
      <Text style={styles.rowMeta}>現在地：{item.current}</Text>
      <Text style={styles.todoLine}>今日進めること：{item.todayStep}</Text>
    </Pressable>
  );
}

function LoopStep({
  index,
  title,
  body,
  onPress,
}: {
  index: string;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.loopStep} onPress={onPress}>
      <Text style={styles.loopIndex}>{index}</Text>
      <View style={styles.loopBody}>
        <Text style={styles.rowName}>{title}</Text>
        <Text style={styles.rowMeta}>{body}</Text>
      </View>
    </Pressable>
  );
}

function PostMeetingLine({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.postLine}>
      <Text style={styles.rowName}>{title}</Text>
      <Text style={styles.rowMeta}>{body}</Text>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoBlock({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <View style={[styles.infoBlock, compact && styles.infoBlockCompact]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function RowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.rowButton} onPress={onPress}>
      <Text style={styles.rowButtonText}>{label}</Text>
    </Pressable>
  );
}

function ModalButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.modalButton, primary && styles.modalButtonPrimary]} onPress={onPress}>
      <Text style={[styles.modalButtonText, primary && styles.modalButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function TabButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, selected && styles.tabButtonSelected]} onPress={onPress}>
      <Text style={[styles.tabButtonText, selected && styles.tabButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function getModalTitle(modal: ModalState) {
  if (modal.type === 'action') return '今日の行動詳細';
  if (modal.type === 'schedule') return '予定と通知の詳細';
  if (modal.type === 'route') return '営業ルート詳細';
  if (modal.type === 'meeting') return '商談前ナビ';
  if (modal.type === 'postMeeting') return '商談後メモ';
  if (modal.type === 'notifications') return '今日の通知';
  if (modal.type === 'addAction') return '今日やることを追加';
  return '';
}

function createTodayActions(people: Person[]): TodayAction[] {
  const yamamoto = findPerson(people, '山本', 'mock-yamamoto');
  const tanaka = findPerson(people, '田中', 'mock-tanaka');
  const sato = findPerson(people, '佐藤', 'mock-sato');

  return [
    {
      id: 'action-yamamoto',
      priority: '最優先',
      personName: yamamoto?.name ?? '山本さん',
      personId: yamamoto?.id ?? 'mock-yamamoto',
      actionType: '初回連絡',
      shortReason: '紹介直後。温度感が落ちる前に連絡する',
      todayTodo: '整体院の経営課題を聞く',
      purpose: '紹介直後の初回接触を完了し、本人の店舗課題を確認する',
      whyToday: '紹介者の信頼と相手の記憶が残っているうちに接触するため',
      evidence: '紹介直後は記憶の鮮度が高く、接触が遅れるほど反応率と信頼の受け渡し効果が落ちやすい',
      question: '整体院の経営で、最近いちばん負担に感じる固定費は何ですか？',
      message: '山本さん、先日はご紹介でありがとうございました。整体院経営で最近負担に感じることを少し教えていただけませんか？',
    },
    {
      id: 'action-tanaka',
      priority: '重要',
      personName: tanaka?.name ?? '田中さん',
      personId: tanaka?.id ?? 'mock-tanaka',
      actionType: '情報交換',
      shortReason: '美容業界の紹介元候補。紹介依頼前に課題を聞く',
      todayTodo: '採用・集客の悩みを聞く',
      purpose: '美容業界の経営者人脈を確認し、紹介元化の入口を作る',
      whyToday: '前回接触から3日。関係が冷める前に軽く接触するため',
      evidence: '短い間隔で価値ある質問を挟むと、売り込み感を下げながら関係記憶を維持しやすい',
      question: '美容系の経営者さんって、最近は集客より採用の方が大変だったりしますか？',
      message: '田中さん、先日はありがとうございました。美容業界の採用や集客の悩みについて少し教えていただけませんか？',
    },
    {
      id: 'action-sato',
      priority: '予定あり',
      personName: sato?.name ?? '佐藤さん',
      personId: sato?.id ?? 'mock-sato',
      actionType: '会う前準備',
      shortReason: '今日13時に情報交換予定',
      todayTodo: '不動産顧客層の動きを聞く準備',
      purpose: '不動産顧客層の動きを聞き、情報源化ルートを進める',
      whyToday: '面談前に質問を固定しておくと、会話が雑談で終わりにくい',
      evidence: '事前に質問を明確化すると、認知負荷が下がり、会話中に目的から逸れにくい',
      question: '最近、不動産を検討する方って、投資目的と自宅目的だとどちらが多いですか？',
      message: '佐藤さん、本日13時よろしくお願いします。不動産まわりの最近の動きも少し伺えたら嬉しいです。',
    },
  ];
}

function createScheduleItems(people: Person[]): ScheduleItem[] {
  const yamamoto = findPerson(people, '山本', 'mock-yamamoto');
  const sato = findPerson(people, '佐藤', 'mock-sato');
  const tanaka = findPerson(people, '田中', 'mock-tanaka');

  return [
    {
      id: 'schedule-yamamoto',
      time: '10:00',
      personName: yamamoto?.name ?? '山本さん',
      personId: yamamoto?.id ?? 'mock-yamamoto',
      title: '山本さんに初回LINE',
      purpose: '紹介直後の初回接触',
      kind: 'line',
    },
    {
      id: 'schedule-sato',
      time: '13:00',
      personName: sato?.name ?? '佐藤さん',
      personId: sato?.id ?? 'mock-sato',
      title: '佐藤さんと情報交換',
      purpose: '不動産顧客層の情報取得',
      kind: 'meeting',
    },
    {
      id: 'schedule-tanaka',
      time: '18:00',
      personName: tanaka?.name ?? '田中さん',
      personId: tanaka?.id ?? 'mock-tanaka',
      title: '田中さんに近況LINE',
      purpose: '美容業界の課題確認',
      kind: 'line',
    },
  ];
}

function createRouteItems(people: Person[]): RouteItem[] {
  const yamamoto = findPerson(people, '山本', 'mock-yamamoto');
  const tanaka = findPerson(people, '田中', 'mock-tanaka');
  const sato = findPerson(people, '佐藤', 'mock-sato');

  return [
    {
      id: 'route-yamamoto',
      personName: yamamoto?.name ?? '山本さん',
      personId: yamamoto?.id ?? 'mock-yamamoto',
      theme: '本人の店舗課題確認',
      routeType: '顧客化ルート',
      current: '紹介直後',
      todayStep: '初回接触',
      goal: '本人の経営課題を確認し、将来の相談余地を作る',
      nextMove: '返信後に分類と次回連絡日を更新する',
    },
    {
      id: 'route-tanaka',
      personName: tanaka?.name ?? '田中さん',
      personId: tanaka?.id ?? 'mock-tanaka',
      theme: '美容業界の経営者人脈',
      routeType: '紹介元化ルート',
      current: '情報交換前',
      todayStep: '採用・集客課題を聞く',
      goal: '美容業界の紹介元候補として関係を温める',
      nextMove: '役立つ情報を渡して2回目以降に紹介依頼を検討する',
    },
    {
      id: 'route-sato',
      personName: sato?.name ?? '佐藤さん',
      personId: sato?.id ?? 'mock-sato',
      theme: '資産形成層の情報',
      routeType: '情報源化ルート',
      current: '質問準備',
      todayStep: '不動産顧客層の動きを聞く',
      goal: '資産形成層の動きについて情報源として関係を作る',
      nextMove: '聞いた情報をメモ化し、紹介先候補の判断材料にする',
    },
  ];
}

function createMeetingCheck(people: Person[]): MeetingCheck {
  const sato = findPerson(people, '佐藤', 'mock-sato');

  return {
    personName: sato?.name ?? '佐藤さん',
    personId: sato?.id ?? 'mock-sato',
    time: '13:00',
    purpose: '不動産顧客層の動きを聞く',
    question: '最近、不動産を検討する方って、投資目的と自宅目的だとどちらが多いですか？',
    caution: '一方的に聞くだけで終わらない。情報交換の形にする。',
  };
}

function findPerson(people: Person[], keyword: string, fallbackId: string) {
  return people.find((person) => person.name.includes(keyword)) ?? people.find((person) => person.id === fallbackId);
}

function matchesIndustryFilter(person: Person, filter: string) {
  if (filter === '経営者') {
    return person.industry.includes('経営');
  }
  if (filter === '採用') {
    return person.rawMemo.includes('採用') || person.nextAction.includes('採用') || person.openingTalk.includes('採用');
  }
  if (filter === 'その他') {
    return true;
  }
  return person.industry.includes(filter) || person.rawMemo.includes(filter);
}

function sortPeople(a: Person, b: Person, sortMode: SortMode) {
  if (sortMode === 'nextContact') {
    return dateValue(a.nextContactAt) - dateValue(b.nextContactAt);
  }
  if (sortMode === 'newest') {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  if (sortMode === 'referrer') {
    return b.referrerPotential - a.referrerPotential;
  }

  return priorityScore(b) - priorityScore(a);
}

function dateValue(value?: string) {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function priorityScore(person: Person) {
  const next = person.nextContactAt ? new Date(person.nextContactAt).getTime() : Number.MAX_SAFE_INTEGER;
  const dueBonus = next <= Date.now() + 24 * 60 * 60 * 1000 ? 100 : 0;
  const actionBonus = person.nextAction ? 20 : 0;
  const recentBonus = Math.max(0, 20 - Math.floor((Date.now() - new Date(person.createdAt).getTime()) / 86400000));
  return dueBonus + person.referrerPotential + actionBonus + recentBonus;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    paddingRight: 10,
  },
  screenName: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  appName: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  dateText: {
    color: '#153E75',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  subcopy: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 7,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconButtonDark: {
    alignItems: 'center',
    backgroundColor: '#153E75',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  tabBar: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    padding: 4,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  tabButtonSelected: {
    backgroundColor: '#FFFFFF',
  },
  tabButtonText: {
    color: '#64748B',
    fontWeight: '900',
  },
  tabButtonTextSelected: {
    color: '#153E75',
  },
  homeContent: {
    paddingBottom: 96,
  },
  listContent: {
    paddingBottom: 96,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: '#64748B',
    lineHeight: 19,
    marginTop: 4,
  },
  sectionBody: {
    marginTop: 10,
  },
  infoBlock: {
    marginBottom: 9,
  },
  infoBlockCompact: {
    marginBottom: 7,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  infoValue: {
    color: '#0F172A',
    lineHeight: 20,
    marginTop: 2,
  },
  updatedNotice: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  priorityRow: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 9,
    padding: 12,
  },
  priorityHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  priorityBadge: {
    backgroundColor: '#153E75',
    borderRadius: 999,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  rowName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
  },
  actionType: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  shortReason: {
    color: '#334155',
    lineHeight: 20,
  },
  todoLine: {
    color: '#153E75',
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 4,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  rowButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  rowButtonText: {
    color: '#153E75',
    fontSize: 12,
    fontWeight: '900',
  },
  scheduleRow: {
    alignItems: 'flex-start',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  scheduleTime: {
    color: '#153E75',
    fontSize: 15,
    fontWeight: '900',
    width: 52,
  },
  scheduleBody: {
    flex: 1,
  },
  rowMeta: {
    color: '#64748B',
    lineHeight: 19,
    marginTop: 2,
  },
  routeRow: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  loopStep: {
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 12,
  },
  loopIndex: {
    backgroundColor: '#153E75',
    borderRadius: 999,
    color: '#FFFFFF',
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  loopBody: {
    flex: 1,
  },
  prepCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  linkText: {
    color: '#153E75',
    fontWeight: '900',
    marginTop: 4,
  },
  postLine: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
    padding: 10,
  },
  bodyText: {
    color: '#334155',
    lineHeight: 22,
    marginBottom: 6,
  },
  primaryCta: {
    alignItems: 'center',
    backgroundColor: '#153E75',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  secondaryCta: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  secondaryCtaText: {
    color: '#153E75',
    fontWeight: '900',
  },
  notificationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  notificationTime: {
    color: '#153E75',
    fontSize: 15,
    fontWeight: '900',
    width: 52,
  },
  notificationBody: {
    flex: 1,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    maxHeight: '86%',
    padding: 16,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  modalButton: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
    width: '48%',
  },
  modalButtonPrimary: {
    backgroundColor: '#153E75',
    borderColor: '#153E75',
  },
  modalButtonText: {
    color: '#153E75',
    fontWeight: '900',
    textAlign: 'center',
  },
  modalButtonTextPrimary: {
    color: '#FFFFFF',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
  },
  filterTitle: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 14,
  },
  filterRow: {
    flexGrow: 0,
  },
  summary: {
    marginBottom: 8,
    marginTop: 16,
  },
  summaryText: {
    color: '#64748B',
    fontWeight: '900',
  },
  empty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 20,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: '#64748B',
    lineHeight: 20,
    marginTop: 8,
  },
  emptyButton: {
    alignItems: 'center',
    backgroundColor: '#153E75',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 46,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  floatingActions: {
    bottom: 18,
    flexDirection: 'row',
    gap: 10,
    left: 16,
    position: 'absolute',
    right: 16,
  },
  floatingButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  coachButton: {
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderWidth: 1,
  },
  addButton: {
    backgroundColor: '#153E75',
  },
  coachButtonText: {
    color: '#153E75',
    fontWeight: '900',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
});
