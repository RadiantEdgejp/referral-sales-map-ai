import { Pressable, StyleSheet, Text } from 'react-native';

export default function MiniButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.rowButtonText}>{label}</Text>
    </Pressable>
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
  pressed: {
    backgroundColor: '#EAF2FF',
  },
  rowButtonText: { color: '#153E75', fontSize: 12, fontWeight: '900' },
});
