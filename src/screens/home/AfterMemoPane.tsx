import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { getLlmAdapter, toLlmErrorMessage } from '../../ai/llmAdapter';
import AttachmentTextInput from '../../components/AttachmentTextInput';
import Info from '../../components/Info';
import MemoField from '../../components/MemoField';
import Section from '../../components/Section';
import { createAfterMemoQuestions } from '../../logic/afterMemo';
import { scheduleContactNotification } from '../../notifications/notificationService';
import { saveAfterMemo } from '../../storage/flowLogStorage';
import { updatePerson } from '../../storage/personStorage';
import type { AfterMemoAiSuggestion } from '../../types/aiAnalysis';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';
import type { AfterMemoHandoff } from './types';

function timingLabelToDays(label: string) {
  if (label.includes('明日')) return 1;
  if (label.includes('1週間')) return 7;
  return 3;
}

export default function AfterMemoPane({
  people,
  personId,
  handoff,
  onPersonUpdated,
  onLine,
  onEnd,
  onOpenPerson,
  onCoach,
}: {
  people: Person[];
  personId?: string;
  handoff?: AfterMemoHandoff;
  onPersonUpdated: (person: Person) => void;
  onLine: (personId?: string) => void;
  onEnd: () => void;
  onOpenPerson: (personId?: string) => void;
  onCoach: (initialPrompt: string) => void;
}) {
  const person = useMemo(() => people.find((item) => item.id === personId) ?? people[0], [people, personId]);
  // 予定前ナビからの引き継ぎ質問を最優先で使う（CLAUDE.md 5.4）。
  // 別人物の引き継ぎが残っている場合は使わない（AIContext混入防止）。
  const activeHandoff = handoff && person && handoff.personId === person.id ? handoff : undefined;
  const questions = useMemo(
    () => (activeHandoff && activeHandoff.questions.length > 0 ? activeHandoff.questions : createAfterMemoQuestions(person)),
    [activeHandoff, person],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [talkMemo, setTalkMemo] = useState('');
  const [allInfoMemo, setAllInfoMemo] = useState('');
  const [nextTodo, setNextTodo] = useState('');
  const [suggestion, setSuggestion] = useState<AfterMemoAiSuggestion | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [updatedNotice, setUpdatedNotice] = useState(false);

  const setAnswer = (question: string, value: string) => {
    setAnswers((current) => ({ ...current, [question]: value }));
  };

  const organizeWithAi = async () => {
    if (organizing) return;

    setOrganizing(true);
    setErrorMessage('');
    setSuggestion(null);
    setShowAiDetails(false);
    setUpdatedNotice(false);
    try {
      const result = await getLlmAdapter().analyzeAfterMemo({
        person,
        answers,
        talkMemo,
        allInfoMemo,
        nextTodo,
      });
      setSuggestion(result);
    } catch (error) {
      // AI失敗時は更新案を持たない＝人脈カード更新（DB書き込み）ができない状態を維持する
      setSuggestion(null);
      setErrorMessage(toLlmErrorMessage(error));
    } finally {
      setOrganizing(false);
    }
  };

  const updatePersonCard = async () => {
    if (!person) {
      Alert.alert('人脈カードがありません', '更新対象の人物を選んでください。');
      return;
    }
    if (!suggestion) {
      Alert.alert('AIの更新案がありません', '先に「AIで整理する」を実行してください。');
      return;
    }

    const answeredQuestions = questions
      .map((question) => `${question}\n回答：${answers[question] || '未入力'}`)
      .join('\n\n');
    const memoLines = [
      `予定前ナビの質問回答\n${answeredQuestions}`,
      `話した内容：${talkMemo || '未入力'}`,
      `得た情報全部：${allInfoMemo || '未入力'}`,
      `自分が思う次アクション：${nextTodo || '未入力'}`,
      `AI抽出：${suggestion.accumulation}`,
      `AIフィードバック：${suggestion.feedback}`,
    ];

    try {
      // 後メモ本体を after_memos に永続化してから、人脈カードへ反映する（Issue #17）
      await saveAfterMemo({
        person,
        questions,
        answers,
        talkMemo,
        allInfoMemo,
        nextTodo,
        suggestion,
        preMeetingNavRowId: activeHandoff?.preMeetingNavRowId,
      });

      const saved = await updatePerson({
        ...person,
        goal: suggestion.goal,
        nextAction: suggestion.nextAction,
        nextQuestion: suggestion.nextQuestion,
        lineMessage: suggestion.lineMessage,
        additionalMemo: [person.additionalMemo, memoLines.join('\n')].filter(Boolean).join('\n\n'),
      });
      onPersonUpdated(saved);
      setUpdatedNotice(true);
      Alert.alert('人脈カードを更新しました', '後メモの内容を人脈カードに蓄積しました。');
    } catch (error) {
      // 保存に失敗した場合は成功表示をしない（CLAUDE.md 4.2）
      Alert.alert('保存に失敗しました', error instanceof Error ? error.message : '後メモの保存中にエラーが発生しました。');
    }
  };

  const scheduleNextContact = async () => {
    if (!person) {
      Alert.alert('人脈カードがありません', '通知を設定する人物を選んでください。');
      return;
    }
    if (!suggestion) {
      Alert.alert('AIの更新案がありません', '先に「AIで整理する」を実行してください。');
      return;
    }

    const date = new Date();
    date.setDate(date.getDate() + timingLabelToDays(suggestion.nextContact));
    date.setHours(9, 0, 0, 0);

    let notificationId = person.notificationId;
    let notice = `${formatDateTime(date.toISOString())} に${person.name}への連絡通知を設定しました。`;
    try {
      notificationId = await scheduleContactNotification(person, date);
    } catch {
      notice = `次回連絡日を ${formatDateTime(date.toISOString())} に設定しました（通知は設定できませんでした）。`;
    }

    const saved = await updatePerson({
      ...person,
      nextContactAt: date.toISOString(),
      notificationId,
    });
    onPersonUpdated(saved);
    Alert.alert('次回通知を設定しました', notice);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.paneHeaderRow}>
        <View style={styles.paneHeaderText}>
          <Text style={styles.paneTitle}>後メモ</Text>
          <Text style={styles.paneSubcopy}>会話の回答を営業データにして、人脈カードを更新する</Text>
        </View>
        <View style={styles.paneHeaderActions}>
          <Pressable style={styles.smallOutlineButton} onPress={() => onOpenPerson(person?.id)}>
            <Text style={styles.smallOutlineText}>人脈</Text>
          </Pressable>
        </View>
      </View>

      <Section title="予定前ナビから引き継ぎ" subtitle="予定前で決めた質問に、会話後すぐ回答を入れます。">
        <View style={styles.afterContextCard}>
          <Text style={styles.afterContextTitle}>{person?.name ?? '人物未選択'}</Text>
          <Text style={styles.afterContextMeta}>{person ? `${person.industry} / ${person.relationship}` : '人脈カード未選択'}</Text>
          <Text style={styles.afterContextFocus}>今日の目的：{person?.goal ?? '課題確認と次アクション設定'}</Text>
        </View>
      </Section>

      <Section title="質問への回答">
        {questions.map((question) => (
          <View key={question} style={styles.questionBlock}>
            <Text style={styles.questionText}>{question}</Text>
            <AttachmentTextInput
              value={answers[question] ?? ''}
              onChangeText={(value) => setAnswer(question, value)}
              placeholder="相手の回答をそのまま入力"
              minHeight={76}
              compact
            />
          </View>
        ))}
      </Section>

      <Section title="会話で得た情報を全部入れる" subtitle="分類・温度感・次回タイミングはAIが推論します。ここでは素材を漏らさず残します。">
        <MemoField label="話した内容" value={talkMemo} onChangeText={setTalkMemo} placeholder="会話全体の流れ、相手が強く話していたこと、印象に残った言葉" large />
        <MemoField
          label="得た情報を全部貼る"
          value={allInfoMemo}
          onChangeText={setAllInfoMemo}
          placeholder="課題、背景、周りの人脈、紹介できそうな人、予算感、期限、決裁者、断り理由、温度感、LINEで来た文などを雑に全部"
          large
        />
        <MemoField label="自分が思う次にやること" value={nextTodo} onChangeText={setNextTodo} placeholder="例：3日以内に採用系の情報を送る / 紹介依頼はまだしない / 次回は固定費の話を聞く" />

        <View style={styles.aiExtractHintCard}>
          <Text style={styles.aiExtractTitle}>AIが抽出する営業データ</Text>
          <Text style={styles.aiExtractText}>課題 / 背景 / 温度感 / 紹介可能性 / 決裁者 / 期限 / 予算感 / 次アクション / 次回連絡日 / 聞き漏れ / 改善点</Text>
        </View>
      </Section>

      <Pressable
        style={[styles.fullPrimaryButton, organizing && styles.buttonDisabled]}
        onPress={organizeWithAi}
        disabled={organizing}
      >
        {organizing ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        <Text style={styles.fullPrimaryText}>{organizing ? 'AIが整理中...' : 'AIで整理する'}</Text>
      </Pressable>

      {errorMessage ? <Text style={styles.errorNotice}>{errorMessage}</Text> : null}

      {organizing ? (
        <Section title="AIの人脈カード更新案">
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#153E75" size="large" />
            <Text style={styles.loadingText}>AIが回答と会話データから更新案を作成しています。数秒〜数十秒かかることがあります。</Text>
          </View>
        </Section>
      ) : suggestion ? (
        <Section title="AIの人脈カード更新案" subtitle="分類・ゴール・次アクションを、人脈カードへ戻すための案です。">
          <View style={styles.navSummaryCard}>
            <Info label="分類更新案" value={suggestion.categoryUpdate} compact />
            <Info label="ゴール更新案" value={suggestion.goal} compact />
            <Info label="次アクション" value={suggestion.nextAction} compact />
            <Info label="次回連絡日" value={suggestion.nextContact} compact />
          </View>

          <Pressable style={styles.toggleRow} onPress={() => setShowAiDetails((value) => !value)}>
            <Text style={styles.toggleText}>{showAiDetails ? '更新案の詳細を閉じる' : '更新案の詳細を開く'}</Text>
          </Pressable>

          {showAiDetails ? (
            <>
              <Info label="営業フィードバック" value={suggestion.feedback} />
              <Info label="次回聞くべき質問" value={suggestion.nextQuestion} />
              <Info label="LINE文案" value={suggestion.lineMessage} />
              <Info label="蓄積する情報" value={suggestion.accumulation} />
            </>
          ) : null}

          <View style={styles.primaryActionStack}>
            <Pressable style={styles.primaryCtaWide} onPress={updatePersonCard}>
              <Text style={styles.primaryCtaText}>人脈カードを更新</Text>
            </Pressable>
            <View style={styles.inlineActions}>
              <Pressable style={styles.secondaryCta} onPress={scheduleNextContact}>
                <Text style={styles.secondaryCtaText}>次回通知</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => onLine(person?.id)}>
                <Text style={styles.secondaryCtaText}>LINE文</Text>
              </Pressable>
            </View>
            <View style={styles.inlineActions}>
              <Pressable style={styles.secondaryCta} onPress={() => onCoach(`${person?.name ?? 'この人'}との会話後メモから、人脈カード更新と次アクションを相談したいです。`)}>
                <Text style={styles.secondaryCtaText}>コーチ相談</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={onEnd}>
                <Text style={styles.secondaryCtaText}>今日の処理完了</Text>
              </Pressable>
            </View>
          </View>
          {updatedNotice ? <Text style={styles.successNotice}>人脈カードへ蓄積しました</Text> : null}
        </Section>
      ) : (
        <Section title="AIの人脈カード更新案">
          <Text style={styles.emptyText}>回答と会話データを入力して、「AIで整理する」を押してください。</Text>
        </Section>
      )}
    </ScrollView>
  );
}
