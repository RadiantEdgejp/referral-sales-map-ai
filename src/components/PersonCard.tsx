import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { Person } from '../types/person';
import { formatDateTime } from '../utils/date';

type Props = {
  person: Person;
  onPress: () => void;
};

export default function PersonCard({ person, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.meta}>{person.industry}</Text>
        </View>
        <ChevronRight color="#64748B" size={20} />
      </View>

      <View style={styles.tags}>
        {person.categories.map((category) => (
          <Text key={category} style={styles.tag}>
            {category}
          </Text>
        ))}
      </View>

      <Text style={styles.memo} numberOfLines={2}>
        {person.rawMemo}
      </Text>
      <Text style={styles.next}>次回連絡: {formatDateTime(person.nextContactAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pressed: {
    opacity: 0.72,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: '#64748B',
    marginTop: 3,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: '#EAF2FF',
    color: '#153E75',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '800',
  },
  memo: {
    color: '#334155',
    lineHeight: 20,
    marginTop: 12,
  },
  next: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
});
