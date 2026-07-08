import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Bot, ChevronDown, Send, Sparkles } from 'lucide-react-native';
import { getLlmAdapter, toLlmErrorMessage } from '../ai/llmAdapter';
import type { CoachAnswer } from '../ai/types';
import ContactPickerModal from '../components/ContactPickerModal';
import { getCoachLogs, saveCoachLog } from '../storage/flowLogStorage';
import { getPeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';

const SAMPLE_COACH_PROMPT =
  '田中さんに美容サロン経営者を紹介してほしいです。まだ一回しか会っていません。今お願いしてもいいですか？';

/**
 * 営業コーチ（CLAUDE.md 5.7）。
 * - 選択した人物の直近 coach_logs をロードし、チャット形式で表示する
 * - 送信ごとに会話へ追記し、直近履歴をコンテキストとしてAIに渡すマルチターン形式
 * - コーチは提案のみ。Contact/SalesRoute/Task を自動更新しない
 */

type ChatTurn = {
  key: string;
  question: string;
  answer: string;
  /** 科学的根拠（coach_logs.advice） */
  advice: string;
  nextAction: string;
  createdAt: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function answerToText(answer: CoachAnswer) {
  // coach_logs.answer と同じ結合ルール（flowLogStorage.saveCoachLog）。
  // 再ログイン後に履歴を読み直しても、同じ見た目で復元される。
  return [answer.conclusion, answer.reason, answer.translation].filter(Boolean).join('\n');
}

export default function CoachChatScreen({ route }: ScreenProps<'CoachChat'>) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [draft, setDraft] = useState(route.params?.initialPrompt ?? '');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const selectedPerson = people.find((person) => person.id === selectedPersonId);

  useEffect(() => {
    getPeople()
      .then((loaded) => setPeople(loaded.filter((person) => !person.archivedAt)))
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : '人物データの取得に失敗しました。'));
  }, []);

  useEffect(() => {
    if (route.params?.initialPrompt) {
      setDraft(route.params.initialPrompt);
    }
  }, [route.params?.initialPrompt]);

  const loadHistory = useCallback(async (personId: string | undefined) => {
    setHistoryLoading(true);
    setErrorMessage('');
    try {
      const logs = await getCoachLogs(personId);
      setTurns(
        logs.map((log) => ({
          key: log.rowId,
          question: log.question,
          answer: log.answer,
          advice: log.advice,
          nextAction: log.nextAction,
          createdAt: log.createdAt,
        })),
      );
    } catch (error) {
      setTurns([]);
      setErrorMessage(error instanceof Error ? error.message : '相談履歴の取得に失敗しました。');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(selectedPersonId);
  }, [loadHistory, selectedPersonId]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = async () => {
    const problem = draft.trim();
    if (!problem || pendingQuestion !== null) {
      return;
    }

    setDraft('');
    setErrorMessage('');
    setPendingQuestion(problem);
    scrollToEnd();

    try {
      const history = turns.slice(-6).map((turn) => ({ question: turn.question, answer: turn.answer }));
      const result = await getLlmAdapter().coachChat({ problem, person: selectedPerson, history });

      const newTurn: ChatTurn = {
        key: `local-${Date.now()}`,
        question: problem,
        answer: answerToText(result),
        advice: result.evidence,
        nextAction: result.nextAction,
        createdAt: new Date().toISOString(),
      };

      // AI成功時のみ coach_logs へ永続化する（Issue #17 / CLAUDE.md 4.4）。
      // 回答自体は表示するため、ログ保存の失敗は会話を消さずエラーだけ知らせる。
      try {
        await saveCoachLog({ person: selectedPerson, problem, answer: result });
      } catch (saveError) {
        setErrorMessage(saveError instanceof Error ? saveError.message : '相談ログの保存に失敗しました。');
      }

      setTurns((current) => [...current, newTurn]);
    } catch (error) {
      // AI失敗時は会話に追記せず、入力欄に相談文を戻して再送できるようにする
      setErrorMessage(toLlmErrorMessage(error));
      setDraft(problem);
    } finally {
      setPendingQuestion(null);
      scrollToEnd();
    }
  };

  const personLabel = selectedPerson
    ? [selectedPerson.name, [selectedPerson.company, selectedPerson.role].filter(Boolean).join('・') || selectedPerson.industry]
        .filter(Boolean)
        .join('｜')
    : '相手を指定しない（全般相談）';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.coachBadge}>
            <Bot color="#153E75" size={20} />
          </View>
          <View style={styles.headerTextBox}>
            <Text style={styles.title}>営業コーチ</Text>
            <Text style={styles.subcopy}>営業の迷いを、次の行動に変える</Text>
          </View>
        </View>
        <Pressable style={styles.personSelector} onPress={() => setPickerOpen(true)}>
          <Text style={styles.personSelectorLabel}>相談する相手</Text>
          <View style={styles.personSelectorValueRow}>
            <Text style={styles.personSelectorValue} numberOfLines={1}>
              {personLabel}
            </Text>
            <ChevronDown color="#64748B" size={16} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {historyLoading ? (
          <View style={styles.historyLoading}>
            <ActivityIndicator color="#153E75" size="small" />
            <Text style={styles.historyLoadingText}>相談履歴を読み込んでいます...</Text>
          </View>
        ) : turns.length === 0 && pendingQuestion === null ? (
          <View style={styles.emptyState}>
            <Sparkles color="#153E75" size={22} />
            <Text style={styles.emptyTitle}>
              {selectedPerson ? `${selectedPerson.name}についての最初の相談です` : 'まだ相談履歴がありません'}
            </Text>
            <Text style={styles.emptyText}>
              紹介依頼のタイミング、返信の温度感、次の一手など、迷っていることをそのまま書いてください。
            </Text>
            <Pressable
              style={styles.sampleButton}
              onPress={() => {
                setDraft(SAMPLE_COACH_PROMPT);
              }}
            >
              <Text style={styles.sampleButtonText}>サンプル相談を入れる</Text>
            </Pressable>
          </View>
        ) : (
          turns.map((turn) => (
            <View key={turn.key}>
              <View style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{turn.question}</Text>
                </View>
              </View>
              <Text style={styles.timeRight}>{formatTime(turn.createdAt)}</Text>

              <View style={styles.coachRow}>
                <View style={styles.coachAvatar}>
                  <Bot color="#153E75" size={16} />
                </View>
                <View style={styles.coachBubble}>
                  <Text style={styles.coachText}>{turn.answer}</Text>
                  {turn.advice ? <Text style={styles.coachEvidence}>根拠：{turn.advice}</Text> : null}
                  {turn.nextAction ? (
                    <View style={styles.nextActionBox}>
                      <Text style={styles.nextActionLabel}>次の行動</Text>
                      <Text style={styles.nextActionText}>{turn.nextAction}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.timeLeft}>{formatTime(turn.createdAt)}</Text>
            </View>
          ))
        )}

        {pendingQuestion !== null ? (
          <View>
            <View style={styles.userRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{pendingQuestion}</Text>
              </View>
            </View>
            <View style={styles.coachRow}>
              <View style={styles.coachAvatar}>
                <Bot color="#153E75" size={16} />
              </View>
              <View style={[styles.coachBubble, styles.typingBubble]}>
                <ActivityIndicator color="#153E75" size="small" />
                <Text style={styles.typingText}>コーチが考えています...</Text>
              </View>
            </View>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorNotice}>{errorMessage}</Text> : null}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="例：この人に紹介依頼していい？ このLINE重い？"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (!draft.trim() || pendingQuestion !== null) && styles.sendDisabled]}
          onPress={send}
          disabled={!draft.trim() || pendingQuestion !== null}
        >
          {pendingQuestion !== null ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Send color="#FFFFFF" size={18} />}
        </Pressable>
      </View>

      <ContactPickerModal
        visible={pickerOpen}
        people={people}
        selectedPersonId={selectedPersonId}
        allowNone
        noneLabel="相手を指定しない（全般相談）"
        title="相談する相手を選ぶ"
        subtitle="相手を選ぶと、その人の人脈カードと相談履歴を踏まえて回答します。"
        onClose={() => setPickerOpen(false)}
        onSelect={(person) => {
          setSelectedPersonId(person?.id);
          setPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 12,
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  coachBadge: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTextBox: { flex: 1 },
  title: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
  },
  subcopy: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  personSelector: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  personSelectorLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
  },
  personSelectorValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  personSelectorValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  chatArea: { flex: 1 },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  historyLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  historyLoadingText: {
    color: '#64748B',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 22,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
  },
  sampleButton: {
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sampleButtonText: {
    color: '#153E75',
    fontWeight: '900',
  },
  userRow: {
    alignItems: 'flex-end',
    marginTop: 14,
  },
  userBubble: {
    backgroundColor: '#153E75',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  timeRight: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
  coachRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  coachAvatar: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderColor: '#B8D4FF',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  coachBubble: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    flexShrink: 1,
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  coachText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 22,
  },
  coachEvidence: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  nextActionBox: {
    backgroundColor: '#EAF2FF',
    borderRadius: 8,
    marginTop: 10,
    padding: 10,
  },
  nextActionLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
  },
  nextActionText: {
    color: '#153E75',
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 2,
  },
  timeLeft: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 36,
    marginTop: 3,
  },
  typingBubble: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  typingText: {
    color: '#64748B',
    fontWeight: '700',
  },
  errorNotice: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 8,
    borderWidth: 1,
    color: '#B91C1C',
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 14,
    padding: 12,
  },
  inputBar: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE8',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#153E75',
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sendDisabled: {
    opacity: 0.4,
  },
});
