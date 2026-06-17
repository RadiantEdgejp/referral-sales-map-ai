import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Brain, Save, WandSparkles } from 'lucide-react-native';
import AnalysisPreview from '../components/AnalysisPreview';
import { createMockAnalysis } from '../data/mockAnalysis';
import { SAMPLE_PERSON_MEMO } from '../data/sampleInput';
import { addPerson } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { PersonAnalysis } from '../types/person';

export default function AddPersonScreen({ navigation }: ScreenProps<'AddPerson'>) {
  const [memo, setMemo] = useState('');
  const [analysis, setAnalysis] = useState<PersonAnalysis | null>(null);

  const fillSample = () => {
    setMemo(SAMPLE_PERSON_MEMO);
    setAnalysis(null);
  };

  const analyze = () => {
    if (!memo.trim()) {
      Alert.alert('メモを入力してください', 'まずは雑でいいので人物メモを書いてください。');
      return;
    }

    setAnalysis(createMockAnalysis(memo));
  };

  const save = async () => {
    if (!analysis) {
      Alert.alert('分析結果がありません', '先に「AIで整理する」を押してください。');
      return;
    }

    await addPerson({
      id: `${Date.now()}`,
      rawMemo: memo,
      createdAt: new Date().toISOString(),
      nextContactAt: analysis.recommendedNextContactAt,
      ...analysis,
    });

    Alert.alert('保存しました', '人脈カード一覧に追加しました。');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>人物を追加</Text>
        <Text style={styles.subcopy}>覚えていることを雑に書くだけでOK</Text>

        <Text style={styles.label}>雑メモ</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="例：田中さん。美容サロン経営。採用に困ってる..."
          placeholderTextColor="#94A3B8"
          multiline
          textAlignVertical="top"
          style={styles.memoInput}
        />

        <View style={styles.buttonRow}>
          <Pressable style={[styles.button, styles.secondaryButton]} onPress={fillSample}>
            <WandSparkles color="#153E75" size={18} />
            <Text style={styles.secondaryButtonText}>サンプル入力</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.primaryButton]} onPress={analyze}>
            <Brain color="#FFFFFF" size={18} />
            <Text style={styles.primaryButtonText}>AIで整理する</Text>
          </Pressable>
        </View>

        {analysis ? (
          <AnalysisPreview analysis={analysis} />
        ) : (
          <View style={styles.previewEmpty}>
            <Text style={styles.previewTitle}>分析結果プレビュー</Text>
            <Text style={styles.previewText}>メモを入力して「AIで整理する」を押すと、ここに分類と次アクションが表示されます。</Text>
          </View>
        )}

        <Pressable style={[styles.saveButton, !analysis && styles.disabled]} onPress={save}>
          <Save color="#FFFFFF" size={20} />
          <Text style={styles.saveText}>保存する</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
  },
  subcopy: {
    color: '#64748B',
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 18,
  },
  label: {
    color: '#0F172A',
    fontWeight: '900',
    marginBottom: 8,
  },
  memoInput: {
    minHeight: 150,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7DEE8',
    borderRadius: 8,
    padding: 14,
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 14,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#B8D4FF',
  },
  primaryButton: {
    backgroundColor: '#153E75',
  },
  secondaryButtonText: {
    color: '#153E75',
    fontWeight: '900',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  previewEmpty: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
  },
  previewTitle: {
    color: '#0F172A',
    fontWeight: '900',
  },
  previewText: {
    color: '#64748B',
    lineHeight: 21,
    marginTop: 8,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
});
