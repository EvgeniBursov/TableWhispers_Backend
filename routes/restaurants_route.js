const express = require('express');
const router = express.Router();

const {all_Restaurants_Data, Restaurants_Reservation, add_New_Reviews,
    check_Availability,create_Reservation, get_Available_Times, update_Reservation_Status,
    update_Reservation_Details,get_Customer_Reservation_History,get_Restaurant_Clients,
    get_Restaurant_Menu, update_Restaurant_Menu, get_all_bills_for_Restaurants,  get_all_bills_for_user,
} = require('../restaurant_data/restaurant_data')



router.get('/all_Restaurants_Data', all_Restaurants_Data);

router.get('/restaurant/:id', all_Restaurants_Data);

router.get('/reservation/restaurant/:id', Restaurants_Reservation);

router.post('/add_New_Reviews/restaurant/:id', add_New_Reviews);

router.get('/check_Availability/reservation/restaurant/:id', check_Availability);

router.get('/get_Available_Times/reservation/restaurant/:id', get_Available_Times);

router.post('/create_Reservation/restaurant/:id', create_Reservation);

router.post('/update_Reservation/restaurant/', update_Reservation_Status);

router.post('/update_Reservation_Details/restaurant/', update_Reservation_Details);

router.get('/get_Customer_Reservation_History/restaurant/', get_Customer_Reservation_History);

router.get('/get_Restaurant_Clients/restaurant/:id', get_Restaurant_Clients);




router.get('/get_Restaurant_Menu/restaurant/:id', get_Restaurant_Menu);

router.post('/update_Restaurant_Menu/restaurant/:id', update_Restaurant_Menu);

router.post('/get_all_bills_for_Restaurants/restaurant/', get_all_bills_for_Restaurants);

router.post('/get_all_bills_for_user/order/:id', get_all_bills_for_user);


module.exports = router;