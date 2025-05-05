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

/**
 * Get all tables for a restaurant with enhanced details
 * Includes all reservations for the day with customer information
 */
const getRestaurantTables = async (req, res) => {
  console.log("START getRestaurantTables FUNCTION");
  try {
    const restaurant_id = req.params.id;
    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }
    
    // Get all tables for the restaurant
    const tables = await Table.find({ restaurant_id })
      .populate({
        path: 'current_reservation',
        select: 'client_id start_time end_time guests status',
        populate: {
          path: 'client_id',
          select: 'first_name last_name email phone_number'
        }
      })
      .sort({ table_number: 1 });
    
    // Set up date range for today's reservations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get all active reservations for today 
    const todayReservations = await UserOrder.find({
      restaurant: restaurant_id,
      start_time: { $gte: today, $lt: tomorrow },
      status: { $nin: ['Cancelled'] }
    }).populate('client_id', 'first_name last_name email phone_number');
    
    console.log(`Found ${tables.length} tables and ${todayReservations.length} reservations for today`);
    
    // Transform data to include daily reservations per table
    const enhancedTables = tables.map(table => {
      // Filter reservations for this specific table
      const tableReservations = todayReservations.filter(
        reservation => reservation.tableNumber === table.table_number || 
                      (reservation.table_Id && reservation.table_Id.toString() === table._id.toString())
      );
      
      // Create enhanced table object with all needed properties
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
        status: table.table_status || 'available',
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

/**
 * Add a new table with real-time updates via socket.io
 * Validates all required fields and emits events for real-time updates
 */
const addTable = async (req, res) => {
  console.log("START addTable FUNCTION");
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
      table_status
    } = req.body;
    
    // Validate required fields
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
    
    // Create new table with validated data
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
      table_status: table_status || 'available'
    });
    
    await newTable.save();
    
    // Emit socket events for real-time update
    const io = req.app.get('socketio');
    emitTableAdded(io, restaurant_id, newTable);
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

/**
 * Update table position with real-time socket updates
 * Allows dragging and repositioning tables in UI
 */
const updateTablePosition = async (req, res) => {
  console.log("START updateTablePosition FUNCTION");
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

/**
 * Update table details with real-time socket updates
 * Supports changing seats, shape, size and other properties
 */
const updateTableDetails = async (req, res) => {
  console.log("START updateTableDetails FUNCTION");
  try {
    const table_id = req.params.table_id;
    const { 
      seats, 
      shape, 
      size,
      width,
      height,
      section, 
      table_status 
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
    
    // Prepare update data with changed fields only
    const updateData = {};
    
    if (seats) updateData.seats = seats;
    if (section) updateData.section = section;
    if (table_status) updateData.table_status = table_status;
    
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

/**
 * Assign reservation to table with real-time updates
 * Handles validation, conflicting reservations, and socket notifications
 */
const assignTableToReservation = async (req, res) => {
  console.log("START assignTableToReservation FUNCTION");
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
    if (table.table_status !== 'available') {
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
    
    // Verify or set client_type in the reservation
    if (!reservation.client_type) {
      // Determine client_type based on the client_id
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
    }
    
    // Check if the table has enough seats
    if (table.seats < reservation.guests) {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} doesn't have enough seats for this reservation (${reservation.guests} guests)`
      });
    }
    
    // Check for conflicting reservations
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
    
    // Update reservation with table information
    reservation.tableNumber = table.table_number;
    reservation.table_Id = table._id;
    await reservation.save();
    
    // Update table status based on reservation time and status
    const now = new Date();
    if (
      new Date(reservation.start_time) <= now && 
      new Date(reservation.end_time) >= now &&
      reservation.status === 'Seated'
    ) {
      table.current_reservation = reservation_id;
      table.table_status = 'occupied';
    } else if (reservation.status === 'Planning') {
      table.table_status = 'reserved';
    }
    
    await table.save();
    
    // Get the client data for socket event
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
    
    // Emit socket events for real-time updates
    const io = req.app.get('socketio');
    emitReservationAssigned(io, table.restaurant_id, table, reservation);
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

/**
 * Delete table with safety checks and real-time updates
 * Won't delete tables with active or upcoming reservations
 */
const deleteTable = async (req, res) => {
  console.log("START deleteTable FUNCTION");
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
    const tableNumber = table.table_number;
    
    // Safety checks - don't delete tables with active or future reservations
    if (table.current_reservation) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table with an active reservation'
      });
    }
    
    // Check for future reservations in UserOrder
    const now = new Date();
    const futureReservations = await UserOrder.find({
      table_Id: table_id,
      end_time: { $gt: now },
      status: { $nin: ['Cancelled'] }
    });
    
    if (futureReservations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table with future reservations'
      });
    }
    
    await Table.findByIdAndDelete(table_id);
    
    // Emit socket events for real-time updates
    const io = req.app.get('socketio');
    emitTableDeleted(io, restaurantId, table_id, tableNumber);
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

/**
 * Set table status with real-time updates
 * Updates availability for reservations
 */
const setTableStatus = async (req, res) => {
  console.log("START setTableStatus FUNCTION");
  try {
    const table_id = req.params.table_id;
    const { status } = req.body;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    const validStatuses = ['available', 'reserved', 'occupied', 'maintenance', 'inactive'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Valid status is required. Must be one of: ${validStatuses.join(', ')}`
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
    table.table_status = status;
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

/**
 * Calculate duration in minutes between two times
 */
const getDurationInMinutes = (start, end) => {
  console.log("START getDurationInMinutes FUNCTION");
  if (!start || !end) return 0;
  return Math.floor((new Date(end) - new Date(start)) / (1000 * 60));
};

/**
 * Check table availability for a specific time slot
 * Used to verify a table is free when making a reservation
 */
const checkTableAvailability = async (tableId, startTime, endTime, excludeReservationId = null) => {
  console.log("START checkTableAvailability FUNCTION");
  try {
    const table = await Table.findById(tableId);
    if (!table) return false;
    
    // Get all reservations for this table for the time period
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    const reservations = await UserOrder.find({
      table_Id: tableId,
      status: { $nin: ['Cancelled', 'Done'] },
      $or: [
        // Reservation starts during the requested period
        { start_time: { $gte: startDate, $lt: endDate } },
        // Reservation ends during the requested period
        { end_time: { $gt: startDate, $lte: endDate } },
        // Reservation spans the entire requested period
        { start_time: { $lte: startDate }, end_time: { $gte: endDate } }
      ]
    });
    
    // Exclude the current reservation if provided
    const conflictingReservations = reservations.filter(reservation => 
      !excludeReservationId || reservation._id.toString() !== excludeReservationId.toString()
    );
    
    return conflictingReservations.length === 0;
  } catch (error) {
    console.error('Error checking table availability:', error);
    return false;
  }
};

/**
 * Get complete floor layout with schedule information
 * Used for the table management view with real-time support
 */
const getFloorLayout = async (req, res) => {
  console.log("START getFloorLayout FUNCTION");
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
    
    console.log(`Getting floor layout for date: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
    
    // Get all tables for the restaurant
    const tables = await Table.find({ restaurant_id });
    
    // Get all reservations for the specified date
    const todaysReservations = await UserOrder.find({
      restaurant: restaurant_id,
      start_time: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['Cancelled'] }
    });
    
    console.log(`Found ${tables.length} tables and ${todaysReservations.length} reservations`);
    
    // Get client information for all reservations
    const clientIds = todaysReservations
      .map(res => res.client_id)
      .filter(id => id)
      .map(id => typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id);
    
    // Get client information - try both collections
    const clientUsers = await ClientUser.find({
      _id: { $in: clientIds }
    });
    
    const clientGuests = await ClientGuest.find({
      _id: { $in: clientIds }
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
    
    // Create reservation info map
    const reservationsMap = {};
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
        status: reservation.status, // Keep for compatibility
        client_status: reservation.status, // Status is the client status in UserOrder
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
        status: table.table_status || 'available', // For backward compatibility
        table_status: table.table_status || 'available',
        section: table.section,
        current_client: null,
        schedule: []
      };
    });
    
    // Add reservations to the tables
    todaysReservations.forEach(reservation => {
      if (reservation.tableNumber && tableMap[reservation.tableNumber]) {
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
          status: reservation.status, // Keep for backward compatibility
          client_status: reservation.status,
          client_type: reservation.client_type,
          is_current: reservation.status === 'Seated' && 
            new Date() >= new Date(reservation.start_time) && 
            new Date() <= new Date(reservation.end_time)
        });
        
        // Set current_client if this reservation is active now
        const now = new Date();
        if (
          now >= new Date(reservation.start_time) && 
          now <= new Date(reservation.end_time) &&
          reservation.status === 'Seated'
        ) {
          tableMap[reservation.tableNumber].current_client = {
            name: client ? 
              `${client.first_name} ${client.last_name}` : 'Guest',
            first_name: client ? client.first_name : 'Guest',
            last_name: client ? client.last_name : '',
            guests: reservation.guests,
            end_time: reservation.end_time,
            client_type: reservation.client_type,
            client_status: reservation.status
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

/**
 * Get detailed reservations for a specific table
 * Used when selecting a table to view its reservations
 */
const getTableReservations = async (req, res) => {
  console.log("START getTableReservations FUNCTION");
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
    
    // Find all reservations for this table
    let query = { table_Id: table_id };
    
    // Filter by date if provided
    if (date) {
      const filterDate = new Date(date);
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      query.start_time = { $gte: startOfDay, $lte: endOfDay };
    }
    
    const reservations = await UserOrder.find(query).populate('client_id');
    
    // Sort by start time
    reservations.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    res.status(200).json({
      success: true,
      table_number: table.table_number,
      seats: table.seats,
      reservations: reservations.map(reservation => {
        return {
          id: reservation._id,
          client_name: reservation.client_id ? 
            `${reservation.client_id.first_name} ${reservation.client_id.last_name}` : 'Guest',
          first_name: reservation.client_id ? reservation.client_id.first_name : 'Guest',
          last_name: reservation.client_id ? reservation.client_id.last_name : '',
          guests: reservation.guests,
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

/**
 * Create a new reservation for a table
 * Allows selecting a specific table when making a reservation
 */
const createTableReservation = async (req, res) => {
  console.log("START createTableReservation FUNCTION");
  try {
    const { 
      table_id, 
      client_email, 
      client_name,
      guests,
      start_time,
      end_time,
      restaurant_id
    } = req.body;
    
    if (!table_id || !client_email || !guests || !start_time || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: table_id, client_email, guests, start_time, and restaurant_id are required'
      });
    }
    
    // Validate table exists and is available
    const table = await Table.findById(table_id);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    if (table.table_status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} is not available`
      });
    }
    
    // Check if table has enough seats
    if (table.seats < guests) {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} only has ${table.seats} seats, but ${guests} guests requested`
      });
    }
    
    // Check time slot availability
    const calculatedEndTime = end_time || new Date(new Date(start_time).getTime() + 90 * 60000); // 90 minutes if end_time not provided
    
    const isTimeSlotAvailable = await checkTableAvailability(table_id, start_time, calculatedEndTime);
    if (!isTimeSlotAvailable) {
      return res.status(400).json({
        success: false,
        message: `Table ${table.table_number} is not available during the requested time slot`
      });
    }
    
    // Find or create client
    let client;
    let clientType;
    
    // Try to find registered user first
    client = await ClientUser.findOne({ email: client_email });
    if (client) {
      clientType = 'ClientUser';
    } else {
      // Check for guest user
      client = await ClientGuest.findOne({ email: client_email });
      if (client) {
        clientType = 'ClientGuest';
      } else {
        // Create new guest user if doesn't exist
        if (!client_name) {
          return res.status(400).json({
            success: false,
            message: 'Client name is required for new guests'
          });
        }
        
        // Parse name into first and last
        const nameParts = client_name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        const newGuest = new ClientGuest({
          first_name: firstName,
          last_name: lastName,
          email: client_email
        });
        
        client = await newGuest.save();
        clientType = 'ClientGuest';
      }
    }
    
    // Create the reservation
    const newReservation = new UserOrder({
      restaurant: restaurant_id,
      client_id: client._id,
      client_type: clientType,
      guests: guests,
      status: 'Planning',
      start_time: start_time,
      end_time: calculatedEndTime,
      tableNumber: table.table_number,
      table_Id: table._id
    });
    
    const savedReservation = await newReservation.save();
    
    // Update table status
    table.table_status = 'reserved';
    await table.save();
    
    // Emit socket events
    const io = req.app.get('socketio');
    if (io) {
      emitReservationAssigned(io, restaurant_id, table, {
        ...savedReservation.toObject(),
        client_id: {
          first_name: client.first_name,
          last_name: client.last_name,
          email: client.email
        }
      });
      
      // Emit general event for all clients
      io.emit('reservationCreated', {
        reservationId: savedReservation._id,
        restaurantId: restaurant_id,
        tableNumber: table.table_number,
        customerName: `${client.first_name} ${client.last_name}`,
        customerEmail: client.email,
        timestamp: new Date(),
        newReservation: {
          id: savedReservation._id,
          customer: {
            firstName: client.first_name,
            lastName: client.last_name,
            email: client.email
          },
          orderDetails: {
            guests: guests,
            status: 'Planning',
            startTime: start_time,
            endTime: calculatedEndTime,
            tableNumber: table.table_number
          }
        }
      });
    }
    
    res.status(201).json({
      success: true,
      message: `Reservation created successfully for table ${table.table_number}`,
      reservation: savedReservation
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create reservation',
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
  checkTableAvailability,
  createTableReservation // For creating reservations directly for a table
};