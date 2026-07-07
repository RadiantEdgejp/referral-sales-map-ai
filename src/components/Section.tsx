import { StyleSheet, Text, View } from 'react-native';

export default function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', lineHeight: 19, marginTop: 4 },
  sectionBody: { marginTop: 10 },
});
