import type { Person } from '../types/person';

export type SortMode = 'priority' | 'nextContact' | 'newest';

export type DueState = 'overdue' | 'today' | 'upcoming' | 'unset';

export function dedupePeople(people: Person[]) {
  const unique = new Map<string, Person>();

  people.forEach((person) => {
    // 会社・役職が異なる同姓同名は別人として扱う（CLAUDE.md 5.2）。
    // ここで畳んでよいのは全項目が一致する「真の重複」だけ。
    const key = [person.name, person.company ?? '', person.role ?? '', person.industry, person.relationship]
      .map((value) => value.trim())
      .join('|');
    if (!unique.has(key)) {
      unique.set(key, person);
    }
  });

  return Array.from(unique.values());
}

export function matchesIndustryFilter(person: Person, filter: string) {
  if (filter === '経営者') {
    return person.industry.includes('経営');
  }
  if (filter === '採用') {
    return person.rawMemo.includes('採用') || person.nextAction.includes('採用') || person.openingTalk.includes('採用');
  }
  if (filter === 'その他') {
    return true;
  }
  return person.industry.includes(filter) || person.rawMemo.includes(filter);
}

export function sortPeople(a: Person, b: Person, sortMode: SortMode) {
  if (sortMode === 'nextContact') {
    return dateValue(a.nextContactAt) - dateValue(b.nextContactAt);
  }
  if (sortMode === 'newest') {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  return priorityScore(b) - priorityScore(a);
}

export function dateValue(value?: string) {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

export function priorityScore(person: Person) {
  // 優先度は「次回連絡日の近さ」を主軸に、次アクションの有無と新しさで補正する。
  // 恣意的な関係性スコアには依存しない（数値スコアは廃止）。
  const next = person.nextContactAt ? new Date(person.nextContactAt).getTime() : Number.MAX_SAFE_INTEGER;
  const dueBonus = next <= Date.now() + 24 * 60 * 60 * 1000 ? 100 : 0;
  const actionBonus = person.nextAction ? 20 : 0;
  const recentBonus = Math.max(0, 20 - Math.floor((Date.now() - new Date(person.createdAt).getTime()) / 86400000));
  return dueBonus + actionBonus + recentBonus;
}

export function getDueState(person: Person): DueState {
  if (!person.nextContactAt) return 'unset';

  const next = new Date(person.nextContactAt);
  const now = new Date();
  const isSameDay =
    next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth() && next.getDate() === now.getDate();

  if (isSameDay) return 'today';
  if (next.getTime() < now.getTime()) return 'overdue';
  return 'upcoming';
}

export function isDueToday(person: Person) {
  const due = getDueState(person);
  return due === 'today' || due === 'overdue';
}

export function formatTime(value?: string) {
  if (!value) return '--:--';
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
