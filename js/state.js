// js/state.js
export const S = {
  orders: [], vehicles: [], settings:{ weekStart: new Date().toISOString().slice(0,10) }
};

export function uid(prefix='ID'){
  return prefix + Math.random().toString(36).slice(2,8).toUpperCase();
}

export function load(){
  const raw = localStorage.getItem('tp_mod_v1');
  if (raw){
    try{ Object.assign(S, JSON.parse(raw)); }catch(e){ console.warn('Load failed', e); }
  } else {
    seed();
    save('Voorbeelddata geladen');
  }
}

export function save(msg){
  localStorage.setItem('tp_mod_v1', JSON.stringify(S));
  if (msg) console.log(msg);
}

export function seed(){
  const today = new Date().toISOString().slice(0,10);
  S.vehicles = [
    {id:uid('VEH'), plate:'V-123-AB', type:'Bakwagen', capPal:18, capKg:9000},
    {id:uid('VEH'), plate:'TX-45-PP', type:'Trailer', capPal:33, capKg:24000}
  ];
  S.orders = [
    {id:uid('ORD'), client:'ACME BV', pickup:'Amsterdam', drop:'Rotterdam', date:today, pallets:10, weight:2500, priority:'Hoog', status:'Nieuw', vehicleId:''},
    {id:uid('ORD'), client:'Globex NL', pickup:'Utrecht', drop:'Den Haag', date:today, pallets:4, weight:600, priority:'Normaal', status:'Nieuw', vehicleId:''}
  ];
}
