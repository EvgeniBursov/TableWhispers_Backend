const express = require('express');
const router = express.Router();

const {all_Restaurants_Data, Restaurants_Reservation, add_New_Reviews,
    check_Availability,create_Reservation, get_Available_Times } = require('../restaurant_data/restaurant_data')



router.get('/all_Restaurants_Data', all_Restaurants_Data);

router.get('/restaurant/:id', all_Restaurants_Data);

router.get('/reservation/restaurant/:id', Restaurants_Reservation);

router.post('/add_New_Reviews/restaurant/:id', add_New_Reviews);

router.get('/check_Availability/reservation/restaurant/:id', check_Availability);

router.get('/get_Available_Times/reservation/restaurant/:id', get_Available_Times);


router.post('/create_Reservation/restaurant/:id', create_Reservation);




module.exports = router;