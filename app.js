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
const { scheduleDailyReminderEmails } = require('./MessageSystem/ReminderSystem')

const client_register_route = require('./routes/client_register_route');
const client_login_route = require('./routes/client_login_route');

const res_register_route = require('./routes/res_register_route');
const res_login_route = require('./routes/res_login_route');
const restaurants_route = require('./routes/restaurants_route');

const send_totp_code_to_client = require('./routes/auth');
const verify_totp_code = require('./routes/auth');
const reset_user_password = require('./routes/auth');

const client_profile = require('./routes/client_profile_route');

const upload_image_route = require('./upload_image/upload_image_service');

const tables_management = require('./routes/tables_route');

const survey_management = require('./routes/survey_route')

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
server_app.use(cors());
server_app.use(bodyParser.json());

// Add routes
server_app.use(client_register_route);
server_app.use(client_login_route);
server_app.use(send_totp_code_to_client, verify_totp_code, reset_user_password);
server_app.use(client_profile);
server_app.use(upload_image_route);
server_app.use(res_register_route);
server_app.use(res_login_route);
server_app.use(restaurants_route);
server_app.use(tables_management);
server_app.use(survey_management);

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
  console.log('Client connected:', socket.id);
  
  // Track connected users/restaurants
  const connectedClients = new Map();
  
  // Join restaurant-specific room
  socket.on('joinRestaurantRoom', ({ restaurantId }) => {
    if (!restaurantId) return;
    
    const roomName = `restaurant_${restaurantId}`;
    socket.join(roomName);
    console.log(`Client ${socket.id} joined room: ${roomName}`);
    
    // Notify room that a new client connected
    socket.to(roomName).emit('clientJoined', { socketId: socket.id });
  });
  
  // Join customer-specific room
  socket.on('joinCustomerRoom', ({ customerEmail }) => {
    if (!customerEmail) return;
    
    const roomName = `customer_${customerEmail}`;
    socket.join(roomName);
    console.log(`Client ${socket.id} joined room: ${roomName}`);
    
    // Store customer info
    connectedClients.set(socket.id, { type: 'customer', email: customerEmail });
  });
  
  // Leave room
  socket.on('leaveRestaurantRoom', ({ restaurantId }) => {
    if (!restaurantId) return;
    
    const roomName = `restaurant_${restaurantId}`;
    socket.leave(roomName);
    console.log(`Client ${socket.id} left room: ${roomName}`);
  });
  
  // Restaurant events
  socket.on('reservationUpdated', (data) => {
    console.log('Reservation updated event received:', data);
    
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
    console.log('Client updated reservation:', data);
    
    // Broadcast to restaurant room
    if (data.restaurantId) {
      const roomName = `restaurant_${data.restaurantId}`;
      io.to(roomName).emit('clientUpdatedReservation', data);
    }
  });
  
  socket.on('clientCancelledReservation', (data) => {
    console.log('Client cancelled reservation:', data);
    
    // Broadcast to restaurant room
    if (data.restaurantId) {
      const roomName = `restaurant_${data.restaurantId}`;
      io.to(roomName).emit('clientCancelledReservation', data);
    }
  });
  
  // Handle table assignments
  socket.on('tableAssigned', (data) => {
    console.log('Table assigned:', data);
    
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
    console.log('Reservation status changed:', data);
    
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
  
  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up client tracking
    connectedClients.delete(socket.id);
  });
});

// Environment configuration
dotenv.config();
const server_app_port = process.env.CLIEN_PORT;

// Start server
http_server.listen(server_app_port, () => {
    console.log('Server is up and running on port:', server_app_port);
    console.log('WebSockets enabled on server');
});

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