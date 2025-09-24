import { users, transports, trucks } from './database.js';
import { createUserPortal } from './portals/userPortal.js';
import { createPlannerPortal } from './portals/plannerPortal.js';

let currentUserId = null;
let userPortal;
let plannerPortal;
let mainTabsInitialized = false;
let appDelegationAttached = false;
let headerListenersAttached = false;
let modalListenersAttached = false;

// --- TEMPLATING & RENDERING ---
const renderViews = () => {
    userPortal.renderView(document.getElementById('view-user'));
    plannerPortal.renderView(document.getElementById('view-planner'));
    renderAdminView();
};

const renderAdminView = () => {
    document.getElementById('view-admin').innerHTML = `<div class="mb-4 border-b border-gray-200"><nav class="flex -mb-px"><button id="subtab-admin-users" class="sub-tab py-3 px-4 text-sm font-medium text-gray-600 rounded-t-lg hover:text-motrac-blue-text sub-tab-active">Gebruikersbeheer</button><button id="subtab-admin-trucks" class="sub-tab py-3 px-4 text-sm font-medium text-gray-600 rounded-t-lg hover:text-motrac-blue-text">Vrachtwagenbeheer</button></nav></div><div id="subview-admin-users" class="subview-section active"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold">Gebruikersoverzicht</h2><button data-action="open-modal" data-modal-id="user-modal" class="motrac-blue text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 hover:opacity-90 transition-opacity"><i data-lucide="user-plus" class="w-5 h-5"></i><span>Nieuwe Gebruiker</span></button></div><div class="bg-white p-4 rounded-lg shadow-sm"><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-6 py-3">Naam</th><th scope="col" class="px-6 py-3">Email</th><th scope="col" class="px-6 py-3">Rol</th><th scope="col" class="px-6 py-3">Status</th><th scope="col" class="px-6 py-3">Acties</th></tr></thead><tbody id="user-list-body"></tbody></table></div></div></div><div id="subview-admin-trucks" class="subview-section"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold">Vrachtwagenoverzicht</h2><button data-action="open-modal" data-modal-id="truck-modal" class="motrac-blue text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 hover:opacity-90 transition-opacity"><i data-lucide="truck" class="w-5 h-5"></i><span>Nieuwe Vrachtwagen</span></button></div><div class="bg-white p-4 rounded-lg shadow-sm"><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-6 py-3">ID</th><th scope="col" class="px-6 py-3">Chauffeur</th><th scope="col" class="px-6 py-3">Capaciteit (objecten)</th><th scope="col" class="px-6 py-3">Acties</th></tr></thead><tbody id="truck-list-body"></tbody></table></div></div></div>`;
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
};

const renderUserList = () => {
    const listBody = document.getElementById('user-list-body');
    if(!listBody) return;
    listBody.innerHTML = '';
    users.forEach(u => {
        const statusClass = u.status === 'Actief' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const actionButton = u.id === currentUserId ? '' : (u.status === 'Actief'
            ? `<button data-action="toggle-user-status" data-user-id="${u.id}" class="p-1 text-gray-500 hover:text-red-600" title="Deactiveren"><i data-lucide="user-x" class="w-4 h-4"></i></button>`
            : `<button data-action="toggle-user-status" data-user-id="${u.id}" class="p-1 text-gray-500 hover:text-green-600" title="Activeren"><i data-lucide="user-check" class="w-4 h-4"></i></button>`);
        listBody.innerHTML += `<tr class="bg-white border-b">
            <td class="px-6 py-4 font-medium">${u.name}</td><td class="px-6 py-4">${u.email}</td><td class="px-6 py-4">${u.role}</td>
            <td class="px-6 py-4"><span class="${statusClass} text-xs font-medium px-2.5 py-0.5 rounded-full">${u.status}</span></td>
            <td class="px-6 py-4 flex space-x-2"><button data-action="open-modal" data-modal-id="user-modal" data-item-id="${u.id}" class="p-1 text-gray-500 hover:text-blue-600" title="Bewerken"><i data-lucide="pencil" class="w-4 h-4"></i></button>${actionButton}</td></tr>`;
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
                <button data-action="open-modal" data-modal-id="truck-modal" data-item-id="${t.id}" class="p-1 text-gray-500 hover:text-blue-600" title="Bewerken"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button data-action="delete-truck" data-truck-id="${t.id}" class="p-1 text-gray-500 hover:text-red-600" title="Verwijderen"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td></tr>`;
    });
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
    plannerPortal.reset();
};

// --- UI & NOTIFICATIONS ---
function showNotification(message, type = 'success') {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = `notification no-print ${type} show`;
    setTimeout(() => { el.classList.remove('show'); }, 3000);
}

userPortal = createUserPortal({ showNotification, lucide });
plannerPortal = createPlannerPortal({ showNotification, lucide });
userPortal.setOnTransportCreated(() => plannerPortal.renderPlanner());
plannerPortal.setRefreshUserList(() => userPortal.renderTransportList());

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
    plannerPortal.renderPlanner();
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
        const index = trucks.findIndex(t => t.id === truckId);
        if (index !== -1) {
            trucks.splice(index, 1);
        }
        transports.forEach(t => {
            if (t.plannedOn === truckId) {
                t.plannedOn = null;
                t.status = 'Aangevraagd';
            }
        });
        showNotification('Vrachtwagen verwijderd');
        renderTruckList();
        plannerPortal.removeTruck(truckId);
        plannerPortal.renderPlanner();
    }
};

// --- APP INITIALIZATION ---
const initializeApp = () => {
    const currentUser = users.find(u => u.id === currentUserId);
    document.getElementById('loggedInUser').textContent = `Ingelogd als: ${currentUser.name} (${currentUser.role})`;

    document.getElementById('tab-user').style.display = ['Gebruiker', 'Admin'].includes(currentUser.role) ? 'block' : 'none';
    document.getElementById('tab-planner').style.display = ['Planner', 'Admin'].includes(currentUser.role) ? 'block' : 'none';
    document.getElementById('tab-admin').style.display = currentUser.role === 'Admin' ? 'block' : 'none';

    renderViews();
    userPortal.attachListeners();

    const userDashboardTab = document.getElementById('subtab-user-dashboard');
    if (userDashboardTab) {
        userDashboardTab.addEventListener('click', () => userPortal.renderTransportList());
    }

    const userNewTab = document.getElementById('subtab-user-new');
    if (userNewTab) {
        userNewTab.addEventListener('click', () => userPortal.renderTransportForm());
    }

    const adminUsersTab = document.getElementById('subtab-admin-users');
    if (adminUsersTab) {
        adminUsersTab.addEventListener('click', renderUserList);
    }

    const adminTrucksTab = document.getElementById('subtab-admin-trucks');
    if (adminTrucksTab) {
        adminTrucksTab.addEventListener('click', renderTruckList);
    }

    userPortal.renderTransportList();
    userPortal.renderTransportForm();
    plannerPortal.renderPlanner();

    attachAppListeners();

    const firstVisibleTab = document.querySelector('#app .main-tab[style*="display: block"]');
    if (firstVisibleTab) {
        firstVisibleTab.click();
    }
};

const attachAppListeners = () => {
    if (!mainTabsInitialized) {
        document.querySelectorAll('.main-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('main-tab-active'));
                e.currentTarget.classList.add('main-tab-active');
                const viewId = 'view-' + e.currentTarget.id.split('-')[1];
                document.querySelectorAll('.view-section').forEach(v => v.classList.toggle('active', v.id === viewId));

                if (viewId === 'view-planner') {
                    plannerPortal.renderPlanner();
                    plannerPortal.ensureMap();
                } else if (viewId === 'view-user') {
                    const dashboardTab = document.getElementById('subtab-user-dashboard');
                    if (dashboardTab) {
                        dashboardTab.click();
                    }
                } else if (viewId === 'view-admin') {
                    renderUserList();
                    renderTruckList();
                    const adminUsersTab = document.getElementById('subtab-admin-users');
                    if (adminUsersTab) {
                        adminUsersTab.click();
                    }
                }
            });
        });
        mainTabsInitialized = true;
    }

    if (!appDelegationAttached) {
        document.getElementById('app').addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            const subTabTarget = e.target.closest('.sub-tab');

            if (subTabTarget) {
                const parentView = subTabTarget.closest('.view-section');
                parentView.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('sub-tab-active'));
                subTabTarget.classList.add('sub-tab-active');
                const subviewId = 'subview-' + subTabTarget.id.substring(subTabTarget.id.indexOf('-') + 1);
                parentView.querySelectorAll('.subview-section').forEach(sv => sv.classList.toggle('active', sv.id === subviewId));
            }

            if (!target) return;

            const action = target.dataset.action;

            switch (action) {
                case 'show-new-request-form':
                    document.getElementById('subtab-user-new').click();
                    break;
                case 'open-modal':
                    openModal(target.dataset.modalId, target.dataset.itemId);
                    break;
                case 'open-transport-details':
                    openModal('transport-details-modal', target.dataset.transportId);
                    break;
                case 'toggle-user-status':
                    toggleUserStatus(target.dataset.userId);
                    break;
                case 'delete-truck':
                    deleteTruck(target.dataset.truckId);
                    break;
                case 'print-truck-list':
                    plannerPortal.printTruckList(target.dataset.truckId);
                    break;
            }
        });
        appDelegationAttached = true;
    }

    if (!headerListenersAttached) {
        const bellButton = document.getElementById('bell-button');
        const userButton = document.getElementById('user-button');
        const bellDropdown = document.getElementById('bell-dropdown');
        const userDropdown = document.getElementById('user-dropdown');
        bellButton.addEventListener('click', (e) => { e.stopPropagation(); userDropdown.classList.add('hidden'); bellDropdown.classList.toggle('hidden'); });
        userButton.addEventListener('click', (e) => { e.stopPropagation(); bellDropdown.classList.add('hidden'); userDropdown.classList.toggle('hidden'); });
        window.addEventListener('click', () => { bellDropdown.classList.add('hidden'); userDropdown.classList.add('hidden'); });
        headerListenersAttached = true;
    }

    if (!modalListenersAttached) {
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action="close-modal"]');
            if (target) {
                const modal = target.closest('.fixed.inset-0');
                if (modal) {
                    closeModal(modal.id);
                }
            }
        });
        modalListenersAttached = true;
    }
};

// --- GLOBAL START ---
lucide.createIcons();
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('logout-button').addEventListener('click', handleLogout);

// Expose functions for testing when QUnit is running
if (typeof QUnit !== 'undefined') {
    window.testable = {
        handleTransportSubmit: userPortal.handleTransportSubmit,
        renderTransportForm: userPortal.renderTransportForm,
        showNotification
    };
}
