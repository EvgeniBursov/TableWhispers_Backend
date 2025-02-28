const mongoose = require('mongoose');
const reviews = require('./Reviews')
const menu = require('./Menu')


const RestaruntSchema = new mongoose.Schema({
    res_name:{
        type: String,
        required: true
    },
    phone_number:{
      type: String,
      required: true
    },
    city:{
        type: String,
        required: true
    },
    full_address:{
        type: String,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    full_description:{
      type: String,
  },
    main_image: {
        type: String,
        required: false
      },
    all_images: [{
        type: String,
        required: false
      }],
    rating:{
      type: Number
    },
    menu: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuCollection'
  }],
    open_time: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String }
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewSchema'
  }],
  tables:[{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  }],
  reservation_id: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserOrder'
  }],
}, { timestamps: true });


module.exports = mongoose.model('RestaruntSchema', RestaruntSchema);
