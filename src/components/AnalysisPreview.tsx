import { StyleSheet, Text, View } from 'react-native';
import type { PersonAnalysis } from '../types/person';
import SectionCard from './SectionCard';

type Props = {
  analysis: PersonAnalysis;
};

export default function AnalysisPreview({ analysis }: Props) {
  return (
    <SectionCard title="分析結果プレビュー">
      <View style={styles.row}>
        <Text style={styles.label}>名前</Text>
        <Text style={styles.value}>{analysis.name}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>業種</Text>
        <Text style={styles.value}>{analysis.industry}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>分類</Text>
        <Text style={styles.value}>{analysis.categories.join('、')}</Text>
      </View>
      <Text style={styles.heading}>次アクション</Text>
      <Text style={styles.paragraph}>{analysis.nextAction}</Text>
      <Text style={styles.heading}>LINE文</Text>
      <Text style={styles.paragraph}>{analysis.lineMessage}</Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  label: {
    width: 54,
    color: '#64748B',
    fontWeight: '800',
  },
  value: {
    flex: 1,
    color: '#0F172A',
    fontWeight: '700',
  },
  heading: {
    color: '#153E75',
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    color: '#334155',
    lineHeight: 21,
  },
});
