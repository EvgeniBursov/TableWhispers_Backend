const express = require('express');
const router = express.Router();

const ChatSystem = require('../MessageSystem/ChatSystem');

// Get chat history between restaurant and customer for a specific order
router.get('/chat_history/:orderId/:customerEmail', ChatSystem.get_chat_history);

// Get all chats for a restaurant
router.get('/restaurant_chats/:restaurantId', ChatSystem.get_restaurant_chats);

// Get all chats for a customer
router.get('/customer_chats/:customerEmail', ChatSystem.get_customer_chats);

// Send a message (REST fallback for Socket.IO)
router.post('/send_message', ChatSystem.save_message);

// Mark message as read (REST fallback for Socket.IO)
router.post('/mark_message_read/:messageId', ChatSystem.mark_message_as_read);

// Delete a chat conversation
router.delete('/delete_chat/:orderId/:customerEmail', ChatSystem.delete_chat);

// Get unread message count
router.get('/unread_count/:type/:id', ChatSystem.get_unread_count);

module.exports = router;