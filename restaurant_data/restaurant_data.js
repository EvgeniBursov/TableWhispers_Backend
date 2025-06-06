const mongoose = require('mongoose');
const restaurants = require('../models/Restarunt')
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const ClientGuest = require('../models/ClientGuest');
const Allergies = require('../models/Allergies');
const Table = require('../models/Tables')
const Review = require('../models/Reviews');
const RestaurantsBills = require('../models/Restaurants_Bills')

const {sendMail} = require('../MessageSystem/email_message');

const ISRAEL_TIMEZONE = 'Asia/Jerusalem';
const createIsraelDate = (dateString, timeString) => {
  const [year, month, day] = dateString.split('-');
  const [hours, minutes] = timeString.split(':');
  return new Date(Date.UTC(
    parseInt(year), 
    parseInt(month) - 1, 
    parseInt(day), 
    parseInt(hours) - 2, 
    parseInt(minutes)
  ));
};

const all_Restaurants_Data = async (req, res) => {
  const restaurantId = req.params.id; 
  if (restaurantId) {
    ////console.log("Start Restaurant Data for ID: ", restaurantId);
    try {
      const restaurantData = await restaurants.findById(restaurantId)
      .populate({
        path: 'menu', 
        populate: {
          path: 'menus.items', 
          model: 'MenuCollection'
        }
      })
      .populate({
        path: 'reviews',
        populate: {
          path: 'user',
          select: 'first_name last_name'
        }
      });

      if (!restaurantData) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      res.status(200).json(restaurantData); 
    } catch (error) {
      console.error("Error fetching restaurant by ID:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    try {
      ////console.log("Fetching all Restaurants Data");
      const allRestaurantsData = await restaurants.find();
      res.status(200).json(allRestaurantsData);
    } catch (error) {
      console.error("Error fetching all restaurants:", error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

const Restaurants_Reservation = async (req, res) => {
  ////console.log("Start Restaurants_Reservation");
  const restaurantId = req.params.id;
  if (!restaurantId) {
    return res.status(400).json({ error: 'Restaurant ID is undefined' });
  }

  try {
    // Find all reservations for this restaurant
    const restaurant = await restaurants.findById(restaurantId)
      .populate({
        path: 'reservation_id',
        // Don't populate client_id yet
      })
      .select('res_name phone_number city full_address description rating reservation_id tables')
      .lean();

    if (!restaurant) {
      return res.status(404).json({ 
        success: false,
        message: 'Restaurant not found'
      });
    }

    const reservations = restaurant.reservation_id || [];
    
    // Process each reservation to get client information
    const processedReservations = [];
    
    for (const reservation of reservations) {
      let customerInfo = null;
      
      // First, try to find a registered user
      if (reservation.client_id) {
        const registeredUser = await ClientUser.findById(reservation.client_id)
          .populate('allergies', 'name severity')
          .lean();
        
        if (registeredUser) {
          customerInfo = {
            id: registeredUser._id,
            firstName: registeredUser.first_name,
            lastName: registeredUser.last_name,
            email: registeredUser.email,
            phone: registeredUser.phone_number,
            allergies: registeredUser.allergies?.map(allergy => ({
              name: allergy.name,
              severity: allergy.severity
            })) || [],
            userType: 'registered',
            profileImage: registeredUser.profileImage,
            age: registeredUser.age
          };
        }
      }
      
      // If no registered user found, try to find a guest user
      // Assuming there's some way to connect reservations to guest users
      // You'll need to adjust this based on your actual schema!
      if (!customerInfo) {
        // This is a placeholder - you need to determine how guest users are
        // connected to reservations in your database
        const guestUser = await ClientGuest.findOne({
          // This condition needs to be replaced with your actual logic
          // Examples:
          // reservation_id: reservation._id
          // or maybe you have a field like:
          // email: reservation.contact_email
        }).lean();
        
        if (guestUser) {
          customerInfo = {
            id: guestUser._id,
            firstName: guestUser.first_name,
            lastName: guestUser.last_name,
            email: guestUser.email,
            phone: guestUser.phone_number,
            allergies: [],
            userType: 'guest'
          };
        }
      }
      processedReservations.push({
        id: reservation._id,
        orderDetails: {
          guests: reservation.guests,
          status: reservation.status,
          orderDate: reservation.orderDate,
          startTime: reservation.start_time.toISOString(),
          endTime: reservation.end_time.toISOString(),
          table: reservation.tableNumber
        },
        customer: customerInfo
      });
    }

    const formattedResponse = {
      success: true,
      restaurant: {
        id: restaurant._id,
        name: restaurant.res_name,
        phone: restaurant.phone_number,
        city: restaurant.city,
        full_address: restaurant.full_address,
        description: restaurant.description,
        rating: restaurant.rating,
        tables: restaurant.tables
      },
      reservations: processedReservations
    };
    
    ////console.log("END of Restaurants_Reservation");
    res.status(200).json(formattedResponse);

  } catch (error) {
    console.error("Error fetching restaurant reservations:", error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch restaurant reservations',
      message: error.message 
    });
  }
};

const add_New_Reviews = async (req, res) => {
  try {
    const req_restaurant_Id = req.body.restaurant_Id;
    const user_email = req.body.user_email;
    const review_string = req.body.review;
    const req_rating = req.body.rating;
  
    if (!req_restaurant_Id || !user_email || !review_string || !req_rating) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const client_id = await ClientUser.findOne({ email: user_email });

    const new_Review = new Review({
      user: client_id,
      rating: req_rating,
      comment: review_string,
      created_at: new Date()
    });
  
    const saved_Review = await new_Review.save();
  
    const restaurant = await restaurants.findById(req_restaurant_Id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found"
      });
    }
    restaurant.reviews.push(saved_Review._id);
    await restaurant.save();
    const populatedRestaurant = await restaurants.findById(req_restaurant_Id)
      .populate('reviews');
  
    if (populatedRestaurant.reviews && populatedRestaurant.reviews.length > 0) {
      let totalRating = 0;
      let validReviewCount = 0;
      
      populatedRestaurant.reviews.forEach(review => {
        if (review.rating) {
          totalRating += review.rating;
          validReviewCount++;
        }
      });
      
      if (validReviewCount > 0) {
        restaurant.rating = parseFloat((totalRating / validReviewCount).toFixed(1));
        restaurant.number_of_rating = validReviewCount;
        await restaurant.save();
      }
    }

    res.status(201).json({
      success: true,
      message: "Review added successfully",
    });
    
  } catch (error) {
    console.error("Error in add_New_Reviews:", error);
    res.status(500).json({
      success: false,
      message: "Error adding review",
      error: error.message
    });
  }
};



/**
 * Checks availability of tables for a specific date and time
 * @param {string} restaurantId - Restaurant ID
 * @param {string} dateCheck - Date to check availability for
 * @param {string} time - Time to check availability for
 * @param {number} guests - Number of guests
 * @returns {Object} - Availability information
 */
const check_Availability = async (restaurantId, dateCheck, time, guests) => {
  ////console.log("=== Start check_Availability ===");
  //////console.log("Parameters:", { restaurantId, dateCheck, time, guests });
  
  try {
    // Find restaurant data
    const restaurantData = await restaurants.findById(restaurantId);
  //  ////console.log("Restaurant found:", !!restaurantData);

    if (!restaurantData) {
      ////console.log("Restaurant not found");
      return {
        success: false,
        message: 'Restaurant not found'
      };
    }

    // Check if restaurant has tables configured
    if (!restaurantData.tables || restaurantData.tables.length === 0) {
      ////console.log("No tables configured for restaurant");
      return {
        success: false,
        message: 'No tables configured for this restaurant',
        availableTables: 0
      };
    }
    
    // Extract day of week from the date
    const dayOfWeek = new Date(dateCheck).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    ////console.log("Day of week:", dayOfWeek);
    
    // Check if restaurant is open on this day
    if (!restaurantData.open_time || !restaurantData.open_time[dayOfWeek] || 
        restaurantData.open_time[dayOfWeek].open === 'Closed') {
      ////console.log("Restaurant is closed on this day");
      return {
        success: false,
        message: 'Restaurant is closed on this day',
        availableTables: 0
      };
    }

    // Parse reservation time and calculate start/end times
    const reservationTime = parseTimeString(time);
    const reservationDate = new Date(dateCheck);
    reservationDate.setHours(reservationTime.hours, reservationTime.minutes, 0, 0);
    
    const endTime = new Date(reservationDate);
    endTime.setMinutes(endTime.getMinutes() + 90); 
    
    ////console.log("Reservation start time:", reservationDate);
    ////console.log("Reservation end time:", endTime);
    
    // Set up the day boundaries for query
    const startOfDay = new Date(dateCheck);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateCheck);
    endOfDay.setHours(23, 59, 59, 999);
    
    ////console.log("Checking reservations between:", startOfDay, "and", endOfDay);

    // Get all existing reservations for this day that are not cancelled
    const existingReservations = await UserOrder.find({
      restaurant: restaurantId,
      start_time: { $gte: startOfDay, $lt: endOfDay },
      status: { $ne: 'Cancelled' }
    });
    
    ////console.log("Found existing reservations:", existingReservations.length);

    // Filter tables that can accommodate the guest count
    const suitableTables = restaurantData.tables.filter(table => {
      // If table data includes capacity field, filter by it
      if (table.seats) {
        return table.seats >= guests;
      }
      // Otherwise, assume all tables can accommodate any party size
      return true;
    });
    
    ////console.log("Suitable tables for party size:", suitableTables.length);

    // Count how many suitable tables are available at the requested time
    let availableTablesCount = suitableTables.length;

    // Check for overlapping reservations
    existingReservations.forEach(reservation => {
      const reservationStart = new Date(reservation.start_time);
      const reservationEnd = new Date(reservation.end_time);
      
      // Check if this reservation overlaps with the requested time
      if (
        (reservationDate >= reservationStart && reservationDate < reservationEnd) || 
        (endTime > reservationStart && endTime <= reservationEnd) ||
        (reservationDate <= reservationStart && endTime >= reservationEnd)
      ) {
        // This reservation overlaps, so one table is not available
        availableTablesCount--;
        ////console.log("Found overlapping reservation, reducing available tables");
      }
    });
    
    ////console.log("Final available tables count:", availableTablesCount);

    const result = {
      success: true,
      availableTables: availableTablesCount,
      totalTables: suitableTables.length,
      date: dateCheck,
      time: time,
      isAvailable: availableTablesCount > 0
    };
    
    ////console.log("Availability check result:", result);
    ////console.log("=== End check_Availability ===");
    
    return result;
  } catch (error) {
    console.error("Error checking availability:", error);
    return {
      success: false,
      message: `Error checking availability: ${error.message}`
    };
  }
};

/**
 * Gets all available times for a specific date
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const get_Available_Times = async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const { date, partySize = 2 } = req.query;
    
    if (!date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Date parameter is required' 
      });
    }
    
    // Find the restaurant
    const restaurant = await restaurants.findById(restaurantId);
    
    if (!restaurant) {
      return res.status(404).json({ 
        success: false, 
        message: 'Restaurant not found' 
      });
    }

    // Check if restaurant is open on the selected day
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (!restaurant.open_time || 
        !restaurant.open_time[dayOfWeek] || 
        !restaurant.open_time[dayOfWeek].open || 
        !restaurant.open_time[dayOfWeek].close || 
        restaurant.open_time[dayOfWeek].open === 'Closed') {
      return res.status(200).json({ 
        success: true, 
        availableTimes: [],
        message: 'Restaurant is closed on this day or has invalid opening hours'
      });
    }
    
    const openTime = String(restaurant.open_time[dayOfWeek].open);
    const closeTime = String(restaurant.open_time[dayOfWeek].close);
  
    if (!openTime || !closeTime || openTime === 'undefined' || closeTime === 'undefined') {
      return res.status(200).json({
        success: true,
        availableTimes: [],
        message: 'Restaurant has invalid opening hours'
      });
    }
    
    // Generate time slots every 30 minutes between opening and closing time
    const timeSlots = generateTimeSlots(openTime, closeTime);
    
    // Check availability for each time slot
    const availabilityPromises = timeSlots.map(async (timeSlot) => {
      const availability = await check_Availability(
        restaurantId,
        date,
        timeSlot,
        parseInt(partySize)
      );
      
      return {
        time: timeSlot,
        availableTables: availability.availableTables
      };
    });
    
    // Wait for all availability checks to complete
    const availabilityResults = await Promise.all(availabilityPromises);
    
    // Filter only times with available tables
    const availableTimes = availabilityResults.filter(slot => slot.availableTables > 0);
    
    const response = {
      success: true,
      availableTimes: availableTimes,
      totalTimeSlots: timeSlots.length
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error("Error getting available times:", error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
};

/**
 * Gets all available tables for a specific date and time
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const get_Available_Tables = async (req, res) => {
  ////console.log("=== Start get_Available_Tables ===");
  
  try {
    const restaurantId = req.params.id;
    const { date, time, guests = 2 } = req.query;
    
    ////console.log("Parameters:", { restaurantId, date, time, guests });
    
    if (!date || !time) {
      ////console.log("Missing date or time parameter");
      return res.status(400).json({ 
        success: false, 
        message: 'Date and time parameters are required' 
      });
    }
    
    // Find the restaurant
    const restaurant = await restaurants.findById(restaurantId).populate('tables');
    ////console.log("Restaurant found:", !!restaurant);
    
    if (!restaurant) {
      ////console.log("Restaurant not found");
      return res.status(404).json({ 
        success: false, 
        message: 'Restaurant not found' 
      });
    }

    // Check if restaurant is open on the selected day
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    ////console.log("Day of week:", dayOfWeek);
    
    if (!restaurant.open_time || !restaurant.open_time[dayOfWeek] || 
        restaurant.open_time[dayOfWeek].open === 'Closed') {
      ////console.log("Restaurant is closed on this day");
      return res.status(200).json({ 
        success: false, 
        message: 'Restaurant is closed on this day',
        tables: []
      });
    }
    
    // Parse the time and create start/end times
    const timeObj = parseTimeString(time);
    const startTime = new Date(date);
    startTime.setHours(timeObj.hours, timeObj.minutes, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 90); // 90 minute reservation
    
    const existingReservations = await UserOrder.find({
      restaurant: restaurantId,
      status: { $ne: 'Cancelled' },
      $or: [
        { start_time: { $lt: endTime }, end_time: { $gt: startTime } }
      ]
    });
    
    // Create BOTH sets for table_Id and tableNumber
    const reservedTableIds = new Set();
    const reservedTableNumbers = new Set();
    
    existingReservations.forEach(reservation => {
      if (reservation.table_Id) { // Changed from tableId to table_Id
        reservedTableIds.add(reservation.table_Id.toString());
      }
      
      if (reservation.tableNumber) {
        reservedTableNumbers.add(reservation.tableNumber.toString());
      }
    });
    
    // Make sure restaurant.tables is an array
    const tables = Array.isArray(restaurant.tables) ? restaurant.tables : [];
    
    // Filter out tables that are:
    // 1. Already reserved
    // 2. Not big enough for the party size
    // 3. In maintenance or inactive
    const availableTables = tables.filter(table => {
      // Skip if already reserved by ID
      if (table._id && reservedTableIds.has(table._id.toString())) {
        return false;
      }
      
      // Skip if already reserved by number
      if (table.table_number && reservedTableNumbers.has(table.table_number.toString())) {
        return false;
      }
      
      // Skip if too small
      if (table.seats < parseInt(guests)) {
        return false;
      }
      
      // Skip if in maintenance or inactive
      if (table.status === 'maintenance' || table.status === 'inactive') {
        return false;
      }
      
      return true;
    });
    
    // Sort tables from smallest appropriate size to largest
    const sortedTables = availableTables.sort((a, b) => {
      return a.seats - b.seats;
    });
    
    // Format the response data
    const tablesData = sortedTables.map(table => ({
      id: table._id,
      table_number: table.table_number,
      seats: table.seats,
      shape: table.shape,
      section: table.section
    }));
    
    ////console.log(`Returning ${tablesData.length} available tables`);
    
    res.status(200).json({
      success: true,
      tables: tablesData
    });
    
    ////console.log("=== End get_Available_Tables ===");
  } catch (error) {
    console.error("Error getting available tables:", error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
};

/**
 * Find the best available table for a reservation
 * @param {string} restaurantId - The ID of the restaurant
 * @param {Date} reservationDate - Start time of the reservation
 * @param {Date} endTime - End time of the reservation
 * @param {number} guests - Number of guests
 * @returns {Promise<Object|null>} - The best available table or null if none found
 */
const findBestTable = async (restaurantId, reservationDate, endTime, guests) => {
  try {

    const startDateTime = reservationDate;
    const endDateTime = endTime;

    console.log(`Looking for table for ${guests} guests`);
    console.log(`Start time: ${startDateTime.toISOString()} (UTC)`);
    console.log(`End time: ${endDateTime.toISOString()} (UTC)`);

    const formatTimeDebug = (date) => {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`;
    };
    
   // console.log(`Readable start: ${formatTimeDebug(startDateTime)}`);
   // console.log(`Readable end: ${formatTimeDebug(endDateTime)}`);
    
    const minSeats = guests;
    const maxSeats = guests + 2;
    
   // console.log(`Searching for tables with ${minSeats}-${maxSeats} seats`);
    const restaurant = await restaurants.findById(restaurantId).populate('tables');
    if (!restaurant || !restaurant.tables || restaurant.tables.length === 0) {
     // console.log("No tables found for restaurant:", restaurantId);
      return null;
    }
    
    const eligibleTables = restaurant.tables.filter(table => 
      table.seats >= minSeats && 
      table.seats <= maxSeats  
    );
    
    if (eligibleTables.length === 0) {
     // console.log(`No tables with ${minSeats}-${maxSeats} seats or in available status`);
      const largerTables = restaurant.tables.filter(table => 
        table.seats > maxSeats
      );
      //console.log("Eligible tables:", eligibleTables);
      
      if (largerTables.length === 0) {
       // console.log("No larger tables available either");
        return null;
      }
    //  console.log(`Found ${largerTables.length} larger tables, will check availability`);
      eligibleTables.push(...largerTables);
    }
    
    const availableTables = [];
    
    for (const table of eligibleTables) {
      //console.log(`Checking availability for table ${table.table_number} (ID: ${table._id})`);
      
      const overlappingReservations = await UserOrder.find({
        restaurant: restaurantId,
        status: { $nin: ['Cancelled'] },
        $and: [
          { start_time: { $lt: endDateTime } },
          { end_time: { $gt: startDateTime } }
        ],
        $or: [
          { table_Id: table._id },
          { tableNumber: table.table_number }
        ]
      });
      
      if (overlappingReservations.length > 0) {
        //console.log(`Table ${table.table_number} has ${overlappingReservations.length} overlapping reservations:`);
        overlappingReservations.forEach((res, index) => {
          //console.log(`  ${index + 1}. ${formatTimeDebug(res.start_time)} to ${formatTimeDebug(res.end_time)}`);
        });
      } else {
        //console.log(`Table ${table.table_number} is available!`);
        availableTables.push(table);
      }
    }
    
    //console.log(`Found ${availableTables.length} available tables`);
    
    if (availableTables.length === 0) {
      return null;
    }
    availableTables.sort((a, b) => {
      const aInRange = a.seats <= maxSeats;
      const bInRange = b.seats <= maxSeats;
      
      if (aInRange && !bInRange) return -1;
      if (!aInRange && bInRange) return 1;
      return a.seats - b.seats;
    });
    
    console.log(`Selected table: ${availableTables[0]._id}, number: ${availableTables[0].table_number}, seats: ${availableTables[0].seats}`);
    return availableTables[0];
  } catch (error) {
    console.error('Error finding best table:', error);
    return null;
  }
};



/**
 * Creates a new reservation
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const create_Reservation = async (req, res) => {
  console.log("=== Start create_Reservation ===", req.body);
  const restaurantId = req.body.restaurant_Id;
  
  const requestedTableId = req.body.tableId;
  const requestedTableNumber = req.body.tableNumber;
  
  let userEmail = req.body.user_email;
  let phone = null;
  let fullName = null;
  if (req.body.guestInfo) {
    userEmail = req.body.guestInfo.user_email;
    phone = req.body.guestInfo.phone_number;
    fullName = req.body.guestInfo.full_name;
  }
  
  if (!userEmail) {
    return res.status(400).json({ success: false, message: 'Email is required for reservation' });
  }
  
  const time = req.body.time;
  const day = req.body.day;
  const guests = req.body.guests;
  const date = req.body.date;

  try {
    const restaurant = await restaurants.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }
    const reservationResult = date ? 
      calculateReservationDateWithDate(date, time) : 
      calculateReservationDate(day, time);

    const reservationDate = reservationResult.date || reservationResult; 
    const formattedReservationTime = reservationResult.formatted || null;
    
    console.log("Reservation Date:", reservationDate);
    console.log("Formatted Time:", formattedReservationTime);

    const endTime = new Date(reservationDate.getTime());
    endTime.setMinutes(endTime.getMinutes() + 90);

    const isOpen = isRestaurantOpen(restaurant, day, time);
    if (!isOpen) {
      return res.status(400).json({ success: false, message: 'Restaurant is closed at the requested time' });
    }
    
    let selectedTable = null;
    
    if (requestedTableId && requestedTableId !== "null" && requestedTableId !== null) {
      selectedTable = await Table.findById(requestedTableId);
      
      if (!selectedTable) {
        return res.status(404).json({ 
          success: false, 
          message: 'Requested table not found' 
        });
      }
      
      if (selectedTable.seats < guests) {
        return res.status(400).json({ 
          success: false, 
          message: 'Selected table is too small for your party size' 
        });
      }
      
      const isAvailable = await checkTableAvailability(
        selectedTable._id,
        reservationDate,
        endTime
      );
      
      if (!isAvailable) {
        return res.status(400).json({ 
          success: false, 
          message: 'Selected table is not available for the requested time' 
        });
      }
    } 
    else if (requestedTableNumber && requestedTableNumber !== "null" && requestedTableNumber !== null) {
      selectedTable = await Table.findOne({ 
        restaurant_id: restaurantId,
        table_number: requestedTableNumber
      });
      
      if (!selectedTable) {
        return res.status(404).json({ 
          success: false, 
          message: 'Requested table not found' 
        });
      }
      
      if (selectedTable.seats < guests) {
        return res.status(400).json({ 
          success: false, 
          message: 'Selected table is too small for your party size' 
        });
      }
      
      const isAvailable = await checkTableAvailability(
        selectedTable._id,
        reservationDate,
        endTime
      );
      
      if (!isAvailable) {
        return res.status(400).json({ 
          success: false, 
          message: 'Selected table is not available for the requested time' 
        });
      }
    }
    else {
      selectedTable = await findBestTable(
        restaurantId,
        reservationDate,
        endTime,
        guests
      );
      
      if (!selectedTable) {
        return res.status(400).json({ 
          success: false, 
          message: 'No tables available for the requested time and party size' 
        });
      }
    }

    let userId;
    let clientName;
    let clientType = "";
    let clientData = null;
    
    let user = await ClientUser.findOne({ 'email': userEmail })
      .populate('allergies', 'name severity');
    
    if (user) {
      userId = user._id;
      clientName = user.first_name;
      clientType = "ClientUser";
      clientData = user;
    } else {
      const existingGuest = await ClientGuest.findOne({ 'email': userEmail });
      if (existingGuest) {
        userId = existingGuest._id;
        clientName = existingGuest.first_name;
        clientType = "ClientGuest";
        clientData = existingGuest;
        
        if (phone || fullName) {
          const updateData = {};
          if (phone) updateData.phone_number = phone;
          if (fullName) {
            const nameParts = fullName.split(' ');
            updateData.first_name = nameParts[0];
            updateData.last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
          }
          const updatedGuest = await ClientGuest.findByIdAndUpdate(existingGuest._id, updateData, { new: true });
          clientData = updatedGuest;
        }
      } else {
        if (!fullName) {
          return res.status(400).json({ success: false, message: 'Full name is required for new guest' });
        }
        
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        const newGuestUser = new ClientGuest({
          first_name: firstName,
          last_name: lastName,
          email: userEmail,
          phone_number: phone || '',
        });
        
        const savedGuest = await newGuestUser.save();
        userId = savedGuest._id;
        clientName = savedGuest.first_name;
        clientType = "ClientGuest";
        clientData = savedGuest;
      }
    }
    
    const verifyTableAvailable = await checkTableAvailability(
      selectedTable._id,
      reservationDate,
      endTime
    );
    
    if (!verifyTableAvailable) {
      return res.status(400).json({ 
        success: false, 
        message: 'Table has just been reserved by another user. Please try another table or time.'
      });
    }

    const newOrder = new UserOrder({
      restaurant: restaurantId,
      client_id: userId,
      client_type: clientType,
      guests: guests,
      status: 'Planning',
      start_time: reservationDate,
      end_time: endTime,
      table_Id: selectedTable._id,
      tableNumber: selectedTable.table_number
    });

    const savedOrder = await newOrder.save();
    
    await restaurants.findByIdAndUpdate(
      restaurantId,
      { $push: { reservation_id: savedOrder._id } }
    );
    
    if (clientType === "ClientUser") {
      await ClientUser.findByIdAndUpdate(
        userId,
        { $push: { orders: savedOrder._id } }
      );
    }
    
    await Table.findByIdAndUpdate(
      selectedTable._id,
      { 
        table_status: 'reserved'
      }
    );
    
    // פורמט זמן אחיד - שימוש ב-UTC כדי להימנע מ-timezone issues
    const formatDateForDisplay = (date) => {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      
      return `${weekdays[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
    };
    
    const formatTimeForDisplay = (date) => {
      const hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    const formattedDateStr = formatDateForDisplay(reservationDate);
    const formattedStartTime = formatTimeForDisplay(reservationDate);
    const formattedEndTime = formatTimeForDisplay(endTime);
    
    let processedAllergies = [];
    if (clientData.allergies && Array.isArray(clientData.allergies)) {
      processedAllergies = clientData.allergies.map(allergy => {
        if (typeof allergy === 'object' && allergy.name) {
          return {
            name: allergy.name,
            severity: allergy.severity || null
          };
        }
        return {
          name: allergy.toString(),
          severity: null
        };
      });
    }
    
    const io = req.app.get('socketio');
    if (io) {
      io.emit('reservationCreated', {
        newReservation: {
          id: savedOrder._id,
          customer: {
            id: clientData._id,
            firstName: clientData.first_name || '',
            lastName: clientData.last_name || '',
            email: clientData.email,
            phone: clientData.phone_number || '',
            age: clientData.age || null,
            profileImage: clientData.profileImage || null,
            allergies: processedAllergies,
            userType: clientType === "ClientUser" ? "registered" : "guest"
          },
          orderDetails: {
            guests: guests,
            status: 'Planning',
            startTime: reservationDate,
            endTime: endTime,
            table: selectedTable.table_number,
            tableNumber: selectedTable.table_number,
            orderDate: new Date()
          },
          restaurantId: restaurantId,
          restaurant_id: restaurantId
        }
      });
    }

    console.log("Start Time:", reservationDate);
    console.log("Start Time ISO:", reservationDate.toISOString());
    
    const emailMessage = `Hello ${clientName},
    
You have a reservation at "${restaurant.res_name}"
for ${guests} guests on ${formattedDateStr}.
Your table is Table ${selectedTable.table_number}.
Time: ${formattedStartTime} to ${formattedEndTime}.

Best regards,
Table Whispers`;

    ////////sendMail(userEmail, emailMessage, 'order_info');
    return res.status(200).json({
      success: true,
      message: "Reservation created successfully",
      reservation: {
        ...savedOrder._doc,
        table: {
          id: selectedTable._id,
          table_number: selectedTable.table_number,
          shape: selectedTable.shape,
          seats: selectedTable.seats
        }
      }
    });
  } catch (error) {
    console.error("Reservation error:", error);
    return res.status(500).json({
      success: false,
      message: `Reservation error: ${error.message}`
    });
  }
};

/**
 * Check if a specific table is available for the given time range
 * @param {string} tableId - The ID of the table
 * @param {Date} startTime - Reservation start time
 * @param {Date} endTime - Reservation end time
 * @returns {Promise<boolean>} - Whether the table is available
 */
const checkTableAvailability = async (tableId, startTime, endTime) => {
  try {
    // Find reservations that overlap with this time period using consistent formula
    const overlappingReservations = await UserOrder.find({
      table_Id: tableId, 
      status: { $nin: ['Cancelled'] },
      // Simplified overlap check (one condition catches all overlap scenarios)
      $or: [
        { start_time: { $lt: endTime }, end_time: { $gt: startTime } }
      ]
    });
    
    // Additional check in case reservations are stored by table number
    if (overlappingReservations.length === 0) {
      // If we didn't find by ID, find the table to get its number
      const table = await Table.findById(tableId);
      if (table && table.table_number) {
        const overlappingByNumber = await UserOrder.find({
          tableNumber: table.table_number,
          status: { $nin: ['Cancelled'] },
          $or: [
            { start_time: { $lt: endTime }, end_time: { $gt: startTime } }
          ]
        });
        
        if (overlappingByNumber.length > 0) {
          return false; // Table is reserved for this time by number
        }
      }
    }
    
    // Table is available if there are no overlapping reservations
    return overlappingReservations.length === 0;
  } catch (error) {
    console.error('Error checking table availability:', error);
    return false;
  }
};


/**
 * Calculates reservation date based on day of week and time
 * @param {string} day - Day of the week
 * @param {string} time - Time of reservation
 * @returns {Date} - Reservation date
 */
const calculateReservationDate = (day, time) => {
  ////console.log("Calculating reservation date from day and time:", day, time);
  
  const daysMap = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  const targetDayOfWeek = daysMap[day.toLowerCase()];
  const timeObj = parseTimeString(time);
  
  // Calculate days until target day
  let daysToAdd = targetDayOfWeek - currentDayOfWeek;
  if (daysToAdd < 0) {
    daysToAdd += 7; // If target day has passed this week, go to next week
  }
  
  // Create new date
  const reservationDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + daysToAdd,
    timeObj.hours,
    timeObj.minutes,
    0,
    0
  );
  reservationDate.setDate(today.getDate() + daysToAdd);
  
  // Set time
  reservationDate.setHours(timeObj.hours, timeObj.minutes, 0, 0);
  //console.log(reservationDate)
  return reservationDate;
};

/**
 * Checks if restaurant is open at requested time
 * @param {Object} restaurant - Restaurant object
 * @param {string} day - Day of week
 * @param {string} time - Time in HH:MM format
 * @returns {boolean} - Whether restaurant is open
 */
const isRestaurantOpen = (restaurant, day, time) => {
  ////console.log("Checking if restaurant is open:", day, time);
  
  const dayLower = day.toLowerCase();
  
  // Check if operating hours exist for requested day
  if (!restaurant.open_time || !restaurant.open_time[dayLower]) {
    ////console.log("No operating hours found for this day");
    return false;
  }
  
  const openTime = restaurant.open_time[dayLower].open;
  const closeTime = restaurant.open_time[dayLower].close;
  
  if (!openTime || !closeTime) {
    ////console.log("Open or close time not defined");
    return false;
  }
  
  // Convert times to minutes for simple comparison
  const timeToMinutes = (timeStr) => {
    ////console.log("Parsing time string for comparison:", timeStr);
    
    // Check if the time string is in 12-hour format (contains AM/PM)
    const isPM = timeStr.toLowerCase().includes('pm');
    const isAM = timeStr.toLowerCase().includes('am');
    
    let hours, minutes;
    
    if (isPM || isAM) {
      // Handle 12-hour format with AM/PM
      
      // Remove AM/PM and trim any whitespace
      const cleanTimeStr = timeStr.toLowerCase()
        .replace('am', '')
        .replace('pm', '')
        .replace('a.m.', '')
        .replace('p.m.', '')
        .trim();
      
      // Split into hours and minutes
      const timeParts = cleanTimeStr.split(':');
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
      
      // Convert 12-hour to 24-hour
      if (isPM && hours < 12) {
        hours += 12; // Convert PM times to 24-hour (except 12 PM)
      } else if (isAM && hours === 12) {
        hours = 0;  // 12 AM is 0 in 24-hour format
      }
    } else {
      // Handle 24-hour format
      const [hoursStr, minutesStr] = timeStr.split(':');
      hours = parseInt(hoursStr, 10);
      minutes = parseInt(minutesStr, 10);
    }
    
    // Check for valid parsing results
    if (isNaN(hours) || isNaN(minutes)) {
      console.error("Failed to parse time string:", timeStr);
      return 0; // Default to midnight if parsing fails
    }
    
    const totalMinutes = hours * 60 + minutes;
    ////console.log("Time in minutes:", totalMinutes);
    return totalMinutes;
  };
  
  const requestedTimeInMinutes = timeToMinutes(time);
  const openTimeInMinutes = timeToMinutes(openTime);
  const closeTimeInMinutes = timeToMinutes(closeTime);
  
  // Check if requested time is between opening and closing
  const isOpen = requestedTimeInMinutes >= openTimeInMinutes && requestedTimeInMinutes < closeTimeInMinutes;
  ////console.log("Restaurant is open:", isOpen);
  return isOpen;
};

/**
 * Calculates reservation date with specific date string and time
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} time - Time in format like "7:30 PM"
 * @returns {Date} - Date object with correct date and time
 */
const calculateReservationDateWithDate = (dateString, time) => {
  const timeObj = parseTimeString(time);
  const dateParts = dateString.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; 
  const day = parseInt(dateParts[2], 10);

  const date = new Date(Date.UTC(year, month, day, timeObj.hours, timeObj.minutes, 0, 0));

  const formatLocalDateTime = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };
  //console.log(date,formatLocalDateTime(date),date.getTime())
  return {
    date: date,                           
    //formatted: formatLocalDateTime(date), 
    //timestamp: date.getTime()            
  };
};
/**
 * Parses time string into hours and minutes
 * @param {string} timeString - Time string in various formats
 * @returns {Object} - Object with hours and minutes
 */
const parseTimeString = (timeString) => {
  //console.log("Parsing time string:", timeString);
  
  if (!timeString || typeof timeString !== 'string') {
    console.error("Invalid input:", timeString);
    return { hours: 0, minutes: 0 };
  }
  
  // Check if the time string is in 12-hour format (contains AM/PM)
  const isPM = timeString.toLowerCase().includes('pm') || timeString.toLowerCase().includes('p.m.');
  const isAM = timeString.toLowerCase().includes('am') || timeString.toLowerCase().includes('a.m.');
  
  let hours, minutes;
  
  if (isPM || isAM) {
    const cleanTimeStr = timeString.toLowerCase()
      .replace(/\s+/g, '') // Remove all whitespace first
      .replace('a.m.', '')
      .replace('p.m.', '')
      .replace('am', '')
      .replace('pm', '');
    
    // Split into hours and minutes
    const timeParts = cleanTimeStr.split(':');
    
    // Validate we have exactly 2 parts
    if (timeParts.length !== 2) {
      console.error("Invalid time format - expected HH:MM:", timeString);
      return { hours: 0, minutes: 0 };
    }
    
    hours = parseInt(timeParts[0], 10);
    minutes = parseInt(timeParts[1], 10);
    
    // Check for valid parsing results
    if (isNaN(hours) || isNaN(minutes)) {
      console.error("Failed to parse numbers from time string:", timeString);
      return { hours: 0, minutes: 0 };
    }
    
    // Validate 12-hour format ranges
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      console.error("Invalid 12-hour time values:", { hours, minutes }, "from:", timeString);
      return { hours: 0, minutes: 0 };
    }
    
    // Convert 12-hour to 24-hour
    if (isPM && hours < 12) {
      hours += 12; // Convert PM times to 24-hour (except 12 PM)
    } else if (isAM && hours === 12) {
      hours = 0;  // 12 AM is 0 in 24-hour format
    }
  } else {
    // Handle 24-hour format
    const cleanTimeStr = timeString.replace(/\s+/g, ''); // Remove whitespace
    const timeParts = cleanTimeStr.split(':');
    
    // Validate we have exactly 2 parts
    if (timeParts.length !== 2) {
      console.error("Invalid time format - expected HH:MM:", timeString);
      return { hours: 0, minutes: 0 };
    }
    
    hours = parseInt(timeParts[0], 10);
    minutes = parseInt(timeParts[1], 10);
    
    // Check for valid parsing results
    if (isNaN(hours) || isNaN(minutes)) {
      console.error("Failed to parse numbers from time string:", timeString);
      return { hours: 0, minutes: 0 };
    }
  }
  
  // Final validation for 24-hour format
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.error("Invalid 24-hour time values:", { hours, minutes }, "from:", timeString);
    return { hours: 0, minutes: 0 };
  }
  return { hours, minutes };
};

/**
 * Generates time slots between opening and closing times
 * @param {string} openTime - Opening time
 * @param {string} closeTime - Closing time 
 * @returns {Array} - Array of time slots
 */
const generateTimeSlots = (openTime, closeTime) => {
  ////console.log("Generating time slots between:", openTime, "and", closeTime);
  
  const slots = [];
  
  // Parse open and close times
  const openTimeObj = parseTimeString(openTime);
  const closeTimeObj = parseTimeString(closeTime);
  
  // Create Date objects for manipulation
  const startTime = new Date();
  startTime.setHours(openTimeObj.hours, openTimeObj.minutes, 0, 0);
  
  const endTime = new Date();
  endTime.setHours(closeTimeObj.hours, closeTimeObj.minutes, 0, 0);
  
  // Last slot should be 90 minutes before closing
  const lastPossibleSlot = new Date(endTime);
  lastPossibleSlot.setMinutes(lastPossibleSlot.getMinutes() - 90);
  
  // Generate slots every 30 minutes
  const currentSlot = new Date(startTime);
  
  while (currentSlot <= lastPossibleSlot) {
    // Format as 12-hour time
    let hours = currentSlot.getHours();
    const minutes = currentSlot.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // The hour '0' should be '12'
    
    // Format time slot
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    slots.push(timeStr);
    
    // Move to next slot (30 minutes later)
    currentSlot.setMinutes(currentSlot.getMinutes() + 30);
  }
  
  ////console.log("Generated", slots.length, "time slots");
  return slots;
};


const update_Reservation_Status = async (req, res) => {
  ////console.log("START update_Reservation_Status FUNCTION");
  const reservation_id = req.body.reservation_id;
  const status = req.body.status;
  const notify_all = req.body.notify_all || false;
  const restaurant_id = req.body.restaurant_id;
  const client_email = req.body.client_email;
  const client_name = req.body.client_name;
  
  try {
    // Find the reservation first to check its client_type
    const existingReservation = await UserOrder.findById(reservation_id);
    
    if (!existingReservation) {
      return res.status(404).json({ 
        success: false,
        message: 'Reservation not found'
      });
    }
    
    // Determine which model to use for populating client data based on client_type
    let populateModel;
    
    if (existingReservation.client_type === 'ClientUser') {
      populateModel = 'ClientUser';
    } else if (existingReservation.client_type === 'ClientGuest') {
      populateModel = 'ClientGuest';
    } else {
      // If client_type not set, try to determine it
      const clientUser = await ClientUser.findById(existingReservation.client_id);
      if (clientUser) {
        populateModel = 'ClientUser';
        // Update client_type in reservation
        existingReservation.client_type = 'ClientUser';
        await existingReservation.save();
      } else {
        populateModel = 'ClientGuest';
        // Update client_type in reservation
        existingReservation.client_type = 'ClientGuest';
        await existingReservation.save();
      }
    }
    
    // Find and update the reservation with proper population
    const reservation = await UserOrder.findOneAndUpdate(
      { _id: reservation_id }, 
      { status: status }, 
      { new: true } // Return updated document
    ).populate({
      path: 'client_id',
      model: populateModel, 
      select: 'first_name last_name email phone_number'
    }).populate('restaurant', 'res_name');

    if (!reservation) {
      return res.status(404).json({ 
        success: false,
        message: 'Reservation not found'
      });
    }

    // Get the Socket.IO instance if available
    const io = req.app.get('socketio');
    
    // Extract customer email for notifications
    const customerEmail = client_email || reservation.client_id?.email;
    const restaurantId = restaurant_id || reservation.restaurant?._id?.toString();
    
    // Format the reservation for the frontend
    const formattedReservation = {
      id: reservation._id,
      customer: {
        firstName: reservation.client_id?.first_name || 'Guest',
        lastName: reservation.client_id?.last_name || '',
        email: customerEmail || '',
        phone: reservation.client_id?.phone_number || '',
        type: reservation.client_type 
      },
      orderDetails: {
        guests: reservation.guests,
        status: reservation.status,
        startTime: reservation.start_time.toISOString(),
        endTime: reservation.end_time.toISOString(),
        tableNumber: reservation.tableNumber
      },
      restaurantName: reservation.restaurant?.res_name || 'Restaurant'
    };
    
    // Emit socket events if Socket.IO is available
    if (io) {
      // First event: reservationUpdated - general update
      io.emit('reservationUpdated', {
        reservationId: reservation_id,
        newStatus: status,
        updatedReservation: formattedReservation,
        timestamp: new Date()
      });
      
      // Second event: reservationStatusChanged - specific status change
      io.emit('reservationStatusChanged', {
        reservationId: reservation_id,
        newStatus: status,
        customerEmail: customerEmail,
        restaurantId: restaurantId,
        customerName: client_name || `${reservation.client_id?.first_name} ${reservation.client_id?.last_name}`,
        timestamp: new Date()
      });
      
      // If this is meant to notify specific rooms
      if (notify_all && restaurantId) {
        const roomName = `restaurant_${restaurantId}`;
        io.to(roomName).emit('reservationStatusChanged', {
          reservationId: reservation_id,
          newStatus: status,
          customerEmail: customerEmail,
          timestamp: new Date()
        });
      }
      
      // Notify customer specifically
      if (customerEmail) {
        const customerRoom = `customer_${customerEmail}`;
        io.to(customerRoom).emit('reservationStatusChanged', {
          reservationId: reservation_id,
          newStatus: status,
          restaurantId: restaurantId,
          restaurantName: reservation.restaurant?.res_name,
          timestamp: new Date()
        });
      }
      
      ////console.log('WebSocket: Emitted reservation status change events');
    }

    // Also update the table if applicable
    if (reservation.tableNumber || reservation.table_Id) {
      // Find the table by ID or table number
      const table = reservation.table_Id ?
        await Table.findById(reservation.table_Id) :
        await Table.findOne({ 
          table_number: reservation.tableNumber,
          restaurant_id: restaurantId
        });
      
      if (table) {
        ////console.log(`Found table ${table.table_number} for reservation update`);
        
        // Update table_status based on reservation status
        if (status === 'Seated') {
          table.table_status = 'occupied';
          table.current_reservation = reservation_id;
        } else if (status === 'Planning' || status === 'Confirmed') {
          table.table_status = 'reserved';
        } else if (status === 'Cancelled' || status === 'Done') {
          // Check if this was the current reservation
          if (table.current_reservation && 
              table.current_reservation.toString() === reservation_id.toString()) {
            table.current_reservation = null;
            
            // Check if there are other active reservations
            const hasActiveReservations = await UserOrder.findOne({
              table_Id: table._id,
              status: { $nin: ['Cancelled', 'Done'] },
              start_time: { $lt: new Date(new Date().getTime() + 24*60*60*1000) }, // within next 24 hours
              end_time: { $gt: new Date() } // not ended yet
            });
            
            // If no other active reservations, mark table as available
            if (!hasActiveReservations) {
              table.table_status = 'available';
            }
          }
        }
        
        await table.save();
        ////console.log(`Table ${table.table_number} updated with new status: ${table.table_status}`);
        
        // Emit table update
        if (io && restaurantId) {
          io.to(`restaurant_${restaurantId}`).emit('tableReservationUpdated', {
            tableId: table._id,
            tableNumber: table.table_number,
            reservationId: reservation_id,
            status: status,
            tableStatus: table.table_status
          });
          
          // Also emit a floor layout update
          io.to(`restaurant_${restaurantId}`).emit('floorLayoutUpdated', {
            restaurantId: restaurantId,
            timestamp: new Date(),
            action: 'refresh'
          });
        }
      } else {
        ////console.log(`Table not found for reservation ${reservation_id}`);
      }
    }

    if (status === 'Done' || status === 'Seated') {
      try {
        const restaurantId = restaurant_id || reservation.restaurant._id.toString();
        await generateRandomBill(reservation_id, restaurantId);
      } catch (billError) {
      console.error(`error with new bill ${reservation_id}:`, billError);
  }
}


    res.json({
      success: true,
      message: "Reservation status updated successfully",
      reservation: formattedReservation
    });

  } catch (error) {
    console.error("Error updating reservation status:", error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update reservation status',
      message: error.message 
    });
  }
};

/**
 * Update reservation details including table assignment
 */
const update_Reservation_Details = async (req, res) => {
  ////console.log("START update_Reservation_Details FUNCTION");
  
  // Extract data from request body
  const reservation_id = req.body.reservation_id;
  const new_date = req.body.date;
  const new_time = req.body.time;
  const new_guests = req.body.guests;
  const tableNumber = req.body.tableNumber;
  const notify_all = req.body.notify_all || false;
  const restaurant_id = req.body.restaurant_id;
  const client_email = req.body.client_email;
  const client_name = req.body.client_name;
  
  // Get Socket.io instance from app
  const io = req.app.get('socketio');
  
  try {
    // Find the reservation by ID
    const reservation = await UserOrder.findById(reservation_id)
      .populate('restaurant', 'res_name');
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reservation not found',
        message: 'The requested reservation does not exist'
      });
    }
    
    // Make sure client_type is set properly if it's missing
    if (!reservation.client_type) {
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
            error: 'Invalid client reference',
            message: 'Cannot determine client type for this reservation'
          });
        }
      }
    }
    
    // Track what fields are updated
    const updatedFields = {};
    const originalValues = {
      date: reservation.start_time ? new Date(reservation.start_time).toISOString().split('T')[0] : null,
      time: reservation.start_time ? new Date(reservation.start_time).toTimeString().slice(0, 5) : null,
      guests: reservation.guests,
      tableNumber: reservation.tableNumber
    };
    
    // Keep track of previous table ID and number for updates
    const previousTableId = reservation.table_Id;
    const previousTableNumber = reservation.tableNumber;
    
    // Check and update each field individually
    if (new_date && new_time) {
      // If both date and time are provided, update start_time and end_time
      // Create date object from the new date and time
      const [hours, minutes] = new_time.split(':').map(Number);
      const startDate = new Date(new_date);
      startDate.setHours(hours, minutes, 0, 0);
      
      // Calculate end time (assuming 2 hour duration)
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 2);
      
      // Update the reservation with new times
      reservation.start_time = startDate;
      reservation.end_time = endDate;
      
      // Update orderDate to now (when the reservation was modified)
      reservation.orderDate = new Date();
      
      updatedFields.start_time = startDate;
      updatedFields.end_time = endDate;
      updatedFields.orderDate = reservation.orderDate;
    } else if (new_date) {
      // If only date is changing, preserve the original time
      const originalDate = new Date(reservation.start_time);
      const originalHours = originalDate.getHours();
      const originalMinutes = originalDate.getMinutes();
      
      // Create a new date with original time
      const startDate = new Date(new_date);
      startDate.setHours(originalHours, originalMinutes, 0, 0);
      
      // Calculate end time
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 2);
      
      reservation.start_time = startDate;
      reservation.end_time = endDate;
      
      // Update orderDate to now (when the reservation was modified)
      reservation.orderDate = new Date();
      
      updatedFields.start_time = startDate;
      updatedFields.end_time = endDate;
      updatedFields.orderDate = reservation.orderDate;
    } else if (new_time) {
      // If only time is changing, preserve the original date
      const originalDate = new Date(reservation.start_time);
      const [hours, minutes] = new_time.split(':').map(Number);
      
      // Set new time on original date
      originalDate.setHours(hours, minutes, 0, 0);
      
      // Calculate end time
      const endDate = new Date(originalDate);
      endDate.setHours(endDate.getHours() + 2);
      
      reservation.start_time = originalDate;
      reservation.end_time = endDate;
      
      // Update orderDate to now (when the reservation was modified)
      reservation.orderDate = new Date();
      
      updatedFields.start_time = originalDate;
      updatedFields.end_time = endDate;
      updatedFields.orderDate = reservation.orderDate;
    }
    
    // Update number of guests if provided
    if (new_guests && !isNaN(parseInt(new_guests))) {
      const guests = parseInt(new_guests);
      reservation.guests = guests;
      updatedFields.guests = guests;
      
      // If only guests changed, also update the orderDate
      if (!new_date && !new_time) {
        reservation.orderDate = new Date();
        updatedFields.orderDate = reservation.orderDate;
      }
    }
    
    // Update table number if provided
    let newTableId = null;
    if (tableNumber !== undefined && tableNumber !== previousTableNumber) {
      reservation.tableNumber = tableNumber;
      updatedFields.tableNumber = tableNumber;
      
      // Find the new table ID based on the table number
      const newTable = await Table.findOne({ 
        table_number: tableNumber,
        restaurant_id: restaurant_id || reservation.restaurant?._id
      });
      
      if (newTable) {
        reservation.table_Id = newTable._id;
        updatedFields.table_Id = newTable._id;
        newTableId = newTable._id;
      }
    }
    
    // Save the updated reservation
    await reservation.save();
    
    // Get the restaurant ID
    const restaurantId = restaurant_id || reservation.restaurant?._id?.toString();
    
    // Handle table updates - first update the existing table if there was one
    if (previousTableId) {
      // Find the previous table
      const previousTable = await Table.findById(previousTableId);
      
      if (previousTable) {
        ////console.log(`Found previous table ${previousTableNumber}`);
        
        // If table number changed, update the previous table status
        if (tableNumber !== undefined && tableNumber !== previousTableNumber) {
          ////console.log(`Table number changed from ${previousTableNumber} to ${tableNumber}`);
          
          // If this was the current reservation, clear it
          if (previousTable.current_reservation && 
              previousTable.current_reservation.toString() === reservation_id.toString()) {
            previousTable.current_reservation = null;
            
            // Check if there are other active reservations
            const hasActiveReservations = await UserOrder.findOne({
              table_Id: previousTable._id,
              _id: { $ne: reservation_id }, // Excluding the current reservation
              status: { $nin: ['Cancelled', 'Done'] },
              start_time: { $lt: new Date(new Date().getTime() + 24*60*60*1000) }, // within next 24 hours
              end_time: { $gt: new Date() } // not ended yet
            });
            
            // If no other active reservations, mark table as available
            if (!hasActiveReservations) {
              previousTable.table_status = 'available';
            }
          }
          
          await previousTable.save();
          ////console.log(`Updated previous table ${previousTableNumber} status to ${previousTable.table_status}`);
          
          // Emit table update
          if (io && restaurantId) {
            io.to(`restaurant_${restaurantId}`).emit('tableReservationUpdated', {
              tableId: previousTable._id,
              tableNumber: previousTable.table_number,
              reservationId: reservation_id,
              action: 'remove',
              tableStatus: previousTable.table_status
            });
          }
        }
      }
    }
    
    // If table number changed, update the new table
    if (newTableId) {
      // Find the new table
      const newTable = await Table.findById(newTableId);
      
      if (newTable) {
        ////console.log(`Found new table ${tableNumber}`);
        
        // Update table status based on reservation status
        if (reservation.status === 'Seated') {
          newTable.table_status = 'occupied';
          newTable.current_reservation = reservation._id;
        } else if (reservation.status === 'Planning' || reservation.status === 'Confirmed') {
          newTable.table_status = 'reserved';
        }
        
        await newTable.save();
        ////console.log(`Updated new table ${tableNumber} status to ${newTable.table_status}`);
        
        // Emit table update
        if (io && restaurantId) {
          io.to(`restaurant_${restaurantId}`).emit('reservationAssigned', {
            restaurantId: restaurantId,
            tableId: newTable._id,
            tableNumber: newTable.table_number,
            reservation: {
              id: reservation._id,
              client_id: reservation.client_id,
              guests: reservation.guests,
              start_time: reservation.start_time,
              end_time: reservation.end_time,
              status: reservation.status
            }
          });
        }
      }
    }
    
    // Extract customer email for notifications
    const customerEmail = client_email || await getCustomerEmail(reservation);
    
    // Create a formatted update record for the socket event
    const updateDetails = {
      reservationId: reservation_id,
      restaurantId: restaurantId,
      customerEmail: customerEmail,
      customerName: client_name || await getCustomerName(reservation),
      restaurantName: reservation.restaurant?.res_name || 'Restaurant',
      updates: {
        dateChanged: new_date && originalValues.date !== new_date,
        timeChanged: new_time && originalValues.time !== new_time,
        guestsChanged: new_guests && originalValues.guests !== parseInt(new_guests),
        tableChanged: tableNumber !== undefined && originalValues.tableNumber !== tableNumber,
        newDate: new_date || originalValues.date,
        newTime: new_time || originalValues.time,
        newGuests: new_guests ? parseInt(new_guests) : originalValues.guests,
        newTableNumber: tableNumber !== undefined ? tableNumber : originalValues.tableNumber
      },
      timestamp: new Date()
    };
    
    // Emit real-time updates via Socket.io
    if (io) {
      // General update event
      io.emit('reservationUpdated', {
        reservationId: reservation_id,
        updatedFields: updatedFields,
        timestamp: new Date()
      });
      
      // Detailed update event
      io.emit('reservationDetailsChanged', updateDetails);
      
      // Send to specific rooms if requested
      if (notify_all) {
        // Send to restaurant room
        if (restaurantId) {
          io.to(`restaurant_${restaurantId}`).emit('reservationDetailsChanged', updateDetails);
        }
        
        // Send to customer room
        if (customerEmail) {
          io.to(`customer_${customerEmail}`).emit('reservationDetailsChanged', updateDetails);
        }
      }
      
      // Emit floor layout update for complete refresh
      if (restaurantId) {
        io.to(`restaurant_${restaurantId}`).emit('floorLayoutUpdated', {
          restaurantId: restaurantId,
          timestamp: new Date(),
          action: 'refresh'
        });
      }
      
      ////console.log('Emitted real-time update for reservation', reservation_id);
    }
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Reservation details updated successfully',
      reservation: {
        id: reservation._id,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        guests: reservation.guests,
        orderDate: reservation.orderDate,
        tableNumber: reservation.tableNumber,
        client_type: reservation.client_type
      },
      updates: updateDetails.updates
    });
    
    ////console.log("END Update Reservation Details");
    
  } catch (error) {
    console.error("Error updating reservation details:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to update reservation details',
      message: error.message
    });
  }
};
// Helper function to map UserOrder status to reservation client_status
function mapOrderStatusToReservationStatus(status) {
  ////console.log(`Mapping order status: ${status}`);
  
  const statusMap = {
    'Planning': 'planning',
    'Confirmed': 'confirmed',
    'Seated': 'seated',
    'Done': 'done',
    'Cancelled': 'cancelled'
  };
  
  const result = statusMap[status] || 'planning';
  ////console.log(`Mapped to: ${result}`);
  return result;
}

// Helper function to get customer email
async function getCustomerEmail(reservation) {
  try {
    if (!reservation.client_id) return null;
    
    if (reservation.client_type === 'ClientUser') {
      const client = await ClientUser.findById(reservation.client_id);
      return client?.email || null;
    } else if (reservation.client_type === 'ClientGuest') {
      const client = await ClientGuest.findById(reservation.client_id);
      return client?.email || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting customer email:', error);
    return null;
  }
}

// Helper function to get customer name
async function getCustomerName(reservation) {
  try {
    if (!reservation.client_id) return 'Guest';
    
    if (reservation.client_type === 'ClientUser') {
      const client = await ClientUser.findById(reservation.client_id);
      return client ? `${client.first_name} ${client.last_name}` : 'Guest';
    } else if (reservation.client_type === 'ClientGuest') {
      const client = await ClientGuest.findById(reservation.client_id);
      return client ? `${client.first_name} ${client.last_name}` : 'Guest';
    }
    return 'Guest';
  } catch (error) {
    console.error('Error getting customer name:', error);
    return 'Guest';
  }
}

const get_Customer_Reservation_History = async (req, res) => {
  ////console.log("Start GET Reservation History");
  const { customer_id, email } = req.query;
  
  try {
    let clientData;
    
    if (customer_id) {
      clientData = await ClientUser.findById(customer_id);
    } 
    else if (email) {
      clientData = await ClientUser.findOne({ email });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Missing customer_id or email'
      });
    }
    
    if (!clientData) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    const customerOrders = await UserOrder.find({ client_id: clientData._id })
      .populate('restaurant', 'res_name phone_number city')
      .sort({ start_time: -1 });
    
    if (!customerOrders || customerOrders.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No reservations found for this customer',
        reservations: []
      });
    }
    
    const reservations = customerOrders.map(order => ({
      id: order._id,
      customerName: `${clientData.first_name} ${clientData.last_name}`,
      customerEmail: clientData.email,
      customerPhone: clientData.phone_number,
      restaurantName: order.restaurant ? order.restaurant.res_name : 'Unknown',
      restaurantCity: order.restaurant ? order.restaurant.city : '',
      restaurantPhone: order.restaurant ? order.restaurant.phone_number : '',
      date: order.start_time,
      time: order.start_time,
      endTime: order.end_time,
      guests: order.guests,
      status: order.status,
      orderDate: order.orderDate
    }));
    
    res.status(200).json({
      success: true,
      customer: {
        first_name: clientData.first_name,
        last_name: clientData.last_name,
        email: clientData.email,
        phone: clientData.phone_number
      },
      reservations
    });
    ////console.log("End GET Reservation History");
  } catch (error) {
    console.error('Error fetching reservation history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reservation history',
      error: error.message
    });
  }
};

const get_Restaurant_Clients = async (req, res) => {
  ////console.log("Start GET Clients Data");
  try {
    const restaurant_id = req.params.id;
    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }
    
    // Step 1: Get all orders for this restaurant
    const all_orders = await UserOrder.find({ restaurant: restaurant_id });
    
    if (!all_orders || all_orders.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No customers found for this restaurant',
        customers: []
      });
    }

    // Step 2: Extract all client IDs from orders
    const allClientIds = all_orders.map(order => order.client_id ? order.client_id.toString() : null)
                                 .filter(id => id !== null);
    
    ////console.log(`Found ${allClientIds.length} client IDs from orders`);
    
    // Step 3: Find all registered clients
    const registered_Clients = await ClientUser.find({
      _id: { $in: allClientIds }
    }).populate('allergies', 'name severity');
    
    // Step 4: Create a set of registered client IDs for quick lookup
    const registeredClientIdSet = new Set(
      registered_Clients.map(client => client._id.toString())
    );
    
    // Step 5: Find all client IDs that are not registered clients
    const guestClientIds = allClientIds.filter(id => !registeredClientIdSet.has(id));
    
    ////console.log(`Found ${registered_Clients.length} registered clients and ${guestClientIds.length} guest client IDs`);
    
    // Step 6: Find guest clients directly by ID
    const guest_Clients = await ClientGuest.find({
      _id: { $in: guestClientIds }
    });
    
    ////console.log(`Found ${guest_Clients.length} guest clients in the database by ID`);
    
    // Step 7: Process registered clients
    const formattedRegisteredClients = registered_Clients.map(client => {
      const clientOrders = all_orders.filter(order => 
        order.client_id && order.client_id.toString() === client._id.toString()
      );
      
      return {
        id: client._id,
        type: 'registered',
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone: client.phone_number,
        age: client.age,
        allergies: client.allergies || [],
        visits: clientOrders.length,
        last_visit: findLastVisit(clientOrders)
      };
    });
    
    // Step 8: Process guest clients
    const formattedGuestClients = guest_Clients.map(client => {
      const clientOrders = all_orders.filter(order => 
        order.client_id && order.client_id.toString() === client._id.toString()
      );
      
      return {
        id: client._id,
        type: 'guest',
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone: client.phone_number,
        visits: clientOrders.length,
        last_visit: findLastVisit(clientOrders)
      };
    });
    
    // Step 9: Combine and sort all customers
    const allCustomers = [...formattedRegisteredClients, ...formattedGuestClients]
      .sort((a, b) => {
        if (!a.last_visit) return 1;
        if (!b.last_visit) return -1;
        return new Date(b.last_visit) - new Date(a.last_visit);
      });
    
    ////console.log("End GET Clients Data");
    res.status(200).json({
      success: true,
      total: allCustomers.length,
      registered: formattedRegisteredClients.length,
      guests: formattedGuestClients.length,
      customers: allCustomers
    });
  } catch (error) {
    console.error('Error fetching restaurant customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant customers',
      error: error.message
    });
  }
};

// Helper function to find the last visit date from a list of orders
const findLastVisit = (orders) => {
  if (!orders || orders.length === 0) return null;
  
  // Sort orders by start_time descending
  const sortedOrders = [...orders].sort((a, b) => {
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return new Date(b.start_time) - new Date(a.start_time);
  });
  
  return sortedOrders[0].start_time || sortedOrders[0].orderDate;
};

const get_Restaurant_Menu = async (req, res) => {
  ////console.log("START")
  try {
    const restaurantId = req.params.id;
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }

    // Find the restaurant and populate its menu
    const restaurant = await restaurants.findById(restaurantId)
      .populate({
        path: 'menu',
        model: 'MenuCollection',
        populate: {
          path: 'menus.items',
          model: 'MenuCollection'
        }
      });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // If the restaurant has no menu, return an empty array
    if (!restaurant.menu || restaurant.menu.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No menu items found for this restaurant',
        menu: []
      });
    }

    // Return the menu
    res.status(200).json({
      success: true,
      menu: restaurant.menu
    });

  } catch (error) {
    console.error('Error fetching restaurant menu:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant menu',
      error: error.message
    });
  }
};

/**
 * Update the restaurant menu by adding or removing menu items
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const update_Restaurant_Menu = async (req, res) => {
  try {
    const { 
      restaurant_id, 
      action, 
      menu_id, 
      menu_title, 
      item_name, 
      item_description, 
      item_price, 
      item_category 
    } = req.body;

    // Validate required fields
    if (!restaurant_id || !action) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID and action are required'
      });
    }

    // Find the restaurant
    const restaurant = await restaurants.findById(restaurant_id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Find or create the menu collection for the restaurant
    let menuCollection = await MenuCollection.findOne({ _id: { $in: restaurant.menu } });
    if (!menuCollection) {
      menuCollection = new MenuCollection({ menus: [] });
    }

    switch (action) {
      case 'add_menu':
        // Add a new menu section
        if (!menu_title) {
          return res.status(400).json({
            success: false,
            message: 'Menu title is required to add a new menu section'
          });
        }
        
        // Check if menu section already exists
        const existingMenuIndex = menuCollection.menus.findIndex(m => m.title === menu_title);
        if (existingMenuIndex !== -1) {
          return res.status(400).json({
            success: false,
            message: 'Menu section with this title already exists'
          });
        }

        menuCollection.menus.push({ title: menu_title, items: [] });
        break;

      case 'remove_menu':
        // Remove a menu section
        if (!menu_title) {
          return res.status(400).json({
            success: false,
            message: 'Menu title is required to remove a menu section'
          });
        }
        
        menuCollection.menus = menuCollection.menus.filter(m => m.title !== menu_title);
        break;

      case 'add_item':
        // Add a new menu item
        if (!menu_title || !item_name || !item_description || !item_price || !item_category) {
          return res.status(400).json({
            success: false,
            message: 'All menu item details are required'
          });
        }
        
        const menuToAddItem = menuCollection.menus.find(m => m.title === menu_title);
        if (!menuToAddItem) {
          return res.status(404).json({
            success: false,
            message: 'Menu section not found'
          });
        }

        // Check if item with same name already exists in the menu section
        const existingItemIndex = menuToAddItem.items.findIndex(
          item => item.name === item_name
        );
        if (existingItemIndex !== -1) {
          return res.status(400).json({
            success: false,
            message: 'Menu item with this name already exists in the section'
          });
        }

        menuToAddItem.items.push({
          name: item_name,
          description: item_description,
          price: parseFloat(item_price),
          category: item_category
        });
        break;

      case 'remove_item':
        // Remove a menu item
        if (!menu_title || !item_name) {
          return res.status(400).json({
            success: false,
            message: 'Menu title and item name are required'
          });
        }
        
        const menuToRemoveItem = menuCollection.menus.find(m => m.title === menu_title);
        if (!menuToRemoveItem) {
          return res.status(404).json({
            success: false,
            message: 'Menu section not found'
          });
        }

        menuToRemoveItem.items = menuToRemoveItem.items.filter(
          item => item.name !== item_name
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Supported actions: add_menu, remove_menu, add_item, remove_item'
        });
    }

    // Save the updated menu collection
    const savedMenuCollection = await menuCollection.save();

    // If this is a new menu collection, add its ID to the restaurant's menu
    if (!restaurant.menu.includes(savedMenuCollection._id)) {
      restaurant.menu.push(savedMenuCollection._id);
      await restaurant.save();
    }

    res.status(200).json({
      success: true,
      message: 'Menu updated successfully',
      menu: savedMenuCollection
    });

  } catch (error) {
    console.error('Error updating restaurant menu:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update restaurant menu',
      error: error.message
    });
  }
};


const get_all_bills_for_Restaurants = async (req, res) => {
  ////console.log("START get_all_bills_for_Restaurants");
  try {
    // Extract and validate request parameters
    const restaurant_id = req.body.restaurant_id;
    if (!restaurant_id) {
      return res.status(400).json({ success: false, message: "Restaurant ID is required" });
    }

    // Ensure restaurant_id is proper ObjectId
    const restaurantObjectId = typeof restaurant_id === 'string' 
      ? new mongoose.Types.ObjectId(restaurant_id) 
      : restaurant_id;

    ////console.log(`Processing request for restaurant ID: ${restaurantObjectId}`);

    // Parse date parameters with proper validation
    let start_date = null;
    let end_date = null;
    
    if (req.body.start_date) {
      start_date = new Date(req.body.start_date);
      if (isNaN(start_date.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid start date format" });
      }
      ////console.log(`Using start date: ${start_date.toISOString()}`);
    }
    
    if (req.body.end_date) {
      end_date = new Date(req.body.end_date);
      if (isNaN(end_date.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid end date format" });
      }
      // Set end date to end of day
      end_date.setHours(23, 59, 59, 999);
      ////console.log(`Using end date: ${end_date.toISOString()}`);
    }
    
    const analytics = req.body.analytics || false;
    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 50;
    const skip = (page - 1) * limit;
    const status = req.body.status || null;
    
    // NEW APPROACH: Get all valid orders for this restaurant first
    // This is just to check if our restaurant ID is valid and has orders
    const orderCountCheck = await UserOrder.countDocuments({ restaurant: restaurantObjectId });
    ////console.log(`Total orders for restaurant ${restaurantObjectId}: ${orderCountCheck}`);
    
    // NEW APPROACH: Get all bills from RestaurantsBills
    // We'll do a two-step process:
    // 1. Get all bills
    // 2. Filter them to only include those related to our restaurant
    
    // Step 1: Build query for bills with date filters only
    let billDateQuery = {};
    
    if (start_date && end_date) {
      billDateQuery.date = { $gte: start_date, $lte: end_date };
    } else if (start_date) {
      billDateQuery.date = { $gte: start_date };
    } else if (end_date) {
      billDateQuery.date = { $lte: end_date };
    }
    
    ////console.log("Initial bill query (date filters only):", JSON.stringify(billDateQuery));
    
    // Check if specific bill exists (the one mentioned) before filtering
    if (mongoose.Types.ObjectId.isValid("67f50abdf604bb8f6eda36d0")) {
      const testBill = await RestaurantsBills.findById("67f50abdf604bb8f6eda36d0").lean();
      if (testBill) {
        ////console.log("Found specific bill with ID 67f50abdf604bb8f6eda36d0:");
        ////console.log("Bill order_id:", testBill.order_id);
        
        // Check which restaurant this bill belongs to
        if (testBill.order_id) {
          const billOrder = await UserOrder.findById(testBill.order_id).lean();
          if (billOrder) {
            ////console.log("This bill belongs to restaurant:", billOrder.restaurant);
            ////console.log("Matches our restaurant?", billOrder.restaurant.toString() === restaurantObjectId.toString());
          } else {
            ////console.log("Could not find order for this bill");
          }
        }
      } else {
        ////console.log("Could not find specific bill with ID 67f50abdf604bb8f6eda36d0");
      }
    }
    
    // Find all bills with date filters
    const allDateFilteredBills = await RestaurantsBills.find(billDateQuery)
      .lean();
    
    ////console.log(`Found ${allDateFilteredBills.length} bills matching date filters`);
    
    if (allDateFilteredBills.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bills found matching the date criteria"
      });
    }
    
    // Extract order IDs from bills
    const billOrderIds = allDateFilteredBills.map(bill => bill.order_id);
    
    // Step 2: Find orders for these bills that belong to our restaurant
    const relatedOrders = await UserOrder.find({
      _id: { $in: billOrderIds },
      restaurant: restaurantObjectId
    }).lean();
    
    ////console.log(`Found ${relatedOrders.length} orders that match bills and belong to restaurant`);
    
    // Get IDs of orders that match our criteria
    const matchingOrderIds = relatedOrders.map(order => order._id);
    
    // Apply status filter if provided
    let filteredOrderIds = matchingOrderIds;
    if (status) {
      const ordersWithStatus = await UserOrder.find({
        _id: { $in: matchingOrderIds },
        status: status
      }).lean();
      filteredOrderIds = ordersWithStatus.map(order => order._id);
      ////console.log(`After status filter, found ${filteredOrderIds.length} matching orders`);
    }
    
    // Now find bills for these filtered orders
    const matchingBills = allDateFilteredBills.filter(bill => 
      filteredOrderIds.some(orderId => 
        bill.order_id && orderId && bill.order_id.toString() === orderId.toString()
      )
    );
    
    ////console.log(`Final count of matching bills: ${matchingBills.length}`);
    
    // Apply pagination to the bills
    const totalBills = matchingBills.length;
    const paginatedBills = matchingBills.slice(skip, skip + limit);
    
    // Populate the bills with order data
    const populatedBills = [];
    for (const bill of paginatedBills) {
      const order = relatedOrders.find(o => o._id.toString() === bill.order_id.toString());
      
      if (order) {
        // Manually populate client data
        let clientData = null;
        if (order.client_id) {
          const client = await ClientUser.findById(order.client_id).lean();
          if (client) {
            clientData = {
              _id: client._id,
              name: client.name,
              email: client.email,
              phone: client.phone
            };
          }
        }
        
        // Create populated version
        const populatedBill = {
          ...bill,
          order_id: {
            _id: order._id,
            client_id: clientData,
            orderDate: order.orderDate,
            start_time: order.start_time,
            end_time: order.end_time,
            status: order.status,
            guests: order.guests,
            tableNumber: order.tableNumber
          }
        };
        
        populatedBills.push(populatedBill);
      } else {
        // If order not found, just include the bill without population
        populatedBills.push(bill);
      }
    }
    
    // Get orders for analytics if needed
    let orders = [];
    if (analytics) {
      orders = await UserOrder.find({
        _id: { $in: matchingOrderIds }
      })
      .select('_id client_id guests status orderDate start_time end_time tableNumber')
      .lean();
    }

    // If no analytics requested, simply return the bills with pagination info
    if (!analytics) {
      return res.status(200).json({
        success: true,
        pagination: {
          total: totalBills,
          page,
          limit,
          pages: Math.ceil(totalBills / limit)
        },
        count: populatedBills.length,
        bills: populatedBills
      });
    }

    // ANALYTICS SECTION
    const analyticsData = calculateAnalytics(populatedBills, orders);

    return res.status(200).json({
      success: true,
      pagination: {
        total: totalBills,
        page,
        limit,
        pages: Math.ceil(totalBills / limit)
      },
      count: populatedBills.length,
      bills: populatedBills,
      analytics: analyticsData
    });

  } catch (error) {
    console.error("Error in get_all_bills_for_Restaurants:", error);
    console.error(error.stack);
    
    let errorMessage = "Server error processing restaurant bills";
    let errorDetails = error.message;
    
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      errorMessage = "Invalid ID format";
      errorDetails = `Could not convert "${error.value}" to a valid ObjectId`;
      return res.status(400).json({ 
        success: false, 
        message: errorMessage, 
        error: errorDetails 
      });
    }
    
    if (error.name === 'MongooseError' && error.message.includes('Connection')) {
      errorMessage = "Database connection error";
    }
    
    return res.status(500).json({ 
      success: false, 
      message: errorMessage, 
      error: errorDetails 
    });
  }
};


/**
 * Calculates detailed analytics from bill and order data
 * @param {Array} bills - Array of bill documents
 * @param {Array} orders - Array of order documents
 * @returns {Object} Comprehensive analytics object
 */
const calculateAnalytics = (bills, orders) => {
  // Initialize analytics data structure
  const analyticsData = {
    // Revenue metrics
    totalRevenue: 0,
    averageBillAmount: 0,
    
    // Time-based analytics
    salesByDay: {},
    salesByDayOfWeek: {
      "Monday": { count: 0, revenue: 0 },
      "Tuesday": { count: 0, revenue: 0 },
      "Wednesday": { count: 0, revenue: 0 },
      "Thursday": { count: 0, revenue: 0 },
      "Friday": { count: 0, revenue: 0 },
      "Saturday": { count: 0, revenue: 0 },
      "Sunday": { count: 0, revenue: 0 }
    },
    salesByMonth: {},
    peakHours: {},
    
    // Item analytics
    topSellingItems: {},
    itemsByCategory: {},
    
    // Customer analytics
    customerData: {},
    averageGuestsPerBill: 0,
    totalGuests: 0,
    
    // Table analytics
    tableUsage: {},
    
    // Status analytics
    orderStatusDistribution: {
      "Planning": 0,
      "Done": 0,
      "Cancelled": 0,
      "Seated": 0
    },
    
    // Advanced metrics
    avgTimeSpent: 0,
    popularItemCombinations: {}
  };

  // Basic metrics calculation
  if (bills.length === 0) return analyticsData;
  
  analyticsData.totalRevenue = bills.reduce((sum, bill) => sum + bill.total_Price, 0);
  analyticsData.averageBillAmount = analyticsData.totalRevenue / bills.length;

  // Track total time spent for calculation of averages
  let totalTimeSpentMinutes = 0;
  let billsWithTimeData = 0;
  
  // Initialize month names for better readability
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  // Day of week mapping
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  // Process orders for status distribution
  orders.forEach(order => {
    if (order.status) {
      analyticsData.orderStatusDistribution[order.status]++;
    }
  });

  // Process each bill for detailed analytics
  bills.forEach(bill => {
    // Skip if bill doesn't have necessary data
    if (!bill) return;
    
    // Process date information
    const billDate = new Date(bill.date);
    const dateKey = billDate.toISOString().split('T')[0];
    const monthKey = `${monthNames[billDate.getMonth()]} ${billDate.getFullYear()}`;
    const dayOfWeekKey = dayNames[billDate.getDay()];
    
    // Sales by day
    if (!analyticsData.salesByDay[dateKey]) {
      analyticsData.salesByDay[dateKey] = {
        count: 0,
        revenue: 0
      };
    }
    analyticsData.salesByDay[dateKey].count += 1;
    analyticsData.salesByDay[dateKey].revenue += bill.total_Price;
    
    // Sales by month
    if (!analyticsData.salesByMonth[monthKey]) {
      analyticsData.salesByMonth[monthKey] = {
        count: 0,
        revenue: 0
      };
    }
    analyticsData.salesByMonth[monthKey].count += 1;
    analyticsData.salesByMonth[monthKey].revenue += bill.total_Price;
    
    // Sales by day of week
    analyticsData.salesByDayOfWeek[dayOfWeekKey].count += 1;
    analyticsData.salesByDayOfWeek[dayOfWeekKey].revenue += bill.total_Price;

    // Top selling items and category analytics
    if (bill.orders_items && Array.isArray(bill.orders_items)) {
      bill.orders_items.forEach(item => {
        // Process item data
        if (!analyticsData.topSellingItems[item.name]) {
          analyticsData.topSellingItems[item.name] = {
            count: 0,
            revenue: 0,
            averagePrice: 0
          };
        }
        analyticsData.topSellingItems[item.name].count += item.quantity;
        analyticsData.topSellingItems[item.name].revenue += item.price * item.quantity;
        
        // Process category data if available
        if (item.category) {
          if (!analyticsData.itemsByCategory[item.category]) {
            analyticsData.itemsByCategory[item.category] = {
              count: 0,
              revenue: 0,
              items: {}
            };
          }
          analyticsData.itemsByCategory[item.category].count += item.quantity;
          analyticsData.itemsByCategory[item.category].revenue += item.price * item.quantity;
          
          if (!analyticsData.itemsByCategory[item.category].items[item.name]) {
            analyticsData.itemsByCategory[item.category].items[item.name] = {
              count: 0,
              revenue: 0
            };
          }
          analyticsData.itemsByCategory[item.category].items[item.name].count += item.quantity;
          analyticsData.itemsByCategory[item.category].items[item.name].revenue += item.price * item.quantity;
        }
        
        // Track popular item combinations
        if (bill.orders_items.length > 1) {
          bill.orders_items
            .filter(otherItem => otherItem.name !== item.name)
            .forEach(otherItem => {
              const combination = [item.name, otherItem.name].sort().join(' & ');
              if (!analyticsData.popularItemCombinations[combination]) {
                analyticsData.popularItemCombinations[combination] = {
                  count: 0,
                  items: [item.name, otherItem.name]
                };
              }
              // Only count combinations once per bill
              analyticsData.popularItemCombinations[combination].count += 1;
            });
        }
      });
    }

    // Peak hours analysis
    if (bill.order_id && bill.order_id.start_time) {
      const hour = new Date(bill.order_id.start_time).getHours();
      const hourKey = `${hour}:00 - ${hour + 1}:00`;
      
      if (!analyticsData.peakHours[hourKey]) {
        analyticsData.peakHours[hourKey] = {
          count: 0,
          revenue: 0
        };
      }
      analyticsData.peakHours[hourKey].count += 1;
      analyticsData.peakHours[hourKey].revenue += bill.total_Price;
    }

    // Calculate time spent if both start and end times are available
    if (bill.order_id && bill.order_id.start_time && bill.order_id.end_time) {
      const startTime = new Date(bill.order_id.start_time);
      const endTime = new Date(bill.order_id.end_time);
      if (startTime < endTime) {
        const timeSpentMinutes = (endTime - startTime) / (1000 * 60);
        totalTimeSpentMinutes += timeSpentMinutes;
        billsWithTimeData++;
      }
    }

    // Customer data analysis
    if (bill.order_id && bill.order_id.client_id) {
      const clientId = typeof bill.order_id.client_id === 'object' ? 
        bill.order_id.client_id._id.toString() : bill.order_id.client_id.toString();
      
      if (!analyticsData.customerData[clientId]) {
        analyticsData.customerData[clientId] = {
          name: bill.order_id.client_id.name || 'Unknown Customer',
          visitCount: 0,
          totalSpent: 0,
          averageSpend: 0,
          lastVisit: null
        };
      }
      analyticsData.customerData[clientId].visitCount += 1;
      analyticsData.customerData[clientId].totalSpent += bill.total_Price;
      
      // Track the last visit date
      const visitDate = new Date(bill.date);
      if (!analyticsData.customerData[clientId].lastVisit || 
          visitDate > new Date(analyticsData.customerData[clientId].lastVisit)) {
        analyticsData.customerData[clientId].lastVisit = visitDate;
      }
    }

    // Guest count analytics
    if (bill.order_id && bill.order_id.guests) {
      analyticsData.totalGuests += bill.order_id.guests;
    }

    // Table usage analytics
    if (bill.order_id && bill.order_id.tableNumber) {
      const tableKey = bill.order_id.tableNumber;
      if (!analyticsData.tableUsage[tableKey]) {
        analyticsData.tableUsage[tableKey] = {
          usageCount: 0,
          totalRevenue: 0,
          averageRevenue: 0,
          averageGuests: 0,
          totalGuests: 0
        };
      }
      analyticsData.tableUsage[tableKey].usageCount += 1;
      analyticsData.tableUsage[tableKey].totalRevenue += bill.total_Price;
      
      if (bill.order_id.guests) {
        analyticsData.tableUsage[tableKey].totalGuests += bill.order_id.guests;
      }
    }
  });

  // Calculate derived metrics and format data
  
  // Average time spent calculation
  if (billsWithTimeData > 0) {
    analyticsData.avgTimeSpent = Math.round(totalTimeSpentMinutes / billsWithTimeData);
  }
  
  // Average guests per bill
  if (bills.length > 0) {
    analyticsData.averageGuestsPerBill = analyticsData.totalGuests / bills.length;
  }

  // Calculate averages for items
  Object.keys(analyticsData.topSellingItems).forEach(key => {
    analyticsData.topSellingItems[key].averagePrice = 
      analyticsData.topSellingItems[key].revenue / analyticsData.topSellingItems[key].count;
  });

  // Calculate customer averages
  Object.keys(analyticsData.customerData).forEach(key => {
    analyticsData.customerData[key].averageSpend = 
      analyticsData.customerData[key].totalSpent / analyticsData.customerData[key].visitCount;
  });

  // Calculate table usage averages
  Object.keys(analyticsData.tableUsage).forEach(key => {
    analyticsData.tableUsage[key].averageRevenue = 
      analyticsData.tableUsage[key].totalRevenue / analyticsData.tableUsage[key].usageCount;
    
    if (analyticsData.tableUsage[key].usageCount > 0) {
      analyticsData.tableUsage[key].averageGuests = 
        analyticsData.tableUsage[key].totalGuests / analyticsData.tableUsage[key].usageCount;
    }
  });

  // Sort and process item combinations
  analyticsData.popularItemCombinations = Object.entries(analyticsData.popularItemCombinations)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10) // Top 10 combinations
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});

  // Sort top selling items by count
  analyticsData.topSellingItems = Object.entries(analyticsData.topSellingItems)
    .sort((a, b) => b[1].count - a[1].count)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});

  // Find best sales day
  const bestDay = Object.entries(analyticsData.salesByDay)
    .sort((a, b) => b[1].revenue - a[1].revenue)[0];
  analyticsData.bestSalesDay = bestDay ? { date: bestDay[0], ...bestDay[1] } : null;

  // Find best sales month
  const bestMonth = Object.entries(analyticsData.salesByMonth)
    .sort((a, b) => b[1].revenue - a[1].revenue)[0];
  analyticsData.bestSalesMonth = bestMonth ? { month: bestMonth[0], ...bestMonth[1] } : null;

  // Find best day of week
  const bestDayOfWeek = Object.entries(analyticsData.salesByDayOfWeek)
    .sort((a, b) => b[1].revenue - a[1].revenue)[0];
  analyticsData.bestDayOfWeek = bestDayOfWeek ? { day: bestDayOfWeek[0], ...bestDayOfWeek[1] } : null;

  // Find peak hour
  const busiest = Object.entries(analyticsData.peakHours)
    .sort((a, b) => b[1].count - a[1].count)[0];
  analyticsData.busiestHour = busiest ? { time: busiest[0], ...busiest[1] } : null;

  // Find most valuable customer
  const mostValuable = Object.entries(analyticsData.customerData)
    .sort((a, b) => b[1].totalSpent - a[1].totalSpent)[0];
  analyticsData.mostValuableCustomer = mostValuable ? 
    { id: mostValuable[0], ...mostValuable[1] } : null;

  // Find most frequent customer
  const mostFrequent = Object.entries(analyticsData.customerData)
    .sort((a, b) => b[1].visitCount - a[1].visitCount)[0];
  analyticsData.mostFrequentCustomer = mostFrequent ? 
    { id: mostFrequent[0], ...mostFrequent[1] } : null;

  // Find most profitable table
  const mostProfitableTable = Object.entries(analyticsData.tableUsage)
    .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue)[0];
  analyticsData.mostProfitableTable = mostProfitableTable ? 
    { table: mostProfitableTable[0], ...mostProfitableTable[1] } : null;

  return analyticsData;
};



// Function to get all bills for a user
const get_all_bills_for_user = async (req, res) => {
  ////console.log("START get_all_bills_for_user");
  try {
    const order_id = req.params.id;
    //console.log("Looking for bill with order_id:", order_id);

    if (!order_id) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    let orderObjectId;
    try {
      orderObjectId = new mongoose.Types.ObjectId(String(order_id));
    } catch (err) {
      return res.status(400).json({ success: false, message: "Invalid Order ID format" });
    }

    const bills = await RestaurantsBills.find({ order_id: orderObjectId });
    ////console.log(bills)
    if (!bills || bills.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No bill found for this order" 
      });
    }

    const formattedBills = bills.map((bill) => ({
      _id: bill._id,
      restaurant: {
        name: "Restaurant",
        address: "",
        phone: "",
        email: "",
        logo: ""
      },
      orderDetails: {
        orderDate: bill.date,
        orderNumber: order_id,
        tableNumber: "",
        guests: 1
      },
      items: bill.orders_items || [],
      financials: {
        subtotal: 0,
        tax: 0,
        total: bill.total_Price || 0,
        date: bill.date
      }
    }));

    return res.status(200).json({
      success: true,
      bills: formattedBills
    });

  } catch (error) {
    console.error("Error in get_all_bills_for_user:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error processing bill", 
      error: error.message 
    });
  }
};


/**
 * Generate a random bill for a restaurant order
 * @param {string} orderId - The ID of the user order
 * @param {string} restaurantId - The ID of the restaurant
 * @returns {Promise<Object|null>} - The generated bill or null
 */
const generateRandomBill = async (orderId, restaurantId) => {
  try {
    // Check if a bill already exists for this order
    const existingBill = await RestaurantsBills.findOne({ order_id: orderId });
    
    if (existingBill) {
      //console.log(`Bill already exists for order ${orderId}`);
      return null;
    }
    
    // Find the restaurant and populate its menu
    const restaurant = await restaurants.findById(restaurantId)
      .populate({
        path: 'menu',
        model: 'MenuCollection',
        populate: {
          path: 'menus.items',
          model: 'MenuCollection'
        }
      });
    
    if (!restaurant || !restaurant.menu) {
      //console.log(`Restaurant menu not found for ID ${restaurantId}`);
      return null;
    }
    
    // Extract all menu items from all menus
    const allMenuItems = [];
    
    if (restaurant.menu && Array.isArray(restaurant.menu)) {
      // Handle case where restaurant.menu is an array
      restaurant.menu[0].menus.forEach(menuSection => {
        if (menuSection.items && Array.isArray(menuSection.items)) {
          menuSection.items.forEach(item => {
            allMenuItems.push({
              name: item.name,
              price: item.price,
              category: menuSection.title || item.category
            });
          });
        }
      });
    } else if (restaurant.menu && restaurant.menu.menus) {
      // Handle case where restaurant.menu is an object with menus property
      restaurant.menu.menus.forEach(menuSection => {
        if (menuSection.items && Array.isArray(menuSection.items)) {
          menuSection.items.forEach(item => {
            allMenuItems.push({
              name: item.name,
              price: item.price,
              category: menuSection.title || item.category
            });
          });
        }
      });
    }
    
    if (allMenuItems.length === 0) {
      //console.log(`No menu items found for restaurant ${restaurantId}`);
      return null;
    }
    
    // Generate random number of items (4-12)
    const numberOfItems = Math.floor(Math.random() * 9) + 4;
    
    // Generate a set of random menu items
    const selectedItems = [];
    const selectedItemNames = new Set(); // To ensure uniqueness
    
    // Try to select unique items
    while (selectedItems.length < numberOfItems && selectedItems.length < allMenuItems.length) {
      const randomIndex = Math.floor(Math.random() * allMenuItems.length);
      const menuItem = allMenuItems[randomIndex];
      
      // Skip if we've already selected this item
      if (selectedItemNames.has(menuItem.name)) continue;
      
      selectedItemNames.add(menuItem.name);
      
      // Generate random quantity (1-5)
      const quantity = Math.floor(Math.random() * 5) + 1;
      
      selectedItems.push({
        name: menuItem.name,
        price: menuItem.price,
        category: menuItem.category,
        quantity: quantity
      });
    }
    
    // Calculate the total price explicitly
    const totalPrice = selectedItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    // Create and save the bill with explicitly set total_Price
    const newBill = new RestaurantsBills({
      order_id: orderId,
      orders_items: selectedItems,
      total_Price: totalPrice // Explicitly set the total price
    });
    
    const savedBill = await newBill.save();
    //console.log(`Bill created successfully for order ${orderId} with total price ${totalPrice}`);
    
    return savedBill;
    
  } catch (error) {
    console.error('Error generating random bill:', error);
    return null;
  }
};


const getAvailableTablesCount = async (req, res) => {
  
  const { restaurantId } = req.params;
  const { date, guests = 2} = req.query;
  
  // Helper functions
  const convertTo24Hour = (timeString) => {
    const [timePart, meridiem] = timeString.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    
    if (meridiem === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const convertTo12Hour = (timeString) => {
    const [hours24, minutes] = timeString.split(':').map(Number);
    const hours12 = hours24 % 12 || 12;
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${meridiem}`;
  };

  const generateTimeSlots = (openTime24h, closeTime24h) => {
    const slots = [];
    
    let [openHours, openMinutes] = openTime24h.split(':').map(Number);
    let [closeHours, closeMinutes] = closeTime24h.split(':').map(Number);
    
    const startTime = new Date();
    startTime.setHours(openHours, openMinutes, 0, 0);
    
    const endTime = new Date();
    endTime.setHours(closeHours, closeMinutes, 0, 0);
    
    const lastPossibleSlot = new Date(endTime);
    lastPossibleSlot.setMinutes(lastPossibleSlot.getMinutes() - 90);
    
    const currentSlot = new Date(startTime);
    
    while (currentSlot <= lastPossibleSlot) {
      const hours = currentSlot.getHours().toString().padStart(2, '0');
      const minutes = currentSlot.getMinutes().toString().padStart(2, '0');
      
      const timeStr = `${hours}:${minutes}`;
      slots.push(timeStr);
      
      currentSlot.setMinutes(currentSlot.getMinutes() + 30);
    }
    
    return slots;
  };
  
  try {
    const restaurant = await restaurants.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }
    const guestsNum = parseInt(guests);
    let maxTableSize = guestsNum+2;
    
    const allTables = await Table.find({
      restaurant_id: restaurantId,
      seats: { 
        $gte: guestsNum,
        $lte: maxTableSize 
      },
      //isActive: true
    });
    
    
    const dateObj = new Date(date);
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = daysOfWeek[dateObj.getDay()];
    
    if (!restaurant.open_time || !restaurant.open_time[dayOfWeek] || 
        restaurant.open_time[dayOfWeek].open === 'Closed') {
      return res.json({ success: true, availability: {} });
    }
    
    const dayHours = restaurant.open_time[dayOfWeek];
    const openTime = convertTo24Hour(dayHours.open);
    const closeTime = convertTo24Hour(dayHours.close);
    
    const timeSlots = generateTimeSlots(openTime, closeTime);
    const availability = {};

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existingReservations = await UserOrder.find({
      start_time: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ['Cancelled'] },
      table_Id: { $in: allTables.map(t => t._id) }
    }).select('table_Id start_time end_time');

      const reservationsByTable = {};
    existingReservations.forEach(reservation => {
      const tableId = reservation.table_Id.toString();
      if (!reservationsByTable[tableId]) {
        reservationsByTable[tableId] = [];
      }
      reservationsByTable[tableId].push({
        start: reservation.start_time,
        end: reservation.end_time
      });
    });

    for (const timeSlot of timeSlots) {
      const reservationDate = calculateReservationDateWithDate(date, convertTo12Hour(timeSlot));
      const startTime = reservationDate.date || reservationDate;
      const endTime = new Date(startTime.getTime());
      endTime.setMinutes(endTime.getMinutes() + 90);
      
      let availableCount = 0;
      
      for (const table of allTables) {
        const tableId = table._id.toString();
        const tableReservations = reservationsByTable[tableId] || [];
      
        let isAvailable = true;
        for (const reservation of tableReservations) {
          if (startTime < reservation.end && endTime > reservation.start) {
            isAvailable = false;
            break;
          }
        }
        
        if (isAvailable) {
          availableCount++;
        }
      }
      
      availability[timeSlot] = availableCount;
    }
    
    return res.json({ 
      success: true, 
      availability 
    });
    
  } catch (error) {
    console.error('Error getting availability:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error checking availability' 
    });
  }
};

module.exports = {
  all_Restaurants_Data,
  Restaurants_Reservation,
  add_New_Reviews,
  check_Availability,
  get_Available_Times,
  create_Reservation,
  update_Reservation_Status,
  update_Reservation_Details,
  get_Customer_Reservation_History,
  get_Restaurant_Clients,
  get_Restaurant_Menu,
  update_Restaurant_Menu,
  get_all_bills_for_Restaurants,
  get_all_bills_for_user,
  getAvailableTablesCount,
};
  