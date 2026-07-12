import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Archive, Bell, CalendarClock, ChevronRight, Share2 } from 'lucide-react-native';
import AttachmentTextInput from '../components/AttachmentTextInput';
import ContactPickerModal from '../components/ContactPickerModal';
import SectionCard from '../components/SectionCard';
import { REACTION_LABELS } from '../logic/reactions';
import { cancelContactNotification, scheduleContactNotification } from '../notifications/notificationService';
import { getInteractionTimeline, type TimelineEntry } from '../storage/interactionLedger';
import {
  getPersonHistorySummary,
  type PersonHistorySummary,
} from '../storage/personHistorySummary';
import { getPeople, getPersonById, updatePerson } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';
import type { Person } from '../types/person';
import { formatDateTime } from '../utils/date';

export default function PersonDetailScreen({ navigation, route }: ScreenProps<'PersonDetail'>) {
  const [person, setPerson] = useState<Person | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [additionalMemo, setAdditionalMemo] = useState('');
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [companyDraft, setCompanyDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState('');
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [introducerPickerOpen, setIntroducerPickerOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [historySummary, setHistorySummary] = useState<PersonHistorySummary | null>(null);
  const [historyError, setHistoryError] = useState('');

  const archivePerson = async () => {
    if (!person) {
      return;
    }

    await cancelContactNotification(person.notificationId);
    await updatePerson({
      ...person,
      archivedAt: new Date().toISOString(),
      notificationId: undefined,
      additionalMemo,
    });
    setArchiveConfirmOpen(false);
    navigation.goBack();
  };

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setLoadError('');
    setPerson(null);
    setHistorySummary(null);
    setHistoryError('');

    Promise.all([getPersonById(route.params.personId), getPeople()])
      .then(([found, people]) => {
        if (!active) {
          return;
        }

        setAllPeople(people.filter((item) => !item.archivedAt));
        if (!found || found.archivedAt) {
          setLoadState('not-found');
          return;
        }

        setPerson(found);
        setAdditionalMemo(found.additionalMemo ?? '');
        setCompanyDraft(found.company ?? '');
        setRoleDraft(found.role ?? '');
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : '人物データの取得中にエラーが発生しました。');
        setLoadState('error');
      });

    // 行動→反応タイムラインは補助情報なので、取得失敗で人物詳細全体を止めない。
    getInteractionTimeline(route.params.personId)
      .then((entries) => {
        if (active) {
          setTimeline(entries);
        }
      })
      .catch(() => {
        if (active) {
          setTimeline([]);
        }
      });

    getPersonHistorySummary(route.params.personId)
      .then((summary) => {
        if (active) {
          setHistorySummary(summary);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setHistoryError(error instanceof Error ? error.message : '営業履歴の集計に失敗しました。');
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey, route.params.personId]);

  // 紹介チェーン（contacts.introduced_by）：紹介元と、この人から紹介された人
  const introducer = person?.introducedById
    ? allPeople.find((item) => item.id === person.introducedById) ?? null
    : null;
  const referredPeople = person
    ? allPeople.filter((item) => item.introducedById === person.id && !item.archivedAt)
    : [];

  const saveIntroducer = async (introducedBy: Person | null) => {
    setIntroducerPickerOpen(false);
    if (!person) {
      return;
    }
    try {
      const saved = await updatePerson({ ...person, introducedById: introducedBy?.id });
      setPerson(saved);
      Alert.alert(
        '紹介元を更新しました',
        introducedBy ? `${introducedBy.name}からの紹介として記録しました。` : '紹介元の設定を解除しました。',
      );
    } catch (error) {
      Alert.alert('保存に失敗しました', error instanceof Error ? error.message : '紹介元の保存中にエラーが発生しました。');
    }
  };

  const saveCompanyRole = async () => {
    if (!person) {
      return;
    }
    const updated = {
      ...person,
      company: companyDraft.trim() || undefined,
      role: roleDraft.trim() || undefined,
    };
    try {
      const saved = await updatePerson(updated);
      setPerson(saved);
      Alert.alert('会社・役職を保存しました');
    } catch (error) {
      Alert.alert('保存に失敗しました', error instanceof Error ? error.message : '会社・役職の保存中にエラーが発生しました。');
    }
  };

  const createReminderDate = (type: 'tomorrow' | 'threeDays' | 'week' | 'none') => {
    if (type === 'none') {
      return null;
    }

    const date = new Date();
    const days = type === 'tomorrow' ? 1 : type === 'threeDays' ? 3 : 7;
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    return date;
  };

  const saveReminder = async (type: 'tomorrow' | 'threeDays' | 'week' | 'none') => {
    if (!person) {
      return;
    }

    if (type === 'none') {
      const updated = {
        ...person,
        nextContactAt: undefined,
        additionalMemo,
      };
      await updatePerson(updated);
      setPerson(updated);
      Alert.alert('通知なしにしました', '次回連絡通知は設定されていません。');
      return;
    }

    const selectedDate = createReminderDate(type);
    if (!selectedDate) {
      return;
    }

    // 端末へのプッシュ通知はあくまで付随機能。スケジューリングに失敗しても
    // （Web版は非対応、権限未許可など）、次回連絡日そのものは必ず保存する。
    let notificationId = person.notificationId;
    let notice = formatDateTime(selectedDate.toISOString());
    try {
      notificationId = await scheduleContactNotification(person, selectedDate);
    } catch (error) {
      notificationId = undefined;
      notice = `${formatDateTime(selectedDate.toISOString())}（${
        error instanceof Error ? error.message : '通知は設定できませんでした。'
      }）`;
    }

    const updated = {
      ...person,
      nextContactAt: selectedDate.toISOString(),
      notificationId,
      additionalMemo,
    };
    await updatePerson(updated);
    setPerson(updated);
    Alert.alert('次回連絡日を設定しました', notice);
  };

  if (loadState === 'loading') {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>人物データを読み込んでいます。</Text>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>人物データを読み込めませんでした</Text>
        <Text style={styles.muted}>{loadError}</Text>
        <Pressable style={styles.primaryButton} onPress={() => setReloadKey((current) => current + 1)}>
          <Text style={styles.primaryButtonText}>再試行</Text>
        </Pressable>
        <Pressable style={styles.stateBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.stateBackButtonText}>前の画面に戻る</Text>
        </Pressable>
      </View>
    );
  }

  if (loadState === 'not-found' || !person) {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>人物が見つかりません</Text>
        <Text style={styles.muted}>削除またはアーカイブされた可能性があります。</Text>
        <Pressable style={styles.stateBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.stateBackButtonText}>人脈一覧に戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.name}>{person.name}</Text>
        {person.company || person.role ? (
          <Text style={styles.companyLine}>{[person.company, person.role].filter(Boolean).join('・')}</Text>
        ) : null}
        <Text style={styles.industry}>{person.industry}</Text>
        <View style={styles.tags}>
          {person.categories.map((category) => (
            <Text key={category} style={styles.tag}>
              {category}
            </Text>
          ))}
        </View>
      </View>

      <SectionCard title="この人の現在地">
        <Text style={styles.currentStepLabel}>次の一手</Text>
        <Text style={styles.currentStepValue}>
          {historySummary?.latestNextStep || person.nextAction || '次の一手がまだ設定されていません。'}
        </Text>
        {historySummary ? (
          <View style={styles.historySummaryGrid}>
            <HistoryMetric label="後メモ" value={historySummary.afterMemoCount} />
            <HistoryMetric label="文面確認" value={historySummary.messageCheckCount} />
            <HistoryMetric label="更新履歴" value={historySummary.updateHistoryCount} />
            <HistoryMetric label="操作履歴" value={historySummary.interactionCount} />
            <HistoryMetric label="営業ルート" value={historySummary.salesRouteCount} />
            <HistoryMetric label="未確認" value={historySummary.unresolvedGapCount} warning />
          </View>
        ) : historyError ? (
          <View style={styles.historyErrorBox}>
            <Text style={styles.historyErrorText}>{historyError}</Text>
            <Pressable style={styles.historyRetryButton} onPress={() => setReloadKey((current) => current + 1)}>
              <Text style={styles.historyRetryText}>履歴を再読込</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.muted}>営業履歴を集計しています。</Text>
        )}
        {historySummary?.latestActivityAt ? (
          <Text style={styles.latestActivity}>最終営業データ：{formatDateTime(historySummary.latestActivityAt)}</Text>
        ) : null}
      </SectionCard>

      <SectionCard title="会社・役職">
        <Text style={styles.fieldLabel}>会社名</Text>
        <TextInput
          value={companyDraft}
          onChangeText={setCompanyDraft}
          placeholder="例：〇〇美容室"
          placeholderTextColor="#94A3B8"
          style={styles.textField}
        />
        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>役職</Text>
        <TextInput
          value={roleDraft}
          onChangeText={setRoleDraft}
          placeholder="例：代表"
          placeholderTextColor="#94A3B8"
          style={styles.textField}
        />
        <Pressable style={styles.primaryButton} onPress={saveCompanyRole}>
          <Text style={styles.primaryButtonText}>会社・役職を保存</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="紹介チェーン">
        <View style={styles.chainHeader}>
          <Share2 color="#153E75" size={16} />
          <Text style={styles.chainHint}>誰の紹介でつながり、誰へ広がったかを記録します。</Text>
        </View>

        <Text style={styles.fieldLabel}>紹介元（この人を紹介してくれた人）</Text>
        {introducer ? (
          <Pressable
            style={styles.chainCard}
            onPress={() => navigation.push('PersonDetail', { personId: introducer.id })}
          >
            <View style={styles.chainCardBody}>
              <Text style={styles.chainName}>{introducer.name}</Text>
              <Text style={styles.chainMeta}>
                {[introducer.company, introducer.role].filter(Boolean).join('・') || introducer.industry}
              </Text>
            </View>
            <ChevronRight color="#94A3B8" size={18} />
          </Pressable>
        ) : (
          <Text style={styles.chainEmpty}>
            {person.introducedById ? '紹介元の人物が見つかりません（アーカイブ済みの可能性）。' : 'まだ設定されていません。'}
          </Text>
        )}
        <Pressable style={styles.chainSetButton} onPress={() => setIntroducerPickerOpen(true)}>
          <Text style={styles.chainSetButtonText}>{introducer ? '紹介元を変更する' : '紹介元を設定する'}</Text>
        </Pressable>

        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>この人から紹介された人（{referredPeople.length}人）</Text>
        {referredPeople.length > 0 ? (
          referredPeople.map((referred) => (
            <Pressable
              key={referred.id}
              style={styles.chainCard}
              onPress={() => navigation.push('PersonDetail', { personId: referred.id })}
            >
              <View style={styles.chainCardBody}>
                <Text style={styles.chainName}>{referred.name}</Text>
                <Text style={styles.chainMeta}>
                  {[referred.company, referred.role].filter(Boolean).join('・') || referred.industry}
                </Text>
              </View>
              <ChevronRight color="#94A3B8" size={18} />
            </Pressable>
          ))
        ) : (
          <Text style={styles.chainEmpty}>まだいません。新しく追加した人の「紹介元」にこの人を設定すると、ここに表示されます。</Text>
        )}
      </SectionCard>

      <Info title="関係性" body={person.relationship} />

      <SectionCard title="行動と反応のタイムライン">
        {timeline.length > 0 ? (
          timeline.map((entry) => (
            <View key={entry.rowId} style={styles.timelineRow}>
              <Text style={styles.timelineDate}>{formatDateTime(entry.happenedAt)}</Text>
              <View style={styles.timelineTitleRow}>
                <Text style={styles.timelineTitle}>{entry.title}</Text>
                {entry.reaction ? (
                  <Text style={[styles.reactionChip, reactionChipStyle(entry.reaction)]}>
                    {REACTION_LABELS[entry.reaction]}
                  </Text>
                ) : null}
              </View>
              {entry.summary ? <Text style={styles.timelineSummary}>{entry.summary}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.paragraph}>
            まだ行動記録がありません。ホームの優先行動を完了したり、後メモ・文面確認を保存すると、ここに行動→反応の履歴が蓄積されます。
          </Text>
        )}
      </SectionCard>
      <Info title="初回切り口" body={person.openingTalk} />
      <Info title="次に聞く質問" body={person.nextQuestion} />
      <Info title="ゴール" body={person.goal} />

      <SectionCard title="ゴールまでの道筋">
        {person.roadmap.map((step, index) => (
          <Text key={step} style={styles.step}>
            {index + 1}. {step}
          </Text>
        ))}
      </SectionCard>

      <Info title="次アクション" body={person.nextAction} />
      <Info title="LINE文" body={person.lineMessage} />
      <Info title="メール文" body={person.emailMessage} />
      <Info title="注意点" body={person.cautions} />

      <SectionCard title="次回連絡日・通知設定">
        <View style={styles.reminderBox}>
          <CalendarClock color="#153E75" size={20} />
          <View style={styles.reminderTextBox}>
            <Text style={styles.reminderLabel}>設定中の日時</Text>
            <Text style={styles.reminderValue}>{formatDateTime(person.nextContactAt)}</Text>
          </View>
        </View>

        <View style={styles.reminderButtons}>
          <ReminderButton label="明日 9:00" onPress={() => saveReminder('tomorrow')} />
          <ReminderButton label="3日後 9:00" onPress={() => saveReminder('threeDays')} />
          <ReminderButton label="1週間後 9:00" onPress={() => saveReminder('week')} />
          <ReminderButton label="通知なし" onPress={() => saveReminder('none')} muted />
        </View>
      </SectionCard>

      <SectionCard title="追加メモ">
        <AttachmentTextInput
          value={additionalMemo}
          onChangeText={setAdditionalMemo}
          placeholder="次に会った時の印象、紹介できそうな人、気づいたことなど"
          minHeight={108}
        />
        <Pressable
          style={styles.primaryButton}
          onPress={async () => {
            const updated = { ...person, additionalMemo };
            await updatePerson(updated);
            setPerson(updated);
            Alert.alert('追加メモを保存しました');
          }}
        >
          <Text style={styles.primaryButtonText}>追加メモを保存</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="アーカイブ">
        <Text style={styles.paragraph}>
          今後の営業対象から外します。過去のメモ・履歴データは削除されず、一覧・検索・相手選択には表示されなくなります。
        </Text>
        <Pressable style={styles.archiveButton} onPress={() => setArchiveConfirmOpen(true)}>
          <Archive color="#B91C1C" size={18} />
          <Text style={styles.archiveButtonText}>アーカイブする</Text>
        </Pressable>
      </SectionCard>

      <ContactPickerModal
        visible={introducerPickerOpen}
        people={allPeople}
        selectedPersonId={person.introducedById}
        excludePersonId={person.id}
        allowNone
        noneLabel="紹介元なし（設定を解除する）"
        title="紹介元を選ぶ"
        subtitle={`${person.name}を紹介してくれた人を選びます。`}
        onClose={() => setIntroducerPickerOpen(false)}
        onSelect={saveIntroducer}
      />

      <Modal
        visible={archiveConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setArchiveConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{person.name}をアーカイブしますか？</Text>
            <Text style={styles.modalBody}>
              一覧・検索・相手選択から非表示になります。過去のメモや履歴データは削除されません。設定済みの次回連絡通知は解除されます。
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setArchiveConfirmOpen(false)}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmButton} onPress={archivePerson}>
                <Text style={styles.modalConfirmText}>アーカイブする</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <SectionCard title={title}>
      <Text style={styles.paragraph}>{body}</Text>
    </SectionCard>
  );
}

function reactionChipStyle(reaction: 'positive' | 'neutral' | 'no_response' | 'rejected') {
  switch (reaction) {
    case 'positive':
      return styles.reactionPositive;
    case 'rejected':
      return styles.reactionRejected;
    case 'no_response':
      return styles.reactionNoResponse;
    default:
      return styles.reactionNeutral;
  }
}

function ReminderButton({
  label,
  muted,
  onPress,
}: {
  label: string;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.reminderButton, muted && styles.mutedButton]} onPress={onPress}>
      {!muted && <Bell color="#FFFFFF" size={16} />}
      <Text style={[styles.reminderButtonText, muted && styles.mutedButtonText]}>{label}</Text>
    </Pressable>
  );
}

function HistoryMetric({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return (
    <View style={[styles.historyMetric, warning && value > 0 && styles.historyMetricWarning]}>
      <Text style={styles.historyMetricValue}>{value}</Text>
      <Text style={styles.historyMetricLabel}>{label}</Text>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  stateTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  muted: {
    color: '#64748B',
    textAlign: 'center',
  },
  stateBackButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 18,
  },
  stateBackButtonText: {
    color: '#153E75',
    fontWeight: '800',
  },
  hero: {
    backgroundColor: '#153E75',
    borderRadius: 8,
    padding: 18,
    marginBottom: 12,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  companyLine: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
  },
  currentStepLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  currentStepValue: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 24,
    marginTop: 4,
  },
  historySummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  historyMetric: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  historyMetricWarning: {
    backgroundColor: '#FEF3C7',
  },
  historyMetricValue: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
  },
  historyMetricLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  latestActivity: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 10,
  },
  historyErrorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginTop: 12,
    padding: 10,
  },
  historyErrorText: {
    color: '#991B1B',
    fontSize: 12,
    lineHeight: 18,
  },
  historyRetryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  historyRetryText: {
    color: '#153E75',
    fontSize: 12,
    fontWeight: '900',
  },
  industry: {
    color: '#DBEAFE',
    fontWeight: '700',
    marginTop: 4,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  fieldLabelSpaced: {
    marginTop: 12,
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
  chainHeader: {
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    padding: 10,
  },
  chainHint: {
    color: '#153E75',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  chainCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    padding: 12,
  },
  chainCardBody: { flex: 1 },
  chainName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
  },
  chainMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  chainEmpty: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  chainSetButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  chainSetButtonText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tag: {
    backgroundColor: '#FFFFFF',
    color: '#153E75',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
  paragraph: {
    color: '#334155',
    lineHeight: 22,
  },
  step: {
    color: '#334155',
    lineHeight: 23,
    marginBottom: 4,
  },
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EAF2FF',
    borderRadius: 8,
    padding: 12,
  },
  reminderTextBox: {
    flex: 1,
  },
  reminderLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  reminderValue: {
    color: '#0F172A',
    fontWeight: '900',
    marginTop: 2,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#153E75',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  reminderButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  reminderButton: {
    width: '48%',
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#153E75',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  mutedButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  mutedButtonText: {
    color: '#334155',
  },
  archiveButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
  },
  archiveButtonText: {
    color: '#B91C1C',
    fontWeight: '900',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  modalBody: {
    color: '#334155',
    lineHeight: 21,
    marginTop: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  modalCancelText: {
    color: '#334155',
    fontWeight: '900',
  },
  modalConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  timelineRow: {
    borderLeftColor: '#CBD5E1',
    borderLeftWidth: 2,
    marginBottom: 12,
    paddingLeft: 10,
  },
  timelineDate: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  timelineTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  timelineTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
    flexShrink: 1,
  },
  timelineSummary: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  reactionChip: {
    borderRadius: 10,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reactionPositive: { backgroundColor: '#DCFCE7', color: '#166534' },
  reactionNeutral: { backgroundColor: '#E2E8F0', color: '#334155' },
  reactionNoResponse: { backgroundColor: '#FEF3C7', color: '#92400E' },
  reactionRejected: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
});
