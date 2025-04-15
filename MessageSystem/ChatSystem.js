const mongoose = require('mongoose');
const ChatMessage = require('../models/Chat_Schema');
const Restaurant = require('../models/Restarunt');
const ClientUser = require('../models/Client_User');
const UserOrder = require('../models/User_Order');

/**
 * Get chat history between a restaurant and a customer for a specific order
 */
const get_chat_history = async (req, res) => {
    try {
        const { orderId, customerEmail } = req.params;
        const { page = 1, limit = 50 } = req.query;
        
        console.log(`Getting chat history for order ${orderId} and customer ${customerEmail}`);
        
        // Validate parameters
        if (!orderId || !customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and customer email are required'
            });
        }
        
        // Convert page and limit to numbers
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        // Find messages related to this order and customer
        const messages = await ChatMessage.find({
            order_id: orderId,
            $or: [
                { 
                    sender_type: 'restaurant',
                    recipient_type: 'customer',
                    user_recipient_email: customerEmail 
                },
                { 
                    sender_type: 'customer',
                    user_sender_email: customerEmail,
                    recipient_type: 'restaurant'
                }
            ]
        })
        .sort({ timestamp: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
        
        // Get total count for pagination
        const totalMessages = await ChatMessage.countDocuments({
            order_id: orderId,
            $or: [
                { 
                    sender_type: 'restaurant',
                    recipient_type: 'customer',
                    user_recipient_email: customerEmail 
                },
                { 
                    sender_type: 'customer',
                    user_sender_email: customerEmail,
                    recipient_type: 'restaurant'
                }
            ]
        });
        
        // Return the messages
        res.status(200).json({
            success: true,
            messages: messages.reverse(), // Reverse to get chronological order
            pagination: {
                total: totalMessages,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(totalMessages / limitNum)
            }
        });
        
    } catch (error) {
        console.error('Error getting chat history by order:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving chat history',
            error: error.message
        });
    }
};

/**
 * Get all chats for a restaurant
 */
const get_restaurant_chats = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        
        console.log(`Getting all chats for restaurant ${restaurantId}`);
        
        // Validate parameter
        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: 'Restaurant ID is required'
            });
        }

        // Find all orders associated with this restaurant first
        const restaurantOrders = await UserOrder.find({ 
            restaurant: restaurantId,
            status: { $in: ['Planning', 'Seated'] } // Only show active orders
        }).select('_id client_id');
        
        const orderIds = restaurantOrders.map(order => order._id);
        
        if (orderIds.length === 0) {
            // If no orders found, return empty results
            return res.status(200).json({
                success: true,
                chats: []
            });
        }
        
        // Aggregate to get distinct customer emails that have chatted with this restaurant through any of its orders
        const chatCustomers = await ChatMessage.aggregate([
            {
                $match: {
                    order_id: { $in: orderIds }
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: {
                        customerEmail: {
                            $cond: [
                                { $eq: ['$sender_type', 'customer'] },
                                '$user_sender_email',
                                '$user_recipient_email'
                            ]
                        },
                        order_id: '$order_id'
                    },
                    lastMessage: { $first: '$timestamp' },
                    lastMessageContent: { $first: '$content' },
                    lastMessageSenderType: { $first: '$sender_type' },
                    messageId: { $first: '$_id' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { 
                                    $and: [
                                        { $eq: ['$sender_type', 'customer'] },
                                        { $eq: ['$recipient_type', 'restaurant'] },
                                        { $eq: ['$read', false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    customerEmail: '$_id.customerEmail',
                    order_id: '$_id.order_id',
                    lastMessage: 1,
                    lastMessageContent: 1,
                    lastMessageSenderType: 1,
                    messageId: 1,
                    unreadCount: 1
                }
            },
            { $sort: { lastMessage: -1 } }
        ]);
        
        // Get customer information for each chat
        const chatsWithDetails = await Promise.all(
            chatCustomers.map(async (chat) => {
                // Try to get customer information
                let customerInfo = null;
                try {
                    customerInfo = await ClientUser.findOne({ email: chat.customerEmail })
                        .select('first_name last_name email phone_number profileImage');
                } catch (err) {
                    console.log(`No customer found for email ${chat.customerEmail}`);
                }
                
                // Get order details
                let orderInfo = null;
                try {
                    orderInfo = await UserOrder.findById(chat.order_id)
                        .select('status guests orderDate tableNumber restaurant')
                        .populate('restaurant', 'res_name');
                        
                    // If order has a restaurant reference, extract restaurant ID
                    const restaurantId = orderInfo?.restaurant?._id || null;
                    
                } catch (err) {
                    console.log(`No order found with ID ${chat.order_id}`);
                }
                
                return {
                    customerEmail: chat.customerEmail,
                    order_id: chat.order_id,
                    customerInfo: customerInfo ? {
                        firstName: customerInfo.first_name,
                        lastName: customerInfo.last_name,
                        email: customerInfo.email,
                        phone: customerInfo.phone_number,
                        profileImage: customerInfo.profileImage
                    } : null,
                    orderInfo: orderInfo ? {
                        status: orderInfo.status,
                        guests: orderInfo.guests,
                        date: orderInfo.orderDate,
                        tableNumber: orderInfo.tableNumber,
                        restaurantName: orderInfo.restaurant?.res_name,
                        restaurantId: orderInfo.restaurant?._id
                    } : null,
                    lastMessage: {
                        id: chat.messageId,
                        content: chat.lastMessageContent,
                        timestamp: chat.lastMessage,
                        sender_type: chat.lastMessageSenderType
                    },
                    unreadCount: chat.unreadCount
                };
            })
        );
        
        res.status(200).json({
            success: true,
            chats: chatsWithDetails
        });
        
    } catch (error) {
        console.error('Error getting restaurant chats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving restaurant chats',
            error: error.message
        });
    }
};

/**
 * Get all chats for a customer
 */
const get_customer_chats = async (req, res) => {
    try {
        const { customerEmail } = req.params;
        
        console.log(`Getting all chats for customer ${customerEmail}`);
        
        // Validate parameter
        if (!customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'Customer email is required'
            });
        }
        
        // Find the customer to get their ID
        const customer = await ClientUser.findOne({ email: customerEmail });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }
        
        // Find all orders for this customer
        const customerOrders = await UserOrder.find({ 
            client_id: customer._id,
            status: { $in: ['Planning', 'Seated'] } // Only show active orders
        }).select('_id restaurant');
        
        const orderIds = customerOrders.map(order => order._id);
        
        if (orderIds.length === 0) {
            // If no orders found, return empty results
            return res.status(200).json({
                success: true,
                chats: []
            });
        }
        
        // Aggregate to get distinct orders with chats for this customer
        const chatOrders = await ChatMessage.aggregate([
            {
                $match: {
                    order_id: { $in: orderIds },
                    $or: [
                        { sender_type: 'customer', user_sender_email: customerEmail },
                        { recipient_type: 'customer', user_recipient_email: customerEmail }
                    ]
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: '$order_id',
                    lastMessage: { $first: '$timestamp' },
                    lastMessageContent: { $first: '$content' },
                    lastMessageSenderType: { $first: '$sender_type' },
                    messageId: { $first: '$_id' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { 
                                    $and: [
                                        { $eq: ['$sender_type', 'restaurant'] },
                                        { $eq: ['$recipient_type', 'customer'] },
                                        { $eq: ['$user_recipient_email', customerEmail] },
                                        { $eq: ['$read', false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    order_id: '$_id',
                    lastMessage: 1,
                    lastMessageContent: 1,
                    lastMessageSenderType: 1,
                    messageId: 1,
                    unreadCount: 1
                }
            },
            { $sort: { lastMessage: -1 } }
        ]);
        
        // Get order details and restaurant information for each chat
        const chatsWithDetails = await Promise.all(
            chatOrders.map(async (chat) => {
                let orderInfo = null;
                let restaurantInfo = null;
                
                try {
                    // Get order information including restaurant details
                    orderInfo = await UserOrder.findById(chat.order_id)
                        .select('status guests orderDate tableNumber restaurant')
                        .populate('restaurant', 'res_name phone_number full_address city');
                    
                    if (orderInfo && orderInfo.restaurant) {
                        restaurantInfo = orderInfo.restaurant;
                    }
                } catch (err) {
                    console.log(`Error retrieving order/restaurant info: ${err.message}`);
                }
                
                return {
                    order_id: chat.order_id,
                    restaurantInfo: restaurantInfo ? {
                        id: restaurantInfo._id,
                        name: restaurantInfo.res_name,
                        phone: restaurantInfo.phone_number,
                        address: restaurantInfo.full_address,
                        city: restaurantInfo.city
                    } : null,
                    orderInfo: orderInfo ? {
                        status: orderInfo.status,
                        guests: orderInfo.guests,
                        date: orderInfo.orderDate,
                        tableNumber: orderInfo.tableNumber
                    } : null,
                    lastMessage: {
                        id: chat.messageId,
                        content: chat.lastMessageContent,
                        timestamp: chat.lastMessage,
                        sender_type: chat.lastMessageSenderType
                    },
                    unreadCount: chat.unreadCount
                };
            })
        );
        
        res.status(200).json({
            success: true,
            chats: chatsWithDetails
        });
        
    } catch (error) {
        console.error('Error getting customer chats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving customer chats',
            error: error.message
        });
    }
};

/**
 * Save a new message - can be called directly via REST API or from Socket.IO
 */
const save_message = async (req, res) => {
    try {
        // Handle both REST API and Socket.IO calls
        const messageData = req.body || req;
        
        const {
            order_id,
            sender_type,
            restaurant_sender_id,
            user_sender_email,
            sender_name,
            recipient_type,
            restaurant_recipient_id,
            user_recipient_email,
            content
        } = messageData;
        
        console.log('Saving new message:', {
            order_id,
            sender_type, 
            restaurant_sender_id: restaurant_sender_id || 'N/A', 
            user_sender_email: user_sender_email || 'N/A',
            recipient_type, 
            restaurant_recipient_id: restaurant_recipient_id || 'N/A', 
            user_recipient_email: user_recipient_email || 'N/A'
        });
        
        // Validate required fields
        if (!order_id || !sender_type || !recipient_type || !content) {
            const errorMsg = 'Missing required message fields';
            
            // Handle differently based on call source
            if (res) {
                return res.status(400).json({
                    success: false,
                    message: errorMsg
                });
            } else {
                throw new Error(errorMsg);
            }
        }
        
        // Get restaurant ID from order if it's not provided
        let restaurant_id = null;
        
        if ((sender_type === 'customer' && !restaurant_recipient_id) || 
            (recipient_type === 'customer' && !restaurant_sender_id)) {
            try {
                const orderDetails = await UserOrder.findById(order_id).select('restaurant');
                if (orderDetails && orderDetails.restaurant) {
                    restaurant_id = orderDetails.restaurant;
                }
            } catch (err) {
                console.error('Error fetching restaurant ID from order:', err);
            }
        }
        
        // Additional validation based on sender/recipient types
        if (sender_type === 'restaurant' && !restaurant_sender_id && !restaurant_id) {
            const errorMsg = 'Restaurant sender requires restaurant_sender_id or valid order_id';
            
            if (res) {
                return res.status(400).json({
                    success: false,
                    message: errorMsg
                });
            } else {
                throw new Error(errorMsg);
            }
        }
        
        if (sender_type === 'customer' && !user_sender_email) {
            const errorMsg = 'Customer sender requires user_sender_email';
            
            if (res) {
                return res.status(400).json({
                    success: false,
                    message: errorMsg
                });
            } else {
                throw new Error(errorMsg);
            }
        }
        
        if (recipient_type === 'restaurant' && !restaurant_recipient_id && !restaurant_id) {
            const errorMsg = 'Restaurant recipient requires restaurant_recipient_id or valid order_id';
            
            if (res) {
                return res.status(400).json({
                    success: false,
                    message: errorMsg
                });
            } else {
                throw new Error(errorMsg);
            }
        }
        
        if (recipient_type === 'customer' && !user_recipient_email) {
            const errorMsg = 'Customer recipient requires user_recipient_email';
            
            if (res) {
                return res.status(400).json({
                    success: false,
                    message: errorMsg
                });
            } else {
                throw new Error(errorMsg);
            }
        }
        
        // Create and save the message
        const newMessage = new ChatMessage({
            order_id,
            sender_type,
            restaurant_sender_id: sender_type === 'restaurant' ? (restaurant_sender_id || restaurant_id) : null,
            user_sender_email: sender_type === 'customer' ? user_sender_email : null,
            sender_name,
            recipient_type,
            restaurant_recipient_id: recipient_type === 'restaurant' ? (restaurant_recipient_id || restaurant_id) : null,
            user_recipient_email: recipient_type === 'customer' ? user_recipient_email : null,
            content,
            timestamp: new Date(),
            read: false
        });
        
        const savedMessage = await newMessage.save();
        
        // Return success response or message object based on call source
        if (res) {
            return res.status(201).json({
                success: true,
                message: 'Message sent successfully',
                messageId: savedMessage._id,
                messageData: savedMessage
            });
        } else {
            return savedMessage;
        }
        
    } catch (error) {
        console.error('Error saving message:', error);
        
        // Handle differently based on call source
        if (res) {
            return res.status(500).json({
                success: false,
                message: 'Server error while sending message',
                error: error.message
            });
        } else {
            throw error;
        }
    }
};

/**
 * Mark a message as read - can be called directly via REST API or from Socket.IO
 */
const mark_message_as_read = async (req, res) => {
    try {
        // Handle both REST API and Socket.IO calls
        const messageId = req.params?.messageId || req;
        
        console.log(`Marking message as read: ${messageId}`);
        
        if (!messageId) {
            const errorMsg = 'Message ID is required';
            
            if (res) {
                return res.status(400).json({
                    success: false,
                    message: errorMsg
                });
            } else {
                throw new Error(errorMsg);
            }
        }
        
        // Find and update the message
        const message = await ChatMessage.findByIdAndUpdate(
            messageId,
            { read: true },
            { new: true }
        );
        
        if (!message) {
            const errorMsg = 'Message not found';
            
            if (res) {
                return res.status(404).json({
                    success: false,
                    message: errorMsg
                });
            } else {
                throw new Error(errorMsg);
            }
        }
        
        // Return success response or message object based on call source
        if (res) {
            return res.status(200).json({
                success: true,
                message: 'Message marked as read',
                messageData: message
            });
        } else {
            return message;
        }
        
    } catch (error) {
        console.error('Error marking message as read:', error);
        
        // Handle differently based on call source
        if (res) {
            return res.status(500).json({
                success: false,
                message: 'Server error while marking message as read',
                error: error.message
            });
        } else {
            throw error;
        }
    }
};

/**
 * Delete a chat conversation for a specific order
 */
const delete_chat = async (req, res) => {
    try {
        const { orderId, customerEmail } = req.params;
        
        console.log(`Deleting chat for order ${orderId} with customer ${customerEmail}`);
        
        // Validate parameters
        if (!orderId || !customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and customer email are required'
            });
        }
        
        // Delete all messages for this order and customer
        const result = await ChatMessage.deleteMany({
            order_id: orderId,
            $or: [
                { 
                    sender_type: 'restaurant',
                    recipient_type: 'customer',
                    user_recipient_email: customerEmail 
                },
                { 
                    sender_type: 'customer',
                    user_sender_email: customerEmail,
                    recipient_type: 'restaurant'
                }
            ]
        });
        
        res.status(200).json({
            success: true,
            message: 'Chat deleted successfully',
            deletedCount: result.deletedCount
        });
        
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting chat',
            error: error.message
        });
    }
};

/**
 * Get unread message count for a user or restaurant
 */
const get_unread_count = async (req, res) => {
    try {
        const { type, id } = req.params;
        
        console.log(`Getting unread count for ${type} ${id}`);
        
        // Validate parameters
        if (!type || !id) {
            return res.status(400).json({
                success: false,
                message: 'Type and ID are required'
            });
        }
        
        let query;
        
        if (type === 'restaurant') {
            // Count unread messages sent to this restaurant
            query = {
                recipient_type: 'restaurant',
                restaurant_recipient_id: id,
                read: false
            };
        } else if (type === 'customer') {
            // Count unread messages sent to this customer
            query = {
                recipient_type: 'customer',
                user_recipient_email: id, // Email is used as ID for customers
                read: false
            };
        } else {
            return res.status(400).json({
                success: false,
                message: 'Type must be "restaurant" or "customer"'
            });
        }
        
        // Count unread messages
        const unreadCount = await ChatMessage.countDocuments(query);
        
        res.status(200).json({
            success: true,
            unreadCount
        });
        
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting unread count',
            error: error.message
        });
    }
};

// Make the functions available both ways - directly and through saveMessage/markMessageAsRead aliases
// This ensures compatibility with both forms of import
module.exports = {
    get_chat_history,
    get_restaurant_chats,
    get_customer_chats,
    save_message,
    mark_message_as_read,
    delete_chat,
    get_unread_count,
    saveMessage: save_message,
    markMessageAsRead: mark_message_as_read
};