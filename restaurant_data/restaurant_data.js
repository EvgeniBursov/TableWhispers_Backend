const restaurants = require('../models/Restarunt')
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const ClientGuest = require('../models/ClientGuest');
const Allergies = require('../models/Allergies');
const tables = require('../models/Tables')
const Review = require('../models/Reviews');

const {sendMail} = require('../messages/email_message')


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
            userType: 'registered'
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
 * Creates a new reservation
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const create_Reservation = async (req, res) => {
  console.log("=== Start create_Reservation ===");
  const restaurantId = req.body.restaurant_Id;
  
  // Get email - prioritize user_email field first, then from guestInfo if available
  let userEmail = req.body.user_email;
  let phone = null;
  let fullName = null;
  
  // If userEmail not directly provided, check if it's in guestInfo
  if (!userEmail && req.body.guestInfo && req.body.guestInfo.user_email) {
    userEmail = req.body.guestInfo.user_email;
    phone = req.body.guestInfo.phone_number;
    fullName = req.body.guestInfo.full_name;
  }
  
  if (!userEmail) {
    console.log("Email missing from request");
    return res.status(400).json({ success: false, message: 'Email is required for reservation' });
  }
  
  const time = req.body.time;
  const day = req.body.day;
  const guests = req.body.guests;
  const date = req.body.date; // Date from request

  console.log("Reservation request details:", { 
    restaurantId,
    userEmail,
    time,
    day,
    guests,
    date
  });

  try {
    // Find the restaurant
    console.log("Finding restaurant:", restaurantId);
    const restaurant = await restaurants.findById(restaurantId);
    if (!restaurant) {
      console.log("Restaurant not found");
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Calculate reservation date and time
    const reservationDate = date ? 
      calculateReservationDateWithDate(date, time) : 
      calculateReservationDate(day, time);
    
    console.log("Calculated reservation date:", reservationDate);
    
    // Calculate end time (assuming 90 minutes per reservation)
    const endTime = new Date(reservationDate);
    endTime.setMinutes(endTime.getMinutes() + 90);
    console.log("Reservation end time:", endTime);

    // Check if restaurant is open
    const isOpen = isRestaurantOpen(restaurant, day, time);
    console.log("Restaurant is open at requested time:", isOpen);
    
    if (!isOpen) {
      return res.status(400).json({ success: false, message: 'Restaurant is closed at the requested time' });
    }
    
    // Check table availability
    console.log("Checking table availability...");
    const formattedDate = reservationDate.toISOString().split('T')[0];
    const availabilityCheck = await check_Availability(
      restaurantId,
      formattedDate,
      time,
      parseInt(guests)
    );
    
    console.log("Availability check result:", availabilityCheck);
    
    if (!availabilityCheck.success || availabilityCheck.availableTables <= 0) {
      console.log("No tables available at requested time");
      return res.status(400).json({ 
        success: false, 
        message: 'No tables available at this time for your party size. Please select another time.'
      });
    }

    console.log("Tables are available, proceeding with reservation");

    // STEP 1: Check if email exists in registered users
    console.log("Looking for user with email:", userEmail);
    let user = await ClientUser.findOne({ 'email': userEmail });
    let userId;
    let clientName;
    let isRegisteredUser = false;
    
    if (user) {
      // Email belongs to a registered user
      console.log("Found registered user");
      userId = user._id;
      clientName = user.first_name;
      isRegisteredUser = true;
    } else {
      // STEP 2: Check if email exists in guest database
      console.log("Checking guest database for email:", userEmail);
      const existingGuest = await ClientGuest.findOne({ 'email': userEmail });
      
      if (existingGuest) {
        // Email exists in guest database, use existing info
        console.log("Found existing guest");
        userId = existingGuest._id;
        clientName = existingGuest.first_name;
        
        // Update guest information if provided
        if (phone || fullName) {
          console.log("Updating guest information");
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
        // STEP 3: Create new guest user if no existing record found
        console.log("Creating new guest user");
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
        console.log("New guest created with ID:", userId);
      }
    }

    // Create new order
    console.log("Creating new reservation order");
    const newOrder = new UserOrder({
      restaurant: restaurantId,
      client_id: userId,
      guests: guests,
      status: 'Planning',  // Initial status
      start_time: reservationDate,
      end_time: endTime
    });
    
    // Save the order
    const savedOrder = await newOrder.save();
    console.log("Order saved with ID:", savedOrder._id);
    
    // Update restaurant's reservation list
    console.log("Updating restaurant's reservation list");
    await restaurants.findByIdAndUpdate(
      restaurantId,
      { $push: { reservation_id: savedOrder._id } }
    );
    
    // Update user's orders list only if it's a registered user
    if (isRegisteredUser) {
      console.log("Updating user's orders list");
      await ClientUser.findByIdAndUpdate(
        userId,
        { $push: { orders: savedOrder._id } }
      );
    }
    
    console.log("Reservation created successfully");

    // Format dates for email
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
    
    const io = req.app.get('socketio');

    // Format the new reservation for the frontend
    const formattedReservation = {
      id: savedOrder._id,
      customer: {
        firstName: clientName || 'Guest',
        lastName: '',
        email: userEmail || '',
        phone: phone || ''
      },
      orderDetails: {
        guests: guests,
        status: 'Planning',
        startTime: reservationDate,
        endTime: endTime
      }
    };

    // Emit the creation event to all connected clients if Socket.IO is available
    if (io) {
      io.emit('reservationCreated', {
        newReservation: formattedReservation
      });
      console.log('WebSocket: Emitted reservationCreated event');
    }
    // Create and send email confirmation
    console.log("Sending confirmation email to:", userEmail);
    const emailMessage = `Hello ${clientName},\nyou ordered in restaurant "${restaurant.res_name}"\nfor ${guests} guests on ${formattedDateStr},\nyour table is from ${formattedStartTime} until ${formattedEndTime}.\nBest luck from Table Whispers`;
    sendMail(userEmail, emailMessage, 'order_info');
    
    console.log("=== End create_Reservation ===");
    return res.status(200).json({
      success: true,
      message: "Reservation created successfully",
      reservation: savedOrder
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
  console.log("Start Update Reservation Status");
  const user_id = req.body.user_id;
  const reservation_id = req.body.reservation_id;
  const status = req.body.status;
  
  try {
    // Find and update the reservation
    const reservation = await UserOrder.findOneAndUpdate(
      { _id: reservation_id }, 
      { status: status }, 
      { new: true } // Return updated document
    ).populate('client_id', 'firstName lastName email phone');

    if (!reservation) {
      return res.status(404).json({ 
        success: false,
        message: 'Reservation not found'
      });
    }

    // Get the Socket.IO instance if available
    const io = req.app.get('socketio');
    
    // Format the reservation for the frontend
    const formattedReservation = {
      id: reservation._id,
      customer: {
        firstName: reservation.client_id?.firstName || 'Guest',
        lastName: reservation.client_id?.lastName || '',
        email: reservation.client_id?.email || '',
        phone: reservation.client_id?.phone || ''
      },
      orderDetails: {
        guests: reservation.guests,
        status: reservation.status,
        startTime: reservation.start_time,
        endTime: reservation.end_time
      }
    };
    
    // Emit the update event to all connected clients if Socket.IO is available
    if (io) {
      io.emit('reservationUpdated', {
        reservationId: reservation_id,
        newStatus: status,
        updatedReservation: formattedReservation
      });
      console.log('WebSocket: Emitted reservationUpdated event');
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
  console.log("Start Update Reservation Details");
  
  // Extract data from request body
  const reservation_id = req.body.reservation_id;
  const new_date = req.body.date;
  const new_time = req.body.time;
  const new_guests = req.body.guests;
  const io = req.app.get('io'); // Get Socket.io instance from app
  
  try {
    // Find the reservation by ID
    const reservation = await UserOrder.findById(reservation_id);
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reservation not found',
        message: 'The requested reservation does not exist'
      });
    }
    
    // Track what fields are updated
    const updatedFields = {};
    
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
    
    // Save the updated reservation
    await reservation.save();
    
    // Emit real-time update via Socket.io
    if (io) {
      io.emit('reservationUpdated', {
        reservationId: reservation_id,
        updatedFields: {
          startTime: reservation.start_time,
          endTime: reservation.end_time,
          guests: reservation.guests,
          orderDate: reservation.orderDate
        }
      });
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
        orderDate: reservation.orderDate
      }
    });
    
    console.log("End Update Reservation Details");
    
  } catch (error) {
    console.error("Error updating reservation details:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to update reservation details',
      message: error.message
    });
  }
};


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
  get_Restaurant_Clients
};
  