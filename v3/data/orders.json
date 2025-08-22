// data/orders.js - in-memory store (mutable via splice)
export let transportOrders = [
  // voorbeeldorder; je kunt dit leeg maken if gewenst
  {
    id: 1,
    klantNaam: "Philips Nederland",
    contactpersoon: "Jan de Vries",
    transportDatum: "2025-07-02",
    status: "Nieuw",
    adres: "Philipsstraat 15",
    postcode: "7903 AL",
    plaats: "HOOGEVEEN",
    locatie: "ALMERE",
    product: "Heftruck Toyota 8FBN25",
    gewicht: 2500, lengte: 240, breedte: 120, hoogte: 210,
    vrachtwagen: "",
    opdracht_type: "Vestiging naar Klant",
    pickup_adres: "Motrac Almere",
    pickup_plaats: "ALMERE",
    opmerkingen: "Afleveren voor 14:00"
  }
];

// helper om array te vervangen zonder de import-binding te verbreken
export function replaceTransportOrders(newArr){
  transportOrders.splice(0, transportOrders.length, ...newArr);
}
