import { describe, expect, it } from 'vitest';

import { resolveSentryDsn } from '../../src/lib/errorMonitoringCore';

describe('Sentry DSN resolution', () => {
  it('DSNが設定されていればそのまま返す', () => {
    expect(resolveSentryDsn({ EXPO_PUBLIC_SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1' })).toBe(
      'https://abc@o1.ingest.sentry.io/1',
    );
  });

  it('未設定・空文字・空白のみでは undefined（監視を無効化）', () => {
    expect(resolveSentryDsn({})).toBeUndefined();
    expect(resolveSentryDsn({ EXPO_PUBLIC_SENTRY_DSN: '' })).toBeUndefined();
    expect(resolveSentryDsn({ EXPO_PUBLIC_SENTRY_DSN: '   ' })).toBeUndefined();
  });
});
