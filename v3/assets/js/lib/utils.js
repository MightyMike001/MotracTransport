export const formatDate = (s)=>{ const d=new Date(s); return isNaN(d)?'':d.toLocaleDateString('nl-NL'); };
export const getTodayString = ()=> new Date().toISOString().split('T')[0];
