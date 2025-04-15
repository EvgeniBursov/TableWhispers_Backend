const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserOrder'
    },
    sender_type: {
        type: String,
        enum: ['restaurant', 'customer'],
        required: true
    },
    restaurant_sender_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RestaruntSchema',
        required: function() {
            return this.sender_type === 'restaurant';
        }
    },
    user_sender_email: {
        type: String,
        required: function() {
            return this.sender_type === 'customer';
        }
    },
    sender_name: {
        type: String
    },
    recipient_type: {
        type: String,
        enum: ['restaurant', 'customer'],
        required: true
    },
    restaurant_recipient_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RestaruntSchema',
        required: function() {
            return this.recipient_type === 'restaurant';
        }
    },
    user_recipient_email: {
        type: String,
        required: function() {
            return this.recipient_type === 'customer';
        }
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    read: {
        type: Boolean,
        default: false
    },
});

chatMessageSchema.index({ order_id: 1 });
chatMessageSchema.index({ sender_type: 1, restaurant_sender_id: 1 });
chatMessageSchema.index({ sender_type: 1, user_sender_email: 1 });
chatMessageSchema.index({ recipient_type: 1, restaurant_recipient_id: 1 });
chatMessageSchema.index({ recipient_type: 1, user_recipient_email: 1 });
chatMessageSchema.index({ timestamp: -1 });
chatMessageSchema.index({ read: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);