import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, UserRound } from 'lucide-react-native';
import { dedupePeople } from '../logic/personPriority';
import type { Person } from '../types/person';
import { formatDateTime } from '../utils/date';
import FilterChip from './FilterChip';

/**
 * 人物選択の共通モーダル（CLAUDE.md 5.2）。
 *
 * 人物を選択するすべての画面（予定前ナビ・文面確認・営業コーチ・後メモ等）から
 * 再利用し、検索と「同姓同名を区別できる十分な情報」
 * （名前・会社・役職・関係性・次回連絡日・メモ抜粋）の表示を1箇所に集約する。
 *
 * - アーカイブ済みの人物は呼び出し側の状態に関わらずここで除外する。
 * - 検索は名前・会社・役職・業種・関係性・分類・次アクション・メモを横断する。
 * - `filter` を渡すと、画面固有の絞り込みチップ（例：文面確認の「返信待ち」等）を表示する。
 */

export type ContactPickerFilterConfig = {
  options: readonly string[];
  initial: string;
  matches: (person: Person, option: string) => boolean;
};

type Props = {
  visible: boolean;
  people: Person[];
  selectedPersonId?: string;
  onSelect: (person: Person | null) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** 「指定なし」（人物に紐付けない相談など）を許可する */
  allowNone?: boolean;
  noneLabel?: string;
  /** 自分自身を除外したい場合（紹介元の設定など）に指定 */
  excludePersonId?: string;
  filter?: ContactPickerFilterConfig;
};

export default function ContactPickerModal({
  visible,
  people,
  selectedPersonId,
  onSelect,
  onClose,
  title = '相手を検索',
  subtitle = '名前・会社・役職・業種・メモから探せます。',
  allowNone = false,
  noneLabel = '人物を指定しない',
  excludePersonId,
  filter,
}: Props) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(filter?.initial ?? '');

  useEffect(() => {
    if (visible) {
      setQuery('');
      setActiveFilter(filter?.initial ?? '');
    }
    // filter?.initial は画面ごとに固定値のため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const candidates = useMemo(() => {
    const active = dedupePeople(people.filter((person) => !person.archivedAt && person.id !== excludePersonId));
    const normalized = query.trim().toLowerCase();

    return active.filter((person) => {
      const matchesQuery =
        !normalized ||
        [
          person.name,
          person.company ?? '',
          person.role ?? '',
          person.industry,
          person.relationship,
          person.categories.join(' '),
          person.nextAction,
          person.rawMemo,
          person.additionalMemo ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      const matchesFilter = !filter || filter.matches(person, activeFilter);

      return matchesQuery && matchesFilter;
    });
  }, [people, excludePersonId, query, filter, activeFilter]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>閉じる</Text>
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search color="#64748B" size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="名前・会社・役職・メモで検索"
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              autoFocus
            />
          </View>

          {filter ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {filter.options.map((option) => (
                <FilterChip key={option} label={option} selected={activeFilter === option} onPress={() => setActiveFilter(option)} />
              ))}
            </ScrollView>
          ) : null}

          <Text style={styles.resultHint}>候補 {candidates.length}件</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {allowNone ? (
              <Pressable
                style={[styles.noneCard, !selectedPersonId && styles.cardActive]}
                onPress={() => onSelect(null)}
              >
                <UserRound color="#64748B" size={18} />
                <Text style={styles.noneText}>{noneLabel}</Text>
                {!selectedPersonId ? <Text style={styles.selectedMark}>選択中</Text> : null}
              </Pressable>
            ) : null}

            {candidates.map((person) => {
              const selected = person.id === selectedPersonId;
              const memoExcerpt = (person.rawMemo || '').replace(/\s+/g, ' ').trim().slice(0, 42);
              return (
                <Pressable
                  key={person.id}
                  style={[styles.card, selected && styles.cardActive]}
                  onPress={() => onSelect(person)}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{person.name.trim().slice(0, 1) || '？'}</Text>
                    </View>
                    <View style={styles.cardTitleBox}>
                      <Text style={styles.cardName}>{person.name}</Text>
                      <Text style={styles.cardCompany}>
                        {[person.company, person.role].filter(Boolean).join('・') || `${person.industry} / ${person.relationship}`}
                      </Text>
                    </View>
                    {selected ? <Text style={styles.selectedMark}>選択中</Text> : null}
                  </View>
                  {person.company || person.role ? (
                    <Text style={styles.cardMeta}>
                      {person.industry} / {person.relationship}
                    </Text>
                  ) : null}
                  <Text style={styles.cardTags}>分類：{person.categories.join('・') || '未設定'}</Text>
                  <Text style={styles.cardMeta}>次回連絡：{formatDateTime(person.nextContactAt)}</Text>
                  <Text style={styles.cardAction} numberOfLines={1}>
                    次アクション：{person.nextAction || '未設定'}
                  </Text>
                  {memoExcerpt ? (
                    <Text style={styles.cardMemo} numberOfLines={1}>
                      メモ：{memoExcerpt}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

            {candidates.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>候補が見つかりません。</Text>
                <Text style={styles.emptyText}>名前、会社名、役職、業種、メモの一部で検索してみてください。</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '82%',
    padding: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: { flex: 1, paddingRight: 10 },
  title: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  subtitle: { color: '#64748B', fontWeight: '800', lineHeight: 19, marginTop: 3 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  closeText: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
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
  filterRow: { flexGrow: 0, marginTop: 10 },
  resultHint: { color: '#64748B', fontSize: 12, fontWeight: '900', marginBottom: 7, marginTop: 12 },
  list: { maxHeight: 430 },
  noneCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 9,
    padding: 14,
  },
  noneText: { color: '#334155', flex: 1, fontWeight: '900' },
  card: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 9,
    padding: 12,
  },
  cardActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0F172A',
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  avatarText: { color: '#153E75', fontSize: 16, fontWeight: '900' },
  cardTitleBox: { flex: 1 },
  cardName: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  cardCompany: { color: '#475569', fontSize: 12, fontWeight: '800', marginTop: 2 },
  selectedMark: {
    backgroundColor: '#0F172A',
    borderRadius: 999,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  cardMeta: { color: '#475569', fontSize: 12, fontWeight: '800', marginTop: 6 },
  cardTags: { color: '#153E75', fontSize: 12, fontWeight: '900', marginTop: 7 },
  cardAction: { color: '#334155', lineHeight: 20, marginTop: 5 },
  cardMemo: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 4 },
  emptyState: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  emptyTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#64748B', lineHeight: 20, marginTop: 8 },
});
