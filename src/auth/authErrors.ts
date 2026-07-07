import { AuthApiError } from '@supabase/supabase-js';

/**
 * Convert Supabase auth errors into user-facing Japanese messages
 * (Issue #10: login failure / signup error / email rate limit).
 */
export function toAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    switch (error.code) {
      case 'invalid_credentials':
        return 'メールアドレスまたはパスワードが正しくありません。';
      case 'email_not_confirmed':
        return 'メールアドレスが未確認です。受信した確認メールのリンクを開いてください。';
      case 'user_already_exists':
      case 'email_exists':
        return 'このメールアドレスは既に登録されています。ログインしてください。';
      case 'weak_password':
        return 'パスワードが弱すぎます。より長く複雑なパスワードを設定してください。';
      case 'over_email_send_rate_limit':
        return 'メール送信の回数制限に達しました。しばらく待ってから再度お試しください。';
      case 'over_request_rate_limit':
        return 'リクエストが多すぎます。しばらく待ってから再度お試しください。';
      case 'validation_failed':
        return '入力内容が正しくありません。メールアドレスの形式を確認してください。';
      case 'same_password':
        return '現在と同じパスワードは設定できません。';
      default:
        break;
    }
    if (error.status === 429) {
      return 'リクエストが多すぎます。しばらく待ってから再度お試しください。';
    }
    return `認証エラーが発生しました: ${error.message}`;
  }

  if (error instanceof Error) {
    return `エラーが発生しました: ${error.message}`;
  }

  return '不明なエラーが発生しました。時間をおいて再度お試しください。';
}
