import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bot, ChevronRight, Database, FileText, LogOut, Mail, Save, ShieldCheck, UserRound } from 'lucide-react-native';
import { useAuth } from '../auth/AuthContext';
import { CONTACT_EMAIL, type LegalDocKey } from '../legal/legalContent';
import { updateProfile } from '../storage/profileStorage';
import { MOCK_PEOPLE } from '../data/mockPeople';
import { savePeople } from '../storage/personStorage';
import type { ScreenProps } from '../types/navigation';

const LEGAL_LINKS: { doc: LegalDocKey; label: string; icon: typeof FileText }[] = [
  { doc: 'terms', label: '利用規約', icon: FileText },
  { doc: 'privacy', label: 'プライバシーポリシー', icon: ShieldCheck },
  { doc: 'aiNotice', label: 'AI利用上の注意', icon: Bot },
];

/**
 * Issue #14: 設定画面。法務ページへのリンク、問い合わせ先、ログアウトをまとめる。
 */
export default function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const { signOut, session, profile, reloadProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [companyName, setCompanyName] = useState(profile?.companyName ?? '');
  const [role, setRole] = useState(profile?.role ?? '');
  const [notice, setNotice] = useState('');
  const [seedingDemo, setSeedingDemo] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
    setCompanyName(profile?.companyName ?? '');
    setRole(profile?.role ?? '');
  }, [profile]);

  const saveProfile = async () => {
    if (!session || savingProfile) return;
    if (!displayName.trim()) {
      setNotice('表示名を入力してください。');
      return;
    }
    setSavingProfile(true);
    setNotice('');
    try {
      await updateProfile(session.user.id, { displayName, companyName, role });
      await reloadProfile();
      setNotice('プロフィールを保存しました。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'プロフィールの保存に失敗しました。');
    } finally {
      setSavingProfile(false);
    }
  };

  const confirmAndSignOut = async () => {
    if (busy) {
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm('ログアウトしますか？')) {
      return;
    }
    setBusy(true);
    try {
      await signOut();
      // 成功時は onAuthStateChange 経由で自動的にログイン画面へ切り替わる。
    } catch (err) {
      console.warn(err);
      setBusy(false);
    }
  };

  const addDemoPeople = async () => {
    if (seedingDemo) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm('田中さん・山本さん・佐藤さんのデモ人物を追加します。既存人物は削除しません。')) return;
    setSeedingDemo(true);
    setNotice('');
    try {
      await savePeople(MOCK_PEOPLE);
      setNotice('デモ人物3件を追加しました。既存データは変更していません。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'デモ人物の追加に失敗しました。');
    } finally {
      setSeedingDemo(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>アカウント</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Mail color="#64748B" size={18} />
          <Text style={styles.rowText}>{session?.user.email ?? '-'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>プロフィール</Text>
      <View style={styles.cardBody}>
        <SettingField label="表示名" value={displayName} onChangeText={setDisplayName} placeholder="例：山田 太郎" />
        <SettingField label="会社名" value={companyName} onChangeText={setCompanyName} placeholder="例：山田保険株式会社" />
        <SettingField label="役職・職種" value={role} onChangeText={setRole} placeholder="例：紹介営業" />
        <Pressable style={[styles.saveButton, savingProfile && styles.disabled]} onPress={saveProfile} disabled={savingProfile} testID="settings-save-profile">
          {savingProfile ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Save color="#FFFFFF" size={17} />}
          <Text style={styles.saveText}>{savingProfile ? '保存中...' : 'プロフィールを保存'}</Text>
        </Pressable>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>利用状況</Text>
      <View style={styles.card}>
        <StatusRow icon={UserRound} label="プラン" value={profile?.plan ?? '-'} />
        <StatusRow icon={ShieldCheck} label="契約状態" value={profile?.subscriptionStatus ?? '-'} bordered />
        <StatusRow icon={Bot} label="AIモード" value={process.env.EXPO_PUBLIC_LLM_MODE ?? 'ollama'} bordered />
        <StatusRow icon={Database} label="データ保存先" value="Supabase" bordered />
      </View>

      <Text style={styles.sectionTitle}>規約・ポリシー</Text>
      <View style={styles.card}>
        {LEGAL_LINKS.map(({ doc, label, icon: Icon }, index) => (
          <Pressable
            key={doc}
            style={[styles.row, index > 0 && styles.rowBorder]}
            onPress={() => navigation.navigate('LegalDoc', { doc })}
            testID={`settings-link-${doc}`}
          >
            <Icon color="#153E75" size={18} />
            <Text style={styles.rowText}>{label}</Text>
            <ChevronRight color="#94A3B8" size={18} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>テスト用データ</Text>
      <View style={styles.cardBody}>
        <Text style={styles.contactNote}>田中さん・山本さん・佐藤さんを追加します。既存の人物や履歴は削除しません。</Text>
        <Pressable style={[styles.demoButton, seedingDemo && styles.disabled]} onPress={addDemoPeople} disabled={seedingDemo} testID="settings-add-demo">
          {seedingDemo ? <ActivityIndicator color="#153E75" size="small" /> : null}
          <Text style={styles.demoText}>{seedingDemo ? '追加中...' : 'デモ人物を追加'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>お問い合わせ</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Mail color="#153E75" size={18} />
          <View style={styles.contactColumn}>
            <Text style={styles.rowText}>{CONTACT_EMAIL}</Text>
            <Text style={styles.contactNote}>
              不具合のご報告、データ削除のご依頼などはこちらへご連絡ください。
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        style={[styles.logoutButton, busy && styles.disabled]}
        onPress={confirmAndSignOut}
        disabled={busy}
        testID="settings-logout"
      >
        <LogOut color="#B91C1C" size={18} />
        <Text style={styles.logoutText}>ログアウト</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingField({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#94A3B8" /></View>;
}

function StatusRow({ icon: Icon, label, value, bordered }: { icon: typeof UserRound; label: string; value: string; bordered?: boolean }) {
  return <View style={[styles.row, bordered && styles.rowBorder]}><Icon color="#64748B" size={18} /><Text style={styles.rowText}>{label}</Text><Text style={styles.statusValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
    paddingBottom: 48,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: {
    color: '#64748B',
    fontWeight: '900',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBody: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 12, borderWidth: 1, padding: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { color: '#334155', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  input: { borderColor: '#CBD5E1', borderRadius: 8, borderWidth: 1, color: '#0F172A', fontSize: 15, minHeight: 46, paddingHorizontal: 12 },
  saveButton: { alignItems: 'center', backgroundColor: '#153E75', borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 48 },
  saveText: { color: '#FFFFFF', fontWeight: '900' },
  notice: { color: '#153E75', fontSize: 12, fontWeight: '800', marginTop: 10 },
  statusValue: { color: '#153E75', fontWeight: '900' },
  demoButton: { alignItems: 'center', borderColor: '#B8D4FF', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12, minHeight: 46 },
  demoText: { color: '#153E75', fontWeight: '900' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rowText: {
    color: '#0F172A',
    fontWeight: '700',
    flex: 1,
  },
  contactColumn: {
    flex: 1,
  },
  contactNote: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 32,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutText: {
    color: '#B91C1C',
    fontWeight: '900',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
});
