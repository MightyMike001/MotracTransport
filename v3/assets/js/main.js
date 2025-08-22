import { showSection, loadOrders, saveOrder, editOrder, deleteOrder, resetForm, filterDashboard, togglePickupFields, saveOrderToGitHubFromForm, loadOrdersFromGitHub } from './features/orders.js';
import { loadPlanningData, optimizePlanning, dragOrder, allowDrop, removeDragOver, dropOrder } from './features/planning.js';
import { initializeMap, updateMap, toggleRoutes, calculateAllRoutes, printRoutes, centerMap, focusOnTruck } from './features/map.js';
import { getTodayString } from './lib/utils.js';

Object.assign(window, {
  showSection, loadOrders, saveOrder, editOrder, deleteOrder, resetForm, filterDashboard,
  togglePickupFields, saveOrderToGitHubFromForm, loadOrdersFromGitHub,
  loadPlanningData, optimizePlanning, dragOrder, allowDrop, removeDragOver, dropOrder,
  initializeMap, updateMap, toggleRoutes, calculateAllRoutes, printRoutes, centerMap, focusOnTruck
});

document.addEventListener('DOMContentLoaded', ()=>{
  const t=getTodayString();
  ['transportDatum','planningDate','mapDate'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=t; });
  loadOrders();
  const unplanned=document.getElementById('unplanedOrdersList');
  if(unplanned){
    unplanned.addEventListener('drop', (e)=> dropOrder(e,''));
    unplanned.addEventListener('dragover', allowDrop);
    unplanned.addEventListener('dragleave', removeDragOver);
  }
});
