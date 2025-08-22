export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL');
}
export function getTodayString() {
  return new Date().toISOString().split('T')[0];
}
