import { users, transports, trucks, locations } from './database.js';

let currentUserId = null;
let map;
let deviceCounter = 0;

// --- TEMPLATING & RENDERING ---
const renderViews = () => {
    document.getElementById('view-user').innerHTML = `<div class="mb-4 border-b border-gray-200"><nav class="flex -mb-px"><button id="subtab-user-dashboard" class="sub-tab py-3 px-4 text-sm font-medium text-gray-600 rounded-t-lg hover:text-motrac-blue-text sub-tab-active">Mijn Transporten</button><button id="subtab-user-new" class="sub-tab py-3 px-4 text-sm font-medium text-gray-600 rounded-t-lg hover:text-motrac-blue-text">Nieuwe Aanvraag</button></nav></div><div id="subview-user-dashboard" class="subview-section active"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold">Overzicht van mijn transporten</h2><button onclick="showNewRequestForm()" class="motrac-blue text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 hover:opacity-90 transition-opacity"><i data-lucide="plus" class="w-5 h-5"></i><span>Nieuwe Aanvraag</span></button></div><div class="bg-white p-4 rounded-lg shadow-sm"><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-6 py-3">Order ID</th><th scope="col" class="px-6 py-3">Van</th><th scope="col" class="px-6 py-3">Naar</th><th scope="col" class="px-6 py-3">Gewenste datum</th><th scope="col" class="px-6 py-3">Status</th><th scope="col" class="px-6 py-3">Acties</th></tr></thead><tbody id="transport-list-body"></tbody></table></div></div></div><div id="subview-user-new" class="subview-section"><h2 class="text-xl font-semibold mb-4">Nieuwe transportaanvraag</h2><form id="transport-form" class="space-y-8 bg-white p-6 rounded-lg shadow-sm"></form></div>`;
    document.getElementById('view-planner').innerHTML = `<h2 class="text-xl font-semibold mb-4">Planner Dashboard</h2><div class="grid grid-cols-1 lg:grid-cols-5 gap-6"><div class="lg:col-span-2 space-y-6"><div class="bg-white p-4 rounded-lg shadow-sm"><h3 class="font-semibold mb-3 border-b pb-2">Nieuwe Aanvragen</h3><div id="new-requests-list" class="space-y-3 h-[30vh] overflow-y-auto p-1"></div></div><div class="bg-white p-4 rounded-lg shadow-sm"><h3 class="font-semibold mb-3 border-b pb-2">Vrachtwagens voor vandaag</h3><div class="space-y-4" id="trucks-container"></div></div></div><div class="lg:col-span-3"><div id="map"></div></div></div>`;
    document.getElementById('view-admin').innerHTML = `<div class="mb-4 border-b border-gray-200"><nav class="flex -mb-px"><button id="subtab-admin-users" class="sub-tab py-3 px-4 text-sm font-medium text-gray-600 rounded-t-lg hover:text-motrac-blue-text sub-tab-active">Gebruikersbeheer</button><button id="subtab-admin-trucks" class="sub-tab py-3 px-4 text-sm font-medium text-gray-600 rounded-t-lg hover:text-motrac-blue-text">Vrachtwagenbeheer</button></nav></div><div id="subview-admin-users" class="subview-section active"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold">Gebruikersoverzicht</h2><button onclick="openModal('user-modal')" class="motrac-blue text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 hover:opacity-90 transition-opacity"><i data-lucide="user-plus" class="w-5 h-5"></i><span>Nieuwe Gebruiker</span></button></div><div class="bg-white p-4 rounded-lg shadow-sm"><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-6 py-3">Naam</th><th scope="col" class="px-6 py-3">Email</th><th scope="col" class="px-6 py-3">Rol</th><th scope="col" class="px-6 py-3">Status</th><th scope="col" class="px-6 py-3">Acties</th></tr></thead><tbody id="user-list-body"></tbody></table></div></div></div><div id="subview-admin-trucks" class="subview-section"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold">Vrachtwagenoverzicht</h2><button onclick="openModal('truck-modal')" class="motrac-blue text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 hover:opacity-90 transition-opacity"><i data-lucide="truck" class="w-5 h-5"></i><span>Nieuwe Vrachtwagen</span></button></div><div class="bg-white p-4 rounded-lg shadow-sm"><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-6 py-3">ID</th><th scope="col" class="px-6 py-3">Chauffeur</th><th scope="col" class="px-6 py-3">Capaciteit (objecten)</th><th scope="col" class="px-6 py-3">Acties</th></tr></thead><tbody id="truck-list-body"></tbody></table></div></div></div>`;
};

const renderTransportForm = () => {
     const form = document.getElementById('transport-form');
     if (!form) return;
     form.innerHTML = `
        <div><h3 class="text-lg font-semibold border-b pb-2 mb-4 motrac-blue-text">1. Locatiegegevens</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label for="from" class="block text-sm font-medium text-gray-700 mb-1">Van</label><input type="text" name="from" class="w-full p-2 border rounded-md" value="Rondebeltweg 51, Almere" required></div><div><label for="to" class="block text-sm font-medium text-gray-700 mb-1">Naar</label><input type="text" name="to" class="w-full p-2 border rounded-md" placeholder="Adres van klant" required></div></div></div>
        <div><h3 class="text-lg font-semibold border-b pb-2 mb-4 motrac-blue-text">2. Te Vervoeren Objecten</h3><div id="devices-container" class="space-y-4"></div><div class="mt-4"><button type="button" id="add-device-btn" class="text-sm motrac-blue-text font-semibold hover:underline flex items-center gap-1"><i data-lucide="plus-circle" class="w-4 h-4"></i>Extra machine toevoegen</button></div></div>
        <div><h3 class="text-lg font-semibold border-b pb-2 mb-4 motrac-blue-text">3. Planning en Details</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label for="date" class="block text-sm font-medium">Gewenste datum</label><input type="date" name="date" class="w-full p-2 border rounded-md" required></div>
                <div class="space-y-2">
                    <label class="block text-sm font-medium">Bijzonderheden</label>
                    <div class="flex items-center"><input type="checkbox" id="first-job" name="first-job" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"><label for="first-job" class="ml-2 block text-sm text-gray-900">Eerste werk?</label></div>
                    <div class="flex items-center"><input type="checkbox" id="loading-dock" name="loading-dock" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"><label for="loading-dock" class="ml-2 block text-sm text-gray-900">Laaddock aanwezig?</label></div>
                </div>
            </div>
        </div>
        <div class="flex justify-end space-x-4 pt-6 border-t"><button type="button" id="cancel-transport-btn" class="bg-gray-200 px-6 py-2 rounded-lg">Annuleren</button><button type="submit" class="motrac-blue text-white px-6 py-2 rounded-lg">Aanvraag Indienen</button></div>`;
     addDeviceRow(true);
     lucide.createIcons();
};

const renderTransportList = () => {
    const listBody = document.getElementById('transport-list-body');
    if(!listBody) return;
    listBody.innerHTML = '';
    const statusStyles = { 'Ingepland': 'bg-blue-100 text-blue-800', 'Uitgevoerd': 'bg-green-100 text-green-800', 'Aangevraagd': 'bg-yellow-100 text-yellow-800', 'Geannuleerd': 'bg-red-100 text-red-800' };
    transports.forEach(t => {
        listBody.innerHTML += `<tr class="bg-white border-b">
            <td class="px-6 py-4 font-medium">${t.id}</td><td class="px-6 py-4">${t.from}</td><td class="px-6 py-4">${t.to}</td><td class="px-6 py-4">${t.date}</td>
            <td class="px-6 py-4"><span class="${statusStyles[t.status] || ''} text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">${t.status}</span></td>
            <td class="px-6 py-4 flex space-x-2"><button onclick="openModal('transport-details-modal', '${t.id}')" class="p-1 text-gray-500 hover:text-blue-600"><i data-lucide="eye"></i></button><button class="p-1 text-gray-500 hover:text-blue-600"><i data-lucide="pencil"></i></button></td></tr>`;
    });
    lucide.createIcons();
};

const renderUserList = () => {
    const listBody = document.getElementById('user-list-body');
    if(!listBody) return;
    listBody.innerHTML = '';
    users.forEach(u => {
        const statusClass = u.status === 'Actief' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const actionButton = u.id === currentUserId ? '' : (u.status === 'Actief'
            ? `<button onclick="toggleUserStatus('${u.id}')" class="p-1 text-gray-500 hover:text-red-600" title="Deactiveren"><i data-lucide="user-x" class="w-4 h-4"></i></button>`
            : `<button onclick="toggleUserStatus('${u.id}')" class="p-1 text-gray-500 hover:text-green-600" title="Activeren"><i data-lucide="user-check" class="w-4 h-4"></i></button>`);
        listBody.innerHTML += `<tr class="bg-white border-b">
            <td class="px-6 py-4 font-medium">${u.name}</td><td class="px-6 py-4">${u.email}</td><td class="px-6 py-4">${u.role}</td>
            <td class="px-6 py-4"><span class="${statusClass} text-xs font-medium px-2.5 py-0.5 rounded-full">${u.status}</span></td>
            <td class="px-6 py-4 flex space-x-2"><button onclick="openModal('user-modal', '${u.id}')" class="p-1 text-gray-500 hover:text-blue-600" title="Bewerken"><i data-lucide="pencil" class="w-4 h-4"></i></button>${actionButton}</td></tr>`;
    });
    lucide.createIcons();
};

const renderTruckList = () => {
    const listBody = document.getElementById('truck-list-body');
    if(!listBody) return;
    listBody.innerHTML = '';
    trucks.forEach(t => {
        listBody.innerHTML += `<tr class="bg-white border-b">
            <td class="px-6 py-4 font-medium">${t.id}</td>
            <td class="px-6 py-4">${t.driver}</td>
            <td class="px-6 py-4">${t.capacity}</td>
            <td class="px-6 py-4 flex space-x-2">
                <button onclick="openModal('truck-modal', '${t.id}')" class="p-1 text-gray-500 hover:text-blue-600" title="Bewerken"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="deleteTruck('${t.id}')" class="p-1 text-gray-500 hover:text-red-600" title="Verwijderen"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td></tr>`;
    });
    lucide.createIcons();
};

const renderPlanner = () => {
    const requestsList = document.getElementById('new-requests-list');
    const trucksContainer = document.getElementById('trucks-container');
    if (!requestsList || !trucksContainer) return;
    requestsList.innerHTML = '';
    trucksContainer.innerHTML = '';

    trucks.forEach(truck => {
        trucksContainer.innerHTML += `
        <div id="${truck.id}" class="truck-bin bg-gray-50 p-3 rounded-lg border-2 border-dashed border-gray-300">
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-semibold flex items-center gap-2"><i data-lucide="truck"></i>Vrachtwagen (${truck.driver})</h4>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-mono bg-gray-200 px-2 py-1 rounded">0 / ${truck.capacity}</span>
                    <button onclick="printTruckList('${truck.id}')" class="p-1 text-gray-500 hover:text-blue-600" title="Rittenlijst printen"><i data-lucide="printer" class="w-4 h-4"></i></button>
                </div>
            </div>
            <div class="drop-zone min-h-[15vh] space-y-2"></div>
        </div>`;
    });

    transports.forEach(t => {
        const requestHtml = `<div id="${t.id}" draggable="true" onclick="openModal('transport-details-modal', '${t.id}')" data-destination="${t.to}" data-device-count="${t.devices.length}" class="p-3 bg-gray-100 rounded-lg shadow-sm cursor-grab border hover:border-blue-500 transition-colors"><p class="font-semibold">${t.id}<span class="text-xs font-normal text-gray-500 ml-2">naar ${t.to}</span></p><p class="text-sm">${t.devices.length} object(en)</p></div>`;
        const targetContainer = t.plannedOn ? document.querySelector(`#${t.plannedOn} .drop-zone`) : (t.status === 'Aangevraagd' ? requestsList : null);
        if (targetContainer) targetContainer.innerHTML += requestHtml;
    });
    initDragAndDrop();
    document.querySelectorAll('.truck-bin').forEach(truck => updateTruckLoad(truck.id));
    lucide.createIcons();
};

// --- AUTHENTICATION ---
const handleLogin = (e) => {
    e.preventDefault();
    const loginButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = loginButton.innerHTML;
    loginButton.innerHTML = `<span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full inline-block"></span>`;
    loginButton.disabled = true;

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    setTimeout(() => {
        const user = users.find(u => u.email.toLowerCase() === email && u.password === password);
        if (user) {
            if (user.status === 'Inactief') {
                errorEl.textContent = 'Dit account is inactief.';
            } else {
                currentUserId = user.id;
                document.getElementById('login-container').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                initializeApp();
            }
        } else {
            errorEl.textContent = 'Ongeldige e-mail of wachtwoord.';
        }
        loginButton.innerHTML = originalButtonText;
        loginButton.disabled = false;
    }, 500);
};

const handleLogout = () => {
    currentUserId = null;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('login-form').reset();
    document.getElementById('login-error').textContent = '';
    if(map) { map.remove(); map = null; }
};

// --- UI & NOTIFICATIONS ---
const showNotification = (message, type = 'success') => {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = `notification no-print ${type} show`;
    setTimeout(() => { el.classList.remove('show'); }, 3000);
};

const openModal = (modalId, itemId = null) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (modalId === 'user-modal') {
        // User modal logic
        const form = document.getElementById('user-form');
        form.reset();
        document.getElementById('userId').value = itemId || '';
        const passwordInput = document.getElementById('userPassword');
        if (itemId) {
            const user = users.find(u => u.id === itemId);
            document.getElementById('user-modal-title').textContent = 'Gebruiker Bewerken';
            document.getElementById('userName').value = user.name;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userRole').value = user.role;
            passwordInput.placeholder = "Laat leeg om niet te wijzigen";
            passwordInput.required = false;
        } else {
            document.getElementById('user-modal-title').textContent = 'Nieuwe Gebruiker';
            passwordInput.placeholder = "Wachtwoord";
            passwordInput.required = true;
        }
    } else if (modalId === 'truck-modal') {
        // Truck modal logic
        const form = document.getElementById('truck-form');
        form.reset();
        document.getElementById('truckId').value = itemId || '';
        if(itemId) {
            const truck = trucks.find(t => t.id === itemId);
            document.getElementById('truck-modal-title').textContent = 'Vrachtwagen Bewerken';
            document.getElementById('truckDriver').value = truck.driver;
            document.getElementById('truckCapacity').value = truck.capacity;
        } else {
            document.getElementById('truck-modal-title').textContent = 'Nieuwe Vrachtwagen';
        }
    } else if (modalId === 'transport-details-modal') {
         // Transport details modal logic
        const transport = transports.find(t => t.id === itemId);
        if (transport) {
            document.getElementById('transport-details-title').textContent = `Details voor Transport ${transport.id}`;
            const contentEl = document.getElementById('transport-details-content');

            let devicesHtml = '<h4 class="font-semibold text-gray-800 mt-4 mb-2 border-b pb-1">Vervoerde Objecten</h4>';
            if (transport.devices && transport.devices.length > 0) {
                devicesHtml += '<ul class="list-disc pl-5 space-y-2">';
                transport.devices.forEach(d => {
                    devicesHtml += `<li><strong>SN:</strong> ${d.sn || '-'} | <strong>Type:</strong> ${d.type || '-'} | <strong>Hoogte:</strong> ${d.height || '-'} cm<br><span class="text-gray-500">Opmerkingen: ${d.notes || 'Geen'}</span></li>`;
                });
                devicesHtml += '</ul>';
            } else {
                devicesHtml += '<p>Geen objecten opgegeven.</p>';
            }

            let detailsHtml = '<h4 class="font-semibold text-gray-800 mt-4 mb-2 border-b pb-1">Bijzonderheden</h4>';
            detailsHtml += `<p><strong>Eerste werk:</strong> ${transport.details.firstJob ? 'Ja' : 'Nee'}</p>`;
            detailsHtml += `<p><strong>Laaddock aanwezig:</strong> ${transport.details.loadingDock ? 'Ja' : 'Nee'}</p>`;

            contentEl.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div><p><strong>Van:</strong></p><p>${transport.from}</p></div>
                    <div><p><strong>Naar:</strong></p><p>${transport.to}</p></div>
                    <div><p><strong>Datum:</strong></p><p>${transport.date}</p></div>
                    <div><p><strong>Status:</strong></p><p>${transport.status}</p></div>
                </div>
                ${devicesHtml}
                ${detailsHtml}
            `;
        }
    }
    modal.classList.remove('hidden');
    lucide.createIcons();
};
const closeModal = (modalId) => document.getElementById(modalId).classList.add('hidden');

// --- ADMIN FUNCTIONS ---
document.getElementById('user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const password = document.getElementById('userPassword').value;
    const formData = { name: document.getElementById('userName').value, email: document.getElementById('userEmail').value, role: document.getElementById('userRole').value };
    if (id) {
        const userIndex = users.findIndex(u => u.id === id);
        users[userIndex] = { ...users[userIndex], ...formData };
        if (password) users[userIndex].password = password;
        showNotification('Gebruiker opgeslagen');
    } else {
        users.push({ id: `user-${Date.now()}`, ...formData, password: password, status: 'Actief' });
        showNotification('Gebruiker toegevoegd');
    }
    closeModal('user-modal');
    renderUserList();
});

document.getElementById('truck-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('truckId').value;
    const driver = document.getElementById('truckDriver').value;
    const capacity = document.getElementById('truckCapacity').value;
    if (id) {
        const truckIndex = trucks.findIndex(t => t.id === id);
        trucks[truckIndex] = { ...trucks[truckIndex], driver, capacity };
        showNotification('Vrachtwagen opgeslagen');
    } else {
        trucks.push({ id: `truck-${Date.now()}`, driver, capacity });
        showNotification('Vrachtwagen toegevoegd');
    }
    closeModal('truck-modal');
    renderTruckList();
    renderPlanner();
});

const toggleUserStatus = (userId) => {
    const user = users.find(u => u.id === userId);
    if(user && user.id !== currentUserId) {
        user.status = user.status === 'Actief' ? 'Inactief' : 'Actief';
        showNotification(`Status van ${user.name} gewijzigd naar ${user.status.toLowerCase()}`);
        renderUserList();
    }
};

const deleteTruck = (truckId) => {
    if (confirm('Weet je zeker dat je deze vrachtwagen wilt verwijderen?')) {
        trucks = trucks.filter(t => t.id !== truckId);
        transports.forEach(t => {
            if (t.plannedOn === truckId) {
                t.plannedOn = null;
                t.status = 'Aangevraagd';
            }
        });
        showNotification('Vrachtwagen verwijderd');
        renderTruckList();
        renderPlanner();
    }
};

// --- TRANSPORT FORM FUNCTIONS ---
const addDeviceRow = (isFirst = false) => {
    const container = document.getElementById('devices-container');
    if (!container) return;
    const newDeviceHTML = `
        <div class="device-row p-4 border rounded-lg bg-gray-50 relative">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div><label class="text-sm font-medium">Serienummer</label><input type="text" name="sn" placeholder="bv. SN12345" class="mt-1 w-full p-2 border rounded-md"></div>
                <div><label class="text-sm font-medium">Type</label><input type="text" name="type" placeholder="bv. Heftruck" class="mt-1 w-full p-2 border rounded-md"></div>
                <div><label class="text-sm font-medium">Hoogte (cm)</label><input type="number" name="height" placeholder="220" class="mt-1 w-full p-2 border rounded-md"></div>
                <div><label class="text-sm font-medium">Opmerkingen</label><input type="text" name="notes" placeholder="bv. Stickers plakken" class="mt-1 w-full p-2 border rounded-md"></div>
            </div>
            ${!isFirst ? `<button type="button" class="remove-device-btn absolute top-2 right-2 text-gray-400 hover:text-red-600"><i data-lucide="x-circle" class="w-5 h-5"></i></button>` : ''}
        </div>`;
    container.insertAdjacentHTML('beforeend', newDeviceHTML);
    if (!isFirst) lucide.createIcons();
};

const handleTransportSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const from = formData.get('from');
    const to = formData.get('to');
    const date = formData.get('date');

    const devices = [];
    document.querySelectorAll('.device-row').forEach(row => {
        const sn = row.querySelector('input[name="sn"]').value;
        const type = row.querySelector('input[name="type"]').value;
        const height = row.querySelector('input[name="height"]').value;
        const notes = row.querySelector('input[name="notes"]').value;
        if (sn || type) { // only add if there is some data
            devices.push({ sn, type, height, notes });
        }
    });

    if (!from || !to || !date || devices.length === 0) {
        showNotification('Vul alle locatie/datum velden en tenminste één object in.', 'error');
        return;
    }
    const newId = 'TR-' + (Math.floor(Math.random() * 9000) + 1000);
    transports.push({
        id: newId, from, to, date, status: 'Aangevraagd', plannedOn: null,
        devices: devices,
        details: {
            firstJob: document.getElementById('first-job').checked,
            loadingDock: document.getElementById('loading-dock').checked
        }
    });
    showNotification(`Transport ${newId} succesvol aangevraagd!`);
    e.target.reset();
    document.getElementById('devices-container').innerHTML = '';
    addDeviceRow(true);
    renderTransportList();
    renderPlanner();
    document.getElementById('subtab-user-dashboard').click();
};

// --- PLANNER FUNCTIONS ---
const updateTruckLoad = (truckId) => {
    const truckBin = document.getElementById(truckId);
    if (!truckBin) return;
    const truck = trucks.find(t => t.id === truckId);
    const loadSpan = truckBin.querySelector('.font-mono');
    const currentLoad = Array.from(truckBin.querySelectorAll('[data-device-count]')).reduce((sum, el) => sum + parseInt(el.dataset.deviceCount, 10), 0);
    loadSpan.textContent = `${currentLoad} / ${truck.capacity}`;
};

const printTruckList = (truckId) => {
    const truck = trucks.find(t => t.id === truckId);
    const plannedTransports = transports.filter(t => t.plannedOn === truckId);
    const printableArea = document.getElementById('printable-area');

    if (!truck || plannedTransports.length === 0) {
        showNotification('Geen ritten gepland voor deze vrachtwagen.', 'error');
        return;
    }

    let printContent = `
        <div class="p-8 font-sans">
            <div class="flex justify-between items-center mb-6 border-b pb-4">
                <h1 class="text-3xl font-bold">Rittenlijst: ${truck.driver}</h1>
                <p class="text-lg">Datum: ${new Date().toLocaleDateString('nl-NL')}</p>
            </div>
    `;

    plannedTransports.forEach((transport, index) => {
        printContent += `
            <div class="mb-6 p-4 border rounded-lg" style="page-break-inside: avoid;">
                <h2 class="text-xl font-semibold mb-3 bg-gray-100 p-2 rounded">Stop ${index + 1}: ${transport.to} (Order: ${transport.id})</h2>
                <div class="grid grid-cols-2 gap-x-4 mb-4">
                    <p><strong>Van:</strong> ${transport.from}</p>
                    <p><strong>Naar:</strong> ${transport.to}</p>
                </div>
                <h3 class="font-semibold text-gray-800 mt-4 mb-2 border-b pb-1">Bijzonderheden</h3>
                <p><strong>Eerste werk:</strong> ${transport.details.firstJob ? 'Ja' : 'Nee'}</p>
                <p><strong>Laaddock aanwezig:</strong> ${transport.details.loadingDock ? 'Ja' : 'Nee'}</p>
                <h3 class="font-semibold text-gray-800 mt-4 mb-2 border-b pb-1">Objecten (${transport.devices.length})</h3>
        `;
        transport.devices.forEach(d => {
            printContent += `
                <div class="text-sm mb-2 p-2 bg-gray-50 rounded">
                    <p><strong>SN:</strong> ${d.sn || '-'} | <strong>Type:</strong> ${d.type || '-'} | <strong>Hoogte:</strong> ${d.height || '-'} cm</p>
                    <p><strong>Opmerkingen:</strong> ${d.notes || 'Geen'}</p>
                </div>
            `;
        });
        printContent += `</div>`; // Close transport div
    });

    printContent += `</div>`; // Close main div
    printableArea.innerHTML = printContent;
    window.print();
};


// --- MAP & DRAG-DROP ---
const truckColors = ['#0033a1', '#22c55e', '#ef4444', '#f97316', '#8b5cf6'];
let truckRouteLayers = {};
function initMap() {
    if(map) return;
    map = L.map('map').setView([52.2, 5.5], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    trucks.forEach(truck => { truckRouteLayers[truck.id] = L.layerGroup().addTo(map); });
    updateAllTruckRoutes();
}
function updateAllTruckRoutes() {
    if (!map) return;
    trucks.forEach(truck => updateTruckRoute(truck.id));
}
function updateTruckRoute(truckId, index) {
    if (!truckRouteLayers[truckId]) {
        truckRouteLayers[truckId] = L.layerGroup().addTo(map);
    }
    truckRouteLayers[truckId].clearLayers();
    const dropZone = document.querySelector(`#${truckId} .drop-zone`);
    if (!dropZone) return;
    let waypoints = [locations['Almere']];
    dropZone.querySelectorAll('[data-destination]').forEach(req => {
        const dest = req.dataset.destination;
        if (locations[dest]) {
            waypoints.push(locations[dest]);
            L.marker(locations[dest]).addTo(truckRouteLayers[truckId]).bindPopup(`${req.id} naar ${dest}`);
        }
    });
    if (waypoints.length > 1) {
        const color = truckColors[trucks.findIndex(t => t.id === truckId) % truckColors.length];
        L.polyline(waypoints, { color: color || '#333', weight: 5 }).addTo(truckRouteLayers[truckId]);
    }
}
function initDragAndDrop() {
    document.querySelectorAll('[draggable="true"]').forEach(draggable => {
        draggable.addEventListener('dragstart', e => { e.target.classList.add('dragging'); e.dataTransfer.setData('text/plain', e.target.id); });
        draggable.addEventListener('dragend', e => e.target.classList.remove('dragging'));
    });
    document.querySelectorAll('.drop-zone, #new-requests-list').forEach(container => {
        container.addEventListener('dragover', e => { e.preventDefault(); container.closest('.truck-bin, .bg-white')?.classList.add('bg-blue-100'); });
        container.addEventListener('dragleave', e => { container.closest('.truck-bin, .bg-white')?.classList.remove('bg-blue-100'); });
        container.addEventListener('drop', e => {
            e.preventDefault();
            container.closest('.truck-bin, .bg-white')?.classList.remove('bg-blue-100');
            const transportId = e.dataTransfer.getData('text/plain');
            const draggedElement = document.getElementById(transportId);
            if (draggedElement && !e.currentTarget.contains(draggedElement)) {
                const oldTruckId = draggedElement.closest('.truck-bin')?.id;
                e.currentTarget.appendChild(draggedElement);
                const newTruckId = e.currentTarget.closest('.truck-bin')?.id;
                const transport = transports.find(t => t.id === transportId);
                if(transport) {
                     transport.plannedOn = newTruckId || null;
                     transport.status = newTruckId ? 'Ingepland' : 'Aangevraagd';
                }
                if (oldTruckId) updateTruckLoad(oldTruckId);
                if (newTruckId) updateTruckLoad(newTruckId);
                updateAllTruckRoutes();
                renderTransportList();
            }
        });
    });
}

// --- APP INITIALIZATION ---
const initializeApp = () => {
    const currentUser = users.find(u => u.id === currentUserId);
    document.getElementById('loggedInUser').textContent = `Ingelogd als: ${currentUser.name} (${currentUser.role})`;

    document.getElementById('tab-user').style.display = ['Gebruiker', 'Admin'].includes(currentUser.role) ? 'block' : 'none';
    document.getElementById('tab-planner').style.display = ['Planner', 'Admin'].includes(currentUser.role) ? 'block' : 'none';
    document.getElementById('tab-admin').style.display = currentUser.role === 'Admin' ? 'block' : 'none';

    renderViews();
    document.getElementById('subtab-user-new').addEventListener('click', renderTransportForm);
    attachAppListeners();
    const firstVisibleTab = document.querySelector('#app .main-tab[style*="display: block"]');
    if (firstVisibleTab) {
        firstVisibleTab.click();
    }
};

const attachAppListeners = () => {
    // Main tabs
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('main-tab-active'));
            e.currentTarget.classList.add('main-tab-active');
            const viewId = 'view-' + e.currentTarget.id.split('-')[1];
            document.querySelectorAll('.view-section').forEach(v => v.classList.toggle('active', v.id === viewId));
            if (viewId === 'view-planner') {
                renderPlanner();
                if (!map) initMap();
                else setTimeout(() => { map.invalidateSize(); updateAllTruckRoutes(); }, 1);
            }
            if (viewId === 'view-user') {
                renderTransportList();
                document.getElementById('subtab-user-dashboard').click();
            }
             if (viewId === 'view-admin') {
                renderUserList();
                renderTruckList();
                document.getElementById('subtab-admin-users').click();
            }
        });
    });

    // Sub-tabs using event delegation
    document.getElementById('app').addEventListener('click', (e) => {
        const target = e.target.closest('.sub-tab');
        if (!target) return;
        const parentView = target.closest('.view-section');
        parentView.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('sub-tab-active'));
        target.classList.add('sub-tab-active');
        const subviewId = 'subview-' + target.id.substring(target.id.indexOf('-') + 1);
        parentView.querySelectorAll('.subview-section').forEach(sv => sv.classList.toggle('active', sv.id === subviewId));
    });

    // Transport form listeners (using event delegation on the parent)
    const userView = document.getElementById('view-user');
    userView.addEventListener('submit', e => {
        if (e.target.id === 'transport-form') handleTransportSubmit(e);
    });
    userView.addEventListener('click', e => {
         if (e.target.closest('#add-device-btn')) addDeviceRow();
         if (e.target.id === 'cancel-transport-btn') document.getElementById('subtab-user-dashboard').click();
         if (e.target.closest('.remove-device-btn')) e.target.closest('.device-row').remove();
    });

    // Header dropdowns
    const bellButton = document.getElementById('bell-button');
    const userButton = document.getElementById('user-button');
    const bellDropdown = document.getElementById('bell-dropdown');
    const userDropdown = document.getElementById('user-dropdown');
    bellButton.addEventListener('click', (e) => { e.stopPropagation(); userDropdown.classList.add('hidden'); bellDropdown.classList.toggle('hidden'); });
    userButton.addEventListener('click', (e) => { e.stopPropagation(); bellDropdown.classList.add('hidden'); userDropdown.classList.toggle('hidden'); });
    window.addEventListener('click', () => { bellDropdown.classList.add('hidden'); userDropdown.classList.add('hidden'); });
    lucide.createIcons();
};

const showNewRequestForm = () => document.getElementById('subtab-user-new').click();

// --- GLOBAL START ---
lucide.createIcons();
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('logout-button').addEventListener('click', handleLogout);
