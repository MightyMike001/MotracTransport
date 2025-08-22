export function formatDate(s){
  const d = new Date(s);
  return isNaN(d) ? '' : d.toLocaleDateString('nl-NL');
}
export function getTodayString(){
  return new Date().toISOString().split('T')[0];
}
