import { transports, trucks, locations } from '../database.js';

const truckColors = ['#0033a1', '#22c55e', '#ef4444', '#f97316', '#8b5cf6'];
const noop = () => {};

export const createPlannerPortal = ({ showNotification, lucide }) => {
    const state = {
        refreshUserList: noop
    };

    let map = null;
    const truckRouteLayers = {};

    const createIcons = () => {
        if (lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    };

    const renderView = (container) => {
        if (!container) return;
        container.innerHTML = `
            <h2 class="text-xl font-semibold mb-4">Planner Dashboard</h2>
            <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div class="lg:col-span-2 space-y-6">
                    <div class="bg-white p-4 rounded-lg shadow-sm">
                        <h3 class="font-semibold mb-3 border-b pb-2">Nieuwe Aanvragen</h3>
                        <div id="new-requests-list" class="space-y-3 h-[30vh] overflow-y-auto p-1"></div>
                    </div>
                    <div class="bg-white p-4 rounded-lg shadow-sm">
                        <h3 class="font-semibold mb-3 border-b pb-2">Vrachtwagens voor vandaag</h3>
                        <div class="space-y-4" id="trucks-container"></div>
                    </div>
                </div>
                <div class="lg:col-span-3">
                    <div id="map"></div>
                </div>
            </div>
        `;
        createIcons();
    };

    const updateTruckLoad = (truckId) => {
        const truckBin = document.getElementById(truckId);
        if (!truckBin) return;
        const truck = trucks.find(t => t.id === truckId);
        if (!truck) return;
        const loadSpan = truckBin.querySelector('.font-mono');
        const currentLoad = Array.from(truckBin.querySelectorAll('[data-device-count]')).reduce((sum, el) => sum + parseInt(el.dataset.deviceCount, 10), 0);
        if (loadSpan) {
            loadSpan.textContent = `${currentLoad} / ${truck.capacity}`;
        }
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
            printContent += `</div>`;
        });

        printContent += `</div>`;
        if (printableArea) {
            printableArea.innerHTML = printContent;
        }
        window.print();
    };

    const initDragAndDrop = () => {
        document.querySelectorAll('[draggable="true"]').forEach(draggable => {
            draggable.addEventListener('dragstart', e => {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.id);
            });
            draggable.addEventListener('dragend', e => e.target.classList.remove('dragging'));
        });

        document.querySelectorAll('.drop-zone, #new-requests-list').forEach(container => {
            container.addEventListener('dragover', e => {
                e.preventDefault();
                container.closest('.truck-bin, .bg-white')?.classList.add('bg-blue-100');
            });
            container.addEventListener('dragleave', () => {
                container.closest('.truck-bin, .bg-white')?.classList.remove('bg-blue-100');
            });
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
                    if (transport) {
                        transport.plannedOn = newTruckId || null;
                        transport.status = newTruckId ? 'Ingepland' : 'Aangevraagd';
                    }
                    if (oldTruckId) updateTruckLoad(oldTruckId);
                    if (newTruckId) updateTruckLoad(newTruckId);
                    updateAllTruckRoutes();
                    state.refreshUserList();
                }
            });
        });
    };

    const syncTruckLayers = () => {
        if (!map) return;
        trucks.forEach(truck => {
            if (!truckRouteLayers[truck.id]) {
                truckRouteLayers[truck.id] = L.layerGroup().addTo(map);
            }
        });
        Object.keys(truckRouteLayers).forEach(truckId => {
            if (!trucks.find(t => t.id === truckId)) {
                truckRouteLayers[truckId].remove();
                delete truckRouteLayers[truckId];
            }
        });
    };

    const updateTruckRoute = (truckId) => {
        if (!map) return;
        if (!truckRouteLayers[truckId]) {
            truckRouteLayers[truckId] = L.layerGroup().addTo(map);
        }
        const layerGroup = truckRouteLayers[truckId];
        layerGroup.clearLayers();
        const dropZone = document.querySelector(`#${truckId} .drop-zone`);
        if (!dropZone) return;
        const waypoints = [locations['Almere']];
        dropZone.querySelectorAll('[data-destination]').forEach(req => {
            const dest = req.dataset.destination;
            if (locations[dest]) {
                waypoints.push(locations[dest]);
                L.marker(locations[dest]).addTo(layerGroup).bindPopup(`${req.id} naar ${dest}`);
            }
        });
        if (waypoints.length > 1) {
            const color = truckColors[trucks.findIndex(t => t.id === truckId) % truckColors.length];
            L.polyline(waypoints, { color: color || '#333', weight: 5 }).addTo(layerGroup);
        }
    };

    const updateAllTruckRoutes = () => {
        if (!map) return;
        trucks.forEach(truck => updateTruckRoute(truck.id));
    };

    const initMap = () => {
        if (map) return;
        map = L.map('map').setView([52.2, 5.5], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
        trucks.forEach(truck => {
            truckRouteLayers[truck.id] = L.layerGroup().addTo(map);
        });
        updateAllTruckRoutes();
    };

    const ensureMap = () => {
        if (!map) {
            initMap();
        } else {
            setTimeout(() => {
                map.invalidateSize();
                updateAllTruckRoutes();
            }, 1);
        }
    };

    const reset = () => {
        if (map) {
            map.remove();
            map = null;
        }
        Object.keys(truckRouteLayers).forEach(truckId => {
            delete truckRouteLayers[truckId];
        });
    };

    const removeTruck = (truckId) => {
        if (truckRouteLayers[truckId]) {
            truckRouteLayers[truckId].remove();
            delete truckRouteLayers[truckId];
        }
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
                        <h4 class="font-semibold flex items-center gap-2">
                            <i data-lucide="truck"></i>Vrachtwagen (${truck.driver})
                        </h4>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-mono bg-gray-200 px-2 py-1 rounded">0 / ${truck.capacity}</span>
                            <button data-action="print-truck-list" data-truck-id="${truck.id}" class="p-1 text-gray-500 hover:text-blue-600" title="Rittenlijst printen">
                                <i data-lucide="printer" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    <div class="drop-zone min-h-[15vh] space-y-2"></div>
                </div>
            `;
        });

        transports.forEach(t => {
            const requestHtml = `
                <div id="${t.id}" draggable="true" data-action="open-transport-details" data-transport-id="${t.id}" data-destination="${t.to}" data-device-count="${t.devices.length}" class="p-3 bg-gray-100 rounded-lg shadow-sm cursor-grab border hover:border-blue-500 transition-colors">
                    <p class="font-semibold">${t.id}<span class="text-xs font-normal text-gray-500 ml-2">naar ${t.to}</span></p>
                    <p class="text-sm">${t.devices.length} object(en)</p>
                </div>
            `;
            const targetContainer = t.plannedOn ? document.querySelector(`#${t.plannedOn} .drop-zone`) : (t.status === 'Aangevraagd' ? requestsList : null);
            if (targetContainer) {
                targetContainer.insertAdjacentHTML('beforeend', requestHtml);
            }
        });

        initDragAndDrop();
        document.querySelectorAll('.truck-bin').forEach(truckEl => updateTruckLoad(truckEl.id));
        createIcons();
        syncTruckLayers();
        updateAllTruckRoutes();
    };

    const setRefreshUserList = (fn = noop) => {
        state.refreshUserList = typeof fn === 'function' ? fn : noop;
    };

    return {
        renderView,
        renderPlanner,
        updateTruckLoad,
        printTruckList,
        ensureMap,
        reset,
        removeTruck,
        setRefreshUserList
    };
};
