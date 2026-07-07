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
import { LogIn } from 'lucide-react-native';
import { toAuthErrorMessage } from '../../auth/authErrors';
import { supabase } from '../../lib/supabaseClient';
import type { AuthScreenProps } from '../../types/navigation';
import { authStyles as styles } from './authStyles';

export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const login = async () => {
    if (!email.trim() || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(toAuthErrorMessage(authError));
      }
      // 成功時は AuthProvider の onAuthStateChange 経由で自動的に Home へ切り替わる。
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
        <Text style={styles.title}>ログイン</Text>
        <Text style={styles.subcopy}>紹介営業マップAIへようこそ。登録済みのアカウントでログインしてください。</Text>

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
          testID="login-email"
        />

        <Text style={styles.label}>パスワード</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="パスワード"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          testID="login-password"
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, submitting && styles.disabled]}
          onPress={login}
          disabled={submitting}
          testID="login-submit"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <LogIn color="#FFFFFF" size={18} />
          )}
          <Text style={styles.primaryButtonText}>ログイン</Text>
        </Pressable>

        <View style={styles.linkRow}>
          <Pressable onPress={() => navigation.navigate('SignUp')} testID="go-signup">
            <Text style={styles.linkText}>アカウントをお持ちでない方はこちら（新規登録）</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('ResetPassword')} testID="go-reset">
            <Text style={styles.linkText}>パスワードをお忘れの方はこちら</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
