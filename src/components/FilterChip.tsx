import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

export default function FilterChip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: '#D7DEE8',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  selected: {
    backgroundColor: '#153E75',
    borderColor: '#153E75',
  },
  pressed: {
    opacity: 0.76,
  },
  text: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedText: {
    color: '#FFFFFF',
  },
});
