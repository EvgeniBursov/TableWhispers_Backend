const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cron = require('node-cron');

const { scheduleDailyFeedbackEmails }  = require('./MessageSystem/RestaurantFeedbackSystem');
const { scheduleDailyReminderEmails } = require('./MessageSystem/ReminderSystem');

const ChatSystem = require('./MessageSystem/ChatSystem');

const client_register_route = require('./routes/client_register_route');
const client_login_route = require('./routes/client_login_route');

const res_register_route = require('./routes/res_register_route');
const res_login_route = require('./routes/res_login_route');
const restaurants_route = require('./routes/restaurants_route');

const send_totp_code_to_client = require('./routes/auth');
const verify_totp_code = require('./routes/auth');
const reset_user_password = require('./routes/auth');

const client_profile = require('./routes/client_profile_route');

//const upload_image_route = require('./upload_image/upload_image_service');

const tables_management = require('./routes/tables_route');

const survey_management = require('./routes/survey_route');

const chat_routes = require('./routes/chat_route');

// Create Express app
const server_app = express();

// Create HTTP server to wrap Express app for WebSocket support
const http_server = http.createServer(server_app);

// Create Socket.IO server with CORS support
const io = new Server(http_server, {
  cors: {
    origin: "*", // For development - should be restricted in production
    methods: ["GET", "POST"]
  }
});

// Apply middleware
// server_app.use(cors());
server_app.use(cors({
  origin: [
    'https://lemon-mushroom-0b6d89f03.6.azurestaticapps.net',
    'https://gentle-water-06b1d4400.4.azurestaticapps.net',
    'http://localhost:5173'  // LOCAL
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
server_app.use(bodyParser.json());
server_app.use(express.urlencoded({ extended: true }));


server_app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'API is working!' });
});

server_app.get('/', (req, res) => {
  res.send('Server is running correctly');
});

// Add routes
server_app.use(client_register_route);
server_app.use(client_login_route);
server_app.use(send_totp_code_to_client, verify_totp_code, reset_user_password);
server_app.use(client_profile);
//server_app.use(upload_image_route);
server_app.use(res_register_route);
server_app.use(res_login_route);
server_app.use(restaurants_route);
server_app.use(tables_management);
server_app.use(survey_management);
server_app.use(chat_routes);

// Serve static files
server_app.use('/public', express.static(path.join(__dirname, 'public')));

// Ensure profile_images directory exists
const fs = require('fs');
const profileImagesDir = path.join(__dirname, 'public/profile_images');
if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}

// Debug route
server_app.get('/test-image-path', (req, res) => {
  res.json({
    message: 'Image paths debugging',
    publicPath: path.join(__dirname, 'public'),
    profileImagesPath: profileImagesDir,
    exists: fs.existsSync(profileImagesDir)
  });
});

// Make Socket.IO instance available to routes
server_app.set('socketio', io);

// Enhanced Socket.IO connection handling
io.on('connection', (socket) => {
  //console.log('Client connected:', socket.id);
  
  // Track connected users/restaurants
  const connectedClients = new Map();

  socket.on('joinOrderRoom', ({ orderId }) => {
    if (!orderId) return;
    
    const roomName = `order_${orderId}`;
    socket.join(roomName);
    //console.log(`Client ${socket.id} joined order room: ${roomName}`);
  });
  
  // Leave order-specific room
  socket.on('leaveOrderRoom', ({ orderId }) => {
    if (!orderId) return;
    
    const roomName = `order_${orderId}`;
    socket.leave(roomName);
    //console.log(`Client ${socket.id} left order room: ${roomName}`);
  });
  
  // Join restaurant-specific room
  socket.on('joinRestaurantRoom', ({ restaurantId }) => {
    if (!restaurantId) return;
    
    const roomName = `restaurant_${restaurantId}`;
    socket.join(roomName);
    //console.log(`Client ${socket.id} joined room: ${roomName}`);
    
    // Notify room that a new client connected
    socket.to(roomName).emit('clientJoined', { socketId: socket.id });
  });
  
  // Join customer-specific room
  socket.on('joinCustomerRoom', ({ customerEmail }) => {
    if (!customerEmail) return;
    
    const roomName = `customer_${customerEmail}`;
    socket.join(roomName);
    //console.log(`Client ${socket.id} joined room: ${roomName}`);
    
    // Store customer info
    connectedClients.set(socket.id, { type: 'customer', email: customerEmail });
  });
  
  // Leave room
  socket.on('leaveRestaurantRoom', ({ restaurantId }) => {
    if (!restaurantId) return;
    
    const roomName = `restaurant_${restaurantId}`;
    socket.leave(roomName);
    //console.log(`Client ${socket.id} left room: ${roomName}`);
  });
  
  // Restaurant events
  socket.on('reservationUpdated', (data) => {
    //console.log('Reservation updated event received:', data);
    
    // Broadcast to restaurant room
    if (data.restaurantId) {
      const roomName = `restaurant_${data.restaurantId}`;
      io.to(roomName).emit('reservationUpdated', data);
    }
    
    // Notify specific customer if email is provided
    if (data.customerEmail) {
      const customerRoom = `customer_${data.customerEmail}`;
      io.to(customerRoom).emit('reservationUpdated', data);
    }
  });
  
  // Customer events
  socket.on('clientUpdatedReservation', (data) => {
    //console.log('Client updated reservation:', data);
    
    // Broadcast to restaurant room
    if (data.restaurantId) {
      const roomName = `restaurant_${data.restaurantId}`;
      io.to(roomName).emit('clientUpdatedReservation', data);
    }
  });
  
  socket.on('clientCancelledReservation', (data) => {
    //console.log('Client cancelled reservation:', data);
    
    // Broadcast to restaurant room
    if (data.restaurantId) {
      const roomName = `restaurant_${data.restaurantId}`;
      io.to(roomName).emit('clientCancelledReservation', data);
    }
  });
  
  // Handle table assignments
  socket.on('tableAssigned', (data) => {
    //console.log('Table assigned:', data);
    
    // Broadcast to restaurant room
    if (data.restaurantId) {
      const roomName = `restaurant_${data.restaurantId}`;
      io.to(roomName).emit('tableAssigned', data);
    }
    
    // Notify specific customer if email is provided
    if (data.customerEmail) {
      const customerRoom = `customer_${data.customerEmail}`;
      io.to(customerRoom).emit('tableAssigned', data);
    }
  });
  
  // Restaurant status updates
  socket.on('reservationStatusChanged', (data) => {
    //console.log('Reservation status changed:', data);
    
    // Broadcast to restaurant room if applicable
    if (data.restaurantId) {
      const roomName = `restaurant_${data.restaurantId}`;
      io.to(roomName).emit('reservationStatusChanged', data);
    }
    
    // Always notify specific customer if email is provided
    if (data.customerEmail) {
      const customerRoom = `customer_${data.customerEmail}`;
      io.to(customerRoom).emit('reservationStatusChanged', data);
    }
  });

socket.on('sendMessage', async (data) => {
  try {
    //console.log('Received chat message:', data);
    const savedMessage = await ChatSystem.saveMessage(data);
    
    // Extract just the order ID
    const orderId = data.order_id;
    
    // All clients interested in this order are in the order room
    const orderRoom = `order_${orderId}`;
    
    // Broadcast to order room (except the sender)
    socket.to(orderRoom).emit('newMessage', savedMessage);
    //console.log(`Broadcast message to order room: ${orderRoom}`);
    
    // Send back to sender as confirmation (will update their UI)
    socket.emit('messageSent', savedMessage);
    /*//console.log('Received chat message:', data);
    const savedMessage = await ChatSystem.saveMessage(data);
    
    // Extract essential information from the message
    const orderId = data.order_id;
    let customerEmail, restaurantId;
    
    // Set variables based on sender and recipient type
    if (data.sender_type === 'restaurant') {
      restaurantId = data.restaurant_sender_id;
      customerEmail = data.user_recipient_email;
    } else { // sender_type === 'customer'
      customerEmail = data.user_sender_email;
      restaurantId = data.restaurant_recipient_id;
      
      // If restaurant_recipient_id is missing, try to get it from the saved message
      if (!restaurantId && savedMessage.restaurant_recipient_id) {
        restaurantId = savedMessage.restaurant_recipient_id;
      }
    }
    
    //console.log(`Broadcasting message to rooms: restaurant_${restaurantId}, customer_${customerEmail}, order_${orderId}`);
    
    // Send message to restaurant room
    if (restaurantId) {
      const restaurantRoom = `restaurant_${restaurantId}`;
      io.to(restaurantRoom).emit('newMessage', savedMessage);
    }
    
    // Send message to customer room
    if (customerEmail) {
      const customerRoom = `customer_${customerEmail}`;
      io.to(customerRoom).emit('newMessage', savedMessage);
    }
    
    // Also send to order-specific room
    const orderRoom = `order_${orderId}`;
    io.to(orderRoom).emit('newMessage', savedMessage);
    
    // Send confirmation to sender
    socket.emit('messageSent', {
      messageId: savedMessage._id,
      timestamp: savedMessage.timestamp
    });*/
    
  } catch (error) {
    console.error('Error processing chat message:', error);
    socket.emit('error', { message: 'Failed to send message', error: error.message });
  }
});
  
  socket.on('markMessageRead', async (data) => {
    try {
      const { messageId } = data;
      //console.log(`Marking message as read: ${messageId}`);
      // Fixed: Use ChatSystem.markMessageAsRead instead of just markMessageAsRead
      const updatedMessage = await ChatSystem.markMessageAsRead(messageId);
      if (updatedMessage.sender_type === 'restaurant') {
        const roomName = `restaurant_${updatedMessage.restaurant_sender_id}`;
        io.to(roomName).emit('messageRead', { messageId });
      } else if (updatedMessage.sender_type === 'customer') {
        const roomName = `customer_${updatedMessage.user_sender_email}`;
        io.to(roomName).emit('messageRead', { messageId });
      }
      
    } catch (error) {
      console.error('Error marking message as read:', error);
      socket.emit('error', { message: 'Failed to mark message as read', error: error.message });
    }
  });
  socket.on('typing', (data) => {
    const { sender_type, restaurant_sender_id, user_sender_email, recipient_type, restaurant_recipient_id, user_recipient_email } = data;
    if (recipient_type === 'restaurant') {
      const roomName = `restaurant_${restaurant_recipient_id}`;
      socket.to(roomName).emit('userTyping', { 
        sender_type, 
        restaurant_sender_id, 
        user_sender_email 
      });
    } else if (recipient_type === 'customer') {
      const roomName = `customer_${user_recipient_email}`;
      socket.to(roomName).emit('userTyping', { 
        sender_type, 
        restaurant_sender_id, 
        user_sender_email 
      });
    }
  });
  
  socket.on('stoppedTyping', (data) => {
    const { sender_type, restaurant_sender_id, user_sender_email, recipient_type, restaurant_recipient_id, user_recipient_email } = data;
    if (recipient_type === 'restaurant') {
      const roomName = `restaurant_${restaurant_recipient_id}`;
      socket.to(roomName).emit('userStoppedTyping', { 
        sender_type, 
        restaurant_sender_id, 
        user_sender_email 
      });
    } else if (recipient_type === 'customer') {
      const roomName = `customer_${user_recipient_email}`;
      socket.to(roomName).emit('userStoppedTyping', { 
        sender_type, 
        restaurant_sender_id, 
        user_sender_email 
      });
    }
  });
  
  // Disconnect handling
  socket.on('disconnect', () => {
    //console.log('Client disconnected:', socket.id);
    
    // Clean up client tracking
    connectedClients.delete(socket.id);
  });
});

// Environment configuration
dotenv.config();
//const server_app_port = process.env.CLIEN_PORT;

// Start server
/*http_server.listen(server_app_port, () => {
    //console.log('Server is up and running on port:', server_app_port);
    //console.log('WebSockets enabled on server');
});*/

const port = process.env.CLIEN_PORT || 6000; 
http_server.listen(port, () => {
  console.log('Server is up and running on port:', port);
  console.log('WebSockets enabled on server');
});


/*aif (require.main === module) {
  const port = process.env.CLIEN_PORT || 6000; 
  http_server.listen(port, () => {
    //console.log('Server is up and running on port :', port);
    //console.log('WebSockets enabled on server');
  });
}*/

// Database connection
const dataBaseURL = process.env.DATABASE_URL;
mongoose.connect(dataBaseURL);
const db = mongoose.connection;

db.on('error', error => { console.log(error); });
db.once('open', () => { console.log('Connected to MongoDB'); });

// Schedule tasks
scheduleDailyFeedbackEmails();
scheduleDailyReminderEmails();

// Export Express app and Socket.IO instance
module.exports = { server_app, io };