export function formatDateTime(value?: string) {
  if (!value) {
    return '未設定';
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function createDefaultContactDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  date.setHours(10, 0, 0, 0);
  return date;
}
