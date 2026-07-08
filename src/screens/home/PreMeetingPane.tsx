import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Search } from 'lucide-react-native';
import { buildContactAIContext } from '../../ai/aiContext';
import { getLlmAdapter, toLlmErrorMessage } from '../../ai/llmAdapter';
import type { PreMeetingNavigation } from '../../ai/types';
import AttachmentTextInput from '../../components/AttachmentTextInput';
import ContactPickerModal from '../../components/ContactPickerModal';
import FilterChip from '../../components/FilterChip';
import Info from '../../components/Info';
import Section from '../../components/Section';
import { dedupePeople } from '../../logic/personPriority';
import { getActionGuidance } from '../../logic/preMeetingNav';
import { savePreMeetingNav } from '../../storage/flowLogStorage';
import { updatePerson } from '../../storage/personStorage';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';
import type { AfterMemoHandoff } from './types';

export default function PreMeetingPane({
  people,
  initialPersonId,
  onAfter,
  onLine,
  onPersonUpdated,
  onAddPerson,
  onOpenPerson,
  onOpenCoach,
}: {
  people: Person[];
  initialPersonId?: string;
  onAfter: (personId?: string, handoff?: AfterMemoHandoff) => void;
  onLine: (personId?: string) => void;
  onPersonUpdated: (person: Person) => void;
  onAddPerson: () => void;
  onOpenPerson: (personId?: string) => void;
  onOpenCoach: (initialPrompt: string) => void;
}) {
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId ?? '');
  const [actionType, setActionType] = useState('情報交換前');
  const [memo, setMemo] = useState('');
  const [nav, setNav] = useState<PreMeetingNavigation | null>(null);
  const [navRowId, setNavRowId] = useState<string | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copyNotice, setCopyNotice] = useState(false);
  const [showReferenceDetails, setShowReferenceDetails] = useState(false);
  const [showNavDetails, setShowNavDetails] = useState(false);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [showMoreNavActions, setShowMoreNavActions] = useState(false);

  const uniquePeople = useMemo(() => dedupePeople(people), [people]);
  const selectedPerson = useMemo(() => {
    const currentId = selectedPersonId || initialPersonId || uniquePeople[0]?.id;
    return uniquePeople.find((person) => person.id === currentId) ?? uniquePeople[0];
  }, [initialPersonId, selectedPersonId, uniquePeople]);

  const currentPersonId = selectedPerson?.id ?? selectedPersonId;

  const generateNav = async () => {
    if (generating) return;

    setGenerating(true);
    setErrorMessage('');
    setNav(null);
    setCopyNotice(false);
    setShowNavDetails(false);
    setShowMoreNavActions(false);
    try {
      // 生成直前にSupabaseから蓄積データ（未解決data_gaps含む）を集約する（CLAUDE.md 6章）。
      // 「聞くべき質問」はこのcontextの未確認事項を埋める質問として生成される。
      const context = selectedPerson ? await buildContactAIContext(selectedPerson) : undefined;
      const result = await getLlmAdapter().createPreMeetingNav({
        person: selectedPerson,
        actionType,
        memo,
        context,
      });

      // AI成功時のみ pre_meeting_navs へ永続化する（Issue #17 / CLAUDE.md 4.2）。
      // 保存に失敗した場合は成功扱いにせず、エラーとして表示する。
      let savedRowId: string | undefined;
      if (selectedPerson) {
        const saved = await savePreMeetingNav({
          person: selectedPerson,
          actionType,
          memo,
          nav: result,
        });
        savedRowId = saved.rowId;
      }

      setNav(result);
      setNavRowId(savedRowId);
    } catch (error) {
      // AI失敗・保存失敗時はナビを表示せず、後メモへの引き継ぎもできない状態を維持する
      setNav(null);
      setNavRowId(undefined);
      setErrorMessage(error instanceof Error && !('kind' in error) ? error.message : toLlmErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const copyQuestions = () => {
    if (!nav) return;
    Clipboard.setStringAsync(nav.questions.map((question, index) => `${index + 1}. ${question}`).join('\n')).catch(() => undefined);
    setCopyNotice(true);
    Alert.alert('質問をコピーしました', '予定前ナビで決めた質問をコピーしました。');
  };

  const goAfterMemo = () => {
    // ナビで決めた質問を後メモへそのまま引き継ぐ（CLAUDE.md 5.4）
    if (nav && currentPersonId) {
      onAfter(currentPersonId, {
        questions: nav.questions,
        preMeetingNavRowId: navRowId,
        personId: currentPersonId,
      });
      return;
    }
    onAfter(currentPersonId);
  };

  const saveNavToPersonCard = async () => {
    if (!selectedPerson || !nav) {
      return;
    }

    const memoLines = [
      `予定前ナビ（${actionType}）`,
      `今日の目的：${nav.purpose}`,
      `今日の到達点：${nav.destination}`,
      `聞くべき質問：\n${nav.questions.map((question, index) => `${index + 1}. ${question}`).join('\n')}`,
      `NG行動：\n${nav.ngActions.map((item) => `・${item}`).join('\n')}`,
      `会話後に記録する項目：\n${nav.recordItems.map((item) => `・${item}`).join('\n')}`,
      memo.trim() ? `当日の追加メモ：${memo.trim()}` : '',
    ].filter(Boolean);

    const saved = await updatePerson({
      ...selectedPerson,
      additionalMemo: [selectedPerson.additionalMemo, memoLines.join('\n')].filter(Boolean).join('\n\n'),
    });
    onPersonUpdated(saved);
    Alert.alert('予定前ナビを保存しました', `${selectedPerson.name}の人脈カードのメモに蓄積しました。`);
  };

  if (people.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="予定前ナビ" subtitle="会う前に、今日の目的と聞くべき質問を決める">
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>まだ相手が選ばれていません。</Text>
            <Text style={styles.emptyText}>先に人脈カードを追加すると、その相手の予定前ナビを作れます。</Text>
            <Pressable style={styles.emptyButton} onPress={onAddPerson}>
              <Text style={styles.emptyButtonText}>人物を追加する</Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.paneHeaderRow}>
        <View style={styles.paneHeaderText}>
          <Text style={styles.paneTitle}>予定前ナビ</Text>
          <Text style={styles.paneSubcopy}>会う前に、今日の目的と聞くべき質問を決める</Text>
        </View>
        <View style={styles.paneHeaderActions}>
          <Pressable style={styles.smallOutlineButton} onPress={() => onOpenPerson(currentPersonId)}>
            <Text style={styles.smallOutlineText}>人脈</Text>
          </Pressable>
        </View>
      </View>

      <Section title="相手を選ぶ" subtitle="選択中の相手だけ表示します。変更するときだけ検索を開きます。">
        {selectedPerson ? (
          <View style={styles.selectedPersonSummary}>
            <Text style={styles.selectedSummaryLabel}>選択中</Text>
            <Text style={styles.selectedSummaryName}>{selectedPerson.name}</Text>
            <Text style={styles.selectedSummaryMeta}>
              {[
                [selectedPerson.company, selectedPerson.role].filter(Boolean).join('・'),
                `${selectedPerson.industry} / ${selectedPerson.relationship}`,
              ]
                .filter(Boolean)
                .join('｜')}
            </Text>
            <Text style={styles.selectedSummaryAction}>今日の焦点：{selectedPerson.nextAction}</Text>
          </View>
        ) : null}

        <Pressable style={styles.changePersonButton} onPress={() => setPersonPickerOpen(true)}>
          <Search color="#0F172A" size={18} />
          <Text style={styles.changePersonText}>相手を変更する</Text>
        </Pressable>
      </Section>

      <ContactPickerModal
        visible={personPickerOpen}
        people={uniquePeople}
        selectedPersonId={currentPersonId}
        onClose={() => setPersonPickerOpen(false)}
        onSelect={(person) => {
          if (person) {
            setSelectedPersonId(person.id);
            setNav(null);
            setNavRowId(undefined);
            setErrorMessage('');
            setCopyNotice(false);
            setShowReferenceDetails(false);
            setShowNavDetails(false);
            setShowMoreNavActions(false);
          }
          setPersonPickerOpen(false);
        }}
      />

      <Section title="アクション種別を選ぶ">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {['初回連絡前', '商談前', '電話前', 'LINE前', '情報交換前', '追客前', '紹介依頼前', '関係構築前'].map((item) => (
            <FilterChip
              key={item}
              label={item}
              selected={actionType === item}
              onPress={() => {
                setActionType(item);
                setNav(null);
                setNavRowId(undefined);
                setErrorMessage('');
                setCopyNotice(false);
                setShowMoreNavActions(false);
              }}
            />
          ))}
        </ScrollView>
        <Text style={styles.guidanceText}>{getActionGuidance(actionType)}</Text>
      </Section>

      <Section title="参照している人脈情報" subtitle="人脈カード・過去メモ・LINEチェックの情報を参照して、今日のナビを作ります。">
        <View style={styles.referenceSummaryCard}>
          <Text style={styles.referenceSummaryTitle}>
            {selectedPerson?.categories.join(' / ') ?? '分類未設定'}
          </Text>
          <Text style={styles.referenceSummaryText}>ゴール：{selectedPerson?.goal ?? '未設定'}</Text>
          <Text style={styles.referenceSummaryText}>次アクション：{selectedPerson?.nextAction ?? '未設定'}</Text>
          <Text style={styles.referenceSummaryCaution}>注意：{selectedPerson?.cautions ?? '未設定'}</Text>
        </View>

        <Pressable style={styles.toggleRow} onPress={() => setShowReferenceDetails((value) => !value)}>
          <Text style={styles.toggleText}>{showReferenceDetails ? '参照情報を閉じる' : '参照情報を開く'}</Text>
        </Pressable>

        {showReferenceDetails ? (
          <>
            <View style={styles.referenceGrid}>
              <Info label="名前" value={selectedPerson?.name ?? '未選択'} compact />
              <Info label="業種" value={selectedPerson?.industry ?? '未選択'} compact />
              <Info label="関係性" value={selectedPerson?.relationship ?? '未選択'} compact />
              <Info label="現在の分類" value={selectedPerson?.categories.join(' / ') ?? '未選択'} compact />
              <Info label="次回連絡日" value={formatDateTime(selectedPerson?.nextContactAt)} compact />
            </View>
            <Info label="過去メモ要約" value={selectedPerson?.rawMemo ?? '過去メモはまだありません。'} />
            <Info
              label="やり取りの記録"
              value={selectedPerson?.additionalMemo ? '追加メモに記録あり。人脈カードで確認できます。' : 'まだやり取りの記録はありません。'}
            />
          </>
        ) : null}
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryCta} onPress={() => onOpenPerson(currentPersonId)}>
            <Text style={styles.secondaryCtaText}>人脈カードを開く</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="今日の追加メモ">
        <AttachmentTextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="例：今日13時に会う。採用の話を少し聞きたい。紹介依頼はまだ早そう。相手は忙しそうなので短く聞きたい。"
          minHeight={132}
        />
      </Section>

      <Pressable
        style={[styles.fullPrimaryButton, generating && styles.buttonDisabled]}
        onPress={generateNav}
        disabled={generating}
      >
        {generating ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        <Text style={styles.fullPrimaryText}>{generating ? 'AIがナビを作成中...' : '今日のナビを作る'}</Text>
      </Pressable>

      {errorMessage ? <Text style={styles.errorNotice}>{errorMessage}</Text> : null}

      {generating ? (
        <Section title="ナビ結果">
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#153E75" size="large" />
            <Text style={styles.loadingText}>AIが人脈カード情報と追加メモから今日のナビを作成しています。数秒〜数十秒かかることがあります。</Text>
          </View>
        </Section>
      ) : nav ? (
        <Section title="ナビ結果" subtitle={`${selectedPerson?.name ?? '相手未選択'} / ${actionType}`}>
          <View style={styles.navSummaryCard}>
            <Info label="今日の目的" value={nav.purpose} compact />
            <Info label="今日の到達点" value={nav.destination} compact />
            <Info label="最初の一言" value={nav.opening} compact />
            <Info label="今日のNG" value={nav.ngActions[0]} compact />
          </View>

          <View style={styles.questionPreview}>
            <Text style={styles.questionPreviewTitle}>まず聞く質問</Text>
            {nav.questions.slice(0, 2).map((question, index) => (
              <View key={question}>
                <Text style={styles.questionPreviewText}>
                  {index + 1}. {question}
                </Text>
                {nav.questionReasons[index] ? (
                  <Text style={styles.questionReasonText}>この質問の理由：{nav.questionReasons[index]}</Text>
                ) : null}
              </View>
            ))}
          </View>

          <Pressable style={styles.toggleRow} onPress={() => setShowNavDetails((value) => !value)}>
            <Text style={styles.toggleText}>{showNavDetails ? '詳細ナビを閉じる' : '詳細ナビを開く'}</Text>
          </Pressable>

          {showNavDetails ? (
            <>
              <Info label="今日の会話方針" value={nav.policy} />
              <Info
                label="聞くべき質問"
                value={nav.questions
                  .map((question, index) => {
                    const reason = nav.questionReasons[index] ? `\n　└ 理由：${nav.questionReasons[index]}` : '';
                    return `${index + 1}. ${question}${reason}`;
                  })
                  .join('\n')}
              />
              <Info label="深掘り質問" value={nav.deepQuestions.map((question) => `・${question}`).join('\n')} />
              <Info label="聞いてはいけないこと" value={nav.ngActions.map((item) => `・${item}`).join('\n')} />
              <Info label="売るべきか、聞くべきか" value={nav.sellOrAsk} />
              <Info label="紹介依頼してよいか" value={nav.referralTiming} />
              <Info label="会話後に記録すべき項目" value={nav.recordItems.map((item) => `・${item}`).join('\n')} />
              <Info label="科学的根拠" value={nav.evidence.map((item) => `・${item}`).join('\n')} />
            </>
          ) : null}

          <View style={styles.primaryActionStack}>
            <Pressable style={styles.primaryCtaWide} onPress={goAfterMemo}>
              <Text style={styles.primaryCtaText}>後メモへ進む</Text>
            </Pressable>
            <View style={styles.inlineActions}>
              <Pressable style={styles.secondaryCta} onPress={copyQuestions}>
                <Text style={styles.secondaryCtaText}>質問をコピー</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => setShowMoreNavActions((value) => !value)}>
                <Text style={styles.secondaryCtaText}>{showMoreNavActions ? 'その他を閉じる' : 'その他'}</Text>
              </Pressable>
            </View>
          </View>

          {showMoreNavActions ? (
            <View style={styles.moreActionPanel}>
              <Pressable style={styles.secondaryCta} onPress={() => onOpenPerson(currentPersonId)}>
                <Text style={styles.secondaryCtaText}>人脈カード</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => onLine(currentPersonId)}>
                <Text style={styles.secondaryCtaText}>LINE文を作る</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => onOpenCoach(nav.coachPrompt)}>
                <Text style={styles.secondaryCtaText}>コーチ相談</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={saveNavToPersonCard}>
                <Text style={styles.secondaryCtaText}>ナビを保存</Text>
              </Pressable>
            </View>
          ) : null}
          {copyNotice ? <Text style={styles.successNotice}>質問をコピーしました</Text> : null}
        </Section>
      ) : (
        <Section title="ナビ結果">
          <Text style={styles.emptyText}>相手・アクション種別・追加メモを確認して、「今日のナビを作る」を押してください。</Text>
        </Section>
      )}
    </ScrollView>
  );
}
