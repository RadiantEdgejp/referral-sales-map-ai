import type { Person } from '../types/person';

export function selectMissingDemoPeople(existing: Person[], demos: Person[]): Person[] {
  const existingIds = new Set(existing.map((person) => person.id));
  return demos.filter((person) => !existingIds.has(person.id));
}
