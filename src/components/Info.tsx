import { StyleSheet, Text, View } from 'react-native';

export default function Info({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <View style={[styles.infoBlock, compact && styles.infoBlockCompact]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoBlock: { marginBottom: 9 },
  infoBlockCompact: { marginBottom: 7 },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  infoValue: { color: '#0F172A', lineHeight: 20, marginTop: 2 },
});
