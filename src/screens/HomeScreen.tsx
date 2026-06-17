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
import { Bell, Bot, Plus, Search, UserPlus } from 'lucide-react-native';
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

  const todayTargets = sortedPeople.slice(0, 3);

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
            <Text style={styles.subcopy}>出会いを営業資産に変える</Text>
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
          <TabButton
            label="人脈カード"
            selected={activeTab === 'people'}
            onPress={() => setActiveTab('people')}
          />
        </View>

        {activeTab === 'home' ? (
          <HomePane people={todayTargets} onOpenPerson={openPerson} onShowPeople={() => setActiveTab('people')} />
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
}: {
  people: Person[];
  onOpenPerson: (person?: Person) => void;
  onShowPeople: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.navCard}>
        <Text style={styles.navTitle}>今日の営業ナビ</Text>
        <NavItem
          index={1}
          title={`${people[0]?.name ?? '田中さん'}に近況LINE`}
          body="3日以内に軽く連絡。紹介依頼はまだ早い。"
          onPress={() => onOpenPerson(people[0])}
        />
        <NavItem
          index={2}
          title={`${people[1]?.name ?? '山本さん'}の次回質問を確認`}
          body="採用課題について深掘り。"
          onPress={() => onOpenPerson(people[1])}
        />
        <NavItem
          index={3}
          title="紹介元候補を2人見返す"
          body="美容業界の人脈を持つ人を確認。"
          onPress={() => onShowPeople()}
        />
        <Text style={styles.navFooter}>今日の優先アクション：3件</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>今日連絡すべき人</Text>
        <Pressable onPress={onShowPeople}>
          <Text style={styles.sectionLink}>一覧を見る</Text>
        </Pressable>
      </View>

      {people.length > 0 ? (
        people.map((person) => <PersonCard key={person.id} person={person} onPress={() => onOpenPerson(person)} />)
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>今日動く対象がまだありません</Text>
          <Text style={styles.emptyText}>人物追加からサンプル入力を試すと、ここに対象人物が表示されます。</Text>
        </View>
      )}
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

function TabButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabButton, selected && styles.tabButtonSelected]} onPress={onPress}>
      <Text style={[styles.tabButtonText, selected && styles.tabButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function NavItem({
  index,
  title,
  body,
  onPress,
}: {
  index: number;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.navItem} onPress={onPress}>
      <Text style={styles.navIndex}>{index}.</Text>
      <View style={styles.navBody}>
        <Text style={styles.navItemTitle}>{title}</Text>
        <Text style={styles.navItemBody}>{body}</Text>
      </View>
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
    fontSize: 26,
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
  navCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  navTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  navItem: {
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  navIndex: {
    color: '#153E75',
    fontSize: 16,
    fontWeight: '900',
    width: 22,
  },
  navBody: {
    flex: 1,
  },
  navItemTitle: {
    color: '#0F172A',
    fontWeight: '900',
  },
  navItemBody: {
    color: '#64748B',
    lineHeight: 20,
    marginTop: 3,
  },
  navFooter: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    paddingTop: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionLink: {
    color: '#153E75',
    fontSize: 13,
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
