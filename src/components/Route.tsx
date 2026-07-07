import { StyleSheet, Text, View } from 'react-native';

export default function Route({ title, meta }: { title: string; meta: string }) {
  return (
    <View style={styles.routeRow}>
      <Text style={styles.rowName}>{title}</Text>
      <Text style={styles.rowMeta}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  routeRow: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, marginBottom: 8, padding: 12 },
  rowName: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  rowMeta: { color: '#64748B', lineHeight: 19, marginTop: 2 },
});
