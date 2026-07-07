import { StyleSheet, Text, View } from 'react-native';
import AttachmentTextInput from './AttachmentTextInput';

export default function MemoField({
  label,
  value,
  onChangeText,
  placeholder,
  large,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  large?: boolean;
}) {
  return (
    <View style={styles.memoField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <AttachmentTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        minHeight={large ? 132 : 76}
        compact={!large}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  memoField: { marginBottom: 12 },
  inputLabel: { color: '#64748B', fontSize: 12, fontWeight: '900', marginBottom: 6 },
});
