export let transportOrders = [
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
  },
  {
    id: 2,
    klantNaam: "Used Equipment Center",
    contactpersoon: "Peter Janssen",
    transportDatum: "2025-07-03",
    status: "Lopend",
    adres: "Industrieweg 25",
    postcode: "5928 LH",
    plaats: "VENLO",
    locatie: "VENLO",
    product: "Reachtruck BT RRE160",
    gewicht: 1800, lengte: 200, breedte: 110, hoogte: 190,
    vrachtwagen: "VW-002",
    opdracht_type: "Klant naar Vestiging",
    pickup_adres: "Industrieweg 25",
    pickup_plaats: "VENLO",
    opmerkingen: "Ophalen uit werkplaats"
  },
  {
    id: 3,
    klantNaam: "Warehouse Solutions",
    contactpersoon: "Marie van der Berg",
    transportDatum: "2025-07-01",
    status: "Afleveren",
    adres: "Logistiekpark 8",
    postcode: "3331 LZ",
    plaats: "ZWIJNDRECHT",
    locatie: "ZWIJNDRECHT",
    product: "Elektrische heftruck Still RX60",
    gewicht: 3200, lengte: 280, breedte: 130, hoogte: 220,
    vrachtwagen: "VW-003",
    opdracht_type: "Vestiging naar Klant",
    pickup_adres: "Motrac Zwijndrecht",
    pickup_plaats: "ZWIJNDRECHT",
    opmerkingen: "Nieuwe installatie"
  }
];

export let nextId = 4;
export let editingId = null;

export function setEditingId(val){ editingId = val; }
export function incNextId(){ nextId += 1; return nextId; }
