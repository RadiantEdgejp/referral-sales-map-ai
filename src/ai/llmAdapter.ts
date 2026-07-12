import { mockProvider } from './providers/mockProvider';
import { ollamaProvider } from './providers/ollamaProvider';
import { LlmError, type LlmAdapter, type LlmProviderName } from './types';
import { AiSafetyError } from './safety';

/**
 * プロバイダ選択のfacade。
 * UI/logic層はこのファイル（と ./types の型）だけをimportし、
 * providers/ 配下の実装を直接importしてはならない（CLAUDE.md 4.4）。
 *
 * 切り替えは環境変数 EXPO_PUBLIC_LLM_PROVIDER（ollama | mock）で行う。
 * 未設定・不正値は ollama にフォールバックする。
 * 意図的に「Ollama失敗時のMockへの自動フォールバック」は行わない：
 * AI生成に失敗した場合はDBを更新せずエラー表示する必要があり（CLAUDE.md 4.4）、
 * 静かにモック結果へ差し替えると失敗が成功として保存されてしまうため。
 */
export function resolveProviderName(): LlmProviderName {
  const raw = (process.env.EXPO_PUBLIC_LLM_PROVIDER ?? 'ollama').trim().toLowerCase();
  return raw === 'mock' ? 'mock' : 'ollama';
}

const providers: Record<LlmProviderName, LlmAdapter> = {
  ollama: ollamaProvider,
  mock: mockProvider,
};

export function getLlmAdapter(): LlmAdapter {
  return providers[resolveProviderName()];
}

/**
 * AI呼び出し失敗をユーザー向けメッセージへ変換する。
 * UI側はcatch節でこれを使い、エラー表示のみ行う（DB書き込みはしない）。
 */
export function toLlmErrorMessage(error: unknown): string {
  if (error instanceof LlmError) {
    return error.message;
  }
  if (error instanceof AiSafetyError) {
    return error.message;
  }
  return 'AIの処理中に予期しないエラーが発生しました。時間をおいて再度お試しください。';
}
