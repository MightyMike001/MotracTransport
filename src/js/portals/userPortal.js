import { transports } from '../database.js';

const noop = () => {};

export const createUserPortal = ({ showNotification, lucide }) => {
    const state = {
        onTransportCreated: noop,
        listenersAttached: false
    };

    const createIcons = () => {
        if (lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    };

    const renderView = (container) => {
        if (!container) return;
        container.innerHTML = `
            <div class="mb-4 border-b border-gray-200">
                <nav class="flex -mb-px">
                    <button id="subtab-user-dashboard" class="sub-tab py-3 px-4 text-sm font-medium text-gray-600 rounded-t-lg hover:text-motrac-blue-text sub-tab-active">Mijn Transporten</button>
                    <button id="subtab-user-new" class="sub-tab py-3 px-4 text-sm font-medium text-gray-600 rounded-t-lg hover:text-motrac-blue-text">Nieuwe Aanvraag</button>
                </nav>
            </div>
            <div id="subview-user-dashboard" class="subview-section active">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold">Overzicht van mijn transporten</h2>
                    <button data-action="show-new-request-form" class="motrac-blue text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 hover:opacity-90 transition-opacity">
                        <i data-lucide="plus" class="w-5 h-5"></i>
                        <span>Nieuwe Aanvraag</span>
                    </button>
                </div>
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left">
                            <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" class="px-6 py-3">Order ID</th>
                                    <th scope="col" class="px-6 py-3">Van</th>
                                    <th scope="col" class="px-6 py-3">Naar</th>
                                    <th scope="col" class="px-6 py-3">Gewenste datum</th>
                                    <th scope="col" class="px-6 py-3">Status</th>
                                    <th scope="col" class="px-6 py-3">Acties</th>
                                </tr>
                            </thead>
                            <tbody id="transport-list-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div id="subview-user-new" class="subview-section">
                <h2 class="text-xl font-semibold mb-4">Nieuwe transportaanvraag</h2>
                <form id="transport-form" class="space-y-8 bg-white p-6 rounded-lg shadow-sm"></form>
            </div>
        `;
        createIcons();
    };

    const addDeviceRow = (isFirst = false) => {
        const container = document.getElementById('devices-container');
        if (!container) return;
        container.insertAdjacentHTML('beforeend', `
            <div class="device-row p-4 border rounded-lg bg-gray-50 relative">
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label class="text-sm font-medium">Serienummer</label>
                        <input type="text" name="sn" placeholder="bv. SN12345" class="mt-1 w-full p-2 border rounded-md">
                    </div>
                    <div>
                        <label class="text-sm font-medium">Type</label>
                        <input type="text" name="type" placeholder="bv. Heftruck" class="mt-1 w-full p-2 border rounded-md">
                    </div>
                    <div>
                        <label class="text-sm font-medium">Hoogte (cm)</label>
                        <input type="number" name="height" placeholder="220" class="mt-1 w-full p-2 border rounded-md" min="0">
                    </div>
                    <div>
                        <label class="text-sm font-medium">Opmerkingen</label>
                        <input type="text" name="notes" placeholder="bv. Stickers plakken" class="mt-1 w-full p-2 border rounded-md">
                    </div>
                </div>
                ${!isFirst ? `<button type="button" class="remove-device-btn absolute top-2 right-2 text-gray-400 hover:text-red-600"><i data-lucide="x-circle" class="w-5 h-5"></i></button>` : ''}
            </div>
        `);
        if (!isFirst) {
            createIcons();
        }
    };

    const renderTransportForm = () => {
        const form = document.getElementById('transport-form');
        if (!form) return;
        form.innerHTML = `
            <div>
                <h3 class="text-lg font-semibold border-b pb-2 mb-4 motrac-blue-text">1. Locatiegegevens</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="from" class="block text-sm font-medium text-gray-700 mb-1">Van</label>
                        <input type="text" name="from" class="w-full p-2 border rounded-md" value="Rondebeltweg 51, Almere" required>
                    </div>
                    <div>
                        <label for="to" class="block text-sm font-medium text-gray-700 mb-1">Naar</label>
                        <input type="text" name="to" class="w-full p-2 border rounded-md" placeholder="Adres van klant" required>
                    </div>
                </div>
            </div>
            <div>
                <h3 class="text-lg font-semibold border-b pb-2 mb-4 motrac-blue-text">2. Te Vervoeren Objecten</h3>
                <div id="devices-container" class="space-y-4"></div>
                <div class="mt-4">
                    <button type="button" id="add-device-btn" class="text-sm motrac-blue-text font-semibold hover:underline flex items-center gap-1">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i>
                        Extra machine toevoegen
                    </button>
                </div>
            </div>
            <div>
                <h3 class="text-lg font-semibold border-b pb-2 mb-4 motrac-blue-text">3. Planning en Details</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="date" class="block text-sm font-medium">Gewenste datum</label>
                        <input type="date" name="date" class="w-full p-2 border rounded-md" required>
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-medium">Bijzonderheden</label>
                        <div class="flex items-center">
                            <input type="checkbox" id="first-job" name="first-job" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                            <label for="first-job" class="ml-2 block text-sm text-gray-900">Eerste werk?</label>
                        </div>
                        <div class="flex items-center">
                            <input type="checkbox" id="loading-dock" name="loading-dock" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                            <label for="loading-dock" class="ml-2 block text-sm text-gray-900">Laaddock aanwezig?</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex justify-end space-x-4 pt-6 border-t">
                <button type="button" id="cancel-transport-btn" class="bg-gray-200 px-6 py-2 rounded-lg">Annuleren</button>
                <button type="submit" class="motrac-blue text-white px-6 py-2 rounded-lg">Aanvraag Indienen</button>
            </div>
        `;
        addDeviceRow(true);
        createIcons();
    };

    const renderTransportList = () => {
        const listBody = document.getElementById('transport-list-body');
        if (!listBody) return;
        listBody.innerHTML = '';
        const statusStyles = {
            'Ingepland': 'bg-blue-100 text-blue-800',
            'Uitgevoerd': 'bg-green-100 text-green-800',
            'Aangevraagd': 'bg-yellow-100 text-yellow-800',
            'Geannuleerd': 'bg-red-100 text-red-800'
        };
        transports.forEach(t => {
            listBody.innerHTML += `
                <tr class="bg-white border-b">
                    <td class="px-6 py-4 font-medium">${t.id}</td>
                    <td class="px-6 py-4">${t.from}</td>
                    <td class="px-6 py-4">${t.to}</td>
                    <td class="px-6 py-4">${t.date}</td>
                    <td class="px-6 py-4">
                        <span class="${statusStyles[t.status] || ''} text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">${t.status}</span>
                    </td>
                    <td class="px-6 py-4 flex space-x-2">
                        <button data-action="open-transport-details" data-transport-id="${t.id}" class="p-1 text-gray-500 hover:text-blue-600">
                            <i data-lucide="eye"></i>
                        </button>
                        <button class="p-1 text-gray-500 hover:text-blue-600">
                            <i data-lucide="pencil"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        createIcons();
    };

    const handleTransportSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const from = formData.get('from');
        const to = formData.get('to');
        const date = formData.get('date');

        const devices = [];
        let hasInvalidHeight = false;
        document.querySelectorAll('.device-row').forEach(row => {
            const sn = row.querySelector('input[name="sn"]').value;
            const type = row.querySelector('input[name="type"]').value;
            const height = row.querySelector('input[name="height"]').value;
            const notes = row.querySelector('input[name="notes"]').value;

            if (parseFloat(height) < 0) {
                showNotification('De hoogte van een object kan niet negatief zijn.', 'error');
                hasInvalidHeight = true;
                return;
            }

            if (sn || type) {
                devices.push({ sn, type, height, notes });
            }
        });

        if (hasInvalidHeight) return;

        if (!from || !to || !date || devices.length === 0) {
            showNotification('Vul alle locatie/datum velden en tenminste één object in.', 'error');
            return;
        }

        const newId = 'TR-' + (Math.floor(Math.random() * 9000) + 1000);
        transports.push({
            id: newId,
            from,
            to,
            date,
            status: 'Aangevraagd',
            plannedOn: null,
            devices,
            details: {
                firstJob: document.getElementById('first-job').checked,
                loadingDock: document.getElementById('loading-dock').checked
            }
        });

        showNotification(`Transport ${newId} succesvol aangevraagd!`);
        e.target.reset();
        const devicesContainer = document.getElementById('devices-container');
        if (devicesContainer) {
            devicesContainer.innerHTML = '';
        }
        addDeviceRow(true);
        renderTransportList();
        state.onTransportCreated();
        const dashboardTab = document.getElementById('subtab-user-dashboard');
        if (dashboardTab) {
            dashboardTab.click();
        }
    };

    const attachListeners = () => {
        if (state.listenersAttached) return;
        const userView = document.getElementById('view-user');
        if (!userView) return;

        userView.addEventListener('submit', e => {
            if (e.target.id === 'transport-form') {
                handleTransportSubmit(e);
            }
        });

        userView.addEventListener('click', e => {
            if (e.target.closest('#add-device-btn')) {
                addDeviceRow();
            }
            if (e.target.id === 'cancel-transport-btn') {
                const dashboardTab = document.getElementById('subtab-user-dashboard');
                if (dashboardTab) {
                    dashboardTab.click();
                }
            }
            if (e.target.closest('.remove-device-btn')) {
                const row = e.target.closest('.device-row');
                if (row) {
                    row.remove();
                }
            }
        });

        state.listenersAttached = true;
    };

    const setOnTransportCreated = (fn = noop) => {
        state.onTransportCreated = typeof fn === 'function' ? fn : noop;
    };

    return {
        renderView,
        renderTransportForm,
        renderTransportList,
        handleTransportSubmit,
        addDeviceRow,
        attachListeners,
        setOnTransportCreated
    };
};
