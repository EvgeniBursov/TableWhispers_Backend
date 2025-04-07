/*const Table = require('../models/Tables');

const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/User_Order')
const ClientGuest = require('../models/ClientGuest')



// Get all tables for a restaurant with enhanced details
const getRestaurantTables = async (req, res) => {
  try {
    const restaurant_id = req.params.id;
    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }
    
    // Get all tables with their current reservations and detailed client information
    const tables = await Table.find({ restaurant_id })
      .populate({
        path: 'current_reservation',
        select: 'client_id start_time end_time guests status',
        populate: {
          path: 'client_id',
          select: 'first_name last_name email phone_number'
        }
      })
      .populate({
        path: 'reservations.client_id',
        select: 'first_name last_name email phone_number'
      })
      .sort({ table_number: 1 });
    
    // Get all reservations for today for this restaurant
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayReservations = await UserOrder.find({
      restaurant: restaurant_id,
      start_time: { $gte: today, $lt: tomorrow },
      status: { $nin: ['Cancelled'] }
    }).populate('client_id', 'first_name last_name email phone_number');
    
    // Transform data to include all daily reservations per table
    const enhancedTables = tables.map(table => {
      const tableReservations = todayReservations.filter(
        reservation => reservation.tableNumber === table.table_number
      );
      
      return {
        _id: table._id,
        table_number: table.table_number,
        seats: table.seats,
        shape: table.shape,
        size: table.size,
        width: table.width,
        height: table.height,
        x_position: table.x_position,
        y_position: table.y_position,
        status: table.status,
        section: table.section,
        current_reservation: table.current_reservation,
        daily_schedule: tableReservations.map(reservation => ({
          reservation_id: reservation._id,
          client_name: reservation.client_id ? 
            `${reservation.client_id.first_name} ${reservation.client_id.last_name}` : 
            'Guest',
          guests: reservation.guests,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
          status: reservation.status,
          duration: getDurationInMinutes(reservation.start_time, reservation.end_time)
        })).sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      };
    });
    
    res.status(200).json({
      success: true,
      tables: enhancedTables
    });
  } catch (error) {
    console.error('Error fetching restaurant tables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant tables',
      error: error.message
    });
  }
};

// Helper function to calculate duration in minutes
const getDurationInMinutes = (start, end) => {
  if (!start || !end) return 0;
  return Math.floor((new Date(end) - new Date(start)) / (1000 * 60));
};
 
// Add a new table
const addTable = async (req, res) => {
  try {
    const { 
      restaurant_id, 
      table_number, 
      seats, 
      x_position, 
      y_position,
      shape,
      size,
      width,
      height,
      section,
      status
    } = req.body;
    
    if (!restaurant_id || !table_number || !seats || !shape) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID, table number, seats, and shape are required'
      });
    }
    
    // Validate shape-specific dimensions
    if (shape === 'round' && !size) {
      return res.status(400).json({
        success: false,
        message: 'Size is required for round tables'
      });
    }
    
    if ((shape === 'rectangle' || shape === 'square') && (!width || !height)) {
      return res.status(400).json({
        success: false,
        message: 'Width and height are required for rectangle/square tables'
      });
    }
    
    // Check if table number already exists for this restaurant
    const existingTable = await Table.findOne({ 
      restaurant_id,
      table_number
    });
    
    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: `Table number ${table_number} already exists for this restaurant`
      });
    }
    
    const newTable = new Table({
      restaurant_id,
      table_number,
      seats,
      shape,
      size: shape === 'round' ? size : undefined,
      width: (shape === 'rectangle' || shape === 'square') ? width : undefined,
      height: (shape === 'rectangle' || shape === 'square') ? height : undefined,
      x_position: x_position || 0,
      y_position: y_position || 0,
      section: section || 'main',
      status: status || 'available'
    });
    
    await newTable.save();
    
    res.status(201).json({
      success: true,
      message: 'Table added successfully',
      table: newTable
    });
  } catch (error) {
    console.error('Error adding table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add table',
      error: error.message
    });
  }
};

// Update table position
const updateTablePosition = async (req, res) => {
  try {
    const  table_id  = req.params.table_id;
    const { x_position, y_position } = req.body;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    if (x_position === undefined || y_position === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both x_position and y_position are required'
      });
    }
    
    const updatedTable = await Table.findByIdAndUpdate(
      table_id,
      { x_position, y_position },
      { new: true }
    );
    
    if (!updatedTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Table position updated successfully',
      table: updatedTable
    });
  } catch (error) {
    console.error('Error updating table position:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update table position',
      error: error.message
    });
  }
};

// Update table details
const updateTableDetails = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const { 
      seats, 
      shape, 
      size,
      width,
      height,
      section, 
      status 
    } = req.body;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    // Find the table first to check if shape is changing
    const existingTable = await Table.findById(table_id);
    
    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Prepare update data
    const updateData = {};
    
    if (seats) updateData.seats = seats;
    if (section) updateData.section = section;
    if (status) updateData.status = status;
    
    // Handle shape change and dimensions
    if (shape && shape !== existingTable.shape) {
      updateData.shape = shape;
      
      // Set appropriate dimension fields based on new shape
      if (shape === 'round') {
        if (!size) {
          return res.status(400).json({
            success: false,
            message: 'Size is required when changing to round shape'
          });
        }
        updateData.size = size;
        // Clear rectangle dimensions
        updateData.width = undefined;
        updateData.height = undefined;
      } else if (shape === 'rectangle' || shape === 'square') {
        if (!width || !height) {
          return res.status(400).json({
            success: false,
            message: 'Width and height are required when changing to rectangle/square shape'
          });
        }
        updateData.width = width;
        updateData.height = height;
        // Clear round dimensions
        updateData.size = undefined;
      }
    } else {
      // No shape change, just update dimensions if provided
      if (existingTable.shape === 'round' && size) {
        updateData.size = size;
      } else if ((existingTable.shape === 'rectangle' || existingTable.shape === 'square')) {
        if (width) updateData.width = width;
        if (height) updateData.height = height;
      }
    }
    
    const updatedTable = await Table.findByIdAndUpdate(
      table_id,
      updateData,
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Table details updated successfully',
      table: updatedTable
    });
  } catch (error) {
    console.error('Error updating table details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update table details',
      error: error.message
    });
  }
};

// Enhanced - Assign reservation to table with time slot
const assignTableToReservation = async (req, res) => {
  try {
    const { table_id, reservation_id } = req.body;
    
    if (!table_id || !reservation_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID and reservation ID are required'
      });
    }
    
    // Check if table exists
    const table = await Table.findById(table_id);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Check if table is available
    if (table.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} is not available`
      });
    }
    
    // Check if reservation exists
    const reservation = await UserOrder.findById(reservation_id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }
    
    // Make sure client_type is correctly set in the reservation
    if (!reservation.client_type) {
      // If client_type is not set, determine it based on the client_id
      const clientUser = await ClientUser.findById(reservation.client_id);
      if (clientUser) {
        reservation.client_type = 'ClientUser';
      } else {
        const clientGuest = await ClientGuest.findById(reservation.client_id);
        if (clientGuest) {
          reservation.client_type = 'ClientGuest';
        } else {
          return res.status(400).json({
            success: false,
            message: 'Cannot determine client type for this reservation'
          });
        }
      }
      
      // Save the updated reservation with client_type
      await reservation.save();
    }
    
    // Check if the table has enough seats
    if (table.seats < reservation.guests) {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} doesn't have enough seats for this reservation`
      });
    }
    
    // Check if there are conflicting reservations
    const isTimeSlotAvailable = await checkTableAvailability(
      table_id, 
      reservation.start_time, 
      reservation.end_time,
      reservation_id // Exclude current reservation when checking conflicts
    );
    
    if (!isTimeSlotAvailable) {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} is not available during the requested time slot`
      });
    }
    
    // Update the table's reservations array
    const newReservation = {
      reservation_id: reservation._id,
      client_id: reservation.client_id,
      client_type: reservation.client_type, // Use the verified client_type
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      guests_count: reservation.guests,
      status: mapOrderStatusToReservationStatus(reservation.status)
    };
    
    // Add to reservations array if not already there
    const existingReservationIndex = table.reservations.findIndex(
      r => r.reservation_id && r.reservation_id.toString() === reservation_id
    );
    
    if (existingReservationIndex >= 0) {
      // Update existing reservation
      table.reservations[existingReservationIndex] = newReservation;
    } else {
      // Add new reservation
      table.reservations.push(newReservation);
    }
    
    // Update current_reservation if reservation is currently active
    const now = new Date();
    if (
      new Date(reservation.start_time) <= now && 
      new Date(reservation.end_time) >= now &&
      reservation.status === 'Seated'
    ) {
      table.current_reservation = reservation_id;
      table.status = 'occupied';
    } else if (reservation.status === 'Planning') {
      table.status = 'reserved';
    }
    
    await table.save();
    
    // Update reservation with table number
    reservation.tableNumber = table.table_number;
    await reservation.save();
    
    res.status(200).json({
      success: true,
      message: `Table ${table.table_number} assigned to reservation successfully`,
      table
    });
  } catch (error) {
    console.error('Error assigning table to reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign table to reservation',
      error: error.message
    });
  }
};


// Delete table
const deleteTable = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    const table = await Table.findById(table_id);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Check if table has a current reservation or future reservations
    if (table.current_reservation) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table with an active reservation'
      });
    }
    
    const now = new Date();
    const hasFutureReservations = table.reservations.some(
      reservation => new Date(reservation.end_time) > now
    );
    
    if (hasFutureReservations) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table with future reservations'
      });
    }
    
    await Table.findByIdAndDelete(table_id);
    
    res.status(200).json({
      success: true,
      message: 'Table deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete table',
      error: error.message
    });
  }
};

// NEW FUNCTIONS

const checkTableAvailability = async (tableId, startTime, endTime, excludeReservationId = null) => {
  try {
    const table = await Table.findById(tableId);
    if (!table) return false;
    
    // Check for conflicting reservations
    const conflictingReservation = table.reservations.find(reservation => {
      // Skip the reservation we're trying to update
      if (excludeReservationId && 
          reservation.reservation_id && 
          reservation.reservation_id.toString() === excludeReservationId.toString()) {
        return false;
      }
      
      // Check for time overlap
      const reservationStart = new Date(reservation.start_time);
      const reservationEnd = new Date(reservation.end_time);
      const requestStart = new Date(startTime);
      const requestEnd = new Date(endTime);
      
      // Conflict if: new start time is before existing end time AND new end time is after existing start time
      return requestStart < reservationEnd && requestEnd > reservationStart;
    });
    
    return !conflictingReservation;
  } catch (error) {
    console.error('Error checking table availability:', error);
    return false;
  }
};

const getTableReservations = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const { date } = req.query;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    const table = await Table.findById(table_id)
      .populate({
        path: 'reservations.client_id',
        select: 'first_name last_name email phone_number'
      });
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    let reservations = table.reservations;
    
    // Filter by date if provided
    if (date) {
      const filterDate = new Date(date);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      reservations = reservations.filter(reservation => {
        const reservationDate = new Date(reservation.start_time);
        return reservationDate >= filterDate && reservationDate < nextDay;
      });
    }
    
    // Sort by start time
    reservations.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    res.status(200).json({
      success: true,
      table_number: table.table_number,
      seats: table.seats,
      reservations: reservations.map(reservation => ({
        id: reservation.reservation_id,
        client_name: reservation.client_id ? 
          `${reservation.client_id.first_name} ${reservation.client_id.last_name}` : 'Guest',
        guests: reservation.guests_count,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        status: reservation.status,
        client_type: reservation.client_type, // Include client_type
        duration: getDurationInMinutes(reservation.start_time, reservation.end_time)
      }))
    });
  } catch (error) {
    console.error('Error fetching table reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table reservations',
      error: error.message
    });
  }
};

// Set table status (available, occupied, maintenance, etc.)
const setTableStatus = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const { status } = req.body;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    if (!status || !['available', 'reserved', 'occupied', 'maintenance', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    const table = await Table.findById(table_id);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Handle current reservation if setting to available
    if (status === 'available' && table.current_reservation) {
      table.current_reservation = null;
    }
    
    // Update status
    table.status = status;
    await table.save();
    
    res.status(200).json({
      success: true,
      message: `Table status updated to ${status}`,
      table
    });
  } catch (error) {
    console.error('Error updating table status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update table status',
      error: error.message
    });
  }
};

// Helper function to map UserOrder status to reservation status
const mapOrderStatusToReservationStatus = (orderStatus) => {
  const statusMap = {
    'Planning': 'planning',
    'Done': 'done',
    'Cancelled': 'cancelled',
    'Seated': 'seated'
  };
  
  return statusMap[orderStatus] || 'planning';
};



const getFloorLayout = async (req, res) => {
  try {
    const restaurant_id = req.params.id;
    const { date } = req.query;
    
    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }
    
    // Set up date filtering
    const filterDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(filterDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(filterDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get tables with populated reservations
    const tables = await Table.find({ restaurant_id });
    
    // Create a map of all reservations with their details
    const reservationsMap = {};
    
    // Get all reservations for today
    const todaysReservations = await UserOrder.find({
      restaurant: restaurant_id,
      start_time: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['Cancelled'] }
    });
    
    // Get all client IDs from reservations
    const clientIds = todaysReservations.map(res => res.client_id).filter(id => id);
    
    // Get client information - try both collections
    const clientUsers = await ClientUser.find({ _id: { $in: clientIds } });
    const clientGuests = await ClientGuest.find({ _id: { $in: clientIds } });
    
    // Create a map of clients by ID for easy lookup
    const clientsMap = {};
    
    clientUsers.forEach(client => {
      clientsMap[client._id.toString()] = {
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone_number: client.phone_number,
        type: 'ClientUser'
      };
    });
    
    clientGuests.forEach(client => {
      clientsMap[client._id.toString()] = {
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone_number: client.phone_number,
        type: 'ClientGuest'
      };
    });
    
    // Create reservation map using client information
    todaysReservations.forEach(reservation => {
      const clientId = reservation.client_id ? reservation.client_id.toString() : null;
      const client = clientId ? clientsMap[clientId] : null;
      
      reservationsMap[reservation._id.toString()] = {
        id: reservation._id,
        client_name: client ? `${client.first_name} ${client.last_name}` : 'Guest',
        client_info: client,
        guests: reservation.guests,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        status: reservation.status,
        client_type: reservation.client_type,
        table_number: reservation.tableNumber
      };
    });
    
    // Map tables to response format
    const tableMap = {};
    tables.forEach(table => {
      tableMap[table.table_number] = {
        id: table._id,
        table_number: table.table_number,
        shape: table.shape,
        size: table.size,
        width: table.width,
        height: table.height,
        x_position: table.x_position,
        y_position: table.y_position,
        seats: table.seats,
        status: table.status,
        section: table.section,
        current_client: null,
        schedule: []
      };
      
      // Add reservations from table.reservations that match the date filter
      if (table.reservations && table.reservations.length > 0) {
        table.reservations.forEach(reservation => {
          const resStartTime = new Date(reservation.start_time);
          const resId = reservation.reservation_id ? reservation.reservation_id.toString() : null;
          
          // Check if reservation is for the selected date
          if (resStartTime >= startOfDay && resStartTime <= endOfDay) {
            // Get client info from our pre-populated map
            const resInfo = resId && reservationsMap[resId] ? reservationsMap[resId] : null;
            
            // If we have client info from the reservation map, use it
            if (resInfo) {
              tableMap[table.table_number].schedule.push({
                id: reservation.reservation_id,
                client_name: resInfo.client_name,
                guests: reservation.guests_count,
                start_time: reservation.start_time,
                end_time: reservation.end_time,
                status: reservation.status,
                client_type: reservation.client_type,
                is_current: new Date() >= resStartTime && 
                  new Date() <= new Date(reservation.end_time) &&
                  reservation.status === 'seated'
              });
            } else {
              // Use direct client lookup as fallback
              const clientId = reservation.client_id ? 
                (typeof reservation.client_id === 'object' ? 
                  reservation.client_id.toString() : reservation.client_id) : null;
              
              const client = clientId ? clientsMap[clientId] : null;
              
              tableMap[table.table_number].schedule.push({
                id: reservation.reservation_id,
                client_name: client ? 
                  `${client.first_name} ${client.last_name}` : 'Guest',
                guests: reservation.guests_count,
                start_time: reservation.start_time,
                end_time: reservation.end_time,
                status: reservation.status,
                client_type: reservation.client_type,
                is_current: new Date() >= resStartTime && 
                  new Date() <= new Date(reservation.end_time) &&
                  reservation.status === 'seated'
              });
            }
          }
        });
      }
    });
    
    // Add any reservations from UserOrder that aren't already in tables
    todaysReservations.forEach(reservation => {
      if (reservation.tableNumber && tableMap[reservation.tableNumber]) {
        const resId = reservation._id.toString();
        
        // Check if this reservation is already in the schedule array
        const isAlreadyAdded = tableMap[reservation.tableNumber].schedule.some(
          item => item.id && item.id.toString() === resId
        );
        
        if (!isAlreadyAdded) {
          const clientId = reservation.client_id ? reservation.client_id.toString() : null;
          const client = clientId ? clientsMap[clientId] : null;
          
          tableMap[reservation.tableNumber].schedule.push({
            id: reservation._id,
            client_name: client ? 
              `${client.first_name} ${client.last_name}` : 'Guest',
            guests: reservation.guests,
            start_time: reservation.start_time,
            end_time: reservation.end_time,
            status: reservation.status,
            client_type: reservation.client_type,
            is_current: reservation.status === 'Seated' && 
              new Date() >= new Date(reservation.start_time) && 
              new Date() <= new Date(reservation.end_time)
          });
        }
        
        // Set current_client if this reservation is active now
        const now = new Date();
        if (
          now >= new Date(reservation.start_time) && 
          now <= new Date(reservation.end_time) &&
          reservation.status === 'Seated'
        ) {
          const clientId = reservation.client_id ? reservation.client_id.toString() : null;
          const client = clientId ? clientsMap[clientId] : null;
          
          tableMap[reservation.tableNumber].current_client = {
            name: client ? 
              `${client.first_name} ${client.last_name}` : 'Guest',
            guests: reservation.guests,
            end_time: reservation.end_time,
            client_type: reservation.client_type
          };
        }
      }
    });
    
    // Sort each table's schedule by start time
    Object.values(tableMap).forEach(table => {
      table.schedule.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    });
    
    res.status(200).json({
      success: true,
      layout: Object.values(tableMap)
    });
  } catch (error) {
    console.error('Error fetching floor layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch floor layout',
      error: error.message
    });
  }
};



module.exports = {
  getRestaurantTables,
  addTable,
  updateTablePosition,
  updateTableDetails,
  assignTableToReservation,
  deleteTable,
  getTableReservations,
  setTableStatus,
  getFloorLayout,
  checkTableAvailability
};*/



const Table = require('../models/Tables');
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const ClientGuest = require('../models/ClientGuest');
const mongoose = require('mongoose');

// Import socket events
const {
  emitTableAdded,
  emitTablePositionUpdated,
  emitTableDetailsUpdated,
  emitTableDeleted,
  emitReservationAssigned,
  emitTableStatusUpdated,
  emitFloorLayoutUpdated
} = require('../utils/socket_Events');

// Get all tables for a restaurant with enhanced details
const getRestaurantTables = async (req, res) => {
  try {
    const restaurant_id = req.params.id;
    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }
    
    // Get all tables with their current reservations and detailed client information
    const tables = await Table.find({ restaurant_id })
      .populate({
        path: 'current_reservation',
        select: 'client_id start_time end_time guests status',
        populate: {
          path: 'client_id',
          select: 'first_name last_name email phone_number'
        }
      })
      .populate({
        path: 'reservations.client_id',
        select: 'first_name last_name email phone_number'
      })
      .sort({ table_number: 1 });
    
    // Get all reservations for today for this restaurant
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayReservations = await UserOrder.find({
      restaurant: restaurant_id,
      start_time: { $gte: today, $lt: tomorrow },
      status: { $nin: ['Cancelled'] }
    }).populate('client_id', 'first_name last_name email phone_number');
    
    // Transform data to include all daily reservations per table
    const enhancedTables = tables.map(table => {
      const tableReservations = todayReservations.filter(
        reservation => reservation.tableNumber === table.table_number
      );
      
      return {
        _id: table._id,
        table_number: table.table_number,
        seats: table.seats,
        shape: table.shape,
        size: table.size,
        width: table.width,
        height: table.height,
        x_position: table.x_position,
        y_position: table.y_position,
        status: table.status,
        section: table.section,
        current_reservation: table.current_reservation,
        daily_schedule: tableReservations.map(reservation => ({
          reservation_id: reservation._id,
          client_name: reservation.client_id ? 
            `${reservation.client_id.first_name} ${reservation.client_id.last_name}` : 
            'Guest',
          guests: reservation.guests,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
          status: reservation.status,
          duration: getDurationInMinutes(reservation.start_time, reservation.end_time)
        })).sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      };
    });
    
    res.status(200).json({
      success: true,
      tables: enhancedTables
    });
  } catch (error) {
    console.error('Error fetching restaurant tables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant tables',
      error: error.message
    });
  }
};

// Add a new table with real-time updates
const addTable = async (req, res) => {
  try {
    const { 
      restaurant_id, 
      table_number, 
      seats, 
      x_position, 
      y_position,
      shape,
      size,
      width,
      height,
      section,
      status
    } = req.body;
    
    if (!restaurant_id || !table_number || !seats || !shape) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID, table number, seats, and shape are required'
      });
    }
    
    // Validate shape-specific dimensions
    if (shape === 'round' && !size) {
      return res.status(400).json({
        success: false,
        message: 'Size is required for round tables'
      });
    }
    
    if ((shape === 'rectangle' || shape === 'square') && (!width || !height)) {
      return res.status(400).json({
        success: false,
        message: 'Width and height are required for rectangle/square tables'
      });
    }
    
    // Check if table number already exists for this restaurant
    const existingTable = await Table.findOne({ 
      restaurant_id,
      table_number
    });
    
    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: `Table number ${table_number} already exists for this restaurant`
      });
    }
    
    const newTable = new Table({
      restaurant_id,
      table_number,
      seats,
      shape,
      size: shape === 'round' ? size : undefined,
      width: (shape === 'rectangle' || shape === 'square') ? width : undefined,
      height: (shape === 'rectangle' || shape === 'square') ? height : undefined,
      x_position: x_position || 0,
      y_position: y_position || 0,
      section: section || 'main',
      status: status || 'available'
    });
    
    await newTable.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('socketio');
    emitTableAdded(io, restaurant_id, newTable);
    // Also emit a floor layout update to refresh the entire view
    emitFloorLayoutUpdated(io, restaurant_id);
    
    res.status(201).json({
      success: true,
      message: 'Table added successfully',
      table: newTable
    });
  } catch (error) {
    console.error('Error adding table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add table',
      error: error.message
    });
  }
};

// Update table position with real-time updates
const updateTablePosition = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const { x_position, y_position } = req.body;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    if (x_position === undefined || y_position === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both x_position and y_position are required'
      });
    }
    
    const updatedTable = await Table.findByIdAndUpdate(
      table_id,
      { x_position, y_position },
      { new: true }
    );
    
    if (!updatedTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Emit socket event for real-time update
    const io = req.app.get('socketio');
    emitTablePositionUpdated(io, updatedTable.restaurant_id, updatedTable);
    
    res.status(200).json({
      success: true,
      message: 'Table position updated successfully',
      table: updatedTable
    });
  } catch (error) {
    console.error('Error updating table position:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update table position',
      error: error.message
    });
  }
};

// Update table details with real-time updates
const updateTableDetails = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const { 
      seats, 
      shape, 
      size,
      width,
      height,
      section, 
      status 
    } = req.body;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    // Find the table first to check if shape is changing
    const existingTable = await Table.findById(table_id);
    
    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Prepare update data
    const updateData = {};
    
    if (seats) updateData.seats = seats;
    if (section) updateData.section = section;
    if (status) updateData.status = status;
    
    // Handle shape change and dimensions
    if (shape && shape !== existingTable.shape) {
      updateData.shape = shape;
      
      // Set appropriate dimension fields based on new shape
      if (shape === 'round') {
        if (!size) {
          return res.status(400).json({
            success: false,
            message: 'Size is required when changing to round shape'
          });
        }
        updateData.size = size;
        // Clear rectangle dimensions
        updateData.width = undefined;
        updateData.height = undefined;
      } else if (shape === 'rectangle' || shape === 'square') {
        if (!width || !height) {
          return res.status(400).json({
            success: false,
            message: 'Width and height are required when changing to rectangle/square shape'
          });
        }
        updateData.width = width;
        updateData.height = height;
        // Clear round dimensions
        updateData.size = undefined;
      }
    } else {
      // No shape change, just update dimensions if provided
      if (existingTable.shape === 'round' && size) {
        updateData.size = size;
      } else if ((existingTable.shape === 'rectangle' || existingTable.shape === 'square')) {
        if (width) updateData.width = width;
        if (height) updateData.height = height;
      }
    }
    
    const updatedTable = await Table.findByIdAndUpdate(
      table_id,
      updateData,
      { new: true }
    );
    
    // Emit socket event for real-time update
    const io = req.app.get('socketio');
    emitTableDetailsUpdated(io, existingTable.restaurant_id, updatedTable);
    
    res.status(200).json({
      success: true,
      message: 'Table details updated successfully',
      table: updatedTable
    });
  } catch (error) {
    console.error('Error updating table details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update table details',
      error: error.message
    });
  }
};

// Assign reservation to table with real-time updates
const assignTableToReservation = async (req, res) => {
  try {
    const { table_id, reservation_id } = req.body;
    
    if (!table_id || !reservation_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID and reservation ID are required'
      });
    }
    
    // Check if table exists
    const table = await Table.findById(table_id);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Check if table is available
    if (table.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} is not available`
      });
    }
    
    // Check if reservation exists
    const reservation = await UserOrder.findById(reservation_id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }
    
    // Make sure client_type is correctly set in the reservation
    if (!reservation.client_type) {
      // If client_type is not set, determine it based on the client_id
      const clientUser = await ClientUser.findById(reservation.client_id);
      if (clientUser) {
        reservation.client_type = 'ClientUser';
      } else {
        const clientGuest = await ClientGuest.findById(reservation.client_id);
        if (clientGuest) {
          reservation.client_type = 'ClientGuest';
        } else {
          return res.status(400).json({
            success: false,
            message: 'Cannot determine client type for this reservation'
          });
        }
      }
      
      // Save the updated reservation with client_type
      await reservation.save();
    }
    
    // Check if the table has enough seats
    if (table.seats < reservation.guests) {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} doesn't have enough seats for this reservation`
      });
    }
    
    // Check if there are conflicting reservations
    const isTimeSlotAvailable = await checkTableAvailability(
      table_id, 
      reservation.start_time, 
      reservation.end_time,
      reservation_id // Exclude current reservation when checking conflicts
    );
    
    if (!isTimeSlotAvailable) {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} is not available during the requested time slot`
      });
    }
    
    // Update the table's reservations array
    const newReservation = {
      reservation_id: reservation._id,
      client_id: reservation.client_id,
      client_type: reservation.client_type, // Use the verified client_type
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      guests_count: reservation.guests,
      status: mapOrderStatusToReservationStatus(reservation.status)
    };
    
    // Add to reservations array if not already there
    const existingReservationIndex = table.reservations.findIndex(
      r => r.reservation_id && r.reservation_id.toString() === reservation_id
    );
    
    if (existingReservationIndex >= 0) {
      // Update existing reservation
      table.reservations[existingReservationIndex] = newReservation;
    } else {
      // Add new reservation
      table.reservations.push(newReservation);
    }
    
    // Update current_reservation if reservation is currently active
    const now = new Date();
    if (
      new Date(reservation.start_time) <= now && 
      new Date(reservation.end_time) >= now &&
      reservation.status === 'Seated'
    ) {
      table.current_reservation = reservation_id;
      table.status = 'occupied';
    } else if (reservation.status === 'Planning') {
      table.status = 'reserved';
    }
    
    await table.save();
    
    // Update reservation with table number
    reservation.tableNumber = table.table_number;
    await reservation.save();
    
    // Get the client data 
    let clientData = null;
    if (reservation.client_id) {
      if (reservation.client_type === 'ClientUser') {
        clientData = await ClientUser.findById(reservation.client_id);
      } else {
        clientData = await ClientGuest.findById(reservation.client_id);
      }
      
      // Add client info to reservation for the socket event
      if (clientData) {
        reservation.client_id = clientData;
      }
    }
    
    // Emit socket event for real-time update
    const io = req.app.get('socketio');
    emitReservationAssigned(io, table.restaurant_id, table, reservation);
    // Also emit a floor layout update for the entire view
    emitFloorLayoutUpdated(io, table.restaurant_id);
    
    res.status(200).json({
      success: true,
      message: `Table ${table.table_number} assigned to reservation successfully`,
      table
    });
  } catch (error) {
    console.error('Error assigning table to reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign table to reservation',
      error: error.message
    });
  }
};

// Delete table with real-time updates
const deleteTable = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    const table = await Table.findById(table_id);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Save restaurant_id before deletion
    const restaurantId = table.restaurant_id;
    
    // Check if table has a current reservation or future reservations
    if (table.current_reservation) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table with an active reservation'
      });
    }
    
    const now = new Date();
    const hasFutureReservations = table.reservations.some(
      reservation => new Date(reservation.end_time) > now
    );
    
    if (hasFutureReservations) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table with future reservations'
      });
    }
    
    await Table.findByIdAndDelete(table_id);
    
    // Emit socket event for real-time update
    const io = req.app.get('socketio');
    emitTableDeleted(io, restaurantId, table_id);
    // Also emit a floor layout update
    emitFloorLayoutUpdated(io, restaurantId);
    
    res.status(200).json({
      success: true,
      message: 'Table deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete table',
      error: error.message
    });
  }
};

// Set table status with real-time updates
const setTableStatus = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const { status } = req.body;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    if (!status || !['available', 'reserved', 'occupied', 'maintenance', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    const table = await Table.findById(table_id);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Handle current reservation if setting to available
    if (status === 'available' && table.current_reservation) {
      table.current_reservation = null;
    }
    
    // Update status
    table.status = status;
    await table.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('socketio');
    emitTableStatusUpdated(io, table.restaurant_id, table);
    
    res.status(200).json({
      success: true,
      message: `Table status updated to ${status}`,
      table
    });
  } catch (error) {
    console.error('Error updating table status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update table status',
      error: error.message
    });
  }
};

// Helper function to calculate duration in minutes
const getDurationInMinutes = (start, end) => {
  if (!start || !end) return 0;
  return Math.floor((new Date(end) - new Date(start)) / (1000 * 60));
};

// Helper function to check table availability
const checkTableAvailability = async (tableId, startTime, endTime, excludeReservationId = null) => {
  try {
    const table = await Table.findById(tableId);
    if (!table) return false;
    
    // Check for conflicting reservations
    const conflictingReservation = table.reservations.find(reservation => {
      // Skip the reservation we're trying to update
      if (excludeReservationId && 
          reservation.reservation_id && 
          reservation.reservation_id.toString() === excludeReservationId.toString()) {
        return false;
      }
      
      // Check for time overlap
      const reservationStart = new Date(reservation.start_time);
      const reservationEnd = new Date(reservation.end_time);
      const requestStart = new Date(startTime);
      const requestEnd = new Date(endTime);
      
      // Conflict if: new start time is before existing end time AND new end time is after existing start time
      return requestStart < reservationEnd && requestEnd > reservationStart;
    });
    
    return !conflictingReservation;
  } catch (error) {
    console.error('Error checking table availability:', error);
    return false;
  }
};

// Helper function to map UserOrder status to reservation status
const mapOrderStatusToReservationStatus = (orderStatus) => {
  const statusMap = {
    'Planning': 'planning',
    'Done': 'done',
    'Cancelled': 'cancelled',
    'Seated': 'seated'
  };
  
  return statusMap[orderStatus] || 'planning';
};

// Get floor layout with real-time support
const getFloorLayout = async (req, res) => {
  try {
    const restaurant_id = req.params.id;
    const { date } = req.query;
    
    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }
    
    // Set up date filtering
    const filterDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(filterDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(filterDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get tables with populated reservations
    const tables = await Table.find({ restaurant_id });
    
    // Create a map of all reservations with their details
    const reservationsMap = {};
    
    // Get all reservations for today
    const todaysReservations = await UserOrder.find({
      restaurant: restaurant_id,
      start_time: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['Cancelled'] }
    });
    
    // Get all client IDs from reservations
    const clientIds = todaysReservations.map(res => res.client_id).filter(id => id);
    
    // Convert string IDs to ObjectIds if needed
    const objectIdClientIds = clientIds.map(id => 
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );
    
    // Get client information - try both collections
    const clientUsers = await ClientUser.find({
      _id: { $in: objectIdClientIds }
    });
    
    const clientGuests = await ClientGuest.find({
      _id: { $in: objectIdClientIds }
    });
    
    // Create a map of clients by ID for easy lookup
    const clientsMap = {};
    
    clientUsers.forEach(client => {
      clientsMap[client._id.toString()] = {
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone_number: client.phone_number,
        type: 'ClientUser'
      };
    });
    
    clientGuests.forEach(client => {
      clientsMap[client._id.toString()] = {
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone_number: client.phone_number,
        type: 'ClientGuest'
      };
    });
    
    // Create reservation map using client information
    todaysReservations.forEach(reservation => {
      const clientId = reservation.client_id ? reservation.client_id.toString() : null;
      const client = clientId ? clientsMap[clientId] : null;
      
      reservationsMap[reservation._id.toString()] = {
        id: reservation._id,
        client_name: client ? `${client.first_name} ${client.last_name}` : 'Guest',
        first_name: client ? client.first_name : 'Guest',
        last_name: client ? client.last_name : '',
        guests: reservation.guests,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        status: reservation.status,
        client_type: reservation.client_type,
        table_number: reservation.tableNumber
      };
    });
    
    // Map tables to response format
    const tableMap = {};
    tables.forEach(table => {
      tableMap[table.table_number] = {
        id: table._id,
        table_number: table.table_number,
        shape: table.shape,
        size: table.size,
        width: table.width,
        height: table.height,
        x_position: table.x_position,
        y_position: table.y_position,
        seats: table.seats,
        status: table.status,
        section: table.section,
        current_client: null,
        schedule: []
      };
      
      // Add reservations from table.reservations that match the date filter
      if (table.reservations && table.reservations.length > 0) {
        table.reservations.forEach(reservation => {
          const resStartTime = new Date(reservation.start_time);
          const resId = reservation.reservation_id ? 
            (typeof reservation.reservation_id === 'object' ? 
              reservation.reservation_id.toString() : reservation.reservation_id) : null;
          
          // Check if reservation is for the selected date
          if (resStartTime >= startOfDay && resStartTime <= endOfDay) {
            // Get client info from our pre-populated map
            const resInfo = resId && reservationsMap[resId] ? reservationsMap[resId] : null;
            
            // If we have client info from the reservation map, use it
            if (resInfo) {
              tableMap[table.table_number].schedule.push({
                id: reservation.reservation_id,
                client_name: resInfo.client_name,
                first_name: resInfo.first_name,
                last_name: resInfo.last_name,
                guests: reservation.guests_count,
                start_time: reservation.start_time,
                end_time: reservation.end_time,
                status: reservation.status,
                client_type: reservation.client_type,
                is_current: new Date() >= resStartTime && 
                  new Date() <= new Date(reservation.end_time) &&
                  reservation.status === 'seated'
              });
            } else {
              // Use direct client lookup as fallback
              const clientId = reservation.client_id ? 
                (typeof reservation.client_id === 'object' ? 
                  reservation.client_id.toString() : reservation.client_id) : null;
              
              const client = clientId ? clientsMap[clientId] : null;
              
              tableMap[table.table_number].schedule.push({
                id: reservation.reservation_id,
                client_name: client ? 
                  `${client.first_name} ${client.last_name}` : 'Guest',
                first_name: client ? client.first_name : 'Guest',
                last_name: client ? client.last_name : '',
                guests: reservation.guests_count,
                start_time: reservation.start_time,
                end_time: reservation.end_time,
                status: reservation.status,
                client_type: reservation.client_type,
                is_current: new Date() >= resStartTime && 
                  new Date() <= new Date(reservation.end_time) &&
                  reservation.status === 'seated'
              });
            }
          }
        });
      }
    });
    
    // Add any reservations from UserOrder that aren't already in tables
    todaysReservations.forEach(reservation => {
      if (reservation.tableNumber && tableMap[reservation.tableNumber]) {
        const resId = reservation._id.toString();
        
        // Check if this reservation is already in the schedule array
        const isAlreadyAdded = tableMap[reservation.tableNumber].schedule.some(
          item => item.id && (item.id.toString() === resId)
        );
        
        if (!isAlreadyAdded) {
          const clientId = reservation.client_id ? reservation.client_id.toString() : null;
          const client = clientId ? clientsMap[clientId] : null;
          
          tableMap[reservation.tableNumber].schedule.push({
            id: reservation._id,
            client_name: client ? 
              `${client.first_name} ${client.last_name}` : 'Guest',
            first_name: client ? client.first_name : 'Guest',
            last_name: client ? client.last_name : '',
            guests: reservation.guests,
            start_time: reservation.start_time,
            end_time: reservation.end_time,
            status: reservation.status,
            client_type: reservation.client_type,
            is_current: reservation.status === 'Seated' && 
              new Date() >= new Date(reservation.start_time) && 
              new Date() <= new Date(reservation.end_time)
          });
        }
        
        // Set current_client if this reservation is active now
        const now = new Date();
        if (
          now >= new Date(reservation.start_time) && 
          now <= new Date(reservation.end_time) &&
          reservation.status === 'Seated'
        ) {
          const clientId = reservation.client_id ? reservation.client_id.toString() : null;
          const client = clientId ? clientsMap[clientId] : null;
          
          tableMap[reservation.tableNumber].current_client = {
            name: client ? 
              `${client.first_name} ${client.last_name}` : 'Guest',
            first_name: client ? client.first_name : 'Guest',
            last_name: client ? client.last_name : '',
            guests: reservation.guests,
            end_time: reservation.end_time,
            client_type: reservation.client_type
          };
        }
      }
    });
    
    // Sort each table's schedule by start time
    Object.values(tableMap).forEach(table => {
      table.schedule.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    });
    
    res.status(200).json({
      success: true,
      layout: Object.values(tableMap)
    });
  } catch (error) {
    console.error('Error fetching floor layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch floor layout',
      error: error.message
    });
  }
};

// Get table reservations with better client data handling
const getTableReservations = async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const { date } = req.query;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    const table = await Table.findById(table_id);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    let reservations = table.reservations;
    
    // Get all client IDs from reservations
    const clientIds = reservations.map(res => res.client_id).filter(id => id);
    
    // Convert string IDs to ObjectIds if needed
    const objectIdClientIds = clientIds.map(id => 
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );
    
    // Get client information from both collections
    const clientUsers = await ClientUser.find({
      _id: { $in: objectIdClientIds }
    });
    
    const clientGuests = await ClientGuest.find({
      _id: { $in: objectIdClientIds }
    });
    
    // Create a map of clients by ID
    const clientsMap = {};
    
    clientUsers.forEach(client => {
      clientsMap[client._id.toString()] = {
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone_number: client.phone_number,
        type: 'ClientUser'
      };
    });
    
    clientGuests.forEach(client => {
      clientsMap[client._id.toString()] = {
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone_number: client.phone_number,
        type: 'ClientGuest'
      };
    });
    
    // Filter by date if provided
    if (date) {
      const filterDate = new Date(date);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      reservations = reservations.filter(reservation => {
        const reservationDate = new Date(reservation.start_time);
        return reservationDate >= filterDate && reservationDate < nextDay;
      });
    }
    
    // Sort by start time
    reservations.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    res.status(200).json({
      success: true,
      table_number: table.table_number,
      seats: table.seats,
      reservations: reservations.map(reservation => {
        const clientId = reservation.client_id ? 
          (typeof reservation.client_id === 'object' ? 
            reservation.client_id.toString() : reservation.client_id) : null;
        
        const client = clientId ? clientsMap[clientId] : null;
        
        return {
          id: reservation.reservation_id,
          client_name: client ? 
            `${client.first_name} ${client.last_name}` : 'Guest',
          first_name: client ? client.first_name : 'Guest',
          last_name: client ? client.last_name : '',
          guests: reservation.guests_count,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
          status: reservation.status,
          client_type: reservation.client_type,
          duration: getDurationInMinutes(reservation.start_time, reservation.end_time)
        };
      })
    });
  } catch (error) {
    console.error('Error fetching table reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table reservations',
      error: error.message
    });
  }
};

module.exports = {
  getRestaurantTables,
  addTable,
  updateTablePosition,
  updateTableDetails,
  assignTableToReservation,
  deleteTable,
  getTableReservations,
  setTableStatus,
  getFloorLayout,
  checkTableAvailability
};