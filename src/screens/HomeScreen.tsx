import { useCallback, useMemo, useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import {
  Bell,
  Bot,
  ClipboardPenLine,
  Compass,
  House,
  Image as ImageIcon,
  MessageSquareText,
  Mic,
  Moon,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import FilterChip from '../components/FilterChip';
import PersonCard from '../components/PersonCard';
import { MOCK_PEOPLE } from '../data/mockPeople';
import { getPeople, savePeople } from '../storage/personStorage';
import type { AfterMemoAiSuggestion } from '../types/aiAnalysis';
import type { ScreenProps } from '../types/navigation';
import type { Person, PersonCategory } from '../types/person';

type MainTab = 'home' | 'people' | 'pre' | 'after' | 'line' | 'end';
type SortMode = 'priority' | 'nextContact' | 'newest' | 'referrer';

type TodayAction = {
  id: string;
  priority: string;
  personName: string;
  personId: string;
  actionType: string;
  shortReason: string;
  todayTodo: string;
  purpose: string;
  question: string;
  message: string;
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

const NAV_ITEMS: Array<{ tab: MainTab; Icon: LucideIcon; label: string; hint: string }> = [
  { tab: 'home', Icon: House, label: 'ホーム', hint: 'ホーム' },
  { tab: 'people', Icon: UsersRound, label: '人脈', hint: '人脈カード' },
  { tab: 'pre', Icon: Compass, label: '予定前', hint: '予定前ナビ' },
  { tab: 'after', Icon: ClipboardPenLine, label: '後メモ', hint: '後メモ' },
  { tab: 'line', Icon: MessageSquareText, label: '文確認', hint: 'LINE文チェック' },
  { tab: 'end', Icon: Moon, label: '終了後', hint: '終業後チェック' },
];

const SCREEN_META: Record<MainTab, { screenName: string; title: string; subcopy: string }> = {
  home: {
    screenName: 'ホーム',
    title: '今日の営業地図',
    subcopy: '営業開始前に、今日の方向性を確認する',
  },
  people: {
    screenName: '人脈カード',
    title: '営業資産データベース',
    subcopy: '人物情報と営業データを育てる',
  },
  pre: {
    screenName: '予定前ナビ',
    title: '会う前の作戦確認',
    subcopy: '目的・質問・注意点を先に決める',
  },
  after: {
    screenName: '後メモ',
    title: '会話を営業データにする',
    subcopy: '聞いた回答から次アクションを作る',
  },
  line: {
    screenName: 'LINEチェック',
    title: '文面と会話データを確認',
    subcopy: '送る前・返信後の情報を人脈カードへ戻す',
  },
  end: {
    screenName: '終業後チェック',
    title: '明日の営業地図へ反映',
    subcopy: '漏れを確認して次の日の行動に変える',
  },
};

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

  const actions = useMemo(() => createTodayActions(people), [people]);
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

  const openPerson = (personId?: string) => {
    if (personId) {
      navigation.navigate('PersonDetail', { personId });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Header
          activeTab={activeTab}
          planUpdated={planUpdated}
          onNotice={() =>
            Alert.alert('今日の通知', '10:00 山本さんに初回LINE\n13:00 佐藤さんと情報交換\n18:00 田中さんに近況LINE')
          }
          onRefresh={() => {
            setPlanUpdated(true);
            Alert.alert('今日の計画を更新しました', 'モックの営業地図を再生成しました。');
          }}
          onAdd={() => Alert.alert('今日やることを追加', '今日だけ実行する営業行動を追加する想定です。')}
        />

        {activeTab === 'home' ? (
          <HomePane actions={actions} planUpdated={planUpdated} onOpenPerson={openPerson} />
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
          />
        ) : activeTab === 'pre' ? (
          <PreMeetingPane
            people={people}
            initialPersonId={actions[0]?.personId}
            onAfter={() => setActiveTab('after')}
            onLine={() => setActiveTab('line')}
            onOpenPerson={openPerson}
            onOpenCoach={(initialPrompt) => navigation.navigate('CoachChat', { initialPrompt })}
          />
        ) : activeTab === 'after' ? (
          <AfterMemoPane
            people={people}
            personId={actions[0]?.personId}
            onPeopleUpdated={setPeople}
            onLine={() => setActiveTab('line')}
            onEnd={() => setActiveTab('end')}
            onOpenPerson={openPerson}
            onCoach={(initialPrompt) => navigation.navigate('CoachChat', { initialPrompt })}
          />
        ) : activeTab === 'line' ? (
          <LineCheckPane
            people={people}
            personId={actions[0]?.personId}
            onPeopleUpdated={setPeople}
            onAfter={() => setActiveTab('after')}
            onOpenPerson={openPerson}
            onCoach={(initialPrompt) => navigation.navigate('CoachChat', { initialPrompt })}
          />
        ) : (
          <EndOfDayPane onAfter={() => setActiveTab('after')} onHome={() => setActiveTab('home')} />
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
            <Pressable style={[styles.floatingButton, styles.addButton]} onPress={() => Alert.alert('今日やることを追加', 'モック追加モーダルの想定です。')}>
              <Plus color="#FFFFFF" size={20} />
              <Text style={styles.addButtonText}>今日やること追加</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Header({
  activeTab,
  planUpdated,
  onNotice,
  onRefresh,
  onAdd,
}: {
  activeTab: MainTab;
  planUpdated: boolean;
  onNotice: () => void;
  onRefresh: () => void;
  onAdd: () => void;
}) {
  const meta = SCREEN_META[activeTab];

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.screenName}>{meta.screenName}</Text>
        <Text style={styles.appName}>{meta.title}</Text>
        <Text style={styles.dateText}>6月19日</Text>
        <Text style={styles.subcopy}>{meta.subcopy}</Text>
        {planUpdated ? <Text style={styles.updatedNotice}>今日の計画を更新済み</Text> : null}
      </View>
      <View style={styles.headerActions}>
        <Pressable style={styles.iconButton} onPress={onNotice}>
          <Bell color="#153E75" size={20} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onRefresh}>
          <RefreshCw color="#153E75" size={20} />
        </Pressable>
        <Pressable style={styles.iconButtonDark} onPress={onAdd}>
          <UserPlus color="#FFFFFF" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

function HomePane({
  actions,
  planUpdated,
  onOpenPerson,
}: {
  actions: TodayAction[];
  planUpdated: boolean;
  onOpenPerson: (personId?: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Section title="今日の営業テーマ">
        <Info label="テーマ" value="紹介直後の人を放置せず、初回接触を完了する" compact />
        <Info label="今日の狙い" value="売り込みではなく、課題確認と関係構築を優先する" compact />
        <Info label="今日の注意" value="紹介依頼を急がない。まず情報交換を挟む" compact />
        <Info label="根拠" value="紹介直後は記憶と信頼が残るため、初回接触が遅いほど反応率が下がりやすい" compact />
        {planUpdated ? <Text style={styles.updatedNotice}>再生成された今日の営業地図です</Text> : null}
      </Section>

      <Section title="今日の優先行動" subtitle="誰に・なぜ・何をするかだけ確認します。">
        {actions.map((item) => (
          <Pressable key={item.id} style={styles.priorityRow} onPress={() => onOpenPerson(item.personId)}>
            <View style={styles.priorityHeader}>
              <Text style={styles.priorityBadge}>{item.priority}</Text>
              <Text style={styles.rowName}>{item.personName}</Text>
              <Text style={styles.actionType}>{item.actionType}</Text>
            </View>
            <Text style={styles.shortReason}>{item.shortReason}</Text>
            <Text style={styles.todoLine}>今日やること：{item.todayTodo}</Text>
            <View style={styles.rowButtons}>
              <MiniButton label="詳細" />
              <MiniButton label="完了" />
              <MiniButton label="延期" />
            </View>
          </Pressable>
        ))}
      </Section>

      <Section title="今日の予定と通知">
        <Schedule time="10:00" title="山本さんに初回LINE" purpose="紹介直後の初回接触" />
        <Schedule time="13:00" title="佐藤さんと情報交換" purpose="不動産顧客層の情報取得" />
        <Schedule time="18:00" title="田中さんに近況LINE" purpose="美容業界の課題確認" />
      </Section>

      <Section title="今日進める営業ルート">
        <Route title="山本さん → 本人の店舗課題確認" meta="顧客化ルート / 紹介直後 / 初回接触" />
        <Route title="田中さん → 美容業界の経営者人脈" meta="紹介元化ルート / 情報交換前 / 採用・集客課題を聞く" />
        <Route title="佐藤さん → 資産形成層の情報" meta="情報源化ルート / 質問準備 / 不動産顧客層の動きを聞く" />
      </Section>

      <Section title="会う前チェック">
        <Info label="佐藤さん" value="13:00 情報交換" />
        <Info label="目的" value="不動産顧客層の動きを聞く" />
        <Info label="最初の質問" value="最近、不動産を検討する方って、投資目的と自宅目的だとどちらが多いですか？" />
        <Info label="注意" value="一方的に聞くだけで終わらない。情報交換の形にする。" />
      </Section>

      <Section title="会った後に処理するもの">
        <Route title="佐藤さん" meta="13:00の情報交換後にメモ入力" />
        <Route title="山本さん" meta="返信が来たら分類と次回連絡日を更新" />
      </Section>

      <Section title="今日の営業コーチ指摘">
        <Info label="今週の傾向" value="初回接触はできていますが、会話後に次アクションを決める数が少ないです。" />
        <Info label="今日の改善" value="会話した人は必ず「分類・ゴール・次回連絡日」を決めて終える。" />
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
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    />
  );
}

function PreMeetingPane({
  people,
  initialPersonId,
  onAfter,
  onLine,
  onOpenPerson,
  onOpenCoach,
}: {
  people: Person[];
  initialPersonId?: string;
  onAfter: () => void;
  onLine: () => void;
  onOpenPerson: (personId?: string) => void;
  onOpenCoach: (initialPrompt: string) => void;
}) {
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId ?? '');
  const [actionType, setActionType] = useState('情報交換前');
  const [memo, setMemo] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const [personQuery, setPersonQuery] = useState('');
  const [showReferenceDetails, setShowReferenceDetails] = useState(false);
  const [showNavDetails, setShowNavDetails] = useState(false);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [showMoreNavActions, setShowMoreNavActions] = useState(false);

  const uniquePeople = useMemo(() => dedupePeople(people), [people]);
  const selectedPerson = useMemo(() => {
    const currentId = selectedPersonId || initialPersonId || uniquePeople[0]?.id;
    return uniquePeople.find((person) => person.id === currentId) ?? uniquePeople[0];
  }, [initialPersonId, selectedPersonId, uniquePeople]);

  const nav = useMemo(() => createPreMeetingNavigation(selectedPerson, actionType), [actionType, selectedPerson]);
  const currentPersonId = selectedPerson?.id ?? selectedPersonId;
  const candidatePeople = useMemo(() => {
    const normalized = personQuery.trim().toLowerCase();
    const matches = normalized
      ? uniquePeople.filter((person) =>
          [person.name, person.industry, person.relationship, person.categories.join(' '), person.nextAction, person.rawMemo]
            .join(' ')
            .toLowerCase()
            .includes(normalized),
        )
      : uniquePeople;

    return dedupePeople(matches).slice(0, 20);
  }, [people, personQuery, uniquePeople]);

  const copyQuestions = () => {
    Clipboard.setStringAsync(nav.questions.map((question, index) => `${index + 1}. ${question}`).join('\n')).catch(() => undefined);
    setCopyNotice(true);
    Alert.alert('質問をコピーしました', '予定前ナビで決めた質問をコピーしました。');
  };

  const goAfterMemo = () => {
    Alert.alert('後メモへ引き継ぎます', '相手・目的・質問・記録項目を後メモに渡す想定のUIです。');
    onAfter();
  };

  if (people.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="予定前ナビ" subtitle="会う前に、今日の目的と聞くべき質問を決める">
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>まだ相手が選ばれていません。</Text>
            <Text style={styles.emptyText}>今日会う人、連絡する人、LINEする人を選んでください。</Text>
            <Pressable style={styles.emptyButton} onPress={() => Alert.alert('人脈カードから選ぶ', '人脈カード一覧から相手を選ぶ想定です。')}>
              <Text style={styles.emptyButtonText}>人脈カードから選ぶ</Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.paneHeaderRow}>
        <View style={styles.paneHeaderText}>
          <Text style={styles.paneTitle}>予定前ナビ</Text>
          <Text style={styles.paneSubcopy}>会う前に、今日の目的と聞くべき質問を決める</Text>
        </View>
        <View style={styles.paneHeaderActions}>
          <Pressable style={styles.smallOutlineButton} onPress={() => onOpenPerson(currentPersonId)}>
            <Text style={styles.smallOutlineText}>人脈</Text>
          </Pressable>
          <Pressable style={styles.smallOutlineButton} onPress={() => Alert.alert('履歴', '過去の予定前ナビへ移動する想定です。')}>
            <Text style={styles.smallOutlineText}>履歴</Text>
          </Pressable>
        </View>
      </View>

      <Section title="相手を選ぶ" subtitle="選択中の相手だけ表示します。変更するときだけ検索を開きます。">
        {selectedPerson ? (
          <View style={styles.selectedPersonSummary}>
            <Text style={styles.selectedSummaryLabel}>選択中</Text>
            <Text style={styles.selectedSummaryName}>{selectedPerson.name}</Text>
            <Text style={styles.selectedSummaryMeta}>
              {selectedPerson.industry} / {selectedPerson.relationship}
            </Text>
            <Text style={styles.selectedSummaryAction}>今日の焦点：{selectedPerson.nextAction}</Text>
          </View>
        ) : null}

        <Pressable style={styles.changePersonButton} onPress={() => setPersonPickerOpen(true)}>
          <Search color="#0F172A" size={18} />
          <Text style={styles.changePersonText}>相手を変更する</Text>
        </Pressable>
      </Section>

      <Modal visible={personPickerOpen} transparent animationType="slide" onRequestClose={() => setPersonPickerOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.personPickerSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>相手を検索</Text>
                <Text style={styles.sheetSubcopy}>名前・業種・関係性・メモから探せます。</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setPersonPickerOpen(false)}>
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Search color="#64748B" size={18} />
              <TextInput
                value={personQuery}
                onChangeText={setPersonQuery}
                placeholder="相手を検索"
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.resultHint}>候補 {candidatePeople.length}件</Text>
            <ScrollView style={styles.personPickerList} showsVerticalScrollIndicator={false}>
              {candidatePeople.length > 0 ? (
                candidatePeople.map((person) => {
                  const selected = person.id === currentPersonId;
                  return (
                    <Pressable
                      key={person.id}
                      style={[styles.personSelectCard, selected && styles.personSelectCardActive]}
                      onPress={() => {
                        setSelectedPersonId(person.id);
                        setHasGenerated(false);
                        setCopyNotice(false);
                        setShowReferenceDetails(false);
                        setShowNavDetails(false);
                        setShowMoreNavActions(false);
                        setPersonPickerOpen(false);
                      }}
                    >
                      <View style={styles.personSelectTop}>
                        <Text style={styles.personSelectName}>{person.name}</Text>
                        {selected ? <Text style={styles.selectedMark}>選択中</Text> : null}
                      </View>
                      <Text style={styles.personSelectMeta}>
                        {person.industry} / {person.relationship}
                      </Text>
                      <Text style={styles.personSelectTags}>分類：{person.categories.join('・')}</Text>
                      <Text style={styles.personSelectAction}>次アクション：{person.nextAction}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyPickerState}>
                  <Text style={styles.emptyTitle}>候補が見つかりません。</Text>
                  <Text style={styles.emptyText}>名前、業種、関係性、メモの一部で検索してみてください。</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Section title="アクション種別を選ぶ">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {['初回連絡前', '商談前', '電話前', 'LINE前', '情報交換前', '追客前', '紹介依頼前', '関係構築前'].map((item) => (
            <FilterChip
              key={item}
              label={item}
              selected={actionType === item}
              onPress={() => {
                setActionType(item);
                setHasGenerated(false);
                setCopyNotice(false);
                setShowMoreNavActions(false);
              }}
            />
          ))}
        </ScrollView>
        <Text style={styles.guidanceText}>{getActionGuidance(actionType)}</Text>
      </Section>

      <Section title="参照している人脈情報" subtitle="人脈カード・過去メモ・LINEチェックの情報を参照して、今日のナビを作ります。">
        <View style={styles.referenceSummaryCard}>
          <Text style={styles.referenceSummaryTitle}>
            {selectedPerson?.categories.join(' / ') ?? '分類未設定'}
          </Text>
          <Text style={styles.referenceSummaryText}>ゴール：{selectedPerson?.goal ?? '未設定'}</Text>
          <Text style={styles.referenceSummaryText}>次アクション：{selectedPerson?.nextAction ?? '未設定'}</Text>
          <Text style={styles.referenceSummaryCaution}>注意：{selectedPerson?.cautions ?? '未設定'}</Text>
        </View>

        <Pressable style={styles.toggleRow} onPress={() => setShowReferenceDetails((value) => !value)}>
          <Text style={styles.toggleText}>{showReferenceDetails ? '参照情報を閉じる' : '参照情報を開く'}</Text>
        </Pressable>

        {showReferenceDetails ? (
          <>
            <View style={styles.referenceGrid}>
              <Info label="名前" value={selectedPerson?.name ?? '未選択'} compact />
              <Info label="業種" value={selectedPerson?.industry ?? '未選択'} compact />
              <Info label="関係性" value={selectedPerson?.relationship ?? '未選択'} compact />
              <Info label="現在の分類" value={selectedPerson?.categories.join(' / ') ?? '未選択'} compact />
              <Info label="前回の接触" value={selectedPerson?.name.includes('田中') ? '3日前' : selectedPerson?.name.includes('山本') ? '紹介直後' : '本日13:00予定'} compact />
            </View>
            <Info label="過去メモ要約" value={selectedPerson?.rawMemo ?? '過去メモはまだありません。'} />
            <Info label="LINEチェック要約" value={selectedPerson?.name.includes('田中') ? 'まだ具体的な返信履歴なし。売り込み感を抑えた情報交換文が安全。' : '返信内容から温度感と次回連絡日を更新する想定です。'} />
          </>
        ) : null}
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryCta} onPress={() => onOpenPerson(currentPersonId)}>
            <Text style={styles.secondaryCtaText}>人脈カードを開く</Text>
          </Pressable>
          <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('参照情報を編集', '人脈カードの基本情報編集へ進む想定です。')}>
            <Text style={styles.secondaryCtaText}>参照情報を編集</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="今日の追加メモ">
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="例：今日13時に会う。採用の話を少し聞きたい。紹介依頼はまだ早そう。相手は忙しそうなので短く聞きたい。"
          placeholderTextColor="#94A3B8"
          multiline
          textAlignVertical="top"
          style={styles.largeInput}
        />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('音声入力', 'スマホ版で音声入力を開く想定です。')}>
            <Text style={styles.secondaryCtaText}>音声入力</Text>
          </Pressable>
          <Pressable style={styles.secondaryCta} onPress={() => setMemo('')}>
            <Text style={styles.secondaryCtaText}>クリア</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryCta}
            onPress={() =>
              setMemo('今日13時に情報交換予定。美容業界の採用や集客の悩みを聞きたい。まだ紹介依頼はせず、まずは業界課題を聞く。')
            }
          >
            <Text style={styles.secondaryCtaText}>サンプル</Text>
          </Pressable>
        </View>
      </Section>

      <Pressable
        style={styles.fullPrimaryButton}
        onPress={() => {
          setHasGenerated(true);
          setCopyNotice(false);
          setShowNavDetails(false);
          setShowMoreNavActions(false);
          Alert.alert('今日のナビを作りました', '人脈カード情報と追加メモを参照したモックナビを表示します。');
        }}
      >
        <Text style={styles.fullPrimaryText}>今日のナビを作る</Text>
      </Pressable>

      {hasGenerated ? (
        <Section title="ナビ結果" subtitle={`${selectedPerson?.name ?? '相手未選択'} / ${actionType}`}>
          <View style={styles.navSummaryCard}>
            <Info label="今日の目的" value={nav.purpose} compact />
            <Info label="今日の到達点" value={nav.destination} compact />
            <Info label="最初の一言" value={nav.opening} compact />
            <Info label="今日のNG" value={nav.ngActions[0]} compact />
          </View>

          <View style={styles.questionPreview}>
            <Text style={styles.questionPreviewTitle}>まず聞く質問</Text>
            {nav.questions.slice(0, 2).map((question, index) => (
              <Text key={question} style={styles.questionPreviewText}>
                {index + 1}. {question}
              </Text>
            ))}
          </View>

          <Pressable style={styles.toggleRow} onPress={() => setShowNavDetails((value) => !value)}>
            <Text style={styles.toggleText}>{showNavDetails ? '詳細ナビを閉じる' : '詳細ナビを開く'}</Text>
          </Pressable>

          {showNavDetails ? (
            <>
              <Info label="今日の会話方針" value={nav.policy} />
              <Info label="聞くべき質問" value={nav.questions.map((question, index) => `${index + 1}. ${question}`).join('\n')} />
              <Info label="深掘り質問" value={nav.deepQuestions.map((question) => `・${question}`).join('\n')} />
              <Info label="聞いてはいけないこと" value={nav.ngActions.map((item) => `・${item}`).join('\n')} />
              <Info label="売るべきか、聞くべきか" value={nav.sellOrAsk} />
              <Info label="紹介依頼してよいか" value={nav.referralTiming} />
              <Info label="会話後に記録すべき項目" value={nav.recordItems.map((item) => `・${item}`).join('\n')} />
              <Info label="科学的根拠" value={nav.evidence.map((item) => `・${item}`).join('\n')} />
            </>
          ) : null}

          <View style={styles.primaryActionStack}>
            <Pressable style={styles.primaryCtaWide} onPress={goAfterMemo}>
              <Text style={styles.primaryCtaText}>後メモへ進む</Text>
            </Pressable>
            <View style={styles.inlineActions}>
              <Pressable style={styles.secondaryCta} onPress={copyQuestions}>
                <Text style={styles.secondaryCtaText}>質問をコピー</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => setShowMoreNavActions((value) => !value)}>
                <Text style={styles.secondaryCtaText}>{showMoreNavActions ? 'その他を閉じる' : 'その他'}</Text>
              </Pressable>
            </View>
          </View>

          {showMoreNavActions ? (
            <View style={styles.moreActionPanel}>
              <Pressable style={styles.secondaryCta} onPress={() => onOpenPerson(currentPersonId)}>
                <Text style={styles.secondaryCtaText}>人脈カード</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={onLine}>
                <Text style={styles.secondaryCtaText}>LINE文を作る</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => onOpenCoach(nav.coachPrompt)}>
                <Text style={styles.secondaryCtaText}>コーチ相談</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('予定前ナビを保存しました', '人脈カードの予定前ナビ履歴に保存する想定です。')}>
                <Text style={styles.secondaryCtaText}>ナビを保存</Text>
              </Pressable>
            </View>
          ) : null}
          {copyNotice ? <Text style={styles.successNotice}>質問をコピーしました</Text> : null}
        </Section>
      ) : (
        <Section title="ナビ結果">
          <Text style={styles.emptyText}>相手・アクション種別・追加メモを確認して、「今日のナビを作る」を押してください。</Text>
        </Section>
      )}

      <Section title="過去の予定前ナビ">
        <Route title="6月18日 / 田中さん / 情報交換前" meta="目的：美容業界の採用・集客課題を聞く / 状態：後メモ未入力" />
        <Route title="6月17日 / 山本さん / 初回連絡前" meta="目的：整体院の経営課題を確認 / 状態：後メモ入力済み" />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('履歴を見る', '予定前ナビ履歴一覧を開く想定です。')}>
            <Text style={styles.secondaryCtaText}>履歴を見る</Text>
          </Pressable>
          <Pressable style={styles.secondaryCta} onPress={onAfter}>
            <Text style={styles.secondaryCtaText}>後メモを入力</Text>
          </Pressable>
        </View>
      </Section>
    </ScrollView>
  );
}

function AfterMemoPane({
  people,
  personId,
  onPeopleUpdated,
  onLine,
  onEnd,
  onOpenPerson,
  onCoach,
}: {
  people: Person[];
  personId?: string;
  onPeopleUpdated: (people: Person[]) => void;
  onLine: () => void;
  onEnd: () => void;
  onOpenPerson: (personId?: string) => void;
  onCoach: (initialPrompt: string) => void;
}) {
  const person = useMemo(() => people.find((item) => item.id === personId) ?? people[0], [people, personId]);
  const questions = useMemo(() => createAfterMemoQuestions(person), [person]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [talkMemo, setTalkMemo] = useState('');
  const [allInfoMemo, setAllInfoMemo] = useState('');
  const [nextTodo, setNextTodo] = useState('');
  const [aiGenerated, setAiGenerated] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [updatedNotice, setUpdatedNotice] = useState(false);

  const suggestion = useMemo(
    () =>
      createAfterMemoSuggestion({
        person,
        answers,
        talkMemo,
        allInfoMemo,
        nextTodo,
      }),
    [allInfoMemo, answers, nextTodo, person, talkMemo],
  );

  const setAnswer = (question: string, value: string) => {
    setAnswers((current) => ({ ...current, [question]: value }));
  };

  const updatePersonCard = async () => {
    if (!person) {
      Alert.alert('人脈カードがありません', '更新対象の人物を選んでください。');
      return;
    }

    const answeredQuestions = questions
      .map((question) => `${question}\n回答：${answers[question] || '未入力'}`)
      .join('\n\n');
    const memoLines = [
      `予定前ナビの質問回答\n${answeredQuestions}`,
      `話した内容：${talkMemo || '未入力'}`,
      `得た情報全部：${allInfoMemo || '未入力'}`,
      `自分が思う次アクション：${nextTodo || '未入力'}`,
      `AI抽出：${suggestion.accumulation}`,
      `AIフィードバック：${suggestion.feedback}`,
    ];

    const updatedPeople = people.map((item) =>
      item.id === person.id
        ? {
            ...item,
            goal: suggestion.goal,
            nextAction: suggestion.nextAction,
            nextQuestion: suggestion.nextQuestion,
            lineMessage: suggestion.lineMessage,
            additionalMemo: [item.additionalMemo, memoLines.join('\n')].filter(Boolean).join('\n\n'),
          }
        : item,
    );

    await savePeople(updatedPeople);
    onPeopleUpdated(updatedPeople);
    setUpdatedNotice(true);
    Alert.alert('人脈カードを更新しました', '後メモの内容を人脈カードに蓄積しました。');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.paneHeaderRow}>
        <View style={styles.paneHeaderText}>
          <Text style={styles.paneTitle}>後メモ</Text>
          <Text style={styles.paneSubcopy}>会話の回答を営業データにして、人脈カードを更新する</Text>
        </View>
        <View style={styles.paneHeaderActions}>
          <Pressable style={styles.smallOutlineButton} onPress={() => onOpenPerson(person?.id)}>
            <Text style={styles.smallOutlineText}>人脈</Text>
          </Pressable>
        </View>
      </View>

      <Section title="予定前ナビから引き継ぎ" subtitle="予定前で決めた質問に、会話後すぐ回答を入れます。">
        <View style={styles.afterContextCard}>
          <Text style={styles.afterContextTitle}>{person?.name ?? '人物未選択'}</Text>
          <Text style={styles.afterContextMeta}>{person ? `${person.industry} / ${person.relationship}` : '人脈カード未選択'}</Text>
          <Text style={styles.afterContextFocus}>今日の目的：{person?.goal ?? '課題確認と次アクション設定'}</Text>
        </View>
      </Section>

      <Section title="質問への回答">
        {questions.map((question) => (
          <View key={question} style={styles.questionBlock}>
            <Text style={styles.questionText}>{question}</Text>
            <TextInput
              value={answers[question] ?? ''}
              onChangeText={(value) => setAnswer(question, value)}
              placeholder="相手の回答をそのまま入力"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              style={styles.compactInput}
            />
          </View>
        ))}
      </Section>

      <Section title="会話で得た情報を全部入れる" subtitle="分類・温度感・次回タイミングはAIが推論します。ここでは素材を漏らさず残します。">
        <MemoField label="話した内容" value={talkMemo} onChangeText={setTalkMemo} placeholder="会話全体の流れ、相手が強く話していたこと、印象に残った言葉" large />
        <MemoField
          label="得た情報を全部貼る"
          value={allInfoMemo}
          onChangeText={setAllInfoMemo}
          placeholder="課題、背景、周りの人脈、紹介できそうな人、予算感、期限、決裁者、断り理由、温度感、LINEで来た文などを雑に全部"
          large
        />
        <MemoField label="自分が思う次にやること" value={nextTodo} onChangeText={setNextTodo} placeholder="例：3日以内に採用系の情報を送る / 紹介依頼はまだしない / 次回は固定費の話を聞く" />

        <View style={styles.aiExtractHintCard}>
          <Text style={styles.aiExtractTitle}>AIが抽出する営業データ</Text>
          <Text style={styles.aiExtractText}>課題 / 背景 / 温度感 / 紹介可能性 / 決裁者 / 期限 / 予算感 / 次アクション / 次回連絡日 / 聞き漏れ / 改善点</Text>
        </View>
      </Section>

      <Pressable
        style={styles.fullPrimaryButton}
        onPress={() => {
          setAiGenerated(true);
          setShowAiDetails(false);
          setUpdatedNotice(false);
          Alert.alert('後メモを整理しました', '入力内容から人脈カード更新案を作りました。');
        }}
      >
        <Text style={styles.fullPrimaryText}>AIで整理する</Text>
      </Pressable>

      {aiGenerated ? (
        <Section title="AIの人脈カード更新案" subtitle="分類・ゴール・次アクションを、人脈カードへ戻すための案です。">
          <View style={styles.navSummaryCard}>
            <Info label="分類更新案" value={suggestion.categoryUpdate} compact />
            <Info label="ゴール更新案" value={suggestion.goal} compact />
            <Info label="次アクション" value={suggestion.nextAction} compact />
            <Info label="次回連絡日" value={suggestion.nextContact} compact />
          </View>

          <Pressable style={styles.toggleRow} onPress={() => setShowAiDetails((value) => !value)}>
            <Text style={styles.toggleText}>{showAiDetails ? '更新案の詳細を閉じる' : '更新案の詳細を開く'}</Text>
          </Pressable>

          {showAiDetails ? (
            <>
              <Info label="営業フィードバック" value={suggestion.feedback} />
              <Info label="次回聞くべき質問" value={suggestion.nextQuestion} />
              <Info label="LINE文案" value={suggestion.lineMessage} />
              <Info label="蓄積する情報" value={suggestion.accumulation} />
            </>
          ) : null}

          <View style={styles.primaryActionStack}>
            <Pressable style={styles.primaryCtaWide} onPress={updatePersonCard}>
              <Text style={styles.primaryCtaText}>人脈カードを更新</Text>
            </Pressable>
            <View style={styles.inlineActions}>
              <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('次回通知を設定しました', `${suggestion.nextContact} に通知する想定です。`)}>
                <Text style={styles.secondaryCtaText}>次回通知</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={onLine}>
                <Text style={styles.secondaryCtaText}>LINE文</Text>
              </Pressable>
            </View>
            <View style={styles.inlineActions}>
              <Pressable style={styles.secondaryCta} onPress={() => onCoach(`${person?.name ?? 'この人'}との会話後メモから、人脈カード更新と次アクションを相談したいです。`)}>
                <Text style={styles.secondaryCtaText}>コーチ相談</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={onEnd}>
                <Text style={styles.secondaryCtaText}>今日の処理完了</Text>
              </Pressable>
            </View>
          </View>
          {updatedNotice ? <Text style={styles.successNotice}>人脈カードへ蓄積しました</Text> : null}
        </Section>
      ) : (
        <Section title="AIの人脈カード更新案">
          <Text style={styles.emptyText}>回答と会話データを入力して、「AIで整理する」を押してください。</Text>
        </Section>
      )}
    </ScrollView>
  );
}

function LegacyAfterMemoPane({
  personId,
  onLine,
  onEnd,
  onOpenPerson,
}: {
  personId?: string;
  onLine: () => void;
  onEnd: () => void;
  onOpenPerson: (personId?: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Section title="後メモ" subtitle="予定前ナビで決めた質問の回答を入れて、人脈カードを育てます。">
        {['最近、採用と集客どちらが大変ですか？', '周りの経営者も同じ悩みを持っていますか？'].map((question) => (
          <View key={question} style={styles.questionBlock}>
            <Text style={styles.questionText}>{question}</Text>
            <TextInput
              placeholder="相手の回答を入力"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              style={styles.compactInput}
            />
          </View>
        ))}
      </Section>
      <Section title="AIの人脈カード更新案">
        <Info label="分類変更案" value="紹介元候補 / 情報源候補を維持。" />
        <Info label="次アクション" value="3日以内に会話で出た課題に関する情報を1つ送る。" />
        <Info label="LINE文案" value="今日はありがとうございました。採用の話、とても参考になりました。" />
      </Section>
      <View style={styles.inlineActions}>
        <Pressable style={styles.primaryCta} onPress={() => onOpenPerson(personId)}>
          <Text style={styles.primaryCtaText}>人脈カード更新</Text>
        </Pressable>
        <Pressable style={styles.secondaryCta} onPress={onLine}>
          <Text style={styles.secondaryCtaText}>LINE文を作る</Text>
        </Pressable>
      </View>
      <Pressable style={styles.secondaryCta} onPress={onEnd}>
        <Text style={styles.secondaryCtaText}>今日の処理完了</Text>
      </Pressable>
    </ScrollView>
  );
}

const LINE_CHECK_TYPES = ['受信文チェック', '返信作成', '送信前チェック', '断り返信', '紹介依頼文', 'お礼文', 'スクショメモ', '音声メモ'] as const;
const LINE_PERSON_FILTERS = ['今日予定', '最近やり取り', '次アクションあり', '返信待ち', '最近追加', '全員'] as const;
const LINE_NOTICE_OPTIONS = ['明日 9:00', '3日後 9:00', '1週間後 9:00', '返信がなければ3日後', '通知なし'];

type LineCheckType = (typeof LINE_CHECK_TYPES)[number];
type LinePersonFilter = (typeof LINE_PERSON_FILTERS)[number];

function LineCheckPane({
  people,
  personId,
  onPeopleUpdated,
  onAfter,
  onOpenPerson,
  onCoach,
}: {
  people: Person[];
  personId?: string;
  onPeopleUpdated: (people: Person[]) => void;
  onAfter: () => void;
  onOpenPerson: (personId?: string) => void;
  onCoach: (initialPrompt: string) => void;
}) {
  const [selectedPersonId, setSelectedPersonId] = useState(personId);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [personQuery, setPersonQuery] = useState('');
  const [personFilter, setPersonFilter] = useState<LinePersonFilter>('最近やり取り');
  const [checkType, setCheckType] = useState<LineCheckType>('受信文チェック');
  const [messageText, setMessageText] = useState('');
  const [hasChecked, setHasChecked] = useState(false);
  const [copyNotice, setCopyNotice] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);

  const candidates = useMemo(() => dedupePeople(people), [people]);
  const currentPersonId = selectedPersonId ?? personId ?? candidates[0]?.id;
  const selectedPerson = useMemo(
    () => candidates.find((person) => person.id === currentPersonId) ?? candidates[0],
    [candidates, currentPersonId],
  );
  const filteredCandidates = useMemo(() => {
    const normalized = personQuery.trim().toLowerCase();

    return candidates.filter((person) => {
      const matchesQuery =
        !normalized ||
        [person.name, person.industry, person.relationship, person.rawMemo, person.nextAction, person.cautions]
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      const matchesFilter = matchesLinePersonFilter(person, personFilter);

      return matchesQuery && matchesFilter;
    });
  }, [candidates, personFilter, personQuery]);

  const typeGuide = getLineCheckTypeGuide(checkType);
  const analysis = useMemo(() => createLineCheckAnalysis(selectedPerson, checkType, messageText), [checkType, messageText, selectedPerson]);

  const resetResult = () => {
    setHasChecked(false);
    setCopyNotice('');
    setSavedNotice(false);
  };

  const checkMessage = () => {
    if (!selectedPerson) {
      Alert.alert('相手を選んでください', '文面を確認する相手を先に選んでください。');
      return;
    }
    if (!messageText.trim()) {
      Alert.alert('文面を入力してください', '送る前の文、相手から来た返信、スクショメモ、音声メモなどを入力してください。');
      return;
    }
    setHasChecked(true);
    setSavedNotice(false);
    setCopyNotice('');
  };

  const copyReply = async () => {
    await Clipboard.setStringAsync(analysis.replyDraft);
    setCopyNotice('返信文をコピーしました');
  };

  const saveToPersonCard = async () => {
    if (!selectedPerson) return;

    const memo = [
      `文面確認（${checkType}）`,
      `入力文：${messageText || '未入力'}`,
      `温度感：${analysis.temperature.label} / ${analysis.temperature.reason}`,
      `抽出情報：${analysis.extracted.map((item) => `${item.label}：${item.value}`).join('、')}`,
      `返信方針：${analysis.judgement}`,
      `返信文案：${analysis.replyDraft}`,
      `分類更新案：${analysis.categoryUpdate}`,
      `次アクション：${analysis.nextAction}`,
      `注意点：${analysis.caution}`,
    ].join('\n');

    const updatedPeople = people.map((person) =>
      person.id === selectedPerson.id
        ? {
            ...person,
            nextAction: analysis.nextAction,
            nextQuestion: analysis.nextQuestion,
            lineMessage: analysis.replyDraft,
            cautions: analysis.caution,
            additionalMemo: [person.additionalMemo, memo].filter(Boolean).join('\n\n'),
          }
        : person,
    );

    await savePeople(updatedPeople);
    onPeopleUpdated(updatedPeople);
    setSavedNotice(true);
    Alert.alert('人脈カードに保存しました', 'LINE・DMの内容から抽出した営業データを人脈カードに蓄積しました。');
  };

  const sendToAfterMemo = () => {
    Alert.alert('後メモに送ります', '相手・入力文・抽出情報・温度感・次の質問・返信文案・次アクションを後メモに引き継ぐ想定です。');
    onAfter();
  };

  if (people.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="文面確認" subtitle="送る前に確認し、相手の返信を営業データに変える">
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>まだ相手がいません。</Text>
            <Text style={styles.emptyText}>先に人脈カードを追加すると、LINEやDMの内容を相手ごとに蓄積できます。</Text>
          </View>
        </Section>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.paneHeaderRow}>
        <View style={styles.paneHeaderText}>
          <Text style={styles.paneTitle}>受信文チェック</Text>
          <Text style={styles.paneSubcopy}>相手の返信を貼るだけで、返信・保存・次アクションまで整理する</Text>
        </View>
        <View style={styles.paneHeaderActions}>
          <Pressable style={styles.smallOutlineButton} onPress={() => onOpenPerson(selectedPerson?.id)}>
            <Text style={styles.smallOutlineText}>人脈</Text>
          </Pressable>
          <Pressable style={styles.smallOutlineButton} onPress={() => Alert.alert('履歴', '過去の文面チェック履歴を開く想定です。')}>
            <Text style={styles.smallOutlineText}>履歴</Text>
          </Pressable>
        </View>
      </View>

      <Section title="相手を選ぶ" subtitle="ホーム・人脈カード・後メモから開いた場合は、この相手が自動選択される想定です。">
        {selectedPerson ? (
          <View style={styles.selectedPersonSummary}>
            <Text style={styles.selectedSummaryLabel}>選択中</Text>
            <Text style={styles.selectedSummaryName}>{selectedPerson.name}</Text>
            <Text style={styles.selectedSummaryMeta}>
              {selectedPerson.industry} / {selectedPerson.categories.join(' / ')}
            </Text>
            <Text style={styles.selectedSummaryAction}>次アクション：{selectedPerson.nextAction}</Text>
          </View>
        ) : null}
        <Pressable style={styles.changePersonButton} onPress={() => setPersonPickerOpen(true)}>
          <Search color="#0F172A" size={18} />
          <Text style={styles.changePersonText}>相手を検索・変更する</Text>
        </Pressable>
      </Section>

      <Modal visible={personPickerOpen} transparent animationType="slide" onRequestClose={() => setPersonPickerOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.personPickerSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>相手を検索</Text>
                <Text style={styles.sheetSubcopy}>名前・業種・メモで検索できます。</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setPersonPickerOpen(false)}>
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Search color="#64748B" size={18} />
              <TextInput
                value={personQuery}
                onChangeText={setPersonQuery}
                placeholder="名前・業種・メモで検索"
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {LINE_PERSON_FILTERS.map((item) => (
                <FilterChip key={item} label={item} selected={personFilter === item} onPress={() => setPersonFilter(item)} />
              ))}
            </ScrollView>

            <Text style={styles.resultHint}>候補 {filteredCandidates.length}件</Text>
            <ScrollView style={styles.personPickerList} showsVerticalScrollIndicator={false}>
              {filteredCandidates.map((person) => {
                const selected = person.id === selectedPerson?.id;
                return (
                  <Pressable
                    key={person.id}
                    style={[styles.personSelectCard, selected && styles.personSelectCardActive]}
                    onPress={() => {
                      setSelectedPersonId(person.id);
                      resetResult();
                      setPersonPickerOpen(false);
                    }}
                  >
                    <View style={styles.personSelectTop}>
                      <Text style={styles.personSelectName}>{person.name}</Text>
                      {selected ? <Text style={styles.selectedMark}>選択中</Text> : null}
                    </View>
                    <Text style={styles.personSelectMeta}>
                      {person.industry}｜{getLinePersonStatus(person)}｜{person.categories[0]}
                    </Text>
                    <Text style={styles.personSelectAction}>次アクション：{person.nextAction}</Text>
                  </Pressable>
                );
              })}
              {filteredCandidates.length === 0 ? (
                <View style={styles.emptyPickerState}>
                  <Text style={styles.emptyTitle}>候補が見つかりません。</Text>
                  <Text style={styles.emptyText}>名前、業種、メモ本文、次アクションの一部で検索してみてください。</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Section title="チェック種別" subtitle="基本は受信文チェックのままでOK。必要な時だけ切り替えます。">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {LINE_CHECK_TYPES.map((item) => (
            <FilterChip
              key={item}
              label={item}
              selected={checkType === item}
              onPress={() => {
                setCheckType(item);
                resetResult();
              }}
            />
          ))}
        </ScrollView>
        <Text style={styles.guidanceText}>{typeGuide}</Text>
      </Section>

      <Section title="相手から来た文を貼る" subtitle="LINE・DM・メールの返信をそのまま貼ります。スクショや音声メモは、内容を雑に書けばOKです。">
        <TextInput
          value={messageText}
          onChangeText={(value) => {
            setMessageText(value);
            resetResult();
          }}
          placeholder="例：相手から「最近はリピート率が課題ですね。新規は来るけど続かないです」と返信が来た。"
          placeholderTextColor="#94A3B8"
          multiline
          textAlignVertical="top"
          style={styles.largeInput}
        />
        <View style={styles.messageToolRow}>
          <Pressable
            accessibilityLabel="ファイル添付"
            style={styles.messageToolButton}
            onPress={() => Alert.alert('ファイル添付', '初期UIでは見た目だけです。後でPDFや資料添付を追加します。')}
          >
            <Paperclip color="#0F172A" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="画像添付"
            style={styles.messageToolButton}
            onPress={() => Alert.alert('画像添付', '初期UIでは見た目だけです。後でスクショ読み取りを追加します。')}
          >
            <ImageIcon color="#0F172A" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="音声入力"
            style={styles.messageToolButton}
            onPress={() => Alert.alert('音声入力', '初期UIでは見た目だけです。後で音声メモ入力を追加します。')}
          >
            <Mic color="#0F172A" size={20} />
          </Pressable>
          <Pressable accessibilityLabel="その他" style={styles.messageToolButton} onPress={() => setToolMenuOpen(true)}>
            <MoreHorizontal color="#0F172A" size={22} />
          </Pressable>
        </View>
      </Section>

      <Modal visible={toolMenuOpen} transparent animationType="fade" onRequestClose={() => setToolMenuOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.personPickerSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>入力方法を選ぶ</Text>
                <Text style={styles.sheetSubcopy}>LINEやDMの内容を取り込む方法を選びます。</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setToolMenuOpen(false)}>
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </Pressable>
            </View>
            <Pressable style={styles.personSelectCard} onPress={() => Alert.alert('ファイル添付', '初期UIでは見た目だけです。')}>
              <Text style={styles.personSelectName}>ファイル添付</Text>
              <Text style={styles.personSelectMeta}>PDFや資料を文面チェックに使う想定です。</Text>
            </Pressable>
            <Pressable style={styles.personSelectCard} onPress={() => Alert.alert('画像添付', '初期UIでは見た目だけです。')}>
              <Text style={styles.personSelectName}>画像添付</Text>
              <Text style={styles.personSelectMeta}>LINEスクショやDMスクショを読み取る想定です。</Text>
            </Pressable>
            <Pressable style={styles.personSelectCard} onPress={() => Alert.alert('音声入力', '初期UIでは見た目だけです。')}>
              <Text style={styles.personSelectName}>音声入力</Text>
              <Text style={styles.personSelectMeta}>移動中のメモを音声で入れる想定です。</Text>
            </Pressable>
            <Pressable
              style={styles.personSelectCard}
              onPress={async () => {
                const clipboardText = await Clipboard.getStringAsync();
                setMessageText((current) => [current, clipboardText].filter(Boolean).join('\n'));
                resetResult();
                setToolMenuOpen(false);
              }}
            >
              <Text style={styles.personSelectName}>クリップボードから貼り付け</Text>
              <Text style={styles.personSelectMeta}>コピー済みのLINE文を入力欄へ追加します。</Text>
            </Pressable>
            <Pressable
              style={styles.personSelectCard}
              onPress={() => {
                setMessageText('');
                resetResult();
                setToolMenuOpen(false);
              }}
            >
              <Text style={styles.personSelectName}>入力をクリア</Text>
              <Text style={styles.personSelectMeta}>貼り付けた文面を消します。</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Section title="参照している人脈情報" subtitle="文面だけで判断せず、人脈カードの情報と合わせてナビを出します。">
        <View style={styles.referenceSummaryCard}>
          <Text style={styles.referenceSummaryTitle}>
            {selectedPerson?.name}｜{selectedPerson?.industry}
          </Text>
          <Text style={styles.referenceSummaryText}>分類：{selectedPerson?.categories.join(' / ')}</Text>
          <Text style={styles.referenceSummaryText}>現在のゴール：{selectedPerson?.goal}</Text>
          <Text style={styles.referenceSummaryText}>次アクション：{selectedPerson?.nextAction}</Text>
          <Text style={styles.referenceSummaryCaution}>注意点：{selectedPerson?.cautions}</Text>
        </View>
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryCta} onPress={() => onOpenPerson(selectedPerson?.id)}>
            <Text style={styles.secondaryCtaText}>人脈カードを見る</Text>
          </Pressable>
          <Pressable style={styles.secondaryCta} onPress={onAfter}>
            <Text style={styles.secondaryCtaText}>後メモを見る</Text>
          </Pressable>
        </View>
      </Section>

      <Pressable style={styles.fullPrimaryButton} onPress={checkMessage}>
        <Text style={styles.fullPrimaryText}>AIで返信と更新案を作る</Text>
      </Pressable>

      {hasChecked ? (
        <>
          <Section title="AIの結論" subtitle={`${selectedPerson?.name ?? '相手未選択'} / ${checkType}`}>
            <LineResultCard title="今どう返すか" body={analysis.judgement} />
            <LineResultCard title="返信文案" body={analysis.replyDraft} />
            <LineResultCard title="次にやること" body={`${analysis.nextAction}\n次回連絡：${analysis.nextContact}`} />
          </Section>

          <Section title="人脈カードに保存する内容" subtitle="この返信から営業データとして蓄積する項目です。">
            <LineResultCard title="保存される要点" body={analysis.cardUpdate} />
            <LineResultCard title="次に聞く質問" body={`${analysis.nextQuestion}\n\n目的：${analysis.questionPurpose}`} />
          </Section>

          <Section title="詳細分析" subtitle="必要な時だけ読む確認情報です。">
            <LineResultCard title="相手の温度感" body={`${analysis.temperature.label}\n理由：${analysis.temperature.reason}`} />
            <LineResultCard title="抽出された情報" body={analysis.extracted.map((item) => `・${item.label}：${item.value}`).join('\n')} />
            <LineResultCard title="注意点" body={analysis.caution} />
            <LineResultCard title="営業フィードバック" body={`良い点：${analysis.feedbackGood}\n改善点：${analysis.feedbackImprove}`} />
          </Section>

          <Section title="保存・連携" subtitle="分析した内容を人脈カード、後メモ、通知、営業コーチに流します。">
            <View style={styles.primaryActionStack}>
              <Pressable style={styles.primaryCtaWide} onPress={saveToPersonCard}>
                <Text style={styles.primaryCtaText}>人脈カードに保存</Text>
              </Pressable>
              <View style={styles.inlineActions}>
                <Pressable style={styles.secondaryCta} onPress={sendToAfterMemo}>
                  <Text style={styles.secondaryCtaText}>後メモに送る</Text>
                </Pressable>
                <Pressable style={styles.secondaryCta} onPress={() => setNotificationOpen(true)}>
                  <Text style={styles.secondaryCtaText}>次回通知</Text>
                </Pressable>
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.secondaryCta} onPress={copyReply}>
                  <Text style={styles.secondaryCtaText}>返信文をコピー</Text>
                </Pressable>
                <Pressable style={styles.secondaryCta} onPress={() => onCoach(analysis.coachPrompt)}>
                  <Text style={styles.secondaryCtaText}>コーチに相談</Text>
                </Pressable>
              </View>
            </View>
            {savedNotice ? <Text style={styles.successNotice}>人脈カードに保存しました</Text> : null}
            {copyNotice ? <Text style={styles.successNotice}>{copyNotice}</Text> : null}
          </Section>
        </>
      ) : (
        <Section title="分析結果">
          <Text style={styles.emptyText}>まだ文面が入力されていません。送る前の文、相手から来た返信、スクショメモ、音声メモを入れてください。</Text>
        </Section>
      )}

      <Section title="文面チェック履歴">
        <Route title="6月19日 / 山本さん / 受信文チェック" meta="要約：リピート率が課題という返信 / 状態：人脈カード保存済み / 次アクション：周辺経営者にも同じ課題があるか聞く" />
        <Route title="6月18日 / 田中さん / 紹介依頼文" meta="要約：美容業界の経営者を紹介してほしい相談 / 状態：未保存 / 次アクション：紹介依頼は延期して情報交換を優先" />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('履歴詳細', '文面チェック履歴の詳細を開く想定です。')}>
            <Text style={styles.secondaryCtaText}>詳細を見る</Text>
          </Pressable>
          <Pressable style={styles.secondaryCta} onPress={() => onOpenPerson(selectedPerson?.id)}>
            <Text style={styles.secondaryCtaText}>人脈カードを見る</Text>
          </Pressable>
        </View>
      </Section>

      <Modal visible={notificationOpen} transparent animationType="fade" onRequestClose={() => setNotificationOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.personPickerSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>次回通知を設定</Text>
                <Text style={styles.sheetSubcopy}>返信待ちや追客漏れを防ぐための通知です。</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setNotificationOpen(false)}>
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </Pressable>
            </View>
            {LINE_NOTICE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={styles.personSelectCard}
                onPress={() => {
                  setNotificationOpen(false);
                  Alert.alert('通知を設定しました', `${option} に通知する想定です。`);
                }}
              >
                <Text style={styles.personSelectName}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function LineResultCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.navSummaryCard}>
      <Text style={styles.referenceSummaryTitle}>{title}</Text>
      <Text style={styles.referenceSummaryText}>{body}</Text>
    </View>
  );
}

function LegacyLineCheckPane({
  personId,
  onAfter,
  onOpenPerson,
}: {
  personId?: string;
  onAfter: () => void;
  onOpenPerson: (personId?: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Section title="LINEチェック" subtitle="送信前チェックと、相手の返信から人脈カードへ情報を吸収します。">
        <Text style={styles.inputLabel}>LINE文・相手の発言</Text>
        <TextInput
          placeholder="送る文、相手から来た文、スクショ内容、音声入力メモなど"
          placeholderTextColor="#94A3B8"
          multiline
          textAlignVertical="top"
          style={styles.largeInput}
        />
      </Section>
      <Section title="チェック結果">
        <Info label="売り込み感" value="中。保険の話題はまだ出さない方が安全。" />
        <Info label="相手の温度感" value="中。返信意欲はあるが、商談化はまだ早い。" />
        <Info label="人脈カード更新案" value="情報源候補を強める。次回連絡日は3日後。" />
      </Section>
      <View style={styles.inlineActions}>
        <Pressable style={styles.primaryCta} onPress={() => onOpenPerson(personId)}>
          <Text style={styles.primaryCtaText}>人脈カードに保存</Text>
        </Pressable>
        <Pressable style={styles.secondaryCta} onPress={onAfter}>
          <Text style={styles.secondaryCtaText}>後メモに送る</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function EndOfDayPane({ onAfter, onHome }: { onAfter: () => void; onHome: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Section title="終業後チェック" subtitle="今日の営業データの漏れを確認し、明日のホームに返します。">
        <Route title="今日やったこと" meta="山本さんに初回LINE / 佐藤さんと情報交換" />
        <Route title="後メモ未入力" meta="佐藤さんの13:00情報交換後メモ" />
        <Route title="次回連絡日未設定" meta="2人" />
        <Route title="LINEチェックから保存されてない情報" meta="2件" />
      </Section>
      <Section title="AIフィードバック">
        <Info label="できたこと" value="初回連絡はできています。" />
        <Info label="足りないこと" value="会話後メモが足りず、次アクション設定が弱いです。" />
      </Section>
      <View style={styles.inlineActions}>
        <Pressable style={styles.secondaryCta} onPress={onAfter}>
          <Text style={styles.secondaryCtaText}>未入力メモを処理</Text>
        </Pressable>
        <Pressable style={styles.primaryCta} onPress={onHome}>
          <Text style={styles.primaryCtaText}>明日の営業地図を作る</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Info({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <View style={[styles.infoBlock, compact && styles.infoBlockCompact]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MemoField({
  label,
  value,
  onChangeText,
  placeholder,
  large,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  large?: boolean;
}) {
  return (
    <View style={styles.memoField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline
        textAlignVertical="top"
        style={large ? styles.largeInput : styles.compactInput}
      />
    </View>
  );
}

function Schedule({ time, title, purpose }: { time: string; title: string; purpose: string }) {
  return (
    <View style={styles.scheduleRow}>
      <Text style={styles.scheduleTime}>{time}</Text>
      <View style={styles.scheduleBody}>
        <Text style={styles.rowName}>{title}</Text>
        <Text style={styles.rowMeta}>目的：{purpose}</Text>
      </View>
    </View>
  );
}

function Route({ title, meta }: { title: string; meta: string }) {
  return (
    <View style={styles.routeRow}>
      <Text style={styles.rowName}>{title}</Text>
      <Text style={styles.rowMeta}>{meta}</Text>
    </View>
  );
}

function MiniButton({ label }: { label: string }) {
  return (
    <View style={styles.rowButton}>
      <Text style={styles.rowButtonText}>{label}</Text>
    </View>
  );
}

function dedupePeople(people: Person[]) {
  const unique = new Map<string, Person>();

  people.forEach((person) => {
    const key = [person.name, person.industry, person.relationship].map((value) => value.trim()).join('|');
    if (!unique.has(key)) {
      unique.set(key, person);
    }
  });

  return Array.from(unique.values());
}

function matchesLinePersonFilter(person: Person, filter: LinePersonFilter) {
  if (filter === '全員') return true;
  if (filter === '今日予定') return Boolean(person.nextContactAt) || person.name.includes('佐藤');
  if (filter === '最近やり取り') return person.name.includes('山本') || person.name.includes('田中') || Boolean(person.additionalMemo);
  if (filter === '次アクションあり') return Boolean(person.nextAction);
  if (filter === '返信待ち') return person.name.includes('山本') || person.nextAction.includes('返信');
  if (filter === '最近追加') {
    return Date.now() - new Date(person.createdAt).getTime() < 1000 * 60 * 60 * 24 * 14;
  }
  return true;
}

function getLinePersonStatus(person: Person) {
  if (person.name.includes('山本')) return '返信待ち';
  if (person.name.includes('田中')) return '情報交換中';
  if (person.name.includes('佐藤')) return '最近更新';
  return person.nextAction ? '次アクションあり' : '最近追加';
}

function getLineCheckTypeGuide(type: LineCheckType) {
  const guides: Record<LineCheckType, string> = {
    送信前チェック: '売り込み感、圧の強さ、返信しやすさ、相手メリットを確認します。',
    受信文チェック: '相手の返信から、課題・温度感・興味・次に聞く質問を抽出します。',
    返信作成: '相手の文脈と人脈カードを参照して、次につながる返信文を作ります。',
    スクショメモ: 'スクショから読み取った内容を雑に書いて、人脈カード更新案に変えます。',
    音声メモ: '移動中の音声メモを営業データに整理する想定です。',
    断り返信: '断り理由を抽出し、関係を切らさない次アクションを作ります。',
    紹介依頼文: '紹介依頼してよい段階か、依頼文が重すぎないかを確認します。',
    お礼文: '会った直後のお礼文から、次回接触と後メモにつながる文面を作ります。',
  };

  return guides[type];
}

function createLineCheckAnalysis(person: Person | undefined, checkType: LineCheckType, text: string) {
  const name = person?.name ?? '相手';
  const source = text || '相手から「最近はリピート率が課題ですね。新規は来るけど続かないです」と返信が来た。';
  const issue = inferLineIssue(source);
  const isRefusal = /断|不要|今は|難しい|また|検討|忙しい/.test(source) || checkType === '断り返信';
  const hasReferralSignal = /紹介|知人|経営者|周り|つな|繋/.test(source);
  const hasConcretePain = /課題|困|悩|大変|リピート|採用|集客|広告|固定費|売上/.test(source);
  const isBeforeSend = checkType === '送信前チェック' || checkType === '紹介依頼文' || checkType === 'お礼文';
  const temperatureLabel = isRefusal ? '低い〜普通' : hasConcretePain ? '普通〜やや高い' : '普通';
  const proposalReadiness = hasConcretePain && !isBeforeSend && !isRefusal ? '商品提案はまだ早い。課題の深掘りと情報提供を優先。' : '今は提案より関係維持と確認が安全。';
  const nextQuestion = createLineNextQuestion(issue, person, hasReferralSignal);
  const replyDraft = createLineReplyDraft(name, issue, isRefusal, hasReferralSignal);
  const categoryUpdate = [
    `顧客候補：${hasConcretePain ? '中' : '低〜中'}`,
    `将来候補：${isRefusal ? '中' : '高'}`,
    `情報源候補：${hasReferralSignal ? '高' : '中'}`,
  ].join('\n');
  const nextAction = isRefusal
    ? '断り理由を保存し、1週間後に負担の軽い情報提供で再接触する'
    : `返信後、${issue.shortLabel}について本人と周辺人脈の両方を深掘りする`;

  return {
    judgement: isBeforeSend
      ? '送信前の文面は、相手の状況確認を先に置くと安全です。売り込み感を抑え、返信しやすい一問に絞ってください。'
      : `この返信は${hasConcretePain ? '前向きな材料があります' : '会話継続の余地があります'}。ただし、今すぐ商品提案ではなく、課題の深掘りと情報提供を優先してください。`,
    temperature: {
      label: temperatureLabel,
      reason: hasConcretePain
        ? '自分の課題を具体的に話しているため、会話継続の余地があります。ただし商品への興味ではなく、経営課題への関心です。'
        : isRefusal
          ? '明確な前進サインは弱いですが、断り理由を保存すれば次回の接点設計に使えます。'
          : '温度感はまだ判断途中です。次の一問で課題の具体度を確認する必要があります。',
    },
    extracted: [
      { label: '課題', value: issue.label },
      { label: '状況', value: issue.situation },
      { label: '興味', value: issue.interest },
      { label: '断り理由', value: isRefusal ? '今すぐ進める負担、またはタイミングの問題がある可能性' : '現時点では明確な断りなし' },
      { label: '現時点の提案可否', value: proposalReadiness },
      { label: '人脈価値', value: hasReferralSignal ? '周辺経営者や知人情報を取れる可能性あり' : '周辺人脈にも同じ課題があるか確認が必要' },
    ],
    nextQuestion,
    questionPurpose: '本人だけでなく、周辺人脈にも同じ課題があるか確認し、紹介元・情報源としての価値を判断する。',
    replyDraft,
    cardUpdate: [
      '追加する情報：',
      `・課題：${issue.label}`,
      `・関心：${issue.interest}`,
      `・温度感：${temperatureLabel}`,
      `・注意点：${proposalReadiness}`,
      `・次回の切り口：${issue.shortLabel}と周辺人脈の課題`,
      '',
      '分類更新案：',
      categoryUpdate,
    ].join('\n'),
    categoryUpdate,
    nextAction,
    nextContact: isRefusal ? '1週間後 9:00' : '返信待ち / 返信がなければ3日後 9:00',
    caution: isRefusal
      ? '断られた直後に説得すると負担が増えます。まず理由を保存し、軽い情報提供で接点を残してください。'
      : 'ここで保険や商品提案に進むと早すぎる可能性があります。まずは相手の課題を深掘りし、情報提供できる関係を作ってください。',
    feedbackGood: hasConcretePain ? '相手の課題を引き出せています。' : '会話を営業データとして残す流れを作れています。',
    feedbackImprove: '次は本人の課題だけでなく、周辺人脈にも同じ課題があるか聞くと、紹介元・情報源としての価値を判断しやすくなります。',
    coachPrompt: `${name}から${issue.shortLabel}に関する返信が来ました。今すぐ提案するのではなく、課題を深掘りして関係を温めたいです。次にどう返信するべきか相談したいです。`,
  };
}

function inferLineIssue(text: string) {
  if (/リピート|継続|再来|続か/.test(text)) {
    return {
      label: 'リピート率',
      shortLabel: 'リピート率',
      situation: '新規は来るが継続率が低い',
      interest: '再来店施策、SNS運用、店舗改善',
    };
  }
  if (/採用|スタッフ|人材|定着/.test(text)) {
    return {
      label: '採用・スタッフ定着',
      shortLabel: '採用課題',
      situation: '人手不足やスタッフ定着に悩んでいる可能性',
      interest: '採用導線、定着施策、経営者同士の情報交換',
    };
  }
  if (/集客|広告|SNS|新規/.test(text)) {
    return {
      label: '集客・広告費',
      shortLabel: '集客課題',
      situation: '新規獲得や広告費の効率に課題がある可能性',
      interest: 'SNS運用、紹介導線、広告費改善',
    };
  }
  if (/固定費|経費|コスト|家賃/.test(text)) {
    return {
      label: '固定費・経費',
      shortLabel: '固定費',
      situation: '店舗運営コストの見直し余地がある可能性',
      interest: '固定費削減、経営改善、資金繰り',
    };
  }
  return {
    label: '経営課題',
    shortLabel: '経営課題',
    situation: '課題の具体度はまだ不足',
    interest: '情報交換、課題整理、周辺人脈の状況確認',
  };
}

function createLineNextQuestion(issue: ReturnType<typeof inferLineIssue>, person: Person | undefined, hasReferralSignal: boolean) {
  if (hasReferralSignal) {
    return `${person?.industry ?? '同じ業界'}の周りの方も、${issue.shortLabel}で悩んでいる方は多いですか？`;
  }
  return `周りの${person?.industry ?? '経営者'}さんも、${issue.shortLabel}で悩んでいる方は多いですか？`;
}

function createLineReplyDraft(name: string, issue: ReturnType<typeof inferLineIssue>, isRefusal: boolean, hasReferralSignal: boolean) {
  if (isRefusal) {
    return `${name}さん、ありがとうございます。今すぐ進める話ではなくて大丈夫です。ちなみに今後の参考までに、今はタイミングの問題なのか、内容自体が少し違う感じなのかだけ軽く教えてもらえますか？`;
  }

  const relationQuestion = hasReferralSignal
    ? `ちなみに周りの方も、${issue.shortLabel}で悩んでいる方は多いですか？`
    : `ちなみに周りの経営者さんも、${issue.shortLabel}で悩んでいる方は多いですか？`;

  return `${name}さん、ありがとうございます。${issue.situation}というのは、かなり大きい課題ですね。${relationQuestion}`;
}

function getActionGuidance(actionType: string) {
  const guidance: Record<string, string> = {
    初回連絡前: '売らずに関係開始と課題確認を優先します。',
    商談前: '目的・質問・クロージング可否を整理します。',
    電話前: '短時間で聞くことを絞り、次の接点を決めます。',
    LINE前: '圧を弱め、返信しやすい文面にします。',
    情報交換前: '業界課題と人脈の広がりを聞きます。',
    追客前: '軽い接触で関係を切らさない文面を作ります。',
    紹介依頼前: '紹介依頼してよい段階か、先に価値提供が必要かを見ます。',
    関係構築前: '売り込みより、相手理解と信頼形成を優先します。',
  };

  return guidance[actionType] ?? '今日の目的に合わせて、聞くことと避けることを整理します。';
}

function createPreMeetingNavigation(person: Person | undefined, actionType: string) {
  const name = person?.name ?? '田中さん';
  const industry = person?.industry ?? '美容サロン経営';
  const categories = person?.categories.join('・') ?? '紹介元候補・情報源候補';
  const isReferralRequest = actionType === '紹介依頼前';
  const isLine = actionType === 'LINE前' || actionType === '初回連絡前';

  const questions = [
    `最近、${industry}の方って、集客と採用だとどちらで悩んでいる方が多いですか？`,
    `${name}の周りの経営者さんも、同じような悩みを持っている方は多いですか？`,
    'そういう経営者さんって、今どんな人と繋がれると助かりそうですか？',
  ];

  return {
    purpose: `${industry}の課題を聞き、この人が${categories}として進められるか判断する。`,
    destination: isReferralRequest
      ? '紹介依頼してよい段階かを確認する。早ければ、先に情報提供や人の紹介へ切り替える。'
      : '紹介依頼まではしない。まず周辺課題と人脈の有無を確認する。',
    policy: isLine
      ? '短く、返信しやすく、相手の負担が少ない聞き方にする。'
      : '売り込みではなく、相手の業界理解と情報交換を優先する。',
    opening: `最近の${industry}まわりでは、集客・採用・人材定着のどこが重いのかを聞く。`,
    questions,
    deepQuestions: [
      'その悩みって、ここ最近強くなっている感じですか？',
      '周りで特に困っている方はいますか？',
      '逆に、最近うまくいっている人は何が違うと思いますか？',
    ],
    ngActions: [
      'いきなり保険や商品への興味を聞く',
      'すぐに誰か紹介してほしいと頼む',
      '相手の状況を聞かずに商品説明を始める',
    ],
    sellOrAsk: '今日は聞く日。本人への提案や紹介依頼はまだ早い。',
    referralTiming: isReferralRequest
      ? '依頼前に、相手が紹介するメリットと紹介先の条件を確認する。負担が大きそうなら延期する。'
      : 'まだ早い。まずは情報交換をして、相手にとって話すメリットを作る。紹介依頼は2回目以降が安全。',
    recordItems: [
      '採用と集客のどちらが課題か',
      '周りの経営者にも同じ悩みがあるか',
      '紹介できそうな人がいるか',
      `${name}本人の温度感`,
      '次回連絡してよいタイミング',
      'こちらから価値提供できそうな情報',
    ],
    evidence: [
      'いきなり売ると心理的リアクタンスが起きやすい',
      '質問を絞ると相手の認知負荷が下がり、答えやすくなる',
      '先に情報交換や価値提供を挟むと、返報性が働きやすくなる',
      '紹介依頼は相手の信用を使う行為なので、信頼形成前に頼むと負担が大きい',
    ],
    coachPrompt: `${name}との${actionType}です。今日の目的は、${industry}の課題を聞いて、${categories}として進められるか判断することです。今日の質問や進め方が適切か確認してください。`,
  };
}

function createAfterMemoQuestions(person?: Person) {
  const industry = person?.industry ?? '相手の業界';

  return [
    `最近、${industry}では集客・採用・固定費のどこが一番重いですか？`,
    '周りの経営者さんも、同じような悩みを持っていますか？',
    '今後どんな人と繋がれると助かりそうですか？',
  ];
}

function createAfterMemoSuggestion({
  person,
  answers,
  talkMemo,
  allInfoMemo,
  nextTodo,
}: {
  person?: Person;
  answers: Record<string, string>;
  talkMemo: string;
  allInfoMemo: string;
  nextTodo: string;
}): AfterMemoAiSuggestion {
  const name = person?.name ?? 'この人';
  const sourceText = [Object.values(answers).join('\n'), talkMemo, allInfoMemo, nextTodo].join('\n');
  const inferredPain = inferPain(sourceText);
  const inferredTemperature = inferTemperature(sourceText);
  const inferredNextTiming = inferNextTiming(sourceText, inferredTemperature);
  const hasReferralSignal = /紹介|知人|経営者|人脈|つな|繋|周り|サロン|不動産|士業/.test(sourceText);
  const hasDecisionSignal = /決裁|社長|オーナー|代表|予算|いつまで|期限|来月|今月/.test(sourceText);
  const categoryUpdate =
    inferredTemperature === '高' || hasReferralSignal
      ? '紹介元候補 / 情報源候補を強める。顧客候補は会話内容を見て保留。'
      : '情報源候補を維持。紹介依頼は急がず、関係構築を優先。';
  const goal = hasReferralSignal
    ? '相互紹介の可能性を見ながら、情報交換を継続する。'
    : `${person?.industry ?? '相手業界'}の課題理解を深め、次回連絡で関係を温める。`;
  const nextAction = nextTodo || `${inferredNextTiming}に、会話で出た課題に関する情報を1つ送る。`;
  const nextQuestion = inferredPain
    ? `${inferredPain}について、周りでも同じ悩みが出ているか確認する。`
    : '周りの経営者にも同じ悩みがあるか確認する。';

  return {
    categoryUpdate,
    goal,
    nextAction,
    nextContact: inferredNextTiming,
    feedback: `${name}との会話は、売り込みよりも課題確認を優先する段階です。AI推定の温度感は「${inferredTemperature}」。${hasDecisionSignal ? '決裁者・期限・予算の話が出ているため、次回は具体条件を確認できます。' : '決裁者・期限・予算はまだ薄いので、次回は聞き漏れを埋めるのが安全です。'}`,
    nextQuestion,
    lineMessage: `${name}さん、今日はありがとうございました。お話に出ていた${inferredPain || '課題'}の件、こちらでも少し参考になりそうな情報を探してみます。また共有します。`,
    accumulation: [
      inferredPain ? `AI抽出課題：${inferredPain}` : 'AI抽出課題：未確定',
      `AI推定温度感：${inferredTemperature}`,
      `紹介可能性：${hasReferralSignal ? 'ありそう' : '未確定'}`,
      `決裁・期限・予算情報：${hasDecisionSignal ? '一部あり' : '未確認'}`,
      `次回連絡：${inferredNextTiming}`,
    ].join('\n'),
  };
}

function inferPain(text: string) {
  if (/採用|人材|スタッフ|定着/.test(text)) return '採用・人材定着';
  if (/集客|客|広告|SNS|紹介/.test(text)) return '集客・見込み客獲得';
  if (/固定費|コスト|経費|家賃|保険/.test(text)) return '固定費・コスト';
  if (/資金|売上|利益|単価/.test(text)) return '売上・資金繰り';
  if (/人脈|つな|繋|紹介/.test(text)) return '人脈・紹介先';
  return '';
}

function inferTemperature(text: string) {
  if (/ぜひ|お願い|紹介して|会いたい|詳しく|前向き|興味/.test(text)) return '高';
  if (/検討|また|情報|参考|聞きたい|困って/.test(text)) return '中';
  if (/忙しい|今は|不要|断|興味ない|難しい/.test(text)) return '低';
  return '中';
}

function inferNextTiming(text: string, temperature: string) {
  if (/明日|至急|急ぎ|すぐ/.test(text)) return '明日 9:00';
  if (/来週|一週間|1週間/.test(text)) return '1週間後 9:00';
  if (temperature === '高') return '明日 9:00';
  if (temperature === '低') return '1週間後 9:00';
  return '3日後 9:00';
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
      question: '整体院の経営で、最近いちばん負担に感じる固定費は何ですか？',
      message: '山本さん、先日はご紹介でありがとうございました。',
    },
    {
      id: 'action-tanaka',
      priority: '重要',
      personName: tanaka?.name ?? '田中さん',
      personId: tanaka?.id ?? 'mock-tanaka',
      actionType: '情報交換',
      shortReason: '美容業界の紹介元候補。紹介依頼前に課題を聞く',
      todayTodo: '採用・集客の悩みを聞く',
      purpose: '美容業界の経営者人脈を確認する',
      question: '美容系の経営者さんって、最近は集客より採用の方が大変だったりしますか？',
      message: '田中さん、先日はありがとうございました。',
    },
    {
      id: 'action-sato',
      priority: '予定あり',
      personName: sato?.name ?? '佐藤さん',
      personId: sato?.id ?? 'mock-sato',
      actionType: '会う前準備',
      shortReason: '今日13時に情報交換予定',
      todayTodo: '不動産顧客層の動きを聞く準備',
      purpose: '不動産顧客層の動きを聞く',
      question: '最近、不動産を検討する方って、投資目的と自宅目的だとどちらが多いですか？',
      message: '佐藤さん、本日13時よろしくお願いします。',
    },
  ];
}

function findPerson(people: Person[], keyword: string, fallbackId: string) {
  return people.find((person) => person.name.includes(keyword)) ?? people.find((person) => person.id === fallbackId);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  headerText: { flex: 1, paddingRight: 10 },
  screenName: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  appName: { color: '#0F172A', fontSize: 24, fontWeight: '900', marginTop: 2 },
  dateText: { color: '#153E75', fontSize: 14, fontWeight: '900', marginTop: 2 },
  subcopy: { color: '#64748B', fontSize: 13, fontWeight: '800', marginTop: 4 },
  updatedNotice: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  headerActions: { flexDirection: 'row', gap: 7 },
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
  iconButtonDark: { alignItems: 'center', backgroundColor: '#153E75', borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  content: { paddingBottom: 172 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', lineHeight: 19, marginTop: 4 },
  sectionBody: { marginTop: 10 },
  infoBlock: { marginBottom: 9 },
  infoBlockCompact: { marginBottom: 7 },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  infoValue: { color: '#0F172A', lineHeight: 20, marginTop: 2 },
  priorityRow: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 9,
    padding: 12,
  },
  priorityHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
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
  rowName: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  actionType: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  shortReason: { color: '#334155', lineHeight: 20 },
  todoLine: { color: '#153E75', fontWeight: '900', lineHeight: 20, marginTop: 4 },
  rowButtons: { flexDirection: 'row', gap: 8, marginTop: 10 },
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
  rowButtonText: { color: '#153E75', fontSize: 12, fontWeight: '900' },
  scheduleRow: { alignItems: 'flex-start', borderBottomColor: '#E2E8F0', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 10 },
  scheduleTime: { color: '#153E75', fontSize: 15, fontWeight: '900', width: 52 },
  scheduleBody: { flex: 1 },
  rowMeta: { color: '#64748B', lineHeight: 19, marginTop: 2 },
  routeRow: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, marginBottom: 8, padding: 12 },
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
  searchInput: { color: '#0F172A', flex: 1, fontSize: 15 },
  filterTitle: { color: '#334155', fontSize: 13, fontWeight: '900', marginBottom: 8, marginTop: 14 },
  filterRow: { flexGrow: 0 },
  summary: { marginBottom: 8, marginTop: 16 },
  summaryText: { color: '#64748B', fontWeight: '900' },
  empty: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, marginTop: 8, padding: 20 },
  emptyTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#64748B', lineHeight: 20, marginTop: 8 },
  emptyButton: { alignItems: 'center', backgroundColor: '#153E75', borderRadius: 8, justifyContent: 'center', marginTop: 14, minHeight: 46 },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '900' },
  inputLabel: { color: '#64748B', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  compactInput: {
    minHeight: 76,
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    lineHeight: 20,
    padding: 10,
  },
  largeInput: {
    minHeight: 132,
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    lineHeight: 22,
    padding: 12,
  },
  messageToolRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  messageToolButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  questionBlock: { marginBottom: 12 },
  questionText: { color: '#153E75', fontWeight: '900', lineHeight: 20, marginBottom: 6 },
  memoField: { marginBottom: 12 },
  afterContextCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  afterContextTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  afterContextMeta: { color: '#475569', fontWeight: '800', marginTop: 4 },
  afterContextFocus: { color: '#153E75', fontWeight: '900', lineHeight: 20, marginTop: 7 },
  aiExtractHintCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  aiExtractTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  aiExtractText: { color: '#475569', lineHeight: 20, marginTop: 6 },
  inlineActions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  primaryCta: {
    alignItems: 'center',
    backgroundColor: '#153E75',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryCtaText: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  secondaryCta: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  secondaryCtaText: { color: '#153E75', fontWeight: '900', textAlign: 'center' },
  paneHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paneHeaderText: { flex: 1, paddingRight: 10 },
  paneTitle: { color: '#0F172A', fontSize: 22, fontWeight: '900' },
  paneSubcopy: { color: '#64748B', fontWeight: '800', lineHeight: 20, marginTop: 3 },
  paneHeaderActions: { flexDirection: 'row', gap: 8 },
  smallOutlineButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  smallOutlineText: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
  personSelectCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 9,
    padding: 12,
  },
  personSelectCardActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0F172A',
  },
  personSelectTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  personSelectName: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  selectedMark: {
    backgroundColor: '#0F172A',
    borderRadius: 999,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  personSelectMeta: { color: '#475569', fontWeight: '800', marginTop: 5 },
  personSelectTags: { color: '#153E75', fontSize: 12, fontWeight: '900', marginTop: 7 },
  personSelectAction: { color: '#334155', lineHeight: 20, marginTop: 5 },
  selectedPersonSummary: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    marginTop: 10,
    padding: 12,
  },
  selectedSummaryLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '900' },
  selectedSummaryName: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 3 },
  selectedSummaryMeta: { color: '#E2E8F0', fontWeight: '800', marginTop: 4 },
  selectedSummaryAction: { color: '#FFFFFF', lineHeight: 20, marginTop: 7 },
  changePersonButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 46,
  },
  changePersonText: { color: '#0F172A', fontWeight: '900' },
  resultHint: { color: '#64748B', fontSize: 12, fontWeight: '900', marginTop: 12, marginBottom: 7 },
  sheetBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  personPickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '82%',
    padding: 16,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  sheetSubcopy: { color: '#64748B', fontWeight: '800', lineHeight: 19, marginTop: 3 },
  sheetCloseButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  sheetCloseText: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
  personPickerList: { maxHeight: 430 },
  emptyPickerState: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  guidanceText: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#334155',
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 10,
    padding: 10,
  },
  referenceSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  referenceSummaryTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  referenceSummaryText: { color: '#334155', lineHeight: 20, marginTop: 5 },
  referenceSummaryCaution: { color: '#B45309', fontWeight: '900', lineHeight: 20, marginTop: 6 },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 10,
    minHeight: 42,
  },
  toggleText: { color: '#0F172A', fontWeight: '900' },
  referenceGrid: {
    columnGap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  navSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  questionPreview: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  questionPreviewTitle: { color: '#0F172A', fontWeight: '900', marginBottom: 6 },
  questionPreviewText: { color: '#153E75', fontWeight: '900', lineHeight: 21, marginTop: 4 },
  fullPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#153E75',
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 52,
  },
  fullPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  primaryActionStack: { gap: 10, marginTop: 4 },
  primaryCtaWide: {
    alignItems: 'center',
    backgroundColor: '#153E75',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  moreActionPanel: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    padding: 10,
  },
  successNotice: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  bottomNav: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 82,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 16,
    paddingHorizontal: 4,
    paddingVertical: 7,
    position: 'absolute',
    right: 16,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  navIconButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 36,
  },
  navIconButtonActive: { backgroundColor: '#F1F5F9' },
  navLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 3,
  },
  navLabelActive: { color: '#0F172A' },
  floatingActions: { bottom: 18, flexDirection: 'row', gap: 10, left: 16, position: 'absolute', right: 16 },
  floatingButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  coachButton: { backgroundColor: '#EAF2FF', borderColor: '#B8D4FF', borderWidth: 1 },
  addButton: { backgroundColor: '#153E75' },
  coachButtonText: { color: '#153E75', fontWeight: '900' },
  addButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
});
