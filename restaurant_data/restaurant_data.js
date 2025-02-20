const restaurants = require('../models/Restarunt')

const all_Restaurants_Data = async (req, res) => {
  const restaurantId = req.params.id; // שימוש ב-params במקום ב-body


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
          select: 'first_name last_name' // Select only necessary user fields
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



  
  module.exports = {
    all_Restaurants_Data
   };
  