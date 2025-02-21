const express = require('express');
const router = express.Router();

const {all_Restaurants_Data, Restaurants_Reservation, add_New_Reviews} = require('../restaurant_data/restaurant_data')



router.get('/all_Restaurants_Data', all_Restaurants_Data);

router.get('/restaurant/:id', all_Restaurants_Data);

router.get('/reservation/restaurant/:id', Restaurants_Reservation);

router.post('/add_New_Reviews/restaurant/:id', add_New_Reviews);









module.exports = router;