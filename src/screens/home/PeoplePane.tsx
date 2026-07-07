import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, UserPlus } from 'lucide-react-native';
import FilterChip from '../../components/FilterChip';
import PersonCard from '../../components/PersonCard';
import type { SortMode } from '../../logic/personPriority';
import type { Person, PersonCategory } from '../../types/person';
import { homeStyles as styles } from './homeStyles';

export const CATEGORIES: Array<'すべて' | PersonCategory> = [
  'すべて',
  '顧客候補',
  '紹介元候補',
  '紹介先候補',
  '情報源候補',
  '将来候補',
];

export const INDUSTRIES = ['すべて', '美容', '不動産', '保険', '飲食', '士業', '経営者', '採用', 'その他'];

export const SORTS: Array<{ label: string; value: SortMode }> = [
  { label: '優先順', value: 'priority' },
  { label: '次回連絡日が近い順', value: 'nextContact' },
  { label: '新しく追加した順', value: 'newest' },
  { label: '紹介元可能性が高い順', value: 'referrer' },
];

export default function PeoplePane({
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

          <Pressable style={styles.addPersonButton} onPress={onAddPerson}>
            <UserPlus color="#FFFFFF" size={18} />
            <Text style={styles.addPersonButtonText}>人物を追加する</Text>
          </Pressable>
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
