/**
 * 初回体験ガイド（登録 → 予定 → 予定前ナビ）の表示判定。
 *
 * このアプリの価値実感は「予定前ナビの質問が、自分の記録を根拠に生成される
 * 瞬間」にあるが、新規ユーザーのホームは空でそこへの道筋が見えない。
 * ガイドの完了判定は保存済みの実データ（人脈カード数・予定数・未完了の
 * 予定前タスク）だけから導出し、ローカルフラグは持たない。再ログインや
 * 端末変更でも状態がぶれず、Supabase を唯一の真実とする既存方針に揃う。
 */

export type FirstRunStepKey = 'add_person' | 'add_schedule' | 'pre_meeting';

export type FirstRunStep = {
  key: FirstRunStepKey;
  title: string;
  description: string;
  done: boolean;
  /** 未完了ステップのうち、いま押すべき1つだけを true にする。 */
  current: boolean;
};

export type FirstRunGuideState = {
  visible: boolean;
  steps: FirstRunStep[];
};

export type BuildFirstRunGuideInput = {
  peopleCount: number;
  eventsCount: number;
  hasOpenPreMeetingTask: boolean;
};

/**
 * 表示条件: 利用が立ち上がるまでの間だけ。
 * - 人脈カードか予定がまだ無い（正真正銘の初回状態）
 * - 最初の予定を1件作ったが、予定前ナビをまだ体験していない
 * 予定が2件以上あるユーザーは通常運用に入っているので表示しない。
 */
export function buildFirstRunGuide(input: BuildFirstRunGuideInput): FirstRunGuideState {
  const { peopleCount, eventsCount, hasOpenPreMeetingTask } = input;

  const personDone = peopleCount > 0;
  const scheduleDone = eventsCount > 0;
  const preMeetingDone = scheduleDone && !hasOpenPreMeetingTask;

  const visible =
    !personDone || !scheduleDone || (eventsCount === 1 && hasOpenPreMeetingTask);

  const doneFlags: Record<FirstRunStepKey, boolean> = {
    add_person: personDone,
    add_schedule: scheduleDone,
    pre_meeting: preMeetingDone,
  };
  const currentKey = (['add_person', 'add_schedule', 'pre_meeting'] as const).find(
    (key) => !doneFlags[key],
  );

  const steps: FirstRunStep[] = [
    {
      key: 'add_person',
      title: '最初の1人を人脈カードに登録する',
      description: '直近で会う予定の人や、関係を深めたい1人で大丈夫です。',
      done: personDone,
      current: currentKey === 'add_person',
    },
    {
      key: 'add_schedule',
      title: 'その人との予定を追加する',
      description: '予定を保存すると、予定前ナビと後メモのタスクが自動で作られます。',
      done: scheduleDone,
      current: currentKey === 'add_schedule',
    },
    {
      key: 'pre_meeting',
      title: '予定前ナビを体験する',
      description: 'AIが登録した情報を根拠に、当日確認すべき質問を提案します。',
      done: preMeetingDone,
      current: currentKey === 'pre_meeting',
    },
  ];

  return { visible, steps };
}
