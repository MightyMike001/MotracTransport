// js/main.js
import {S, load} from './state.js';
import {renderDashboard} from './components/dashboard.js';
import {renderOrders} from './components/orders.js';
import {renderPlanning} from './components/planning.js';
import {renderMapView, initLeaflet} from './components/map.js';

const views = {
  dashboard: document.querySelector('#view-dashboard'),
  orders: document.querySelector('#view-orders'),
  planning: document.querySelector('#view-planning'),
  map: document.querySelector('#view-map')
};

function switchTo(name){
  document.querySelectorAll('.tab').forEach(b=> b.classList.toggle('active', b.dataset.view===name));
  Object.entries(views).forEach(([k,el])=> el.classList.toggle('active', k===name));
  if (name==='dashboard') renderDashboard(views.dashboard);
  else if (name==='orders') renderOrders(views.orders);
  else if (name==='planning') renderPlanning(views.planning);
  else if (name==='map') renderMapView(views.map);
}

document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=> switchTo(btn.dataset.view));
});

// boot
load();
renderDashboard(views.dashboard);
initLeaflet(); // pre-init leaflet instance (lazy in component)
