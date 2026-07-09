import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Search } from 'lucide-react-native';
import { buildContactAIContext } from '../../ai/aiContext';
import { getLlmAdapter, toLlmErrorMessage } from '../../ai/llmAdapter';
import type { LineCheckAnalysis } from '../../ai/types';
import AttachmentTextInput from '../../components/AttachmentTextInput';
import ContactPickerModal from '../../components/ContactPickerModal';
import FilterChip from '../../components/FilterChip';
import Section from '../../components/Section';
import {
  LINE_CHECK_TYPES,
  LINE_NOTICE_OPTIONS,
  LINE_PERSON_FILTERS,
  getLineCheckTypeGuide,
  matchesLinePersonFilter,
  type LineCheckType,
  type LinePersonFilter,
} from '../../logic/lineCheck';
import { deriveGapSignals, GAP_DEFINITIONS } from '../../logic/dataGaps';
import { recordReactionEvent } from '../../logic/groundedEvents';
import { dedupePeople } from '../../logic/personPriority';
import { REACTION_LABELS, reactionFromTemperatureLabel } from '../../logic/reactions';
import { cancelContactNotification, scheduleContactNotification } from '../../notifications/notificationService';
import { addOpenGaps, resolveGaps } from '../../storage/dataGapStorage';
import { saveMessageCheck } from '../../storage/flowLogStorage';
import { updatePerson } from '../../storage/personStorage';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';

export default function LineCheckPane({
  people,
  personId,
  onPersonUpdated,
  onAfter,
  onOpenPerson,
  onCoach,
}: {
  people: Person[];
  personId?: string;
  onPersonUpdated: (person: Person) => void;
  onAfter: (personId?: string) => void;
  onOpenPerson: (personId?: string) => void;
  onCoach: (initialPrompt: string) => void;
}) {
  const [selectedPersonId, setSelectedPersonId] = useState(personId);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [checkType, setCheckType] = useState<LineCheckType>('受信文チェック');
  const [messageText, setMessageText] = useState('');
  const [analysis, setAnalysis] = useState<LineCheckAnalysis | null>(null);
  const [checking, setChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const candidates = useMemo(() => dedupePeople(people), [people]);
  const currentPersonId = selectedPersonId ?? personId ?? candidates[0]?.id;
  const selectedPerson = useMemo(
    () => candidates.find((person) => person.id === currentPersonId) ?? candidates[0],
    [candidates, currentPersonId],
  );
  const typeGuide = getLineCheckTypeGuide(checkType);

  const resetResult = () => {
    setAnalysis(null);
    setErrorMessage('');
    setCopyNotice('');
    setSavedNotice(false);
  };

  const checkMessage = async () => {
    if (checking) return;
    if (!selectedPerson) {
      Alert.alert('相手を選んでください', '文面を確認する相手を先に選んでください。');
      return;
    }
    if (!messageText.trim()) {
      Alert.alert('文面を入力してください', '送る前の文、相手から来た返信、スクショメモ、音声メモなどを入力してください。');
      return;
    }

    setChecking(true);
    resetResult();
    try {
      // 生成直前にSupabaseから蓄積データを集約して注入する（CLAUDE.md 6章）
      const context = await buildContactAIContext(selectedPerson);
      const result = await getLlmAdapter().analyzeMessageCheck({
        person: selectedPerson,
        checkType,
        text: messageText,
        context,
      });
      setAnalysis(result);
    } catch (error) {
      // AI失敗時は分析結果を持たない＝人脈カードへの保存操作ができない状態を維持する
      setAnalysis(null);
      setErrorMessage(toLlmErrorMessage(error));
    } finally {
      setChecking(false);
    }
  };

  const copyReply = async () => {
    if (!analysis) return;
    await Clipboard.setStringAsync(analysis.replyDraft);
    setCopyNotice('返信文をコピーしました');
  };

  const saveToPersonCard = async () => {
    if (!selectedPerson || !analysis) return;

    const memo = [
      `文面確認（${checkType}）`,
      `入力文：${messageText || '未入力'}`,
      `温度感：${analysis.temperature.label} / ${analysis.temperature.reason}`,
      `抽出情報：${analysis.extracted.map((item) => `${item.label}：${item.value}`).join('、')}`,
      `返信方針：${analysis.judgement}`,
      `返信文案：${analysis.replyDraft}`,
      `分類更新案：${analysis.categoryUpdate}`,
      `次アクション：${analysis.nextAction}`,
      `注意点：${analysis.caution}`,
    ].join('\n');

    try {
      // 分析結果を message_checks に永続化してから、人脈カードへ反映する（Issue #17）
      const messageCheckRowId = await saveMessageCheck({
        person: selectedPerson,
        checkType,
        text: messageText,
        analysis,
      });

      const saved = await updatePerson({
        ...selectedPerson,
        nextAction: analysis.nextAction,
        nextQuestion: analysis.nextQuestion,
        lineMessage: analysis.replyDraft,
        cautions: analysis.caution,
        additionalMemo: [selectedPerson.additionalMemo, memo].filter(Boolean).join('\n\n'),
      });

      // 送信前チェック等は「送信イベント」、受信文は「受信イベント」として台帳に記録する。
      // AI温度感ラベルを相手の反応として台帳に残す（数値スコアには変換しない）。
      const isOutbound = checkType === '送信前チェック' || checkType === '紹介依頼文' || checkType === 'お礼文' || checkType === '返信作成';
      const reaction = reactionFromTemperatureLabel(analysis.temperature.label);
      const event = await recordReactionEvent({
        person: saved,
        action: isOutbound ? 'message_sent' : 'message_received',
        reaction,
        title: `文面確認（${checkType}）を保存`,
        summary: `温度感：${analysis.temperature.label}。${analysis.judgement.slice(0, 120)}`,
        sourceType: 'message_check',
        sourceId: messageCheckRowId,
      });

      // 受信文からもdata_gapsを更新する（確認できた事項をresolved、未確認をopenに）
      const signals = deriveGapSignals(messageText);
      await resolveGaps(event.saved, signals.resolved);
      await addOpenGaps(
        event.saved,
        signals.stillOpen.map((gapType) => ({
          gapType,
          title: GAP_DEFINITIONS[gapType].title,
          reason: GAP_DEFINITIONS[gapType].reason,
        })),
      );

      onPersonUpdated(event.saved);
      setSavedNotice(true);
      Alert.alert(
        '人脈カードに保存しました',
        [
          'LINE・DMの内容から抽出した営業データを人脈カードに蓄積しました。',
          `記録した反応：${REACTION_LABELS[reaction]}`,
        ].join('\n'),
      );
    } catch (error) {
      // 保存に失敗した場合は成功表示をしない（CLAUDE.md 4.2）
      Alert.alert('保存に失敗しました', error instanceof Error ? error.message : '文面確認の保存中にエラーが発生しました。');
    }
  };

  const sendToAfterMemo = () => {
    onAfter(selectedPerson?.id);
  };

  const applyLineReminder = async (option: string) => {
    if (!selectedPerson) {
      setNotificationOpen(false);
      return;
    }

    setNotificationOpen(false);

    if (option === '通知なし') {
      await cancelContactNotification(selectedPerson.notificationId);
      const saved = await updatePerson({
        ...selectedPerson,
        notificationId: undefined,
      });
      onPersonUpdated(saved);
      Alert.alert('通知なしにしました', '次回連絡通知は設定されていません。');
      return;
    }

    const days = option.includes('明日') ? 1 : option.includes('1週間') ? 7 : 3;
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);

    let notificationId = selectedPerson.notificationId;
    let notice = `${formatDateTime(date.toISOString())} に${selectedPerson.name}への連絡通知を設定しました。`;
    try {
      notificationId = await scheduleContactNotification(selectedPerson, date);
    } catch {
      notice = `次回連絡日を ${formatDateTime(date.toISOString())} に設定しました（通知は設定できませんでした）。`;
    }

    const saved = await updatePerson({
      ...selectedPerson,
      nextContactAt: date.toISOString(),
      notificationId,
    });
    onPersonUpdated(saved);
    Alert.alert('通知を設定しました', notice);
  };

  if (people.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="文面確認" subtitle="送る前に確認し、相手の返信を営業データに変える">
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>まだ相手がいません。</Text>
            <Text style={styles.emptyText}>先に人脈カードを追加すると、LINEやDMの内容を相手ごとに蓄積できます。</Text>
          </View>
        </Section>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.paneHeaderRow}>
        <View style={styles.paneHeaderText}>
          <Text style={styles.paneTitle}>受信文チェック</Text>
          <Text style={styles.paneSubcopy}>相手の返信を貼るだけで、返信・保存・次アクションまで整理する</Text>
        </View>
        <View style={styles.paneHeaderActions}>
          <Pressable style={styles.smallOutlineButton} onPress={() => onOpenPerson(selectedPerson?.id)}>
            <Text style={styles.smallOutlineText}>人脈</Text>
          </Pressable>
        </View>
      </View>

      <Section title="相手を選ぶ" subtitle="他の画面から開いた場合は、その相手が選択されています。違う場合は検索で変更してください。">
        {selectedPerson ? (
          <View style={styles.selectedPersonSummary}>
            <Text style={styles.selectedSummaryLabel}>選択中</Text>
            <Text style={styles.selectedSummaryName}>{selectedPerson.name}</Text>
            <Text style={styles.selectedSummaryMeta}>
              {[
                [selectedPerson.company, selectedPerson.role].filter(Boolean).join('・'),
                `${selectedPerson.industry} / ${selectedPerson.categories.join(' / ')}`,
              ]
                .filter(Boolean)
                .join('｜')}
            </Text>
            <Text style={styles.selectedSummaryAction}>次アクション：{selectedPerson.nextAction}</Text>
          </View>
        ) : null}
        <Pressable style={styles.changePersonButton} onPress={() => setPersonPickerOpen(true)}>
          <Search color="#0F172A" size={18} />
          <Text style={styles.changePersonText}>相手を検索・変更する</Text>
        </Pressable>
      </Section>

      <ContactPickerModal
        visible={personPickerOpen}
        people={candidates}
        selectedPersonId={selectedPerson?.id}
        onClose={() => setPersonPickerOpen(false)}
        filter={{
          options: LINE_PERSON_FILTERS,
          initial: '最近やり取り',
          matches: (person, option) => matchesLinePersonFilter(person, option as LinePersonFilter),
        }}
        onSelect={(person) => {
          if (person) {
            setSelectedPersonId(person.id);
            resetResult();
          }
          setPersonPickerOpen(false);
        }}
      />

      <Section title="チェック種別" subtitle="基本は受信文チェックのままでOK。必要な時だけ切り替えます。">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {LINE_CHECK_TYPES.map((item) => (
            <FilterChip
              key={item}
              label={item}
              selected={checkType === item}
              onPress={() => {
                setCheckType(item);
                resetResult();
              }}
            />
          ))}
        </ScrollView>
        <Text style={styles.guidanceText}>{typeGuide}</Text>
      </Section>

      <Section title="相手から来た文を貼る" subtitle="LINE・DM・メールの返信をそのまま貼ります。スクショや音声メモは、内容を雑に書けばOKです。">
        <AttachmentTextInput
          value={messageText}
          onChangeText={(value) => {
            setMessageText(value);
            resetResult();
          }}
          placeholder="例：相手から「最近はリピート率が課題ですね。新規は来るけど続かないです」と返信が来た。"
          minHeight={132}
        />
      </Section>

      <Section title="参照している人脈情報" subtitle="文面だけで判断せず、人脈カードの情報と合わせてナビを出します。">
        <View style={styles.referenceSummaryCard}>
          <Text style={styles.referenceSummaryTitle}>
            {selectedPerson?.name}｜{selectedPerson?.industry}
          </Text>
          <Text style={styles.referenceSummaryText}>分類：{selectedPerson?.categories.join(' / ')}</Text>
          <Text style={styles.referenceSummaryText}>現在のゴール：{selectedPerson?.goal}</Text>
          <Text style={styles.referenceSummaryText}>次アクション：{selectedPerson?.nextAction}</Text>
          <Text style={styles.referenceSummaryCaution}>注意点：{selectedPerson?.cautions}</Text>
        </View>
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryCta} onPress={() => onOpenPerson(selectedPerson?.id)}>
            <Text style={styles.secondaryCtaText}>人脈カードを見る</Text>
          </Pressable>
          <Pressable style={styles.secondaryCta} onPress={() => onAfter(selectedPerson?.id)}>
            <Text style={styles.secondaryCtaText}>後メモを見る</Text>
          </Pressable>
        </View>
      </Section>

      <Pressable style={[styles.fullPrimaryButton, checking && styles.buttonDisabled]} onPress={checkMessage} disabled={checking}>
        {checking ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        <Text style={styles.fullPrimaryText}>{checking ? 'AIが分析中...' : 'AIで返信と更新案を作る'}</Text>
      </Pressable>

      {errorMessage ? <Text style={styles.errorNotice}>{errorMessage}</Text> : null}

      {checking ? (
        <Section title="分析結果">
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#153E75" size="large" />
            <Text style={styles.loadingText}>AIが文面と人脈カードを分析しています。数秒〜数十秒かかることがあります。</Text>
          </View>
        </Section>
      ) : analysis ? (
        <>
          <Section title="AIの結論" subtitle={`${selectedPerson?.name ?? '相手未選択'} / ${checkType}`}>
            <LineResultCard title="今どう返すか" body={analysis.judgement} />
            <LineResultCard title="返信文案" body={analysis.replyDraft} />
            <LineResultCard title="次にやること" body={`${analysis.nextAction}\n次回連絡：${analysis.nextContact}`} />
          </Section>

          <Section title="人脈カードに保存する内容" subtitle="この返信から営業データとして蓄積する項目です。">
            <LineResultCard title="保存される要点" body={analysis.cardUpdate} />
            <LineResultCard title="次に聞く質問" body={`${analysis.nextQuestion}\n\n目的：${analysis.questionPurpose}`} />
          </Section>

          <Section title="詳細分析" subtitle="必要な時だけ読む確認情報です。">
            <LineResultCard title="相手の温度感" body={`${analysis.temperature.label}\n理由：${analysis.temperature.reason}`} />
            <LineResultCard title="抽出された情報" body={analysis.extracted.map((item) => `・${item.label}：${item.value}`).join('\n')} />
            <LineResultCard title="注意点" body={analysis.caution} />
            <LineResultCard title="営業フィードバック" body={`良い点：${analysis.feedbackGood}\n改善点：${analysis.feedbackImprove}`} />
          </Section>

          <Section title="保存・連携" subtitle="分析した内容を人脈カード、後メモ、通知、営業コーチに流します。">
            <View style={styles.primaryActionStack}>
              <Pressable style={styles.primaryCtaWide} onPress={saveToPersonCard}>
                <Text style={styles.primaryCtaText}>人脈カードに保存</Text>
              </Pressable>
              <View style={styles.inlineActions}>
                <Pressable style={styles.secondaryCta} onPress={sendToAfterMemo}>
                  <Text style={styles.secondaryCtaText}>後メモに送る</Text>
                </Pressable>
                <Pressable style={styles.secondaryCta} onPress={() => setNotificationOpen(true)}>
                  <Text style={styles.secondaryCtaText}>次回通知</Text>
                </Pressable>
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.secondaryCta} onPress={copyReply}>
                  <Text style={styles.secondaryCtaText}>返信文をコピー</Text>
                </Pressable>
                <Pressable style={styles.secondaryCta} onPress={() => onCoach(analysis.coachPrompt)}>
                  <Text style={styles.secondaryCtaText}>コーチに相談</Text>
                </Pressable>
              </View>
            </View>
            {savedNotice ? <Text style={styles.successNotice}>人脈カードに保存しました</Text> : null}
            {copyNotice ? <Text style={styles.successNotice}>{copyNotice}</Text> : null}
          </Section>
        </>
      ) : (
        <Section title="分析結果">
          <Text style={styles.emptyText}>まだ文面が入力されていません。送る前の文、相手から来た返信、スクショメモ、音声メモを入れてください。</Text>
        </Section>
      )}

      <Modal visible={notificationOpen} transparent animationType="fade" onRequestClose={() => setNotificationOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.personPickerSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>次回通知を設定</Text>
                <Text style={styles.sheetSubcopy}>返信待ちや追客漏れを防ぐための通知です。</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setNotificationOpen(false)}>
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </Pressable>
            </View>
            {LINE_NOTICE_OPTIONS.map((option) => (
              <Pressable key={option} style={styles.personSelectCard} onPress={() => applyLineReminder(option)}>
                <Text style={styles.personSelectName}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function LineResultCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.navSummaryCard}>
      <Text style={styles.referenceSummaryTitle}>{title}</Text>
      <Text style={styles.referenceSummaryText}>{body}</Text>
    </View>
  );
}
