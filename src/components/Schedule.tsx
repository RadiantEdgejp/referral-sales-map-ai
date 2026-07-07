import { StyleSheet, Text, View } from 'react-native';

export default function Schedule({ time, title, purpose }: { time: string; title: string; purpose: string }) {
  return (
    <View style={styles.scheduleRow}>
      <Text style={styles.scheduleTime}>{time}</Text>
      <View style={styles.scheduleBody}>
        <Text style={styles.rowName}>{title}</Text>
        <Text style={styles.rowMeta}>目的：{purpose}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scheduleRow: { alignItems: 'flex-start', borderBottomColor: '#E2E8F0', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 10 },
  scheduleTime: { color: '#153E75', fontSize: 15, fontWeight: '900', width: 52 },
  scheduleBody: { flex: 1 },
  rowName: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  rowMeta: { color: '#64748B', lineHeight: 19, marginTop: 2 },
});
