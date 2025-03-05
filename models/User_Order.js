const mongoose = require('mongoose');
const RestaruntSchema = require('./Restarunt')

const userOderSchema = new mongoose.Schema({

  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RestaruntSchema', 
    required: true
  },
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientUser', 
    required: true
  },
  guests:{
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Planning', 'Done','Cancelled','Seated'], 
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  start_time: {
    type: Date,
  },
  end_time: {
    type: Date,
  },
});

module.exports = mongoose.model('UserOrder', userOderSchema);


