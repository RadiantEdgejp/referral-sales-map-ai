import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '../auth/AuthContext';

export default function OnboardingScreen() {
  const { profile, completeOnboarding } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [companyName, setCompanyName] = useState(profile?.companyName ?? '');
  const [role, setRole] = useState(profile?.role ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!displayName.trim()) {
      setError('表示名を入力してください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await completeOnboarding({ displayName, companyName, role });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '初期設定の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <CheckCircle2 color="#153E75" size={42} />
        <Text style={styles.title}>最初の設定</Text>
        <Text style={styles.subcopy}>営業コーチの表示に使う情報です。後から設定画面で変更できます。</Text>
        <Field label="表示名（必須）" value={displayName} onChangeText={setDisplayName} placeholder="例：山田 太郎" />
        <Field label="会社名" value={companyName} onChangeText={setCompanyName} placeholder="例：山田保険株式会社" />
        <Field label="役職・職種" value={role} onChangeText={setRole} placeholder="例：紹介営業" />
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <Pressable testID="onboarding-submit" style={[styles.button, saving && styles.disabled]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : null}
          <Text style={styles.buttonText}>{saving ? '保存中...' : '設定を完了して始める'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#94A3B8" /></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { alignSelf: 'center', maxWidth: 560, padding: 24, paddingBottom: 56, width: '100%' },
  title: { color: '#0F172A', fontSize: 28, fontWeight: '900', marginTop: 16 },
  subcopy: { color: '#64748B', lineHeight: 22, marginBottom: 14, marginTop: 8 },
  field: { marginTop: 16 },
  label: { color: '#334155', fontSize: 13, fontWeight: '900', marginBottom: 7 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: 8, borderWidth: 1, color: '#0F172A', fontSize: 16, minHeight: 50, paddingHorizontal: 14 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: 8, borderWidth: 1, marginTop: 16, padding: 12 },
  errorText: { color: '#B91C1C', fontWeight: '700' },
  button: { alignItems: 'center', backgroundColor: '#153E75', borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
