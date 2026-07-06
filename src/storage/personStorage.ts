import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Person } from '../types/person';

const STORAGE_KEY = 'referral-sales-map-ai.people';

export async function getPeople(): Promise<Person[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Person[];
  } catch {
    return [];
  }
}

export async function savePeople(people: Person[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

export async function addPerson(person: Person) {
  const people = await getPeople();
  await savePeople([person, ...people]);
}

export async function updatePerson(person: Person): Promise<Person> {
  const stamped = { ...person, updatedAt: new Date().toISOString() };
  const people = await getPeople();
  await savePeople(people.map((item) => (item.id === stamped.id ? stamped : item)));
  return stamped;
}
