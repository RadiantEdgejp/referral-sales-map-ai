import { StyleSheet, Text, View } from 'react-native';
import type { PersonAnalysis } from '../types/person';
import SectionCard from './SectionCard';
import { formatDateTime } from '../utils/date';

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
      <PreviewItem title="関係性" body={analysis.relationship} />
      <PreviewItem title="初回切り口" body={analysis.openingTalk} />
      <PreviewItem title="次に聞く質問" body={analysis.nextQuestion} />
      <PreviewItem title="ゴール" body={analysis.goal} />
      <Text style={styles.heading}>ゴールまでの道筋</Text>
      {analysis.roadmap.map((step, index) => (
        <Text key={step} style={styles.step}>
          {index + 1}. {step}
        </Text>
      ))}
      <PreviewItem title="次アクション" body={analysis.nextAction} />
      <PreviewItem title="LINE文" body={analysis.lineMessage} />
      <PreviewItem title="メール文" body={analysis.emailMessage} />
      <PreviewItem title="注意点" body={analysis.cautions} />
      <PreviewItem title="推奨次回連絡日" body={formatDateTime(analysis.recommendedNextContactAt)} />
    </SectionCard>
  );
}

function PreviewItem({ title, body }: { title: string; body: string }) {
  return (
    <>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.paragraph}>{body}</Text>
    </>
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
  step: {
    color: '#334155',
    lineHeight: 22,
    marginBottom: 3,
  },
});
