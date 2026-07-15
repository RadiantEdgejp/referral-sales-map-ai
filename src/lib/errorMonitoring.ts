import * as Sentry from '@sentry/react-native';
import { resolveSentryDsn } from './errorMonitoringCore';

export { resolveSentryDsn } from './errorMonitoringCore';

/**
 * エラー収集（Sentry）の初期化。DSN未設定の環境（ローカル開発・CI・
 * DSN配布前のβ）では初期化自体をスキップし、アプリ挙動に影響を与えない。
 */
export function initErrorMonitoring(): boolean {
  const dsn = resolveSentryDsn();
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    // βの規模ではエラー全件を取りたい。トレースは既定の無効のままにして
    // パフォーマンス計測よりクラッシュ・例外の収集に絞る。
    sampleRate: 1.0,
    // 営業データ（人物名・メモ等）を誤ってSentryに送らないよう、
    // 送信前にリクエストボディ相当の大きなコンテキストを落とす。
    beforeSend(event) {
      if (event.contexts && 'state' in event.contexts) {
        delete event.contexts.state;
      }
      return event;
    },
  });
  return true;
}

/**
 * 捕捉済みエラーを明示的に送るためのヘルパー。
 * DSN未設定（未初期化）のときは何もしない。Sentry SDKは未初期化でも
 * captureExceptionを安全に無視するが、意図を関数名で明示しておく。
 */
export function reportError(error: unknown, context?: Record<string, string>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
