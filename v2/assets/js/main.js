import { loadOrders, saveOrder, editOrder, deleteOrder, resetForm, filterDashboard, togglePickupFields, showSectionInit } from './features/orders.js';
import { loadPlanningData, optimizePlanning, dragOrder, allowDrop, removeDragOver, dropOrder } from './features/planning.js';
import { initializeMap, updateMap, toggleRoutes, calculateAllRoutes, printRoutes, centerMap, focusOnTruck } from './features/map.js';
import { getTodayString } from './lib/utils.js';

// Expose functions used by inline HTML attributes to window.
Object.assign(window, {
  // navigation + sections
  showSection: showSectionInit,
  // dashboard/orders
  filterDashboard, editOrder, deleteOrder,
  // forms
  saveOrder, resetForm, togglePickupFields,
  // planning dnd
  dragOrder, allowDrop, removeDragOver, dropOrder,
  loadPlanningData, optimizePlanning,
  // map controls
  initializeMap, updateMap, toggleRoutes, calculateAllRoutes, printRoutes, centerMap, focusOnTruck
});

document.addEventListener('DOMContentLoaded', () => {
  // Set default dates
  const today = getTodayString();
  const d1 = document.getElementById('transportDatum');
  const d2 = document.getElementById('planningDate');
  const d3 = document.getElementById('mapDate');
  if (d1) d1.value = today;
  if (d2) d2.value = today;
  if (d3) d3.value = today;

  // Load initial data
  loadOrders();

  // Setup drag & drop for unplanned orders area
  const unplannedArea = document.getElementById('unplanedOrdersList');
  if (unplannedArea) {
    unplannedArea.addEventListener('drop', (event)=> dropOrder(event, ''));
    unplannedArea.addEventListener('dragover', allowDrop);
    unplannedArea.addEventListener('dragleave', removeDragOver);
  }
});
