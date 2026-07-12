import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, FileText, Trash2 } from 'lucide-react-native';

type Props = {
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  backgroundColor?: string;
  compact?: boolean;
};

export default function AttachmentTextInput({
  value,
  onChangeText,
  placeholder,
  minHeight = 132,
  backgroundColor = '#F8FAFC',
  compact,
}: Props) {
  const [internalValue, setInternalValue] = useState('');
  const [fileNotice, setFileNotice] = useState('');
  const currentValue = value ?? internalValue;
  const setValue = (nextValue: string) => onChangeText ? onChangeText(nextValue) : setInternalValue(nextValue);

  const appendText = (text: string) => {
    if (!text) return;
    setValue([currentValue, text].filter(Boolean).join('\n'));
  };

  const pasteClipboard = async () => appendText(await Clipboard.getStringAsync());

  const pickTextFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.csv,.json,text/plain,text/csv,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        appendText(typeof reader.result === 'string' ? reader.result : '');
        setFileNotice(`${file.name} を読み込みました`);
      };
      reader.onerror = () => setFileNotice('ファイルを読み込めませんでした');
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  };

  return (
    <View>
      <TextInput
        value={currentValue}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline
        textAlignVertical="top"
        style={[styles.input, { minHeight, backgroundColor }, compact && styles.compactInput]}
      />
      <View style={styles.toolRow}>
        <ToolButton label="貼り付け" icon={ClipboardPaste} onPress={pasteClipboard} />
        {Platform.OS === 'web' ? <ToolButton label="ファイル" icon={FileText} onPress={pickTextFile} /> : null}
        {currentValue ? (
          <ToolButton label="クリア" icon={Trash2} onPress={() => { setValue(''); setFileNotice(''); }} />
        ) : null}
      </View>
      {fileNotice ? <Text style={styles.notice}>{fileNotice}</Text> : null}
    </View>
  );
}

function ToolButton({ label, icon: Icon, onPress }: { label: string; icon: typeof FileText; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} style={styles.toolButton} onPress={onPress}>
      <Icon color="#0F172A" size={19} />
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { borderColor: '#D7DEE8', borderRadius: 8, borderWidth: 1, color: '#0F172A', fontSize: 15, lineHeight: 22, padding: 12 },
  compactInput: { fontSize: 14, lineHeight: 20, padding: 10 },
  toolRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  toolButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 40, paddingHorizontal: 11 },
  toolLabel: { color: '#334155', fontSize: 12, fontWeight: '800' },
  notice: { color: '#153E75', fontSize: 12, fontWeight: '800', marginTop: 6 },
});
