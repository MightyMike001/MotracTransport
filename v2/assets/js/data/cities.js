export const cityCoordinates = {
  "HOOGEVEEN":[52.7167,6.4833],
  "VENLO":[51.3704,6.1724],
  "ZWIJNDRECHT":[51.8167,4.6333],
  "ALMERE":[52.3508,5.2647],
  "APELDOORN":[52.2112,5.9699],
  "AMSTERDAM":[52.3676,4.9041],
  "ROTTERDAM":[51.9244,4.4777],
  "DEN HAAG":[52.0705,4.3007],
  "UTRECHT":[52.0907,5.1214],
  "EINDHOVEN":[51.4416,5.4697],
  "TILBURG":[51.5656,5.0913],
  "GRONINGEN":[53.2194,6.5665],
  "BREDA":[51.5719,4.7683]
};

export function getCoordinatesForCity(cityName){
  const normalized = (cityName||'').toString().toUpperCase();
  return cityCoordinates[normalized] || null;
}

export function getCoordinatesForLocation(location){
  const motracLocations = {
    "ALMERE":[52.3508,5.2647],
    "VENLO":[51.3704,6.1724],
    "ZWIJNDRECHT":[51.8167,4.6333]
  };
  return motracLocations[location] || null;
}
