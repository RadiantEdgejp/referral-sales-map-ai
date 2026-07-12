import type { Person } from '../types/person';
import { dedupePeople } from './personPriority';

export function filterContactCandidates(people: Person[], query: string, excludePersonId?: string): Person[] {
  const normalized = query.trim().toLowerCase();
  return dedupePeople(people.filter((person) => !person.archivedAt && person.id !== excludePersonId)).filter((person) => {
    if (!normalized) return true;
    return [
      person.name,
      person.company ?? '',
      person.role ?? '',
      person.industry,
      person.relationship,
      person.categories.join(' '),
      person.nextAction,
      person.rawMemo,
      person.additionalMemo ?? '',
    ].join(' ').toLowerCase().includes(normalized);
  });
}
