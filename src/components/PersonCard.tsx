import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, ChevronRight, Copy, FileText } from 'lucide-react-native';
import type { Person, PersonCategory } from '../types/person';
import { formatDateTime } from '../utils/date';

type Props = {
  person: Person;
  onPress: () => void;
};

const TAG_COLORS: Record<PersonCategory, { background: string; text: string }> = {
  顧客候補: { background: '#DBEAFE', text: '#1D4ED8' },
  紹介元候補: { background: '#DCFCE7', text: '#15803D' },
  紹介先候補: { background: '#F3E8FF', text: '#7E22CE' },
  情報源候補: { background: '#FFEDD5', text: '#C2410C' },
  将来候補: { background: '#E5E7EB', text: '#374151' },
};

export default function PersonCard({ person, onPress }: Props) {
  const status = getStatusLabel(person);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <Text style={[styles.statusLabel, getStatusStyle(status)]}>{status}</Text>
        <ChevronRight color="#64748B" size={20} />
      </View>

      <View style={styles.header}>
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.meta}>
            {person.industry} / {person.relationship}
          </Text>
        </View>
      </View>

      <View style={styles.tags}>
        {person.categories.map((category) => (
          <Text
            key={category}
            style={[
              styles.tag,
              {
                backgroundColor: TAG_COLORS[category].background,
                color: TAG_COLORS[category].text,
              },
            ]}
          >
            {category}
          </Text>
        ))}
      </View>

      <InfoLine label="次アクション" value={person.nextAction} />
      <InfoLine label="次回連絡" value={formatDateTime(person.nextContactAt)} />

      <View style={styles.scoreGrid}>
        <ScorePill label="紹介元可能性" value={person.referrerPotential} />
        <ScorePill label="顧客可能性" value={person.customerPotential} />
      </View>

      <Text style={styles.cautionLabel}>注意</Text>
      <Text style={styles.caution} numberOfLines={2}>
        {person.cautions}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.updated}>最終更新: {formatDateTime(person.createdAt)}</Text>
        <View style={styles.cardActions}>
          <MiniAction icon="detail" label="詳細" />
          <MiniAction icon="line" label="LINE文" />
          <MiniAction icon="notice" label="通知" />
        </View>
      </View>
    </Pressable>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scorePill}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{Math.max(1, Math.round(value / 20))}/5</Text>
    </View>
  );
}

function MiniAction({ icon, label }: { icon: 'detail' | 'line' | 'notice'; label: string }) {
  const Icon = icon === 'detail' ? FileText : icon === 'line' ? Copy : Bell;

  return (
    <View style={styles.miniAction}>
      <Icon color="#153E75" size={14} />
      <Text style={styles.miniActionText}>{label}</Text>
    </View>
  );
}

function getStatusLabel(person: Person) {
  const next = person.nextContactAt ? new Date(person.nextContactAt) : null;
  const now = new Date();
  const isToday =
    next &&
    next.getFullYear() === now.getFullYear() &&
    next.getMonth() === now.getMonth() &&
    next.getDate() === now.getDate();

  if (isToday) {
    return '今日連絡';
  }
  if (person.referrerPotential >= 75) {
    return '紹介候補';
  }
  if (!person.nextContactAt) {
    return '温め中';
  }
  if (person.nextAction) {
    return '要確認';
  }
  return '放置中';
}

function getStatusStyle(status: string) {
  if (status === '今日連絡') {
    return styles.statusToday;
  }
  if (status === '紹介候補') {
    return styles.statusReferral;
  }
  if (status === '放置中') {
    return styles.statusDormant;
  }
  if (status === '温め中') {
    return styles.statusWarm;
  }
  return styles.statusCheck;
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
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusToday: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
  statusCheck: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  statusReferral: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  statusDormant: {
    backgroundColor: '#E5E7EB',
    color: '#374151',
  },
  statusWarm: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
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
    fontSize: 19,
    fontWeight: '900',
  },
  meta: {
    color: '#64748B',
    marginTop: 4,
    lineHeight: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
  infoLine: {
    marginTop: 12,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  infoValue: {
    color: '#0F172A',
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 3,
  },
  scoreGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  scorePill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  scoreLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  scoreValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  cautionLabel: {
    color: '#7C2D12',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 12,
  },
  caution: {
    color: '#7C2D12',
    lineHeight: 20,
    marginTop: 3,
  },
  footer: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  updated: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  miniAction: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 10,
  },
  miniActionText: {
    color: '#153E75',
    fontSize: 12,
    fontWeight: '900',
  },
});
