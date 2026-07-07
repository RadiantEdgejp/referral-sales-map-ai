import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bot, ChevronRight, FileText, LogOut, Mail, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../auth/AuthContext';
import { CONTACT_EMAIL, type LegalDocKey } from '../legal/legalContent';
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
  const { signOut, session } = useAuth();
  const [busy, setBusy] = useState(false);

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

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>アカウント</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Mail color="#64748B" size={18} />
          <Text style={styles.rowText}>{session?.user.email ?? '-'}</Text>
        </View>
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
