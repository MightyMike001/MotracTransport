import * as Orders from './features/orders.js';
import * as Planning from './features/planning.js';
import * as MapMod from './features/map.js';
import { getTodayString } from './lib/utils.js';

// expose a few items globally (inline onclick uses them)
window.showSection = Orders.showSection;
window.loadOrders = Orders.loadOrders;
window.saveOrder = Orders.saveOrder;
window.saveOrderToGitHubFromForm = Orders.saveOrderToGitHubFromForm;
window.togglePickupFields = Orders.togglePickupFields;
window.editOrder = Orders.editOrder;
window.deleteOrder = Orders.deleteOrder;
window.resetForm = Orders.resetForm;
window.filterDashboard = Orders.filterDashboard;
window.loadOrdersFromGitHub = Orders.loadOrdersFromGitHub;

window.loadPlanningData = Planning.loadPlanningData;
window.optimizePlanning = Planning.optimizePlanning;

window.initializeMap = MapMod.initializeMap;
window.updateMap = MapMod.updateMap;
window.toggleRoutes = MapMod.toggleRoutes;
window.calculateAllRoutes = MapMod.calculateAllRoutes;
window.printRoutes = MapMod.printRoutes;
window.centerMap = MapMod.centerMap;

document.addEventListener('DOMContentLoaded', () => {
  const today = getTodayString();
  ['transportDatum','planningDate','mapDate'].forEach(id => { const el = document.getElementById(id); if(el) el.value = today; });
  // initial load from bundled in-memory data
  Orders.loadOrders();

  // setup drop handlers for unplanned area
  const unplannedArea = document.getElementById('unplanedOrdersList');
  if(unplannedArea){
    unplannedArea.addEventListener('drop', (e) => { Planning.dropOrder?.(e, ''); });
    unplannedArea.addEventListener('dragover', Planning.allowDrop);
    unplannedArea.addEventListener('dragleave', Planning.removeDragOver);
  }
});
