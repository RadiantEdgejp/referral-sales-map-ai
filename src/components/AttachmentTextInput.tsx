import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, MoreHorizontal } from 'lucide-react-native';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [internalValue, setInternalValue] = useState('');
  const currentValue = value ?? internalValue;
  const setValue = (nextValue: string) => {
    if (onChangeText) {
      onChangeText(nextValue);
      return;
    }
    setInternalValue(nextValue);
  };

  const pasteClipboard = async () => {
    const clipboardText = await Clipboard.getStringAsync();
    setValue([currentValue, clipboardText].filter(Boolean).join('\n'));
    setMenuOpen(false);
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
        <Pressable accessibilityLabel="クリップボードから貼り付け" style={styles.toolButton} onPress={pasteClipboard}>
          <ClipboardPaste color="#0F172A" size={20} />
        </Pressable>
        <Pressable accessibilityLabel="その他" style={styles.toolButton} onPress={() => setMenuOpen(true)}>
          <MoreHorizontal color="#0F172A" size={22} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>入力方法を選ぶ</Text>
                <Text style={styles.sheetSubcopy}>貼り付けとクリアを使えます。</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setMenuOpen(false)}>
                <Text style={styles.closeText}>閉じる</Text>
              </Pressable>
            </View>

            <SheetItem title="クリップボードから貼り付け" body="コピー済みの文面を入力欄へ追加します。" onPress={pasteClipboard} />
            <SheetItem
              title="入力をクリア"
              body="入力欄の内容を消します。"
              onPress={() => {
                setValue('');
                setMenuOpen(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SheetItem({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <Pressable style={styles.sheetItem} onPress={onPress}>
      <Text style={styles.sheetItemTitle}>{title}</Text>
      <Text style={styles.sheetItemBody}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: {
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
    padding: 12,
  },
  compactInput: {
    fontSize: 14,
    lineHeight: 20,
    padding: 10,
  },
  toolRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  toolButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  sheetSubcopy: { color: '#64748B', fontWeight: '800', lineHeight: 19, marginTop: 3 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  closeText: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
  sheetItem: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 9,
    padding: 12,
  },
  sheetItemTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  sheetItemBody: { color: '#475569', fontWeight: '800', marginTop: 5 },
});
