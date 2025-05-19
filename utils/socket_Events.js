/**
 * Enhanced Socket Event Emitters for Real-Time Table Management
 * 
 * This module provides functions to emit socket events for real-time updates related to table management.
 * The implementation uses room-based communication to efficiently target specific clients:
 * - restaurant_${restaurantId} for restaurant-specific events
 * - customer_${customerEmail} for customer-specific notifications
 */

// Function to emit table added event
const emitTableAdded = (io, restaurantId, table) => {
  if (!io) return;
  
  const event = {
    restaurantId,
    table,
    timestamp: new Date(),
    action: 'add'
  };
  
  // Target the specific restaurant room
  io.to(`restaurant_${restaurantId}`).emit('tableAdded', event);
  
  // Also emit to the generic channel for any admin interfaces
  io.emit('tableAdded', event);
  
  //console.log('WebSocket: Emitted tableAdded event to restaurant room:', restaurantId);
};

// Function to emit table position updated event
const emitTablePositionUpdated = (io, restaurantId, table) => {
  if (!io) return;
  
  const event = {
    restaurantId,
    tableId: table._id,
    tableNumber: table.table_number,
    x_position: table.x_position,
    y_position: table.y_position,
    timestamp: new Date(),
    action: 'move'
  };
  
  // Target the specific restaurant room
  io.to(`restaurant_${restaurantId}`).emit('tablePositionUpdated', event);
  
  //console.log('WebSocket: Emitted tablePositionUpdated event to restaurant room:', restaurantId);
};

// Function to emit table details updated event
const emitTableDetailsUpdated = (io, restaurantId, table) => {
  if (!io) return;
  
  const event = {
    restaurantId,
    table,
    tableNumber: table.table_number, // For easier access in front-end
    timestamp: new Date(),
    action: 'update'
  };
  
  // Target the specific restaurant room
  io.to(`restaurant_${restaurantId}`).emit('tableDetailsUpdated', event);
  
  //console.log('WebSocket: Emitted tableDetailsUpdated event to restaurant room:', restaurantId);
};

// Function to emit table deleted event
const emitTableDeleted = (io, restaurantId, tableId, tableNumber) => {
  if (!io) return;
  
  const event = {
    restaurantId,
    tableId,
    tableNumber,
    timestamp: new Date(),
    action: 'delete'
  };
  
  // Target the specific restaurant room
  io.to(`restaurant_${restaurantId}`).emit('tableDeleted', event);
  
  //console.log('WebSocket: Emitted tableDeleted event to restaurant room:', restaurantId);
};

// Function to emit reservation assigned to table event
const emitReservationAssigned = (io, restaurantId, table, reservation) => {
  if (!io) return;
  
  // Get client info safely
  let clientName = 'Guest';
  let firstName = 'Guest';
  let lastName = '';
  let customerEmail = null;
  
  if (reservation.client_id) {
    if (typeof reservation.client_id === 'object') {
      if (reservation.client_id.first_name) {
        firstName = reservation.client_id.first_name;
        lastName = reservation.client_id.last_name || '';
        clientName = `${firstName} ${lastName}`;
        
        // Get email for customer-specific notification
        if (reservation.client_id.email) {
          customerEmail = reservation.client_id.email;
        }
      }
    }
  }
  
  const event = {
    restaurantId,
    tableId: table._id,
    tableNumber: table.table_number,
    reservation: {
      id: reservation._id,
      client_name: clientName,
      first_name: firstName,
      last_name: lastName,
      customerEmail: customerEmail,
      guests: reservation.guests,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      status: reservation.status,
      client_type: reservation.client_type
    },
    timestamp: new Date(),
    action: 'assign'
  };
  
  // Target the specific restaurant room
  io.to(`restaurant_${restaurantId}`).emit('reservationAssigned', event);
  
  // If we have customer email, also notify that specific customer
  if (customerEmail) {
    io.to(`customer_${customerEmail}`).emit('tableAssigned', {
      restaurantId,
      tableNumber: table.table_number,
      tableId: table._id,
      reservationId: reservation._id,
      customerEmail: customerEmail,
      customerName: clientName,
      guests: reservation.guests,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      timestamp: new Date()
    });
    
    //console.log('WebSocket: Emitted tableAssigned event to customer:', customerEmail);
  }
  
  //console.log('WebSocket: Emitted reservationAssigned event to restaurant room:', restaurantId);
};

// Function to emit table status updated event
const emitTableStatusUpdated = (io, restaurantId, table) => {
  if (!io) return;
  
  const event = {
    restaurantId,
    tableId: table._id,
    tableNumber: table.table_number,
    status: table.status,
    timestamp: new Date(),
    action: 'status'
  };
  
  // Target the specific restaurant room
  io.to(`restaurant_${restaurantId}`).emit('tableStatusUpdated', event);
  
  //console.log('WebSocket: Emitted tableStatusUpdated event to restaurant room:', restaurantId);
  
  // If table has a current reservation with customer email, notify them too
  if (table.current_reservation && table.current_reservation.client_id) {
    // We would need to fetch the customer email here
    // This would typically require an additional DB query
    // For now, we'll leave this commented out as a placeholder
    /*
    const customerEmail = await getCustomerEmailFromReservation(table.current_reservation);
    if (customerEmail) {
      io.to(`customer_${customerEmail}`).emit('tableStatusChanged', {
        restaurantId,
        tableNumber: table.table_number,
        status: table.status,
        timestamp: new Date()
      });
    }
    */
  }
};

// Function to emit floor layout updated event - for refreshing the entire view
const emitFloorLayoutUpdated = (io, restaurantId) => {
  if (!io) return;
  
  const event = {
    restaurantId,
    timestamp: new Date(),
    action: 'refresh'
  };
  
  // Target the specific restaurant room
  io.to(`restaurant_${restaurantId}`).emit('floorLayoutUpdated', event);
  
  //console.log('WebSocket: Emitted floorLayoutUpdated event to restaurant room:', restaurantId);
};

// Function to emit table reservation time conflict event (when a time slot becomes unavailable)
const emitTableTimeConflict = (io, restaurantId, table, conflictingReservation) => {
  if (!io) return;
  
  const event = {
    restaurantId,
    tableId: table._id,
    tableNumber: table.table_number,
    conflictTime: {
      start: conflictingReservation.start_time,
      end: conflictingReservation.end_time
    },
    timestamp: new Date(),
    action: 'conflict'
  };
  
  // Target the specific restaurant room
  io.to(`restaurant_${restaurantId}`).emit('tableTimeConflict', event);
  
  //console.log('WebSocket: Emitted tableTimeConflict event to restaurant room:', restaurantId);
};

// Function to emit table availability changed event (for customers browsing for tables)
const emitTableAvailabilityChanged = (io, restaurantId, date, timeSlot, availableTables) => {
  if (!io) return;
  
  const event = {
    restaurantId,
    date,
    timeSlot,
    availableTables,
    timestamp: new Date(),
    action: 'availability'
  };
  
  // Broadcast to all clients viewing this restaurant's availability
  io.to(`restaurant_${restaurantId}`).emit('tableAvailabilityChanged', event);
  
  //console.log('WebSocket: Emitted tableAvailabilityChanged event for restaurant:', restaurantId);
};

// Export all event emitter functions
module.exports = {
  emitTableAdded,
  emitTablePositionUpdated,
  emitTableDetailsUpdated,
  emitTableDeleted,
  emitReservationAssigned,
  emitTableStatusUpdated,
  emitFloorLayoutUpdated,
  emitTableTimeConflict,
  emitTableAvailabilityChanged
};