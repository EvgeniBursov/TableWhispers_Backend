const mongoose = require('mongoose');

const ResUserSchema = new mongoose.Schema({
    email:{
        type: String,
        required: true
    },
    first_name:{
        type: String,
        required: true
    },
    last_name:{
      type: String,
      required: true
    },
    age:{
      type: Number,
      required: true
    },
    phone_number:{
      type: String,
      required: true
    },
    password:{
        type: String,
        required: true
    },
    city:{
        type: String,
        required: true
    },
    restaurant_name:{
        type: String,
        required: true
    },
    user_name:{
      type: String,
      required: false
  },
}, { timestamps: true });

//add photo... 
module.exports = mongoose.model('ResClientUser', ResUserSchema);
