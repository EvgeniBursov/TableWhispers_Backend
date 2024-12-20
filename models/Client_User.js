const mongoose = require('mongoose');

const ClientUserSchema = new mongoose.Schema({
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
    twoFa:{
      type: String,
      required: false
  },
}, { timestamps: true });

//add photo... 
module.exports = mongoose.model('ClientUser', ClientUserSchema);
