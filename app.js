const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http'); // Added for WebSockets
const { Server } = require('socket.io'); // Added for WebSockets

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
//const ListOfAllergies = require('./routes/client_profile_route')

// Create Express apps
const client_app = express();
const res_app = express();

// Create HTTP servers to wrap Express apps for WebSocket support
const client_server = http.createServer(client_app);
const res_server = http.createServer(res_app);

// Create Socket.IO server for the restaurant app
const io = new Server(res_server, {
  cors: {
    origin: "*", // For local development
    methods: ["GET", "POST"]
  }
});

client_app.use(cors());
res_app.use(cors());

client_app.use(bodyParser.json());
client_app.use(client_register_route);
client_app.use(client_login_route);
client_app.use(send_totp_code_to_client,verify_totp_code,reset_user_password);
//client_app.use(client_profile,ListOfAllergies);
client_app.use(client_profile);
client_app.use('/public', express.static('public'));

res_app.use(bodyParser.json());
res_app.use(res_register_route);
res_app.use(res_login_route);
res_app.use(restaurants_route);
res_app.use(upload_image_route);
res_app.use('/public', express.static('public'));

res_app.use(tables_management);

// Make Socket.IO instance available to routes
res_app.set('socketio', io);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

dotenv.config();

const client_app_port = process.env.CLIEN_PORT;
const res_app_port = process.env.RES_PORT;

// Use HTTP servers instead of Express apps for listening
client_server.listen(client_app_port, () => {
    console.log('Client server is up and running', client_app_port);
});

res_server.listen(res_app_port, () => {
    console.log('Restaurant server is up and running', res_app_port);
    console.log('WebSockets enabled on restaurant server');
});

const dataBaseURL = process.env.DATABASE_URL;
mongoose.connect(dataBaseURL);
const db = mongoose.connection;

db.on('error', error => { console.log(error); });
db.once('open', () => { console.log('Connected to MongoDB'); });

// Export both Express apps and Socket.IO instance
module.exports = { client_app, res_app, io };