const mongoose = require('mongoose');

const ClientGuestSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone_number: {
    type: String,
    required: true
  },
  user_type: {
    type: String,
    default: 'CLIENT'
  },
});

module.exports = mongoose.model('ClientGuest', ClientGuestSchema);