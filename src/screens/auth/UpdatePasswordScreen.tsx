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
import { ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../auth/AuthContext';
import { toAuthErrorMessage } from '../../auth/authErrors';
import { supabase } from '../../lib/supabaseClient';
import { authStyles as styles } from './authStyles';

/**
 * Shown after the user opens a password-recovery link
 * (PASSWORD_RECOVERY auth event). Completes the reset flow.
 */
export default function UpdatePasswordScreen() {
  const { clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updatePassword = async () => {
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
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) {
        setError(toAuthErrorMessage(authError));
        return;
      }
      clearPasswordRecovery();
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
        <Text style={styles.title}>新しいパスワードを設定</Text>
        <Text style={styles.subcopy}>
          新しいパスワードを入力してください。設定後、そのままアプリを利用できます。
        </Text>

        <Text style={styles.label}>新しいパスワード（8文字以上）</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="新しいパスワード"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          testID="update-password"
        />

        <Text style={styles.label}>新しいパスワード（確認）</Text>
        <TextInput
          style={styles.input}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          placeholder="もう一度入力"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          testID="update-password-confirm"
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, submitting && styles.disabled]}
          onPress={updatePassword}
          disabled={submitting}
          testID="update-password-submit"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ShieldCheck color="#FFFFFF" size={18} />
          )}
          <Text style={styles.primaryButtonText}>パスワードを更新</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
