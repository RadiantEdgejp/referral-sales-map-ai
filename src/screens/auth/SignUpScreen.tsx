import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MailCheck, UserPlus } from 'lucide-react-native';
import { toAuthErrorMessage } from '../../auth/authErrors';
import { supabase } from '../../lib/supabaseClient';
import type { AuthScreenProps } from '../../types/navigation';
import { authStyles as styles } from './authStyles';

export default function SignUpScreen({ navigation }: AuthScreenProps<'SignUp'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const signUp = async () => {
    if (!email.trim() || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください。');
      return;
    }
    if (password !== passwordConfirm) {
      setError('パスワード（確認）が一致しません。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(toAuthErrorMessage(authError));
        return;
      }
      if (!data.session) {
        // メール確認が有効な場合はセッションが返らない。確認待ちUIを表示する。
        setAwaitingConfirmation(true);
      }
      // セッションが返った場合は AuthProvider 経由で自動的に Home へ切り替わる。
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        <MailCheck color="#153E75" size={40} />
        <Text style={[styles.title, { marginTop: 12 }]}>確認メールを送信しました</Text>
        <Text style={styles.subcopy}>
          {email.trim()} 宛に確認メールを送信しました。メール内のリンクを開いて登録を完了した後、ログインしてください。
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            メールが届かない場合は、迷惑メールフォルダを確認するか、しばらく待ってから再度サインアップをお試しください。
          </Text>
        </View>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          testID="back-to-login"
        >
          <Text style={styles.primaryButtonText}>ログイン画面へ戻る</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>新規登録</Text>
        <Text style={styles.subcopy}>メールアドレスとパスワードでアカウントを作成します。</Text>

        <Text style={styles.label}>メールアドレス</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          testID="signup-email"
        />

        <Text style={styles.label}>パスワード（8文字以上）</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="パスワード"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          testID="signup-password"
        />

        <Text style={styles.label}>パスワード（確認）</Text>
        <TextInput
          style={styles.input}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          placeholder="もう一度入力"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          testID="signup-password-confirm"
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, submitting && styles.disabled]}
          onPress={signUp}
          disabled={submitting}
          testID="signup-submit"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <UserPlus color="#FFFFFF" size={18} />
          )}
          <Text style={styles.primaryButtonText}>アカウントを作成</Text>
        </Pressable>

        <View style={styles.linkRow}>
          <Pressable onPress={() => navigation.navigate('Login')} testID="go-login">
            <Text style={styles.linkText}>すでにアカウントをお持ちの方はこちら（ログイン）</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
