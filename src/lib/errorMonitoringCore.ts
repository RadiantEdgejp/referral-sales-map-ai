/**
 * エラー収集の純粋ロジック。@sentry/react-native を import しないことで、
 * node/vitest 環境からもテストできるようにする（salesFlowCore と同じ分離）。
 */

/**
 * DSNは秘密情報ではなく「どのプロジェクトへ送るか」の宛先なので、
 * EXPO_PUBLIC_ でバンドルに含めてよい（Sentry公式の想定通り）。
 * 未設定・空文字・空白のみなら undefined を返し、監視を無効化する。
 */
export function resolveSentryDsn(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const dsn = env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  return dsn ? dsn : undefined;
}
