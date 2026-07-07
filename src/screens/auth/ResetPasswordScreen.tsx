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
import { KeyRound } from 'lucide-react-native';
import { toAuthErrorMessage } from '../../auth/authErrors';
import { supabase } from '../../lib/supabaseClient';
import type { AuthScreenProps } from '../../types/navigation';
import { authStyles as styles } from './authStyles';

export default function ResetPasswordScreen({ navigation }: AuthScreenProps<'ResetPassword'>) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requestReset = async () => {
    if (!email.trim()) {
      setError('メールアドレスを入力してください。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : undefined;
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (authError) {
        setError(toAuthErrorMessage(authError));
        return;
      }
      setSent(true);
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>パスワードリセット</Text>
        <Text style={styles.subcopy}>
          登録済みのメールアドレスを入力してください。パスワード再設定用のリンクを送信します。
        </Text>

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
          testID="reset-email"
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {sent ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              再設定用のメールを送信しました。メール内のリンクを開くと、新しいパスワードの設定画面が表示されます。
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, submitting && styles.disabled]}
          onPress={requestReset}
          disabled={submitting}
          testID="reset-submit"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <KeyRound color="#FFFFFF" size={18} />
          )}
          <Text style={styles.primaryButtonText}>再設定メールを送信</Text>
        </Pressable>

        <View style={styles.linkRow}>
          <Pressable onPress={() => navigation.navigate('Login')} testID="go-login">
            <Text style={styles.linkText}>ログイン画面へ戻る</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
