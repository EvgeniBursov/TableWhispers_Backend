const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv')

const client_register_route = require('./routes/client_register_route')
const client_login_route = require('./routes/client_login_route')

const res_register_route = require('./routes/res_register_route')
const res_login_route = require('./routes/res_login_route')

const client_app = express();
const res_app = express();

client_app.use(bodyParser.json());
client_app.use(client_register_route);
client_app.use(client_login_route);

res_app.use(bodyParser.json());
res_app.use(res_register_route);
res_app.use(res_login_route);

dotenv.config()

const client_app_port = process.env.CLIEN_PORT;
const res_app_port = process.env.RES_PORT;

client_app.listen(client_app_port, () => {
    console.log('client server is up and running ', client_app_port);
  });

res_app.listen(res_app_port, () => {
    console.log('res server is up and running ', res_app_port);
  });


const dataBaseURL = process.env.DATABASE_URL;
mongoose.connect(dataBaseURL)
const db = mongoose.connection

db.on('error', error=>{console.log(error)})
db.once('open',()=>{console.log('connected to mongo DB')})

module.exports = client_app, res_app;
