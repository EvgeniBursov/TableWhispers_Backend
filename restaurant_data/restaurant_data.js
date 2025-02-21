const restaurants = require('../models/Restarunt')
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const Allergies = require('../models/Allergies');




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
  console.log("Start add New Reviews");
  const restaurant_Id = req.body.restaurant_Id;
  const user_Id = req.body.user_Id;
  const review_string = req.body.review;
  const rating = req.body.rating;

};


  
  module.exports = {
    all_Restaurants_Data,
    Restaurants_Reservation,
    add_New_Reviews,
   };
  