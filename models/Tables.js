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
  status: {
    type: String,
    enum: ['Available', 'Reserved', 'Occupied', 'Maintenance'],
    default: 'Available'
  },
  /*shape: {
    type: String,
    enum: ['round', 'rectangle'],
    required: true
  },
  size: {
    type: Number, // לשולחנות עגולים
  },
  width: {
    type: Number, // לשולחנות מלבניים
  },
  height: {
    type: Number, // לשולחנות מלבניים
  },
  coordinates: {
    x: {
      type: Number,
      required: true
    },
    y: {
      type: Number,
      required: true
    }
  },
  location: {
    type: String,
    enum: ['Indoor', 'Outdoor', 'Bar'],
    required: true
  },
  section: {
    type: String,
    default: 'Main'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Maintenance'],
    default: 'Active'
  }*/
});
TableSchema.index({ restaurant_id: 1, table_number: 1 }, { unique: true });
module.exports = mongoose.model('Table', TableSchema);