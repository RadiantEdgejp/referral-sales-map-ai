import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, UserPlus } from 'lucide-react-native';
import FilterChip from '../../components/FilterChip';
import PersonCard from '../../components/PersonCard';
import { applyNextContact, clearNextContact, nextContactDate } from '../../logic/nextContact';
import type { SortMode } from '../../logic/personPriority';
import type { Person, PersonCategory } from '../../types/person';
import { homeStyles as styles } from './homeStyles';

const NOTIFY_OPTIONS: Array<{ label: string; days: number | null }> = [
  { label: '明日 9:00', days: 1 },
  { label: '3日後 9:00', days: 3 },
  { label: '1週間後 9:00', days: 7 },
  { label: '通知なし', days: null },
];

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
  onLineCheck,
  onPersonUpdated,
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
  onLineCheck: (person: Person) => void;
  onPersonUpdated: (person: Person) => void;
}) {
  const [notifyPerson, setNotifyPerson] = useState<Person | null>(null);
  const [notifying, setNotifying] = useState(false);

  const applyNotifyOption = async (days: number | null) => {
    if (!notifyPerson || notifying) {
      return;
    }
    setNotifying(true);
    try {
      if (days === null) {
        const saved = await clearNextContact(notifyPerson);
        onPersonUpdated(saved);
        setNotifyPerson(null);
        Alert.alert('通知なしにしました', '次回連絡通知は設定されていません。');
        return;
      }

      const { saved, notice } = await applyNextContact(notifyPerson, nextContactDate(days));
      onPersonUpdated(saved);
      setNotifyPerson(null);
      Alert.alert('通知を設定しました', notice);
    } catch (error) {
      Alert.alert('通知設定に失敗しました', error instanceof Error ? error.message : 'もう一度お試しください。');
    } finally {
      setNotifying(false);
    }
  };

  return (
    <>
    <FlatList
      data={people}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PersonCard
          person={item}
          onPress={() => onOpenPerson(item)}
          onLinePress={() => onLineCheck(item)}
          onNotifyPress={() => setNotifyPerson(item)}
        />
      )}
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

    <Modal
      visible={notifyPerson !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setNotifyPerson(null)}
    >
      <View style={styles.sheetBackdrop}>
        <View style={styles.personPickerSheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{notifyPerson?.name ?? ''}への次回通知</Text>
              <Text style={styles.sheetSubcopy}>次回連絡日と通知タイミングを設定します。</Text>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={() => setNotifyPerson(null)}>
              <Text style={styles.sheetCloseText}>閉じる</Text>
            </Pressable>
          </View>
          {NOTIFY_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              disabled={notifying}
              style={[styles.personSelectCard, notifying && styles.buttonDisabled]}
              onPress={() => void applyNotifyOption(option.days)}
            >
              <Text style={styles.personSelectName}>{notifying ? '保存中...' : option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
    </>
  );
}
