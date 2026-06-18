import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, Bot, Plus, RefreshCw, Search, UserPlus } from 'lucide-react-native';
import FilterChip from '../components/FilterChip';
import PersonCard from '../components/PersonCard';
import { MOCK_PEOPLE } from '../data/mockPeople';
import { getPeople, savePeople } from '../storage/personStorage';
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

const NAV_ITEMS: Array<{ tab: MainTab; icon: string; hint: string }> = [
  { tab: 'home', icon: '🏠', hint: 'ホーム' },
  { tab: 'people', icon: '👥', hint: '人脈カード' },
  { tab: 'pre', icon: '🧭', hint: '予定前ナビ' },
  { tab: 'after', icon: '📝', hint: '後メモ' },
  { tab: 'line', icon: '💬', hint: 'LINEチェック' },
  { tab: 'end', icon: '🌙', hint: '終業後チェック' },
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
          <PreMeetingPane action={actions[0]} onAfter={() => setActiveTab('after')} onOpenPerson={openPerson} />
        ) : activeTab === 'after' ? (
          <AfterMemoPane personId={actions[0]?.personId} onLine={() => setActiveTab('line')} onEnd={() => setActiveTab('end')} onOpenPerson={openPerson} />
        ) : activeTab === 'line' ? (
          <LineCheckPane personId={actions[0]?.personId} onAfter={() => setActiveTab('after')} onOpenPerson={openPerson} />
        ) : (
          <EndOfDayPane onAfter={() => setActiveTab('after')} onHome={() => setActiveTab('home')} />
        )}

        <View style={styles.bottomNav}>
          {NAV_ITEMS.map((item) => (
            <Pressable
              key={item.tab}
              accessibilityLabel={item.hint}
              style={[styles.navIconButton, activeTab === item.tab && styles.navIconButtonActive]}
              onPress={() => setActiveTab(item.tab)}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              {activeTab === item.tab ? <View style={styles.navDot} /> : null}
            </Pressable>
          ))}
        </View>

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
  action,
  onAfter,
  onOpenPerson,
}: {
  action?: TodayAction;
  onAfter: () => void;
  onOpenPerson: (personId?: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Section title="予定前ナビ" subtitle="人脈カード・過去メモ・LINE情報を参照して、今日の質問を決めます。">
        <Info label="今日会う人" value={action?.personName ?? '山本さん'} />
        <Info label="目的" value={action?.actionType ?? '初回接触'} />
        <Text style={styles.inputLabel}>追加メモ</Text>
        <TextInput
          placeholder="今日聞きたいこと、相手の返信、紹介者情報など"
          placeholderTextColor="#94A3B8"
          multiline
          textAlignVertical="top"
          style={styles.compactInput}
        />
      </Section>
      <Section title="今日のナビ">
        <Info label="今日の目的" value={action?.purpose ?? '相手の課題と次の接点を明確にする'} />
        <Info label="聞くべき質問" value="最近、採用と集客どちらが大変ですか？\n周りの経営者も同じ悩みを持っていますか？" />
        <Info label="売るべきか、聞くべきか" value="今日は売るより聞く。情報交換を優先する。" />
      </Section>
      <View style={styles.inlineActions}>
        <Pressable style={styles.secondaryCta} onPress={() => onOpenPerson(action?.personId)}>
          <Text style={styles.secondaryCtaText}>人脈カードを見る</Text>
        </Pressable>
        <Pressable style={styles.primaryCta} onPress={onAfter}>
          <Text style={styles.primaryCtaText}>後メモへ進む</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AfterMemoPane({
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

function LineCheckPane({
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
  questionBlock: { marginBottom: 12 },
  questionText: { color: '#153E75', fontWeight: '900', lineHeight: 20, marginBottom: 6 },
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
  bottomNav: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 82,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
    left: 16,
    padding: 6,
    position: 'absolute',
    right: 16,
  },
  navIconButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  navIconButtonActive: { backgroundColor: '#EAF2FF' },
  navIcon: { fontSize: 22 },
  navDot: { backgroundColor: '#153E75', borderRadius: 999, height: 4, marginTop: 2, width: 16 },
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
