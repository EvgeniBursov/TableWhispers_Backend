const mongoose = require('mongoose');

const userOderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
  },
  items: {
    type: [String], // רשימת פריטים שהוזמנו
    required: true,
  },
  totalAmount: {
    type: Number, // סכום כולל להזמנה
    required: true,
  },
  status: {
    type: String,
    enum: ['Planing', 'Done'], // סטטוס ההזמנה: חדשה או ישנה
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now, // תאריך יצירת ההזמנה
  },
});

module.exports = mongoose.model('UserOrder', userOderSchema);