const mongoose = require('mongoose');

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
    description:{
        type: String,
        required: true
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
}, { timestamps: true });


module.exports = mongoose.model('RestaruntSchema', RestaruntSchema);
