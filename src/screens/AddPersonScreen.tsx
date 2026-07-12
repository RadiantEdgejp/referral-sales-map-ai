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
  TextInput,
  View,
} from 'react-native';
import { Brain, Save, WandSparkles } from 'lucide-react-native';
import { getLlmAdapter, toLlmErrorMessage } from '../ai/llmAdapter';
import AnalysisPreview from '../components/AnalysisPreview';
import AttachmentTextInput from '../components/AttachmentTextInput';
import { SAMPLE_PERSON_MEMO } from '../data/sampleInput';
import { buildAutoFollowUpPlan, hasValidNextContact } from '../logic/autoFollowUp';
import {
  cancelContactNotification,
  scheduleContactNotification,
} from '../notifications/notificationService';
import { createAutoFollowUp } from '../storage/followUpStorage';
import { addPerson } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person, PersonAnalysis } from '../types/person';

export default function AddPersonScreen({ navigation }: ScreenProps<'AddPerson'>) {
  const [memo, setMemo] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [analysis, setAnalysis] = useState<PersonAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
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
    if (saving) return;

    // 次回連絡日はユーザーがこの画面で入力しない（AIの推奨日時は
    // recommendedNextContactAt として別途保持される）ため、未入力として扱い、
    // 初期ルール「3日後 9:00」を適用する（Issue #16 / CLAUDE.md 5.1）。
    let person: Person = {
      id: `${Date.now()}`,
      rawMemo: memo,
      createdAt: new Date().toISOString(),
      ...analysis,
      // 会社名・役職は同姓同名の判別に使うため、独立カラムとして保存する（CLAUDE.md 5.2）
      company: company.trim() || undefined,
      role: role.trim() || undefined,
    };

    const plan = hasValidNextContact(person.nextContactAt) ? null : buildAutoFollowUpPlan();
    if (plan) {
      person = { ...person, nextContactAt: plan.dueDate.toISOString() };
    }

    setSaving(true);
    try {
      // ローカル通知は任意連携（失敗しても保存は続行する）
      let notificationId: string | undefined;
      if (plan) {
        try {
          notificationId = await scheduleContactNotification(person, plan.dueDate);
        } catch {
          notificationId = undefined;
        }
      }
      person = { ...person, notificationId };

      try {
        await addPerson(person);
      } catch (error) {
        // 人物本体の保存に失敗したら、先行スケジュールした通知を取り消す
        await cancelContactNotification(notificationId);
        throw error;
      }

      let followUpNotice = '人脈カード一覧に追加しました。';
      if (plan) {
        try {
          await createAutoFollowUp({ person, dueDate: plan.dueDate, reason: plan.reason });
          followUpNotice = plan.reason;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          followUpNotice = `人脈カードは保存しましたが、フォローアップの自動作成に失敗しました。人物詳細から次回連絡日を確認してください。\n（${message}）`;
        }
      }

      Alert.alert('保存しました', followUpNotice);
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('保存に失敗しました', message);
    } finally {
      setSaving(false);
    }
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

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>会社名（任意）</Text>
            <TextInput
              value={company}
              onChangeText={setCompany}
              placeholder="例：〇〇美容室"
              placeholderTextColor="#94A3B8"
              style={styles.textField}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>役職（任意）</Text>
            <TextInput
              value={role}
              onChangeText={setRole}
              placeholder="例：代表"
              placeholderTextColor="#94A3B8"
              style={styles.textField}
            />
          </View>
        </View>
        <Text style={styles.fieldHint}>同じ名前の人を区別するために使います。あとから人物詳細でも編集できます。</Text>

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

        <Pressable
          style={[styles.saveButton, (!analysis || saving) && styles.disabled]}
          onPress={save}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Save color="#FFFFFF" size={20} />}
          <Text style={styles.saveText}>{saving ? '保存中...' : '保存する'}</Text>
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
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  fieldHalf: {
    flex: 1,
  },
  textField: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  fieldHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
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
