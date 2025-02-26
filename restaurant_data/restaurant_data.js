const restaurants = require('../models/Restarunt')
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const ClientGuest = require('../models/ClientGuest');
const Allergies = require('../models/Allergies');
const tables = require('../models/Tables')
const {sendMail} = require('../messages/email_message')

const Review = require('../models/Reviews');

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
      res.status(200).json(restaurantData); // שולח את המידע ישירות
    } catch (error) {
      console.error("Error fetching restaurant by ID:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    try {
      console.log("Fetching all Restaurants Data");
      const allRestaurantsData = await restaurants.find();
      res.status(200).json(allRestaurantsData); // שולח את המערך ישירות
    } catch (error) {
      console.error("Error fetching all restaurants:", error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};


const Restaurants_Reservation = async (req, res) => {
  console.log("Start Restaurants_Reservation");

  const restaurantId = req.body.id;
  if (!restaurantId) {
    return res.status(400).json({ error: 'Restaurant ID is undefined' });
  }

  try {
    const restaurant = await restaurants.findById(restaurantId)
      .populate({
        path: 'reservation_id', // משתמשים בשם השדה הנכון מהמודל
        populate: [{
          path: 'client_id',
          model: 'ClientUser',
          select: 'first_name last_name email phone_number allergies',
          populate: {
            path: 'allergies',
            model: 'allergies',
            select: 'name severity'
          }
        }]
      })
      .select('res_name phone_number city full_address description rating reservation_id tables')
      .lean();

    if (!restaurant) {
      return res.status(404).json({ 
        success: false,
        message: 'Restaurant not found'
      });
    }

    // בדיקה שיש הזמנות
    const reservations = restaurant.reservation_id || [];

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
      reservations: reservations.map(reservation => ({
        id: reservation._id,
        orderDetails: {
          guests: reservation.guests,
          status: reservation.status,
          orderDate: reservation.orderDate,
          startTime: reservation.start_time,
          endTime: reservation.end_time
        },
        customer: reservation.client_id ? {
          id: reservation.client_id._id,
          firstName: reservation.client_id.first_name,
          lastName: reservation.client_id.last_name,
          email: reservation.client_id.email,
          phone: reservation.client_id.phone_number,
          allergies: reservation.client_id.allergies?.map(allergy => ({
            name: allergy.name,
            severity: allergy.severity
          })) || []
        } : null
      }))
    };

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


const check_Availability =  async (req, res) => {
  console.log("Start check Availability");
  const req_restaurant_Id = req.body.restaurant_Id;
  const date_check = req.body.date_to_check;
  const guests  = req.body.guests;
  const time   = req.body.time;
  console.log(req_restaurant_Id,date_check,guests,time);
 try{
  const [hours, minutes] = time.split(':').map(Number);
  const requested_Date = new Date(date_check);
  requested_Date.setHours(hours, minutes, 0, 0);

  console.log(hours,minutes,requested_Date);

  const end_Date_Time = new Date(requested_Date);
  end_Date_Time.setHours(end_Date_Time.getHours() + 2);

  console.log("end_Date_Time",end_Date_Time);


  const restaurant = await restaurants.findById(req_restaurant_Id);
  if (!restaurant) {
    return res.status(404).json({ error: 'Res Not found' });
  }

  const existingReservations = await UserOrder.find({
    restaurant: req_restaurant_Id,
    status: { $in: ['Planing', 'Confirmed'] },
    /*$or: [
      // הזמנות שמתחילות לפני ומסתיימות אחרי הזמן המבוקש
      { start_time: { $lte: requested_Date }, end_time: { $gte: requested_Date } },
      // הזמנות שמתחילות בתוך טווח הזמן המבוקש
      { start_time: { $gte: requested_Date, $lt: end_Date_Time } },
      // הזמנות שמסתיימות בתוך טווח הזמן המבוקש
      { end_time: { $gt: requested_Date, $lte: end_Date_Time } }
    ]*/
  });
  console.log("existingReservations",existingReservations)

  const occupiedTableIds = new Set();
  existingReservations.forEach(reservation => {
    // אם יש שדה tables במודל UserOrder, נשתמש בו, אחרת נניח שיש table_id
    if (reservation.tables && reservation.tables.length) {
      reservation.tables.forEach(tableId => occupiedTableIds.add(tableId));
    } else if (reservation.table_id) {
      occupiedTableIds.add(reservation.table_id);
    }
  });
  console.log("occupiedTableIds",occupiedTableIds)

  const availableTables = restaurant.tables.filter(table => {
    return !occupiedTableIds.has(table.tableNumber) && table.seats >= guests;
  });

  console.log("availableTables",availableTables)
  
  // אם יש שולחנות פנויים בזמן המבוקש
  if (availableTables.length > 0) {
    return res.status(200).json({
      available: true,
      requestedTime: time,
      tables: availableTables,
      message: 'נמצאו שולחנות פנויים בזמן המבוקש'
    });
  }
    const alternativeSlots = await findAlternativeTimes(
      req_restaurant_Id,
      requested_Date,
      time,
      guests,
      restaurant.open_time
    );
    console.log("alternativeSlots",alternativeSlots)
    console.log(req_restaurant_Id,
    requested_Date,
    time,
    guests,
    restaurant.open_time)
    
    return res.status(200).json({
      available: false,
      requestedTime: time,
      alternativeSlots,
      message: 'אין שולחנות פנויים בזמן המבוקש, אך נמצאו אפשרויות חלופיות'
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return res.status(500).json({ 
      message: 'שגיאה בבדיקת זמינות',
      error: error.message
    });
  }
};

/**
 * פונקציה למציאת שעות חלופיות בהן יש שולחנות פנויים
 * @param {String} restaurantId - מזהה המסעדה
 * @param {String} date - תאריך מבוקש
 * @param {String} requestedTime - שעה מבוקשת
 * @param {Number} guests - מספר אורחים
 * @param {Object} openingHours - שעות פתיחה של המסעדה
 * @returns {Array} מערך של שעות חלופיות
 */
async function findAlternativeTimes(restaurantId, date, requestedTime, guests, openingHours) {
  // המרת השעה המבוקשת למספרים
  const [reqHours, reqMinutes] = requestedTime.split(':').map(Number);
  const requestedMinutes = reqHours * 60 + reqMinutes;
  console.log("reqHours",reqHours)
  console.log("reqMinutes",reqMinutes)
  console.log("requestedMinutes",requestedMinutes)
  
  // זיהוי היום בשבוע
  const dayOfWeek = new Date(date).getDay();
  const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = daysMap[dayOfWeek];
  console.log("dayOfWeek",dayOfWeek)
  console.log("daysMap",daysMap)
  console.log("dayName",dayName)
  
  
  // יצירת מערך של שעות אפשריות לבדיקה (30 דקות קדימה ואחורה בקפיצות של 30 דקות)
  const timesToCheck = [];
  
  // בדיקה החל מ 90 דקות לפני עד 90 דקות אחרי בקפיצות של 30 דקות
  for (let offsetMinutes = -90; offsetMinutes <= 90; offsetMinutes += 30) {
    // דילוג על השעה המקורית שכבר נבדקה
    if (offsetMinutes === 0) continue;
    
    const alternativeMinutes = requestedMinutes + offsetMinutes;
    
    // וידוא שהשעה החלופית היא בתוך שעות הפעילות
    if (alternativeMinutes >= openingMinutes && alternativeMinutes <= closingMinutes - 120) { // 120 דקות לפני סגירה
      const alternativeHours = Math.floor(alternativeMinutes / 60);
      const alternativeMinutesRemainder = alternativeMinutes % 60;
      
      const formattedTime = `${alternativeHours.toString().padStart(2, '0')}:${alternativeMinutesRemainder.toString().padStart(2, '0')}`;
      
      timesToCheck.push({
        time: formattedTime,
        offset: offsetMinutes
      });
    }
  }
  
  // מיון האפשרויות לפי קרבה לשעה המקורית
  timesToCheck.sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset));
  
  // בדיקת זמינות עבור כל אחת מהשעות החלופיות
  const alternativeResults = [];
  
  for (const timeOption of timesToCheck) {
    const [hours, minutes] = timeOption.time.split(':').map(Number);
    const alternativeDateTime = new Date(date);
    alternativeDateTime.setHours(hours, minutes, 0, 0);
    
    const endDateTime = new Date(alternativeDateTime);
    endDateTime.setHours(endDateTime.getHours() + 2);
    
    // בדיקת הזמנות קיימות בזמן החלופי
    const existingReservations = await UserOrder.find({
      restaurant: restaurantId,
      status: { $in: ['Planing', 'Confirmed'] },
      /*$or: [
        { start_time: { $lte: alternativeDateTime }, end_time: { $gte: alternativeDateTime } },
        { start_time: { $gte: alternativeDateTime, $lt: endDateTime } },
        { end_time: { $gt: alternativeDateTime, $lte: endDateTime } }
      ]*/
    });
    
    // רשימת שולחנות תפוסים
    const occupiedTableIds = new Set();
    existingReservations.forEach(reservation => {
      if (reservation.tables && reservation.tables.length) {
        reservation.tables.forEach(tableId => occupiedTableIds.add(tableId));
      } else if (reservation.table_id) {
        occupiedTableIds.add(reservation.table_id);
      }
    });
    
    // חיפוש מסעדה כדי לקבל רשימת שולחנות
    const restaurant = await Restaurant.findById(restaurantId);
    
    // חיפוש שולחנות פנויים
    const availableTables = restaurant.tables.filter(table => {
      return !occupiedTableIds.has(table.tableNumber) && table.seats >= guests;
    });
    
    if (availableTables.length > 0) {
      alternativeResults.push({
        time: timeOption.time,
        offset: timeOption.offset > 0 ? `+${timeOption.offset / 60} שעות` : `${timeOption.offset / 60} שעות`,
        tables: availableTables
      });
      
      // נחזיר רק עד 3 אפשרויות חלופיות
      if (alternativeResults.length >= 3) {
        break;
      }
    }
  }
  
  return alternativeResults;
}



const create_Reservation = async (req, res) => {
  console.log("Start add New Reservation");
  const req_restaurant_Id = req.body.restaurant_Id;
  const user_email = req.body.user_email || req.body.guestInfo.user_email;
  const time = req.body.time;
  const day = req.body.day;
  const guests = req.body.guests;
  const phone = req.body.guestInfo.phone_number;
  const full_name = req.body.guestInfo.full_name;

  console.log(req.body)

  try {
    // Find the restaurant
    const restaurant = await restaurants.findById(req_restaurant_Id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Find the user
    const user = await ClientUser.findOne({ 'email': user_email });
    if (!user) {
      const nameParts = full_name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const new_guest_user = new ClientGuest({
        first_name: firstName,
        last_name: lastName,
        email: user_email,
        phone_number: phone,
      });
      var saved_guest = await new_guest_user.save();

      //return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Calculate reservation date and time
    const reservation_Date = calculateReservationDate(day, time);
    
    // Calculate end time (assuming 90 minutes per reservation)
    const end_Time = new Date(reservation_Date);
    end_Time.setMinutes(end_Time.getMinutes() + 90);

    // Check if restaurant is open
    if (!isRestaurantOpen(restaurant, day, time)) {
      return res.status(400).json({ success: false, message: 'Restaurant is closed at the requested time' });
    }
    if(user){
      var user_id = user._id
      var client_name = user.first_name
    }else{
      var user_id = saved_guest._id
      var client_name =  saved_guest.first_name
    }
    const newOrder = new UserOrder({
      restaurant: req_restaurant_Id,
      client_id: user_id,
      guests: guests,
      status: 'Planning',  // Initial status
      start_time: reservation_Date,
      end_time: end_Time
    });
    
    // Save the order
    const savedOrder = await newOrder.save();
    
    // Update restaurant's reservation list using findByIdAndUpdate
    await restaurants.findByIdAndUpdate(
      req_restaurant_Id,
      { $push: { reservation_id: savedOrder._id } }
    );
    
    // Update user's orders list using findByIdAndUpdate
    if(user){
      await ClientUser.findByIdAndUpdate(
        user._id,
        { $push: { orders: savedOrder._id } }
      );
    }
    
    console.log("Reservation created successfully");

    const formattedDate = reservation_Date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedStartTime = reservation_Date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const formattedEndTime = end_Time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    
    const email_Message = 
    `Hello ${client_name}, you ordered in restaurant "${restaurant.res_name}" 
    for ${guests} guests on ${formattedDate} and time. Your table is from ${formattedStartTime} 
    until ${formattedEndTime}. Best luck from Table Whispers`;
    
    sendMail(user_email,email_Message,'order_info')
    return res.status(200).json({
      success: true,
      message: "Reservation created successfully",
      reservation: savedOrder
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Reservation error: ${error.message}`
    });
  }
};


const calculateReservationDate = (day, time) => {
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
  const [hours, minutes] = time.split(':').map(Number);
  reservationDate.setHours(hours, minutes, 0, 0);
  
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
  const dayLower = day.toLowerCase();
  
  // Check if operating hours exist for requested day
  if (!restaurant.open_time || !restaurant.open_time[dayLower]) {
    return false;
  }
  
  const openTime = restaurant.open_time[dayLower].open;
  const closeTime = restaurant.open_time[dayLower].close;
  
  if (!openTime || !closeTime) {
    return false;
  }
  
  // Convert times to minutes for simple comparison
  const timeToMinutes = (timeStr) => {
    console.log("Original time string:", timeStr);
    
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
    
    console.log("Parsed hours:", hours, "minutes:", minutes);
    
    // Check for valid parsing results
    if (isNaN(hours) || isNaN(minutes)) {
      console.error("Failed to parse time string:", timeStr);
      return 0; // Default to midnight if parsing fails
    }
    
    return hours * 60 + minutes;
  };
  
  
  const requestedTimeInMinutes = timeToMinutes(time);
  const openTimeInMinutes = timeToMinutes(openTime);
  const closeTimeInMinutes = timeToMinutes(closeTime);
  //console.log(requestedTimeInMinutes,openTimeInMinutes,closeTimeInMinutes)
  
  // Check if requested time is between opening and closing
  return requestedTimeInMinutes >= openTimeInMinutes && requestedTimeInMinutes < closeTimeInMinutes;
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
    create_Reservation

   };
  