import { Pressable, Text, View } from 'react-native';
import { Bell, RefreshCw, UserPlus } from 'lucide-react-native';
import type { MainTab } from './types';
import { homeStyles as styles } from './homeStyles';

const SCREEN_META: Record<MainTab, { screenName: string; title: string; subcopy: string }> = {
  home: {
    screenName: 'ホーム',
    title: '今日の営業地図',
    subcopy: '営業開始前に、今日の方向性を確認する',
  },
  people: {
    screenName: '人脈カード',
    title: '営業資産データベース',
    subcopy: '人物情報と営業データを育てる',
  },
  calendar: {
    screenName: '予定',
    title: '予定とカレンダー',
    subcopy: '予定を確認し、会う前の準備へ進む',
  },
  pre: {
    screenName: '予定前ナビ',
    title: '会う前の作戦確認',
    subcopy: '目的・質問・注意点を先に決める',
  },
  after: {
    screenName: '後メモ',
    title: '会話を営業データにする',
    subcopy: '聞いた回答から次アクションを作る',
  },
  line: {
    screenName: 'LINEチェック',
    title: '文面と会話データを確認',
    subcopy: '送る前・返信後の情報を人脈カードへ戻す',
  },
  end: {
    screenName: '終業後チェック',
    title: '明日の営業地図へ反映',
    subcopy: '漏れを確認して次の日の行動に変える',
  },
};

export default function HomeHeader({
  activeTab,
  planUpdated,
  onNotice,
  onRefresh,
  onAdd,
}: {
  activeTab: MainTab;
  planUpdated: boolean;
  onNotice: () => void;
  onRefresh: () => void;
  onAdd: () => void;
}) {
  const meta = SCREEN_META[activeTab];
  const today = new Date();

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.screenName}>{meta.screenName}</Text>
        <Text style={styles.appName}>{meta.title}</Text>
        <Text style={styles.dateText}>{`${today.getMonth() + 1}月${today.getDate()}日`}</Text>
        <Text style={styles.subcopy}>{meta.subcopy}</Text>
        {planUpdated ? <Text style={styles.updatedNotice}>今日の計画を更新済み</Text> : null}
      </View>
      <View style={styles.headerActions}>
        <Pressable style={styles.iconButton} onPress={onNotice}>
          <Bell color="#153E75" size={20} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onRefresh}>
          <RefreshCw color="#153E75" size={20} />
        </Pressable>
        <Pressable style={styles.iconButtonDark} onPress={onAdd}>
          <UserPlus color="#FFFFFF" size={20} />
        </Pressable>
      </View>
    </View>
  );
}
