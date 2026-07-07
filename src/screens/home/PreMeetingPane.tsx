import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Search } from 'lucide-react-native';
import AttachmentTextInput from '../../components/AttachmentTextInput';
import FilterChip from '../../components/FilterChip';
import Info from '../../components/Info';
import Route from '../../components/Route';
import Section from '../../components/Section';
import { dedupePeople } from '../../logic/personPriority';
import { createPreMeetingNavigation, getActionGuidance } from '../../logic/preMeetingNav';
import type { Person } from '../../types/person';
import { formatDateTime } from '../../utils/date';
import { homeStyles as styles } from './homeStyles';

export default function PreMeetingPane({
  people,
  initialPersonId,
  onAfter,
  onLine,
  onOpenPerson,
  onOpenCoach,
}: {
  people: Person[];
  initialPersonId?: string;
  onAfter: () => void;
  onLine: () => void;
  onOpenPerson: (personId?: string) => void;
  onOpenCoach: (initialPrompt: string) => void;
}) {
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId ?? '');
  const [actionType, setActionType] = useState('情報交換前');
  const [memo, setMemo] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const [personQuery, setPersonQuery] = useState('');
  const [showReferenceDetails, setShowReferenceDetails] = useState(false);
  const [showNavDetails, setShowNavDetails] = useState(false);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [showMoreNavActions, setShowMoreNavActions] = useState(false);

  const uniquePeople = useMemo(() => dedupePeople(people), [people]);
  const selectedPerson = useMemo(() => {
    const currentId = selectedPersonId || initialPersonId || uniquePeople[0]?.id;
    return uniquePeople.find((person) => person.id === currentId) ?? uniquePeople[0];
  }, [initialPersonId, selectedPersonId, uniquePeople]);

  const nav = useMemo(() => createPreMeetingNavigation(selectedPerson, actionType), [actionType, selectedPerson]);
  const currentPersonId = selectedPerson?.id ?? selectedPersonId;
  const candidatePeople = useMemo(() => {
    const normalized = personQuery.trim().toLowerCase();
    const matches = normalized
      ? uniquePeople.filter((person) =>
          [person.name, person.industry, person.relationship, person.categories.join(' '), person.nextAction, person.rawMemo]
            .join(' ')
            .toLowerCase()
            .includes(normalized),
        )
      : uniquePeople;

    return dedupePeople(matches).slice(0, 20);
  }, [personQuery, uniquePeople]);

  const copyQuestions = () => {
    Clipboard.setStringAsync(nav.questions.map((question, index) => `${index + 1}. ${question}`).join('\n')).catch(() => undefined);
    setCopyNotice(true);
    Alert.alert('質問をコピーしました', '予定前ナビで決めた質問をコピーしました。');
  };

  const goAfterMemo = () => {
    Alert.alert('後メモへ引き継ぎます', '相手・目的・質問・記録項目を後メモに渡す想定のUIです。');
    onAfter();
  };

  if (people.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="予定前ナビ" subtitle="会う前に、今日の目的と聞くべき質問を決める">
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>まだ相手が選ばれていません。</Text>
            <Text style={styles.emptyText}>今日会う人、連絡する人、LINEする人を選んでください。</Text>
            <Pressable style={styles.emptyButton} onPress={() => Alert.alert('人脈カードから選ぶ', '人脈カード一覧から相手を選ぶ想定です。')}>
              <Text style={styles.emptyButtonText}>人脈カードから選ぶ</Text>
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
          <Pressable style={styles.smallOutlineButton} onPress={() => Alert.alert('履歴', '過去の予定前ナビへ移動する想定です。')}>
            <Text style={styles.smallOutlineText}>履歴</Text>
          </Pressable>
        </View>
      </View>

      <Section title="相手を選ぶ" subtitle="選択中の相手だけ表示します。変更するときだけ検索を開きます。">
        {selectedPerson ? (
          <View style={styles.selectedPersonSummary}>
            <Text style={styles.selectedSummaryLabel}>選択中</Text>
            <Text style={styles.selectedSummaryName}>{selectedPerson.name}</Text>
            <Text style={styles.selectedSummaryMeta}>
              {selectedPerson.industry} / {selectedPerson.relationship}
            </Text>
            <Text style={styles.selectedSummaryAction}>今日の焦点：{selectedPerson.nextAction}</Text>
          </View>
        ) : null}

        <Pressable style={styles.changePersonButton} onPress={() => setPersonPickerOpen(true)}>
          <Search color="#0F172A" size={18} />
          <Text style={styles.changePersonText}>相手を変更する</Text>
        </Pressable>
      </Section>

      <Modal visible={personPickerOpen} transparent animationType="slide" onRequestClose={() => setPersonPickerOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.personPickerSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>相手を検索</Text>
                <Text style={styles.sheetSubcopy}>名前・業種・関係性・メモから探せます。</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setPersonPickerOpen(false)}>
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Search color="#64748B" size={18} />
              <TextInput
                value={personQuery}
                onChangeText={setPersonQuery}
                placeholder="相手を検索"
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.resultHint}>候補 {candidatePeople.length}件</Text>
            <ScrollView style={styles.personPickerList} showsVerticalScrollIndicator={false}>
              {candidatePeople.length > 0 ? (
                candidatePeople.map((person) => {
                  const selected = person.id === currentPersonId;
                  return (
                    <Pressable
                      key={person.id}
                      style={[styles.personSelectCard, selected && styles.personSelectCardActive]}
                      onPress={() => {
                        setSelectedPersonId(person.id);
                        setHasGenerated(false);
                        setCopyNotice(false);
                        setShowReferenceDetails(false);
                        setShowNavDetails(false);
                        setShowMoreNavActions(false);
                        setPersonPickerOpen(false);
                      }}
                    >
                      <View style={styles.personSelectTop}>
                        <Text style={styles.personSelectName}>{person.name}</Text>
                        {selected ? <Text style={styles.selectedMark}>選択中</Text> : null}
                      </View>
                      <Text style={styles.personSelectMeta}>
                        {person.industry} / {person.relationship}
                      </Text>
                      <Text style={styles.personSelectTags}>分類：{person.categories.join('・')}</Text>
                      <Text style={styles.personSelectAction}>次アクション：{person.nextAction}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyPickerState}>
                  <Text style={styles.emptyTitle}>候補が見つかりません。</Text>
                  <Text style={styles.emptyText}>名前、業種、関係性、メモの一部で検索してみてください。</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Section title="アクション種別を選ぶ">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {['初回連絡前', '商談前', '電話前', 'LINE前', '情報交換前', '追客前', '紹介依頼前', '関係構築前'].map((item) => (
            <FilterChip
              key={item}
              label={item}
              selected={actionType === item}
              onPress={() => {
                setActionType(item);
                setHasGenerated(false);
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
          <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('参照情報を編集', '人脈カードの基本情報編集へ進む想定です。')}>
            <Text style={styles.secondaryCtaText}>参照情報を編集</Text>
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
        style={styles.fullPrimaryButton}
        onPress={() => {
          setHasGenerated(true);
          setCopyNotice(false);
          setShowNavDetails(false);
          setShowMoreNavActions(false);
          Alert.alert('今日のナビを作りました', '人脈カード情報と追加メモを参照したモックナビを表示します。');
        }}
      >
        <Text style={styles.fullPrimaryText}>今日のナビを作る</Text>
      </Pressable>

      {hasGenerated ? (
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
              <Text key={question} style={styles.questionPreviewText}>
                {index + 1}. {question}
              </Text>
            ))}
          </View>

          <Pressable style={styles.toggleRow} onPress={() => setShowNavDetails((value) => !value)}>
            <Text style={styles.toggleText}>{showNavDetails ? '詳細ナビを閉じる' : '詳細ナビを開く'}</Text>
          </Pressable>

          {showNavDetails ? (
            <>
              <Info label="今日の会話方針" value={nav.policy} />
              <Info label="聞くべき質問" value={nav.questions.map((question, index) => `${index + 1}. ${question}`).join('\n')} />
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
              <Pressable style={styles.secondaryCta} onPress={onLine}>
                <Text style={styles.secondaryCtaText}>LINE文を作る</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => onOpenCoach(nav.coachPrompt)}>
                <Text style={styles.secondaryCtaText}>コーチ相談</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('予定前ナビを保存しました', '人脈カードの予定前ナビ履歴に保存する想定です。')}>
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

      <Section title="過去の予定前ナビ">
        <Route title="6月18日 / 田中さん / 情報交換前" meta="目的：美容業界の採用・集客課題を聞く / 状態：後メモ未入力" />
        <Route title="6月17日 / 山本さん / 初回連絡前" meta="目的：整体院の経営課題を確認 / 状態：後メモ入力済み" />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryCta} onPress={() => Alert.alert('履歴を見る', '予定前ナビ履歴一覧を開く想定です。')}>
            <Text style={styles.secondaryCtaText}>履歴を見る</Text>
          </Pressable>
          <Pressable style={styles.secondaryCta} onPress={onAfter}>
            <Text style={styles.secondaryCtaText}>後メモを入力</Text>
          </Pressable>
        </View>
      </Section>
    </ScrollView>
  );
}
