const restaurants = require('../models/Restarunt')



const all_Restaurants_Data = async (req, res) => {
    try {
      console.log("Start all Restaurants Data")
      const all_Restaurants_Data = await restaurants.find()    
      res.status(200).json({data: all_Restaurants_Data})
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Server error' });
    }
  };
  
  module.exports = {
    all_Restaurants_Data
   };
  