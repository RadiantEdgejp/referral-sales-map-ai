import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const repoRoot = path.resolve(import.meta.dirname, '..');
const storagePath = path.join(repoRoot, 'src', 'storage', 'personStorage.ts');
const userId = 'issue22-user';

function createContactRow(id, archivedAt = null) {
  return {
    id: `${userId}:${id}`,
    user_id: userId,
    name: 'テスト人物',
    industry: 'テスト業種',
    relationship: 'テスト関係',
    company: null,
    role: null,
    introduced_by: null,
    classification: [],
    opening_talk: null,
    next_question: null,
    current_goal: '関係を確認する',
    required_actions: [],
    next_step: '次回連絡を決める',
    line_message: null,
    email_message: null,
    caution: '',
    recommended_next_contact_at: null,
    notes: '',
    additional_memo: null,
    next_contact_date: null,
    notification_id: null,
    archived_at: archivedAt,
    created_at: '2026-07-12T00:00:00.000Z',
    updated_at: '2026-07-12T00:00:00.000Z',
  };
}

function createFakeSupabase(rows) {
  return {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null }),
    },
    from(table) {
      assert.equal(table, 'contacts');
      return {
        select() {
          return {
            order: async () => ({ data: [...rows.values()], error: null }),
            eq(_column, id) {
              return {
                maybeSingle: async () => ({ data: rows.get(id) ?? null, error: null }),
              };
            },
          };
        },
        update(updates) {
          return {
            eq(_column, id) {
              return {
                select() {
                  return {
                    single: async () => {
                      const current = rows.get(id);
                      assert.ok(current, `missing row: ${id}`);
                      const updated = {
                        ...current,
                        ...updates,
                        updated_at: '2026-07-12T01:00:00.000Z',
                      };
                      rows.set(id, updated);
                      return { data: updated, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function loadPersonStorage(fakeSupabase) {
  const source = fs.readFileSync(storagePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: storagePath,
  }).outputText;
  const loaded = new Module(storagePath);
  loaded.filename = storagePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(storagePath));
  loaded.require = (request) => {
    if (request === '../lib/supabaseClient') {
      return { supabase: fakeSupabase };
    }
    return Module.createRequire(storagePath)(request);
  };
  loaded._compile(output, storagePath);
  return loaded.exports;
}

test('ID取得は存在しない人物をnullとして返す', async () => {
  const storage = loadPersonStorage(createFakeSupabase(new Map()));
  assert.equal(await storage.getPersonById('missing'), null);
});

test('アーカイブ状態は保存され、再読込後も復元される', async () => {
  const rows = new Map([[`${userId}:contact-1`, createContactRow('contact-1')]]);
  const fakeSupabase = createFakeSupabase(rows);
  const firstLoad = loadPersonStorage(fakeSupabase);
  const person = await firstLoad.getPersonById('contact-1');
  assert.ok(person);

  const archivedAt = '2026-07-12T02:00:00.000Z';
  await firstLoad.updatePerson({ ...person, archivedAt });

  const afterReload = loadPersonStorage(fakeSupabase);
  const restored = await afterReload.getPersonById('contact-1');
  assert.equal(restored?.archivedAt, archivedAt);
  assert.equal((await afterReload.getPeople()).length, 1, 'archive must not delete history rows');
});

test('Home表示はモック人物を保存しない', () => {
  const homeSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'HomeScreen.tsx'), 'utf8');
  assert.doesNotMatch(homeSource, /MOCK_PEOPLE/);
  assert.doesNotMatch(homeSource, /savePeople/);
});

test('人物詳細にloading・not-found・error・再試行がある', () => {
  const detailSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'PersonDetailScreen.tsx'), 'utf8');
  for (const expected of ["'loading'", "'not-found'", "'error'", '再試行']) {
    assert.match(detailSource, new RegExp(expected));
  }
});
