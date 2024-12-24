const mongoose = require('mongoose');
const UserOrder = require('./User_Order')

const ClientUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  phone_number: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  twoFa: {
    type: String,
    required: false
  },
  allergies: {
    type: String,
    required: false
  },
  orders: {
    type: [UserOrder], // מערך של הזמנות
    default: [],
    required: false
  }

}, { timestamps: true });

//add photo... 
//כ, תמונת פרופיל, מספר טלפון הזמנות עתידיות, הזמנות קודמות

module.exports = mongoose.model('ClientUser', ClientUserSchema);

