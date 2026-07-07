import { StyleSheet, Text, View } from 'react-native';

export default function MiniButton({ label }: { label: string }) {
  return (
    <View style={styles.rowButton}>
      <Text style={styles.rowButtonText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  rowButtonText: { color: '#153E75', fontSize: 12, fontWeight: '900' },
});
