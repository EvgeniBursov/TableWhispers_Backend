const express = require('express');
const router = express.Router();

const { 
  getRestaurantTables, 
  addTable, 
  updateTablePosition, 
  updateTableDetails,
  assignTableToReservation, 
  deleteTable,
  getTableReservations,
  setTableStatus,
  getFloorLayout
} = require('../tables_controllers/tablesController');

// Get all tables for a restaurant with enhanced details
router.get('/restaurant/:id/tables', getRestaurantTables);

// Get floor layout with all tables and their statuses
router.get('/restaurant/:id/floor-layout', getFloorLayout);

// Get reservations for a specific table
router.get('/tables/:table_id/reservations', getTableReservations);

// Add a new table
router.post('/tables', addTable);

// Update table position (for drag and drop functionality)
router.put('/tables/:table_id/position', updateTablePosition);

// Update table details (seats, shape, etc.)
router.put('/tables/:table_id/details', updateTableDetails);

// Set table status (available, occupied, maintenance, etc.)
router.put('/tables/:table_id/status', setTableStatus);

// Assign reservation to table
router.post('/tables/assign', assignTableToReservation);

// Delete table
router.delete('/tables/:table_id', deleteTable);

module.exports = router;