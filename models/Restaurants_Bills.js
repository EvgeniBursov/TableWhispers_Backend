const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true }
});

const restaurantBillSchema = new mongoose.Schema({
  order_id: { 
   type: mongoose.Schema.Types.ObjectId,
   ref: 'UserOrder',
   },
  orders_items: [itemSchema],
  total_Price: {
    type: Number, required: true 
  },
  date: { 
    type: Date, default: Date.now 
  }
});

restaurantBillSchema.pre('save', function(next) {
  this.total_Price = this.orders_items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
  next();
});

module.exports = mongoose.model('RestaurantsBills', restaurantBillSchema);