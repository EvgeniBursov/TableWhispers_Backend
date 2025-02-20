const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'ClientUser', 
        required: true 
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});



module.exports = mongoose.model('ReviewSchema', ReviewSchema);
