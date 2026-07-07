import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Brain, Save, WandSparkles } from 'lucide-react-native';
import { getLlmAdapter, toLlmErrorMessage } from '../ai/llmAdapter';
import AnalysisPreview from '../components/AnalysisPreview';
import AttachmentTextInput from '../components/AttachmentTextInput';
import { SAMPLE_PERSON_MEMO } from '../data/sampleInput';
import { addPerson } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { PersonAnalysis } from '../types/person';

export default function AddPersonScreen({ navigation }: ScreenProps<'AddPerson'>) {
  const [memo, setMemo] = useState('');
  const [analysis, setAnalysis] = useState<PersonAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fillSample = () => {
    setMemo(SAMPLE_PERSON_MEMO);
    setAnalysis(null);
    setErrorMessage('');
  };

  const analyze = async () => {
    if (analyzing) return;
    if (!memo.trim()) {
      Alert.alert('メモを入力してください', 'まずは雑でいいので人物メモを書いてください。');
      return;
    }

    setAnalyzing(true);
    setErrorMessage('');
    setAnalysis(null);
    try {
      const result = await getLlmAdapter().analyzePerson({ memo });
      setAnalysis(result);
    } catch (error) {
      // AI失敗時は分析結果を持たない＝保存（DB書き込み）不可の状態を維持する
      setAnalysis(null);
      setErrorMessage(toLlmErrorMessage(error));
    } finally {
      setAnalyzing(false);
    }
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
        <AttachmentTextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="例：田中さん。美容サロン経営。採用に困ってる..."
          minHeight={150}
          backgroundColor="#FFFFFF"
        />

        <View style={styles.buttonRow}>
          <Pressable style={[styles.button, styles.secondaryButton]} onPress={fillSample}>
            <WandSparkles color="#153E75" size={18} />
            <Text style={styles.secondaryButtonText}>サンプル入力</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.primaryButton, analyzing && styles.disabled]}
            onPress={analyze}
            disabled={analyzing}
          >
            {analyzing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Brain color="#FFFFFF" size={18} />}
            <Text style={styles.primaryButtonText}>{analyzing ? 'AIが分析中...' : 'AIで整理する'}</Text>
          </Pressable>
        </View>

        {errorMessage ? <Text style={styles.errorNotice}>{errorMessage}</Text> : null}

        {analyzing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#153E75" size="large" />
            <Text style={styles.loadingText}>AIがメモを分析しています。数秒〜数十秒かかることがあります。</Text>
          </View>
        ) : analysis ? (
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
  errorNotice: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 8,
    borderWidth: 1,
    color: '#B91C1C',
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: 12,
    padding: 12,
  },
  loadingBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
});
