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
import { Bell, Bot, CheckCircle2, Clock3, Eye, Plus, Search, UserPlus } from 'lucide-react-native';
import FilterChip from '../components/FilterChip';
import PersonCard from '../components/PersonCard';
import { MOCK_PEOPLE } from '../data/mockPeople';
import { getPeople, savePeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person, PersonCategory } from '../types/person';

type MainTab = 'home' | 'people';
type SortMode = 'priority' | 'nextContact' | 'newest' | 'referrer';

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

export default function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'すべて' | PersonCategory>('すべて');
  const [industry, setIndustry] = useState('すべて');
  const [sortMode, setSortMode] = useState<SortMode>('priority');

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

  const sortedPeople = useMemo(() => {
    return [...people].sort((a, b) => sortPeople(a, b, 'priority'));
  }, [people]);

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

  const openNotificationMock = () => {
    Alert.alert(
      '通知・次回連絡予定',
      '田中さん: 6月21日 9:00\n山本さん: 6月22日 10:00\n佐藤さん: 未設定',
    );
  };

  const openPerson = (person?: Person) => {
    if (person) {
      navigation.navigate('PersonDetail', { personId: person.id });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.appName}>紹介営業マップAI</Text>
            <Text style={styles.subcopy}>今日の紹介機会を逃さない</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={openNotificationMock}>
              <Bell color="#153E75" size={20} />
            </Pressable>
            <Pressable style={styles.iconButtonDark} onPress={() => navigation.navigate('AddPerson')}>
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
            people={sortedPeople}
            onOpenPerson={openPerson}
            onShowPeople={() => setActiveTab('people')}
            onOpenCoach={() => navigation.navigate('CoachChat')}
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
            onOpenPerson={openPerson}
            onAddPerson={() => navigation.navigate('AddPerson')}
          />
        )}

        <View style={styles.floatingActions}>
          <Pressable style={[styles.floatingButton, styles.coachButton]} onPress={() => navigation.navigate('CoachChat')}>
            <Bot color="#153E75" size={20} />
            <Text style={styles.coachButtonText}>営業コーチ</Text>
          </Pressable>
          <Pressable style={[styles.floatingButton, styles.addButton]} onPress={() => navigation.navigate('AddPerson')}>
            <Plus color="#FFFFFF" size={20} />
            <Text style={styles.addButtonText}>人物追加</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function HomePane({
  people,
  onOpenPerson,
  onShowPeople,
  onOpenCoach,
}: {
  people: Person[];
  onOpenPerson: (person?: Person) => void;
  onShowPeople: () => void;
  onOpenCoach: () => void;
}) {
  const tanaka = people.find((person) => person.name.includes('田中')) ?? people[0];
  const yamamoto = people.find((person) => person.name.includes('山本')) ?? people[1];
  const sato = people.find((person) => person.name.includes('佐藤')) ?? people[2];

  return (
    <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.scoreGrid}>
        <ScoreCard label="今日連絡すべき人" value="3人" tone="blue" />
        <ScoreCard label="放置中の人脈" value="5人" tone="amber" />
        <ScoreCard label="紹介チャンス" value="2件" tone="green" />
        <ScoreCard label="未整理メモ" value="1件" tone="purple" />
      </View>

      <Section title="今日の必達アクション" subtitle="朝と移動中にここだけ見れば、今日の動きが決まります。">
        <ActionCard
          person={tanaka}
          label="紹介元候補"
          purpose="美容業界の人脈を確認する"
          reason="前回接触から3日。関係が冷める前に軽く接触すべき。"
          todo="近況LINEを送り、美容業界の採用課題を聞く"
          question="美容系の経営者さんって、最近は集客より採用の方が大変だったりしますか？"
          onOpenPerson={onOpenPerson}
        />
        <ActionCard
          person={yamamoto}
          label="顧客候補"
          purpose="健康経営や固定費の悩みを確認する"
          reason="紹介直後は記憶が残っているため、情報提供の入口を作りやすい。"
          todo="売り込みではなく、整体院経営で負担になっている固定費を聞く"
          question="最近、院の経営で一番見直したい固定費は何ですか？"
          onOpenPerson={onOpenPerson}
        />
      </Section>

      <Section title="機会損失アラート" subtitle="紹介営業で取りこぼしやすい穴を先に塞ぎます。">
        <AlertRow title="紹介されたが分類していない人" count="2人" onPress={onShowPeople} />
        <AlertRow title="次アクション未設定" count="3人" onPress={onShowPeople} />
        <AlertRow title="紹介元候補なのに紹介依頼ルート未作成" count="2人" onPress={onShowPeople} />
        <AlertRow title="将来候補なのに追客日未設定" count="4人" onPress={onShowPeople} />
        <AlertRow title="情報源候補なのに質問が未設定" count="1人" onPress={onShowPeople} />
      </Section>

      <Section title="紹介チャンス" subtitle="誰に聞くか、誰をつなぐかを地図のように見ます。">
        <ChanceCard
          title="紹介依頼できそうな人"
          name="田中さん"
          body="美容業界の経営者人脈を持っている可能性。"
          onPress={() => onOpenPerson(tanaka)}
        />
        <ChanceCard
          title="誰かに紹介すると関係が深まりそうな人"
          name="山本さん"
          body="採用に困っているため、人材系の知人と繋げる余地あり。"
          onPress={() => onOpenPerson(yamamoto)}
        />
        <ChanceCard
          title="情報源として聞くべき人"
          name="佐藤さん"
          body="不動産営業。資産形成層の動きを聞ける可能性。"
          onPress={() => onOpenPerson(sato)}
        />
      </Section>

      <Section title="会話前ナビ" subtitle="初回面談・交流会・紹介前に見る切り口です。">
        <InfoBlock label="次に会う人" value="美容サロン経営者" />
        <InfoBlock label="おすすめの切り口" value="採用・集客・スタッフ定着" />
        <InfoBlock label="最初の質問" value="最近、美容系って集客より採用の方が大変だったりします？" />
        <InfoBlock label="注意点" value="いきなり保険の話をしない。まず業界課題を聞く。" />
      </Section>

      <Section title="未整理メモ" subtitle="入力は軽く、整理はあとで。">
        <Text style={styles.bodyText}>昨日の交流会メモが1件あります</Text>
        <Text style={styles.bodyText}>最近追加した人：田中さん、山本さん、佐藤さん</Text>
        <Pressable style={styles.secondaryCta} onPress={onShowPeople}>
          <Text style={styles.secondaryCtaText}>AIで整理する</Text>
        </Pressable>
      </Section>

      <Section title="営業コーチからの一言" subtitle="行動の偏りを、次の一手に変えます。">
        <InfoBlock
          label="今週の傾向"
          value="初回接触は増えていますが、紹介依頼まで進める人数が少ないです。"
        />
        <InfoBlock
          label="今日の改善アクション"
          value="紹介元候補の中から1人だけ、情報交換のLINEを送りましょう。"
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
              <FilterChip
                key={item}
                label={item}
                selected={category === item}
                onPress={() => onChangeCategory(item)}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterTitle}>業種</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {INDUSTRIES.map((item) => (
              <FilterChip
                key={item}
                label={item}
                selected={industry === item}
                onPress={() => onChangeIndustry(item)}
              />
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

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ScoreCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'amber' | 'green' | 'purple' }) {
  return (
    <View style={[styles.scoreCard, styles[`score_${tone}`]]}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

function ActionCard({
  person,
  label,
  purpose,
  reason,
  todo,
  question,
  onOpenPerson,
}: {
  person?: Person;
  label: string;
  purpose: string;
  reason: string;
  todo: string;
  question: string;
  onOpenPerson: (person?: Person) => void;
}) {
  return (
    <Pressable style={styles.actionCard} onPress={() => onOpenPerson(person)}>
      <Text style={styles.actionTitle}>
        {person?.name ?? '対象人物'}｜{label}
      </Text>
      <InfoBlock label="目的" value={purpose} />
      <InfoBlock label="なぜ今" value={reason} />
      <InfoBlock label="今日やること" value={todo} />
      <InfoBlock label="次に聞く質問" value={question} />
      <View style={styles.actionButtons}>
        <SmallButton icon={<Eye color="#153E75" size={14} />} label="LINE文を見る" />
        <SmallButton icon={<CheckCircle2 color="#166534" size={14} />} label="完了" />
        <SmallButton icon={<Clock3 color="#92400E" size={14} />} label="延期" />
      </View>
    </Pressable>
  );
}

function AlertRow({ title, count, onPress }: { title: string; count: string; onPress: () => void }) {
  return (
    <Pressable style={styles.alertRow} onPress={onPress}>
      <Text style={styles.alertTitle}>{title}</Text>
      <Text style={styles.alertCount}>{count}</Text>
    </Pressable>
  );
}

function ChanceCard({ title, name, body, onPress }: { title: string; name: string; body: string; onPress: () => void }) {
  return (
    <Pressable style={styles.chanceCard} onPress={onPress}>
      <Text style={styles.chanceTitle}>{title}</Text>
      <Text style={styles.chanceName}>{name}</Text>
      <Text style={styles.bodyText}>{body}</Text>
    </Pressable>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SmallButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.smallButton}>
      {icon}
      <Text style={styles.smallButtonText}>{label}</Text>
    </View>
  );
}

function TabButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, selected && styles.tabButtonSelected]} onPress={onPress}>
      <Text style={[styles.tabButtonText, selected && styles.tabButtonTextSelected]}>{label}</Text>
    </Pressable>
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
    paddingRight: 12,
  },
  appName: {
    color: '#0F172A',
    fontSize: 25,
    fontWeight: '900',
  },
  subcopy: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconButtonDark: {
    alignItems: 'center',
    backgroundColor: '#153E75',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
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
    minHeight: 42,
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
    paddingBottom: 100,
  },
  listContent: {
    paddingBottom: 100,
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  scoreCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    width: '48.5%',
  },
  score_blue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  score_amber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  score_green: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  score_purple: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  scoreLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
  },
  scoreValue: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: '#64748B',
    lineHeight: 20,
    marginTop: 5,
  },
  sectionBody: {
    marginTop: 12,
  },
  actionCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  actionTitle: {
    color: '#153E75',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  infoBlock: {
    marginBottom: 10,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  infoValue: {
    color: '#0F172A',
    lineHeight: 21,
    marginTop: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  smallButtonText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
  },
  alertRow: {
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 12,
  },
  alertTitle: {
    color: '#7C2D12',
    flex: 1,
    fontWeight: '900',
    paddingRight: 10,
  },
  alertCount: {
    color: '#C2410C',
    fontWeight: '900',
  },
  chanceCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  chanceTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  chanceName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
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
  },
});
