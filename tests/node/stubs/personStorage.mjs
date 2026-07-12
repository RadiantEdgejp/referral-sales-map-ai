export async function requireUserId() {
  return 'test-user';
}

export function toContactRowId(userId, entityId) {
  return `${userId}:${entityId}`;
}
