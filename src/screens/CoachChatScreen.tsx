import { useEffect, useState } from 'react';
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
import { Send } from 'lucide-react-native';
import { getLlmAdapter, toLlmErrorMessage } from '../ai/llmAdapter';
import type { CoachAnswer } from '../ai/types';
import AttachmentTextInput from '../components/AttachmentTextInput';
import FilterChip from '../components/FilterChip';
import SectionCard from '../components/SectionCard';
import { getPeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';

const SAMPLE_COACH_PROMPT =
  '田中さんに美容サロン経営者を紹介してほしいです。まだ一回しか会っていません。今お願いしてもいいですか？';

export default function CoachChatScreen({ route }: ScreenProps<'CoachChat'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState('none');
  const [problem, setProblem] = useState(route.params?.initialPrompt ?? '');
  const [answer, setAnswer] = useState<CoachAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    getPeople().then(setPeople);
  }, []);

  useEffect(() => {
    if (route.params?.initialPrompt) {
      setProblem(route.params.initialPrompt);
      setAnswer(null);
      setErrorMessage('');
    }
  }, [route.params?.initialPrompt]);

  const selectedPerson = people.find((person) => person.id === selectedPersonId);

  const submit = async () => {
    if (loading) return;
    if (!problem.trim()) {
      Alert.alert('相談内容を入力してください', '悩みや迷いを一文でもいいので書いてください。');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setAnswer(null);
    try {
      const result = await getLlmAdapter().coachChat({ problem, person: selectedPerson });
      setAnswer(result);
    } catch (error) {
      setAnswer(null);
      setErrorMessage(toLlmErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>営業コーチ</Text>
        <Text style={styles.subcopy}>営業の迷いを、次の行動に変える</Text>

        <Text style={styles.label}>関連人物</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.personRow}>
          <FilterChip label="指定なし" selected={selectedPersonId === 'none'} onPress={() => setSelectedPersonId('none')} />
          {people.map((person) => (
            <FilterChip
              key={person.id}
              label={person.name}
              selected={selectedPersonId === person.id}
              onPress={() => setSelectedPersonId(person.id)}
            />
          ))}
        </ScrollView>

        {selectedPerson && (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedText}>
              {selectedPerson.name} / {selectedPerson.categories.join('、')}
            </Text>
          </View>
        )}

        <Text style={styles.label}>悩み</Text>
        <AttachmentTextInput
          value={problem}
          onChangeText={setProblem}
          placeholder="例：この人に紹介依頼していい？ このLINE重い？"
          minHeight={132}
          backgroundColor="#FFFFFF"
        />

        <Pressable
          style={styles.sampleButton}
          onPress={() => {
            setProblem(SAMPLE_COACH_PROMPT);
            setAnswer(null);
            setErrorMessage('');
          }}
        >
          <Text style={styles.sampleButtonText}>サンプル相談を入れる</Text>
        </Pressable>

        <Pressable style={[styles.submitButton, loading && styles.submitDisabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Send color="#FFFFFF" size={18} />}
          <Text style={styles.submitText}>{loading ? 'AIが回答を作成中...' : '相談を送信'}</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorNotice}>{errorMessage}</Text> : null}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#153E75" size="large" />
            <Text style={styles.loadingText}>AIコーチが回答を考えています。数秒〜数十秒かかることがあります。</Text>
          </View>
        )}

        {answer && (
          <SectionCard title="仮回答">
            <AnswerItem index={1} title="結論" body={answer.conclusion} />
            <AnswerItem index={2} title="理由" body={answer.reason} />
            <AnswerItem index={3} title="科学的根拠" body={answer.evidence} />
            <AnswerItem index={4} title="営業現場への翻訳" body={answer.translation} />
            <AnswerItem index={5} title="次の行動" body={answer.nextAction} />
          </SectionCard>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AnswerItem({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <View style={styles.answerItem}>
      <Text style={styles.answerTitle}>
        {index}. {title}
      </Text>
      <Text style={styles.answerBody}>{body}</Text>
    </View>
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
    marginTop: 8,
  },
  personRow: {
    flexGrow: 0,
    marginBottom: 10,
  },
  selectedBox: {
    backgroundColor: '#EAF2FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  selectedText: {
    color: '#153E75',
    fontWeight: '800',
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: '#153E75',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  sampleButton: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: '#EAF2FF',
  },
  sampleButtonText: {
    color: '#153E75',
    fontWeight: '900',
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  submitDisabled: {
    opacity: 0.6,
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
    marginBottom: 12,
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
  },
  answerItem: {
    marginBottom: 14,
  },
  answerTitle: {
    color: '#153E75',
    fontWeight: '900',
    marginBottom: 4,
  },
  answerBody: {
    color: '#334155',
    lineHeight: 22,
  },
});
