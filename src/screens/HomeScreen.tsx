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
import type { Person, PersonCategory } from '../types/person';

const CATEGORIES: Array<'すべて' | PersonCategory> = [
  'すべて',
  '顧客候補',
  '紹介元候補',
  '紹介先候補',
  '情報源候補',
  '将来候補',
];

export default function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'すべて' | PersonCategory>('すべて');
  const [industry, setIndustry] = useState('すべて');

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

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return people.filter((person) => {
      const matchesQuery =
        !normalized ||
        [person.name, person.industry, person.categories.join(' '), person.rawMemo]
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      const matchesCategory = category === 'すべて' || person.categories.includes(category);
      const matchesIndustry = industry === 'すべて' || person.industry === industry;

      return matchesQuery && matchesCategory && matchesIndustry;
    });
  }, [category, industry, people, query]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.searchBox}>
          <Search color="#64748B" size={20} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="名前・業種・分類・メモで検索"
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
              onPress={() => setCategory(item)}
            />
          ))}
        </ScrollView>

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
          renderItem={({ item }) => (
            <PersonCard
              person={item}
              onPress={() => navigation.navigate('PersonDetail', { personId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>まだ人脈カードがありません</Text>
              <Text style={styles.emptyText}>人物追加からサンプル入力を試してみてください。</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />

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
