export const cityCoordinates = {
  "HOOGEVEEN":[52.7167,6.4833],"VENLO":[51.3704,6.1724],"ZWIJNDRECHT":[51.8167,4.6333],
  "ALMERE":[52.3508,5.2647],"APELDOORN":[52.2112,5.9699],"AMSTERDAM":[52.3676,4.9041],
  "ROTTERDAM":[51.9244,4.4777],"UTRECHT":[52.0907,5.1214]
};
export function getCoordinatesForCity(n){ return cityCoordinates[(n||'').toUpperCase()] || null; }
export function getCoordinatesForLocation(loc){
  const m = {"ALMERE":[52.3508,5.2647],"VENLO":[51.3704,6.1724],"ZWIJNDRECHT":[51.8167,4.6333]};
  return m[loc] || null;
}
