import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('every Issue #23 person-selection screen uses the shared searchable picker', async () => {
  for (const path of [
    'src/screens/home/PreMeetingPane.tsx',
    'src/screens/home/AfterMemoPane.tsx',
    'src/screens/home/LineCheckPane.tsx',
    'src/screens/CoachChatScreen.tsx',
    'src/screens/PersonDetailScreen.tsx',
  ]) {
    assert.match(await source(path), /ContactPickerModal/, `${path} must use ContactPickerModal`);
  }
});

test('line check has no manual type chips and persists the detected internal type', async () => {
  const code = await source('src/screens/home/LineCheckPane.tsx');
  assert.doesNotMatch(code, /LINE_CHECK_TYPES\.map/);
  assert.doesNotMatch(code, /setCheckType/);
  assert.match(code, /detectMessageType\(messageText, intention\)/);
  assert.match(code, /checkType,\s*text:/);
});

test('attachment UI exposes only implemented actions', async () => {
  const code = await source('src/components/AttachmentTextInput.tsx');
  assert.match(code, /reader\.readAsText/);
  assert.match(code, /Clipboard\.getStringAsync/);
  assert.doesNotMatch(code, /画像|音声|マイク|カメラ/);
  assert.doesNotMatch(code, /MoreHorizontal/);
});

test('onboarding completion is persisted and gates the authenticated home stack', async () => {
  const auth = await source('src/auth/AuthContext.tsx');
  const navigator = await source('src/navigation/RootNavigator.tsx');
  assert.match(auth, /onboardingCompleted: true/);
  assert.match(navigator, /!profile\.onboardingCompleted/);
  assert.match(navigator, /OnboardingScreen/);
});

test('settings shows DB-backed account status and the demo action performs a real save', async () => {
  const settings = await source('src/screens/SettingsScreen.tsx');
  assert.match(settings, /profile\?\.plan/);
  assert.match(settings, /profile\?\.subscriptionStatus/);
  assert.match(settings, /AIモード/);
  assert.match(settings, /データ保存先/);
  assert.match(settings, /await savePeople\(MOCK_PEOPLE\)/);
});
