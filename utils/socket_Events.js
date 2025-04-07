
// Function to emit table added event
const emitTableAdded = (io, restaurantId, table) => {
    if (!io) return;
    
    // Emit to the specific restaurant room
    io.emit('tableAdded', {
      restaurantId,
      table
    });
    
    console.log('WebSocket: Emitted tableAdded event');
  };
  
  // Function to emit table position updated event
  const emitTablePositionUpdated = (io, restaurantId, table) => {
    if (!io) return;
    
    io.emit('tablePositionUpdated', {
      restaurantId,
      tableId: table._id,
      x_position: table.x_position,
      y_position: table.y_position
    });
    
    console.log('WebSocket: Emitted tablePositionUpdated event');
  };
  
  // Function to emit table details updated event
  const emitTableDetailsUpdated = (io, restaurantId, table) => {
    if (!io) return;
    
    io.emit('tableDetailsUpdated', {
      restaurantId,
      table
    });
    
    console.log('WebSocket: Emitted tableDetailsUpdated event');
  };
  
  // Function to emit table deleted event
  const emitTableDeleted = (io, restaurantId, tableId) => {
    if (!io) return;
    
    io.emit('tableDeleted', {
      restaurantId,
      tableId
    });
    
    console.log('WebSocket: Emitted tableDeleted event');
  };
  
  // Function to emit reservation assigned to table event
  const emitReservationAssigned = (io, restaurantId, table, reservation) => {
    if (!io) return;
    
    // Get client info safely
    let clientName = 'Guest';
    let firstName = 'Guest';
    let lastName = '';
    
    if (reservation.client_id) {
      if (typeof reservation.client_id === 'object') {
        if (reservation.client_id.first_name) {
          firstName = reservation.client_id.first_name;
          lastName = reservation.client_id.last_name || '';
          clientName = `${firstName} ${lastName}`;
        }
      }
    }
    
    io.emit('reservationAssigned', {
      restaurantId,
      tableId: table._id,
      tableNumber: table.table_number,
      reservation: {
        id: reservation._id,
        client_name: clientName,
        first_name: firstName,
        last_name: lastName,
        guests: reservation.guests,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        status: reservation.status,
        client_type: reservation.client_type
      }
    });
    
    console.log('WebSocket: Emitted reservationAssigned event');
  };
  
  // Function to emit table status updated event
  const emitTableStatusUpdated = (io, restaurantId, table) => {
    if (!io) return;
    
    io.emit('tableStatusUpdated', {
      restaurantId,
      tableId: table._id,
      tableNumber: table.table_number,
      status: table.status
    });
    
    console.log('WebSocket: Emitted tableStatusUpdated event');
  };
  
  // Function to emit floor layout updated event - for refreshing the entire view
  const emitFloorLayoutUpdated = (io, restaurantId) => {
    if (!io) return;
    
    io.emit('floorLayoutUpdated', {
      restaurantId
    });
    
    console.log('WebSocket: Emitted floorLayoutUpdated event');
  };
  
  // Export all event emitter functions
  module.exports = {
    emitTableAdded,
    emitTablePositionUpdated,
    emitTableDetailsUpdated,
    emitTableDeleted,
    emitReservationAssigned,
    emitTableStatusUpdated,
    emitFloorLayoutUpdated
  };