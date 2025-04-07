const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  restaurant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RestaruntSchema',
    required: true
  },
  table_number: {
    type: String,
    required: true
  },
  seats: {
    type: Number,
    required: true
  },
  shape: {
    type: String,
    enum: ['round', 'rectangle', 'square'],
    required: true
  },
  size: {
    type: Number, 
  },
  width: {
    type: Number, 
  },
  height: {
    type: Number,
  },
  x_position: {
    type: Number,
    required: true,
    default: 0
  },
  y_position: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied', 'maintenance', 'inactive'],
    default: 'available'
  },
  section: {
    type: String,
    default: 'main'
  },
  current_reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserOrder',
    default: null
  },
  reservations: [{
    reservation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserOrder'
    },
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'client_type'
    },
    client_type: {
      type: String,
      enum: ['ClientUser', 'ClientGuest'],
      required: true
    },
    start_time: {
      type: Date,
      required: true
    },
    end_time: {
      type: Date,
      required: true
    },
    guests_count: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['planning', 'confirmed', 'seated', 'done', 'cancelled'],
      default: 'planning'
    },
    notes: String
  }]
}, { timestamps: true });

TableSchema.index({ restaurant_id: 1, table_number: 1 }, { unique: true });

module.exports = mongoose.model('Table', TableSchema);