import { useCallback, useMemo, useState } from 'react';
import {
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
import { Bot, Plus, Search } from 'lucide-react-native';
import FilterChip from '../components/FilterChip';
import PersonCard from '../components/PersonCard';
import { getPeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';

type HomeTab = 'home' | 'people';

export default function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('すべて');
  const [activeTab, setActiveTab] = useState<HomeTab>('home');

  const loadPeople = useCallback(async () => {
    setPeople(await getPeople());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPeople();
    }, [loadPeople]),
  );

  const industries = useMemo(() => {
    const unique = Array.from(new Set(people.map((person) => person.industry)));
    return ['すべて', ...unique];
  }, [people]);

  const targetPeople = useMemo(() => {
    return [...people]
      .sort((a, b) => {
        const aDate = a.nextContactAt ? new Date(a.nextContactAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.nextContactAt ? new Date(b.nextContactAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      })
      .slice(0, 3);
  }, [people]);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return people.filter((person) => {
      const matchesQuery =
        !normalized ||
        [person.name, person.industry, person.categories.join(' '), person.rawMemo, person.nextAction]
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      const matchesIndustry = industry === 'すべて' || person.industry === industry;

      return matchesQuery && matchesIndustry;
    });
  }, [industry, people, query]);

  const openPerson = (person: Person) => {
    navigation.navigate('PersonDetail', { personId: person.id });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.appName}>紹介営業マップAI</Text>
          <Text style={styles.subcopy}>出会いを営業資産に変える</Text>
        </View>

        <View style={styles.tabBar}>
          <TabButton label="ホーム" selected={activeTab === 'home'} onPress={() => setActiveTab('home')} />
          <TabButton
            label="人脈カード一覧"
            selected={activeTab === 'people'}
            onPress={() => setActiveTab('people')}
          />
        </View>

        {activeTab === 'home' ? (
          <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
            <View style={styles.todayCard}>
              <Text style={styles.todayTitle}>今日やること</Text>
              <Text style={styles.todayMain}>
                {people.length > 0
                  ? '次回連絡が近い人を確認して、軽い近況LINEを1通送る'
                  : 'まずはサンプル人物を追加して、人脈カードの流れを確認する'}
              </Text>
              <Text style={styles.todaySub}>売り込む前に、相手の課題を1つだけ聞く</Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>今日の対象人物</Text>
              <Text style={styles.sectionMeta}>{targetPeople.length}件</Text>
            </View>

            {targetPeople.length > 0 ? (
              targetPeople.map((person) => (
                <PersonCard key={person.id} person={person} onPress={() => openPerson(person)} />
              ))
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>今日動く対象がまだありません</Text>
                <Text style={styles.emptyText}>人物追加からサンプル入力を試すと、ここに対象人物が表示されます。</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.listPane}>
            <View style={styles.searchBox}>
              <Search color="#64748B" size={20} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="名前・業種・分類・メモ・次アクションで検索"
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.filterTitle}>業種</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {industries.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  selected={industry === item}
                  onPress={() => setIndustry(item)}
                />
              ))}
            </ScrollView>

            <View style={styles.summary}>
              <Text style={styles.summaryText}>人脈カード {filteredPeople.length}件</Text>
            </View>

            <FlatList
              data={filteredPeople}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <PersonCard person={item} onPress={() => openPerson(item)} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>人脈カードが見つかりません</Text>
                  <Text style={styles.emptyText}>検索条件を変えるか、人物追加からカードを作ってください。</Text>
                </View>
              }
              contentContainerStyle={styles.listContent}
            />
          </View>
        )}

        <View style={styles.actions}>
          <Pressable style={[styles.actionButton, styles.coachButton]} onPress={() => navigation.navigate('CoachChat')}>
            <Bot color="#153E75" size={20} />
            <Text style={styles.coachButtonText}>営業コーチ</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.addButton]} onPress={() => navigation.navigate('AddPerson')}>
            <Plus color="#FFFFFF" size={20} />
            <Text style={styles.addButtonText}>人物追加</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
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
  hero: {
    marginBottom: 12,
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
  tabBar: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
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
  listPane: {
    flex: 1,
  },
  todayCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  todayTitle: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '900',
  },
  todayMain: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 21,
    marginTop: 6,
  },
  todaySub: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
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
  sectionMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7DEE8',
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
  },
  filterTitle: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },
  filterRow: {
    flexGrow: 0,
  },
  summary: {
    marginTop: 16,
    marginBottom: 8,
  },
  summaryText: {
    color: '#64748B',
    fontWeight: '800',
  },
  listContent: {
    paddingBottom: 96,
  },
  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    marginTop: 8,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    lineHeight: 20,
    marginTop: 8,
  },
  actions: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  coachButton: {
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#B8D4FF',
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
