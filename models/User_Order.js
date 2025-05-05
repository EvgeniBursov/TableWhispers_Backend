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
  client_type: {
    type: String,
    enum: ['ClientUser', 'ClientGuest'],
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
  table_Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  tableNumber: {
    type: String
  }
});

module.exports = mongoose.model('UserOrder', userOderSchema);
userOderSchema.index({ table_Id: 1, status: 1 });
userOderSchema.index({ tableNumber: 1, status: 1 });
userOderSchema.index({ restaurant: 1, start_time: 1, end_time: 1, status: 1 });


