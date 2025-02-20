const express = require('express');
const router = express.Router();

const {all_Restaurants_Data} = require('../restaurant_data/restaurant_data')



router.get('/all_Restaurants_Data', all_Restaurants_Data);

router.get('/restaurant/:id', all_Restaurants_Data);     





module.exports = router;