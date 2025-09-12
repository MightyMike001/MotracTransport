export let users = [
    { id: 'mike', name: 'Mike (Jij)', email: 'mike@motrac.nl', role: 'Admin', status: 'Actief', password: 'admin' },
    { id: 'jan', name: 'Jan de Planner', email: 'jan.planner@beekman.nl', role: 'Planner', status: 'Actief', password: 'planner' },
    { id: 'piet', name: 'Piet de Gebruiker', email: 'piet@motrac.nl', role: 'Gebruiker', status: 'Inactief', password: 'gebruiker' }
];
export let transports = [
    { id: 'TR-00124', from: 'Almere', to: 'Venlo', date: '2025-09-15', status: 'Ingepland', plannedOn: 'truck-1',
      devices: [{sn: 'SN12345', type: 'Heftruck', height: 220, notes: 'Stickers plakken'}],
      details: {firstJob: true, loadingDock: false} },
    { id: 'TR-00123', from: 'Zwijndrecht', to: 'Amsterdam', date: '2025-09-12', status: 'Uitgevoerd', plannedOn: null,
      devices: [{sn: 'SN67890', type: 'Reachtruck', height: 250, notes: ''}],
      details: {firstJob: false, loadingDock: true} },
    { id: 'TR-00122', from: 'Almere', to: 'Utrecht', date: '2025-09-18', status: 'Aangevraagd', plannedOn: null,
      devices: [{sn: 'SN54321', type: 'Heftruck', height: 210, notes: 'Extra lader mee'}, {sn: 'SN98765', type: 'Palletwagen', height: 120, notes: ''}],
      details: {firstJob: false, loadingDock: true}},
    { id: 'TR-00125', from: 'Almere', to: 'Groningen', date: '2025-09-19', status: 'Aangevraagd', plannedOn: null,
      devices: [{sn: 'SN11223', type: 'Stapelaar', height: 180, notes: ''}],
      details: {firstJob: true, loadingDock: true} }
];
export let trucks = [
    { id: 'truck-1', driver: 'Jan', capacity: 10 },
    { id: 'truck-2', driver: 'Piet', capacity: 8 }
];
export const locations = {'Almere': [52.379189, 5.222723], 'Utrecht': [52.090737, 5.121420], 'Groningen': [53.219383, 6.566502], 'Venlo': [51.370361, 6.173000], 'Amsterdam': [52.3676, 4.9041]};
