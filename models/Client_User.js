const mongoose = require('mongoose');
const UserOrder = require('./User_Order')
const allergies = require('./Allergies')


const ClientUserSchema = new mongoose.Schema({
  user_type: {
    type: String,
    required: true
  },
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
    required: false
  },
  password: {
    type: String,
    required: true
  },
  allergies: [{            
    type: mongoose.Schema.Types.ObjectId,
    ref: 'allergies'
  }],
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserOrder', // Reference the UserOrder model
  }],
  totpSecret: String,
  profileImage: {
    type: String,
  }

}, { timestamps: true });
module.exports = mongoose.model('ClientUser', ClientUserSchema);

