const restaurants = require('../models/Restarunt')
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const ClientGuest = require('../models/ClientGuest');
const Allergies = require('../models/Allergies');
const Table = require('../models/Tables')
const Review = require('../models/Reviews');

const {sendMail} = require('../MessageSystem/email_message')


const all_Restaurants_Data = async (req, res) => {
  const restaurantId = req.params.id; 
  if (restaurantId) {
    console.log("Start Restaurant Data for ID: ", restaurantId);
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
      console.log("Fetching all Restaurants Data");
      const allRestaurantsData = await restaurants.find();
      res.status(200).json(allRestaurantsData);
    } catch (error) {
      console.error("Error fetching all restaurants:", error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

const Restaurants_Reservation = async (req, res) => {
  console.log("Start Restaurants_Reservation");
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
          startTime: reservation.start_time,
          endTime: reservation.end_time
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
    
    console.log("END of Restaurants_Reservation");
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

const add_New_Reviews = async (req, res) =>{
  try{

    console.log("Start add New Reviews");
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

    const client_id = await ClientUser.findOne({ email: user_email })  

    const new_Review = new Review({
      user: client_id,
      rating: req_rating,
      comment: review_string,
      created_at: new Date()
    });
  
    const saved_Review = await new_Review.save();
    console.log("saved_Review",saved_Review);
  
    const restaurant = await restaurants.findById(req_restaurant_Id);
    console.log("restaurant",restaurant);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found"
      });
    }
    restaurant.reviews.push(saved_Review._id);

    const populatedRestaurant = await restaurants.findById(req_restaurant_Id)
    .populate('reviews');
  
  if (populatedRestaurant.reviews) {
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
    }
    console.log("****************************************************",totalRating,validReviewCount)
  }



    await restaurant.save()
    res.status(201).json({
      success: true,
      message: "Review added successfully",
    });
  }catch (error) {
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
  console.log("=== Start check_Availability ===");
  console.log("Parameters:", { restaurantId, dateCheck, time, guests });
  
  try {
    // Find restaurant data
    const restaurantData = await restaurants.findById(restaurantId);
    console.log("Restaurant found:", !!restaurantData);

    if (!restaurantData) {
      console.log("Restaurant not found");
      return {
        success: false,
        message: 'Restaurant not found'
      };
    }

    // Check if restaurant has tables configured
    if (!restaurantData.tables || restaurantData.tables.length === 0) {
      console.log("No tables configured for restaurant");
      return {
        success: false,
        message: 'No tables configured for this restaurant',
        availableTables: 0
      };
    }
    
    // Extract day of week from the date
    const dayOfWeek = new Date(dateCheck).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    console.log("Day of week:", dayOfWeek);
    
    // Check if restaurant is open on this day
    if (!restaurantData.open_time || !restaurantData.open_time[dayOfWeek] || 
        restaurantData.open_time[dayOfWeek].open === 'Closed') {
      console.log("Restaurant is closed on this day");
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
    
    console.log("Reservation start time:", reservationDate);
    console.log("Reservation end time:", endTime);
    
    // Set up the day boundaries for query
    const startOfDay = new Date(dateCheck);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateCheck);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log("Checking reservations between:", startOfDay, "and", endOfDay);

    // Get all existing reservations for this day that are not cancelled
    const existingReservations = await UserOrder.find({
      restaurant: restaurantId,
      start_time: { $gte: startOfDay, $lt: endOfDay },
      status: { $ne: 'Cancelled' }
    });
    
    console.log("Found existing reservations:", existingReservations.length);

    // Filter tables that can accommodate the guest count
    const suitableTables = restaurantData.tables.filter(table => {
      // If table data includes capacity field, filter by it
      if (table.seats) {
        return table.seats >= guests;
      }
      // Otherwise, assume all tables can accommodate any party size
      return true;
    });
    
    console.log("Suitable tables for party size:", suitableTables.length);

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
        console.log("Found overlapping reservation, reducing available tables");
      }
    });
    
    console.log("Final available tables count:", availableTablesCount);

    const result = {
      success: true,
      availableTables: availableTablesCount,
      totalTables: suitableTables.length,
      date: dateCheck,
      time: time,
      isAvailable: availableTablesCount > 0
    };
    
    console.log("Availability check result:", result);
    console.log("=== End check_Availability ===");
    
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
  console.log("=== Start get_Available_Times ===");
  
  try {
    const restaurantId = req.params.id;
    const { date, partySize = 2 } = req.query;
    
    console.log("Parameters:", { restaurantId, date, partySize });
    
    if (!date) {
      console.log("Missing date parameter");
      return res.status(400).json({ 
        success: false, 
        message: 'Date parameter is required' 
      });
    }
    
    // Find the restaurant
    const restaurant = await restaurants.findById(restaurantId);
    console.log("Restaurant found:", !!restaurant);
    
    if (!restaurant) {
      console.log("Restaurant not found");
      return res.status(404).json({ 
        success: false, 
        message: 'Restaurant not found' 
      });
    }

    // Check if restaurant is open on the selected day
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    console.log("Day of week:", dayOfWeek);
    
    if (!restaurant.open_time || !restaurant.open_time[dayOfWeek] || 
        restaurant.open_time[dayOfWeek].open === 'Closed') {
      console.log("Restaurant is closed on this day");
      return res.status(200).json({ 
        success: true, 
        availableTimes: [],
        message: 'Restaurant is closed on this day'
      });
    }
    
    // Get opening hours for the selected day
    const openTime = restaurant.open_time[dayOfWeek].open;
    const closeTime = restaurant.open_time[dayOfWeek].close;
    console.log("Restaurant hours:", openTime, "to", closeTime);
    
    // Generate time slots every 30 minutes between opening and closing time
    const timeSlots = generateTimeSlots(openTime, closeTime);
    console.log("Generated time slots:", timeSlots.length);
    
    // Check availability for each time slot
    console.log("Checking availability for each time slot...");
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
    console.log("Available times found:", availableTimes.length);
    
    const response = {
      success: true,
      availableTimes: availableTimes,
      totalTimeSlots: timeSlots.length
    };
    
    console.log("=== End get_Available_Times ===");
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
  console.log("=== Start get_Available_Tables ===");
  
  try {
    const restaurantId = req.params.id;
    const { date, time, guests = 2 } = req.query;
    
    console.log("Parameters:", { restaurantId, date, time, guests });
    
    if (!date || !time) {
      console.log("Missing date or time parameter");
      return res.status(400).json({ 
        success: false, 
        message: 'Date and time parameters are required' 
      });
    }
    
    // Find the restaurant
    const restaurant = await restaurants.findById(restaurantId).populate('tables');
    console.log("Restaurant found:", !!restaurant);
    
    if (!restaurant) {
      console.log("Restaurant not found");
      return res.status(404).json({ 
        success: false, 
        message: 'Restaurant not found' 
      });
    }

    // Check if restaurant is open on the selected day
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    console.log("Day of week:", dayOfWeek);
    
    if (!restaurant.open_time || !restaurant.open_time[dayOfWeek] || 
        restaurant.open_time[dayOfWeek].open === 'Closed') {
      console.log("Restaurant is closed on this day");
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
    
    console.log(`Returning ${tablesData.length} available tables`);
    
    res.status(200).json({
      success: true,
      tables: tablesData
    });
    
    console.log("=== End get_Available_Tables ===");
  } catch (error) {
    console.error("Error getting available tables:", error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
};

const findBestTable = async (restaurantId, reservationDate, endTime, guests) => {
  try {
    // Get the restaurant with its tables
    const restaurant = await restaurants.findById(restaurantId).populate('tables');
    
    if (!restaurant || !restaurant.tables || restaurant.tables.length === 0) {
      return null;
    }
    
    // Get existing reservations that overlap with the requested time
    const existingReservations = await UserOrder.find({
      restaurant: restaurantId,
      status: { $nin: ['Cancelled'] },
      // Use the standardized overlap condition
      $or: [
        { start_time: { $lt: endTime }, end_time: { $gt: reservationDate } }
      ]
    });
    
    // Create sets of reserved table IDs and numbers
    const reservedTableIds = new Set();
    const reservedTableNumbers = new Set();
    
    existingReservations.forEach(res => {
      if (res.table_Id) { // Changed from tableId to table_Id
        reservedTableIds.add(res.table_Id.toString());
      }
      if (res.tableNumber) {
        reservedTableNumbers.add(res.tableNumber);
      }
    });
    
    // Filter available tables with explicit checks
    const availableTables = restaurant.tables.filter(table => {
      // Skip if already reserved by ID
      if (reservedTableIds.has(table._id.toString())) {
        return false;
      }
      
      // Skip if already reserved by number
      if (table.table_number && reservedTableNumbers.has(table.table_number.toString())) {
        return false;
      }
      
      // Additional check: check table reservations array if it exists
      if (table.reservations && table.reservations.length > 0) {
        const isTableReservedForThisTime = table.reservations.some(res => {
          if (res.status === 'cancelled') return false;
          
          const resStart = new Date(res.start_time);
          const resEnd = new Date(res.end_time);
          
          // Check if this reservation overlaps with the requested time
          return resStart < endTime && resEnd > reservationDate;
        });
        
        if (isTableReservedForThisTime) {
          return false;
        }
      }
      
      // Skip if too small
      if (table.seats < guests) {
        return false;
      }
      
      // Skip if not available
      if (table.status !== 'available') {
        return false;
      }
      
      return true;
    });
    
    if (availableTables.length === 0) {
      return null;
    }
    
    // Find optimal table (closest to party size)
    availableTables.sort((a, b) => {
      // Get the smallest table that fits the party
      if (a.seats >= guests && b.seats >= guests) {
        return a.seats - b.seats;  // Smallest table that fits
      } else if (a.seats >= guests) {
        return -1;  // a fits, b doesn't
      } else if (b.seats >= guests) {
        return 1;   // b fits, a doesn't
      } else {
        return b.seats - a.seats;  // Get largest table if none fit
      }
    });
    
    // Return the best match
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
  console.log("=== Start create_Reservation ===");
  const restaurantId = req.body.restaurant_Id;
  
  // Get table information if provided
  const requestedTableId = req.body.tableId;
  const requestedTableNumber = req.body.tableNumber;
  // Get email info
  let userEmail = req.body.user_email;
  let phone = null;
  let fullName = null;
  
  if (!userEmail && req.body.guestInfo && req.body.guestInfo.user_email) {
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
    // Find the restaurant
    const restaurant = await restaurants.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Calculate reservation date and time
    const reservationDate = date ? 
      calculateReservationDateWithDate(date, time) : 
      calculateReservationDate(day, time);
    
    // Calculate end time (90 minutes per reservation)
    const endTime = new Date(reservationDate);
    endTime.setMinutes(endTime.getMinutes() + 90);

    // Check if restaurant is open
    const isOpen = isRestaurantOpen(restaurant, day, time);
    if (!isOpen) {
      return res.status(400).json({ success: false, message: 'Restaurant is closed at the requested time' });
    }
    
    // Find appropriate table
    let selectedTable = null;
    
    // If a specific table was requested
    if (requestedTableId || requestedTableNumber) {
      // First try to find by ID
      if (requestedTableId) {
        selectedTable = await Table.findById(requestedTableId);
      } 
      // Then try by table number
      else if (requestedTableNumber) {
        selectedTable = await Table.findOne({ 
          restaurant_id: restaurantId,
          table_number: requestedTableNumber
        });
      }
      
      // Verify the table exists and is suitable
      if (!selectedTable) {
        return res.status(404).json({ 
          success: false, 
          message: 'Requested table not found' 
        });
      }
      
      // Verify table is big enough
      if (selectedTable.seats < guests) {
        return res.status(400).json({ 
          success: false, 
          message: 'Selected table is too small for your party size' 
        });
      }
      
      // Verify table is available
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
    // Otherwise find the best available table
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

    // Identify the user (registered or guest)
    let userId;
    let clientName;
    let clientType = "";
    
    // Check for registered user
    let user = await ClientUser.findOne({ 'email': userEmail });
    
    if (user) {
      console.log("Is Client User",user)
      userId = user._id;
      clientName = user.first_name;
      clientType = "ClientUser";
    } else {
      const existingGuest = await ClientGuest.findOne({ 'email': userEmail });
      if (existingGuest) {
        console.log("Is Existing Guest User",existingGuest)
        userId = existingGuest._id;
        clientName = existingGuest.first_name;
        clientType = "ClientGuest";
        
        // Update guest info if provided
        if (phone || fullName) {
          const updateData = {};
          if (phone) updateData.phone_number = phone;
          if (fullName) {
            const nameParts = fullName.split(' ');
            updateData.first_name = nameParts[0];
            updateData.last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
          }
          await ClientGuest.findByIdAndUpdate(existingGuest._id, updateData);
        }
      } else {
        // Create new guest
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

    // Create the reservation with table assignment
    const newOrder = new UserOrder({
      restaurant: restaurantId,
      client_id: userId,
      client_type: clientType,
      guests: guests,
      status: 'Planning',
      start_time: reservationDate,
      end_time: endTime,
      tableId: selectedTable._id,
      tableNumber: selectedTable.table_number
    });

    // Save the reservation
    const savedOrder = await newOrder.save();
    
    // Update restaurant's reservation list
    await restaurants.findByIdAndUpdate(
      restaurantId,
      { $push: { reservation_id: savedOrder._id } }
    );
    
    // Update user's orders list if registered user
    if (clientType === "ClientUser") {
      await ClientUser.findByIdAndUpdate(
        userId,
        { $push: { orders: savedOrder._id } }
      );
    }
    
    // Add reservation to table's reservation list
    await Table.findByIdAndUpdate(
      selectedTable._id,
      { 
        $push: { 
          reservations: {
            reservation_id: savedOrder._id,
            client_id: userId,
            client_type: clientType,
            start_time: reservationDate,
            end_time: endTime,
            guests_count: guests,
            status: 'planning'
          } 
        },
        status: 'reserved'
      }
    );
    
    // Format for email
    const formattedDateStr = reservationDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedStartTime = reservationDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const formattedEndTime = endTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Emit socket event if available
    const io = req.app.get('socketio');
    if (io) {
      io.emit('reservationCreated', {
        newReservation: {
          id: savedOrder._id,
          customer: {
            firstName: clientName,
            email: userEmail,
            phone: phone || '',
            type: clientType
          },
          orderDetails: {
            guests: guests,
            status: 'Planning',
            startTime: reservationDate,
            endTime: endTime,
            tableNumber: selectedTable.table_number
          }
        }
      });
    }
    
    // Send email confirmation
    const emailMessage = `Hello ${clientName},
    
You have a reservation at "${restaurant.res_name}"
for ${guests} guests on ${formattedDateStr}.
Your table is Table ${selectedTable.table_number}.
Time: ${formattedStartTime} to ${formattedEndTime}.

Best regards,
Table Whispers`;

    sendMail(userEmail, emailMessage, 'order_info');
    
    // Return success
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

const checkTableAvailability = async (tableId, startTime, endTime) => {
  try {
    // Find reservations that overlap with this time period using consistent formula
    const overlappingReservations = await UserOrder.find({
      // Fix: Use the correct field name as defined in your schema
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
  console.log("Calculating reservation date from day and time:", day, time);
  
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
  
  // Calculate days until target day
  let daysToAdd = targetDayOfWeek - currentDayOfWeek;
  if (daysToAdd < 0) {
    daysToAdd += 7; // If target day has passed this week, go to next week
  }
  
  // Create new date
  const reservationDate = new Date();
  reservationDate.setDate(today.getDate() + daysToAdd);
  
  // Set time
  const timeObj = parseTimeString(time);
  reservationDate.setHours(timeObj.hours, timeObj.minutes, 0, 0);
  
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
  console.log("Checking if restaurant is open:", day, time);
  
  const dayLower = day.toLowerCase();
  
  // Check if operating hours exist for requested day
  if (!restaurant.open_time || !restaurant.open_time[dayLower]) {
    console.log("No operating hours found for this day");
    return false;
  }
  
  const openTime = restaurant.open_time[dayLower].open;
  const closeTime = restaurant.open_time[dayLower].close;
  
  if (!openTime || !closeTime) {
    console.log("Open or close time not defined");
    return false;
  }
  
  // Convert times to minutes for simple comparison
  const timeToMinutes = (timeStr) => {
    console.log("Parsing time string for comparison:", timeStr);
    
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
    console.log("Time in minutes:", totalMinutes);
    return totalMinutes;
  };
  
  const requestedTimeInMinutes = timeToMinutes(time);
  const openTimeInMinutes = timeToMinutes(openTime);
  const closeTimeInMinutes = timeToMinutes(closeTime);
  
  // Check if requested time is between opening and closing
  const isOpen = requestedTimeInMinutes >= openTimeInMinutes && requestedTimeInMinutes < closeTimeInMinutes;
  console.log("Restaurant is open:", isOpen);
  return isOpen;
};

/**
 * Calculates reservation date with specific date string and time
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} time - Time in format like "7:30 PM"
 * @returns {Date} - Date object with correct date and time
 */
const calculateReservationDateWithDate = (dateString, time) => {
  console.log("Calculating reservation date from date string and time:", dateString, time);
  
  const date = new Date(dateString);
  const timeObj = parseTimeString(time);
  
  date.setHours(timeObj.hours, timeObj.minutes, 0, 0);
  return date;
};

/**
 * Parses time string into hours and minutes
 * @param {string} timeString - Time string in various formats
 * @returns {Object} - Object with hours and minutes
 */
const parseTimeString = (timeString) => {
  console.log("Parsing time string:", timeString);
  
  // Check if the time string is in 12-hour format (contains AM/PM)
  const isPM = timeString.toLowerCase().includes('pm');
  const isAM = timeString.toLowerCase().includes('am');
  
  let hours, minutes;
  
  if (isPM || isAM) {
    // Handle 12-hour format with AM/PM
    // Remove AM/PM and trim any whitespace
    const cleanTimeStr = timeString.toLowerCase()
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
    const [hoursStr, minutesStr] = timeString.split(':');
    hours = parseInt(hoursStr, 10);
    minutes = parseInt(minutesStr, 10);
  }
  
  // Check for valid parsing results
  if (isNaN(hours) || isNaN(minutes)) {
    console.error("Failed to parse time string:", timeString);
    return { hours: 0, minutes: 0 }; // Default to midnight if parsing fails
  }
  
  console.log("Parsed result:", { hours, minutes });
  return { hours, minutes };
};

/**
 * Generates time slots between opening and closing times
 * @param {string} openTime - Opening time
 * @param {string} closeTime - Closing time 
 * @returns {Array} - Array of time slots
 */
const generateTimeSlots = (openTime, closeTime) => {
  console.log("Generating time slots between:", openTime, "and", closeTime);
  
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
  
  console.log("Generated", slots.length, "time slots");
  return slots;
};


const update_Reservation_Status = async (req, res) => {
  console.log("START update_Reservation_Status FUNCTION");
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
        startTime: reservation.start_time,
        endTime: reservation.end_time,
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
      
      console.log('WebSocket: Emitted reservation status change events');
    }

    // Also update the tables with this reservation if applicable
    if (reservation.tableNumber) {
      // Find the table by table number
      const table = await Table.findOne({ 
        table_number: reservation.tableNumber,
        restaurant_id: restaurantId
      });
      
      if (table) {
        console.log(`Found table ${table.table_number} for reservation update`);
        
        // Find the reservation in the table's array and update its status
        const tableReservationIndex = table.reservations.findIndex(
          res => res.reservation_id && res.reservation_id.toString() === reservation_id.toString()
        );
        
        if (tableReservationIndex !== -1) {
          console.log(`Updating table reservation at index ${tableReservationIndex}`);
          
          // Map status from UserOrder to Table reservation status
          const mappedStatus = mapOrderStatusToReservationStatus(status);
          
          // Update client_status (the correct field in the schema)
          table.reservations[tableReservationIndex].client_status = mappedStatus;
          
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
              const hasActiveReservations = table.reservations.some(res => 
                res.reservation_id.toString() !== reservation_id.toString() &&
                res.client_status !== 'cancelled' && 
                res.client_status !== 'done'
              );
              
              // If no other active reservations, mark table as available
              if (!hasActiveReservations) {
                table.table_status = 'available';
              }
            }
          }
          
          await table.save();
          console.log(`Table ${table.table_number} updated with new reservation status: ${mappedStatus}`);
          
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
          console.log(`Reservation ${reservation_id} not found in table's reservations array. Adding it now.`);
          
          // If the reservation wasn't found in the table's array, add it
          const mappedStatus = mapOrderStatusToReservationStatus(status);
          
          // Add the reservation to the table
          table.reservations.push({
            reservation_id: reservation_id,
            client_id: reservation.client_id,
            client_type: reservation.client_type,
            start_time: reservation.start_time,
            end_time: reservation.end_time,
            guests_count: reservation.guests,
            client_status: mappedStatus
          });
          
          // Update table_status based on reservation status
          if (status === 'Seated') {
            table.table_status = 'occupied';
            table.current_reservation = reservation_id;
          } else if (status === 'Planning' || status === 'Confirmed') {
            table.table_status = 'reserved';
          }
          
          await table.save();
          console.log(`Added reservation ${reservation_id} to table ${table.table_number}`);
          
          // Emit table update
          if (io && restaurantId) {
            io.to(`restaurant_${restaurantId}`).emit('reservationAssigned', {
              restaurantId: restaurantId,
              tableId: table._id,
              tableNumber: table.table_number,
              reservation: {
                id: reservation._id,
                guests: reservation.guests,
                start_time: reservation.start_time,
                end_time: reservation.end_time,
                status: status
              },
              timestamp: new Date()
            });
            
            // Also emit a floor layout update
            io.to(`restaurant_${restaurantId}`).emit('floorLayoutUpdated', {
              restaurantId: restaurantId,
              timestamp: new Date(),
              action: 'refresh'
            });
          }
        }
      } else {
        console.log(`Table not found for table number ${reservation.tableNumber} and restaurant ${restaurantId}`);
      }
    } else {
      console.log(`Reservation ${reservation_id} has no table number assigned`);
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

const update_Reservation_Details = async (req, res) => {
  console.log("START update_Reservation_Details FUNCTION");
  
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
    
    // Keep track of previous table number for updates
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
    if (tableNumber !== undefined) {
      reservation.tableNumber = tableNumber;
      updatedFields.tableNumber = tableNumber;
    }
    
    // Save the updated reservation
    await reservation.save();
    
    // Get the restaurant ID
    const restaurantId = restaurant_id || reservation.restaurant?._id?.toString();
    
    // Handle table updates - first update the existing table if there was one
    if (previousTableNumber) {
      // Find the previous table
      const previousTable = await Table.findOne({ 
        table_number: previousTableNumber,
        restaurant_id: restaurantId
      });
      
      if (previousTable) {
        console.log(`Found previous table ${previousTableNumber}`);
        
        // If table number changed, remove the reservation from the previous table
        if (tableNumber !== undefined && tableNumber !== previousTableNumber) {
          console.log(`Table number changed from ${previousTableNumber} to ${tableNumber}`);
          
          // Remove reservation from previous table
          previousTable.reservations = previousTable.reservations.filter(
            res => !res.reservation_id || res.reservation_id.toString() !== reservation_id.toString()
          );
          
          // If this was the current reservation, clear it
          if (previousTable.current_reservation && 
              previousTable.current_reservation.toString() === reservation_id.toString()) {
            previousTable.current_reservation = null;
            
            // Check if there are other active reservations
            const hasActiveReservations = previousTable.reservations.some(res => 
              res.client_status !== 'cancelled' && res.client_status !== 'done'
            );
            
            // If no other active reservations, mark table as available
            if (!hasActiveReservations) {
              previousTable.table_status = 'available';
            }
          }
          
          await previousTable.save();
          console.log(`Removed reservation from previous table ${previousTableNumber}`);
          
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
        // If table didn't change, update the reservation details in the existing table
        else {
          console.log(`Updating reservation details in table ${previousTableNumber}`);
          
          // Find the reservation in the table's array and update its details
          const tableReservationIndex = previousTable.reservations.findIndex(
            res => res.reservation_id && res.reservation_id.toString() === reservation_id.toString()
          );
          
          if (tableReservationIndex !== -1) {
            // Update start and end time if they were changed
            if (updatedFields.start_time) {
              previousTable.reservations[tableReservationIndex].start_time = updatedFields.start_time;
            }
            
            if (updatedFields.end_time) {
              previousTable.reservations[tableReservationIndex].end_time = updatedFields.end_time;
            }
            
            // Update guest count if it was changed
            if (updatedFields.guests) {
              previousTable.reservations[tableReservationIndex].guests_count = updatedFields.guests;
            }
            
            // Ensure client_type is set
            if (!previousTable.reservations[tableReservationIndex].client_type) {
              previousTable.reservations[tableReservationIndex].client_type = reservation.client_type;
            }
            
            await previousTable.save();
            console.log(`Updated reservation details in table ${previousTableNumber}`);
            
            // Emit table update
            if (io && restaurantId) {
              io.to(`restaurant_${restaurantId}`).emit('tableReservationUpdated', {
                tableId: previousTable._id,
                tableNumber: previousTable.table_number,
                reservationId: reservation_id,
                updates: updatedFields
              });
            }
          } else {
            console.log(`Reservation not found in table ${previousTableNumber}`);
            
            // Add reservation to table if not found
            previousTable.reservations.push({
              reservation_id: reservation._id,
              client_id: reservation.client_id,
              client_type: reservation.client_type,
              start_time: reservation.start_time,
              end_time: reservation.end_time,
              guests_count: reservation.guests,
              client_status: mapOrderStatusToReservationStatus(reservation.status)
            });
            
            // Update table status
            if (reservation.status === 'Seated') {
              previousTable.table_status = 'occupied';
              previousTable.current_reservation = reservation._id;
            } else if (reservation.status === 'Planning' || reservation.status === 'Confirmed') {
              previousTable.table_status = 'reserved';
            }
            
            await previousTable.save();
            console.log(`Added reservation to table ${previousTableNumber}`);
            
            // Emit table update
            if (io && restaurantId) {
              io.to(`restaurant_${restaurantId}`).emit('reservationAssigned', {
                restaurantId: restaurantId,
                tableId: previousTable._id,
                tableNumber: previousTable.table_number,
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
      } else {
        console.log(`Previous table ${previousTableNumber} not found`);
      }
    }
    
    // If table number changed, update the new table
    if (tableNumber !== undefined && tableNumber !== previousTableNumber) {
      // Find the new table
      const newTable = await Table.findOne({ 
        table_number: tableNumber,
        restaurant_id: restaurantId
      });
      
      if (newTable) {
        console.log(`Found new table ${tableNumber}`);
        
        // Check if reservation already exists in this table
        const existingReservationIndex = newTable.reservations.findIndex(
          res => res.reservation_id && res.reservation_id.toString() === reservation_id.toString()
        );
        
        if (existingReservationIndex !== -1) {
          // Update the existing reservation
          console.log(`Updating existing reservation in new table ${tableNumber}`);
          
          // Update fields
          newTable.reservations[existingReservationIndex].start_time = reservation.start_time;
          newTable.reservations[existingReservationIndex].end_time = reservation.end_time;
          newTable.reservations[existingReservationIndex].guests_count = reservation.guests;
          newTable.reservations[existingReservationIndex].client_status = 
            mapOrderStatusToReservationStatus(reservation.status);
        } else {
          // Add new reservation
          console.log(`Adding reservation to new table ${tableNumber}`);
          
          newTable.reservations.push({
            reservation_id: reservation._id,
            client_id: reservation.client_id,
            client_type: reservation.client_type,
            start_time: reservation.start_time,
            end_time: reservation.end_time,
            guests_count: reservation.guests,
            client_status: mapOrderStatusToReservationStatus(reservation.status)
          });
        }
        
        // Update table status based on reservation status
        if (reservation.status === 'Seated') {
          newTable.table_status = 'occupied';
          newTable.current_reservation = reservation._id;
        } else if (reservation.status === 'Planning' || reservation.status === 'Confirmed') {
          newTable.table_status = 'reserved';
        }
        
        await newTable.save();
        console.log(`Updated new table ${tableNumber}`);
        
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
      } else {
        console.log(`New table ${tableNumber} not found`);
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
      
      console.log('Emitted real-time update for reservation', reservation_id);
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
    
    console.log("END Update Reservation Details");
    
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
  console.log(`Mapping order status: ${status}`);
  
  const statusMap = {
    'Planning': 'planning',
    'Confirmed': 'confirmed',
    'Seated': 'seated',
    'Done': 'done',
    'Cancelled': 'cancelled'
  };
  
  const result = statusMap[status] || 'planning';
  console.log(`Mapped to: ${result}`);
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
  console.log("Start GET Reservation History");
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
    console.log("End GET Reservation History");
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
  console.log("Start GET Clients Data");
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
    
    console.log(`Found ${allClientIds.length} client IDs from orders`);
    
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
    
    console.log(`Found ${registered_Clients.length} registered clients and ${guestClientIds.length} guest client IDs`);
    
    // Step 6: Find guest clients directly by ID
    const guest_Clients = await ClientGuest.find({
      _id: { $in: guestClientIds }
    });
    
    console.log(`Found ${guest_Clients.length} guest clients in the database by ID`);
    
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
    
    console.log("End GET Clients Data");
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
  console.log("START")
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


// Helper function to calculate new average rating
/*const calculateAverageRating = async (restaurantId, newRating) => {
try {
  const restaurant = await Restaurant.findById(restaurantId)
    .populate('reviews');
  
  const allRatings = restaurant.reviews.map(review => review.rating);
  allRatings.push(newRating);
  
  const averageRating = allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length;
  return parseFloat(averageRating.toFixed(1));
} catch (error) {
  console.error("Error calculating average rating:", error);
  throw error;
}
};*/

// Get reviews for a restaurant
/*const get_Restaurant_Reviews = async (req, res) => {
try {
  const { restaurant_id } = req.params;
  
  const restaurant = await Restaurant.findById(restaurant_id)
    .populate({
      path: 'reviews',
      populate: {
        path: 'user',
        select: 'first_name last_name'
      }
    });

  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: "Restaurant not found"
    });
  }

  res.status(200).json({
    success: true,
    data: restaurant.reviews
  });

} catch (error) {
  console.error("Error in get_Restaurant_Reviews:", error);
  res.status(500).json({
    success: false,
    message: "Error fetching reviews",
    error: error.message
  });
}
};
*/




  
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
  update_Restaurant_Menu
};
  