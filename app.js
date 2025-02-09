const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv')
const cors = require('cors');


const client_register_route = require('./routes/client_register_route')
const client_login_route = require('./routes/client_login_route')

const res_register_route = require('./routes/res_register_route')
const res_login_route = require('./routes/res_login_route')
const restaurants_route = require('./routes/restaurants_route')

const send_totp_code_to_client = require('./routes/auth')
const verify_totp_code = require('./routes/auth')
const reset_user_password = require('./routes/auth')

const client_profile = require('./routes/client_profile_route')

const upload_image_route = require('./upload_image/upload_image_service')
//const ListOfAllergies = require('./routes/client_profile_route')

const client_app = express();
const res_app = express();

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

/*
email
"bursov19951@gmail.com"

db.collection("Allergies").insertMany([
  { name: "Peanuts", description: "Peanut allergy", category: "Nuts" },
  { name: "Tree Nuts", description: "Tree nuts allergy", category: "Nuts" },
  { name: "Dairy", description: "Milk and dairy products", category: "Dairy" },
  { name: "Eggs", description: "Egg allergy", category: "Eggs" },
  { name: "Soy", description: "Soy allergy", category: "Legumes" },
  { name: "Wheat", description: "Wheat allergy", category: "Grains" },
  { name: "Fish", description: "Fish allergy", category: "Seafood" },
  { name: "Shellfish", description: "Shellfish allergy", category: "Seafood" },
  { name: "Sesame", description: "Sesame allergy", category: "Seeds" },
  { name: "Gluten", description: "Gluten intolerance", category: "Grains" },
  { name: "Lactose", description: "Lactose intolerance", category: "Dairy" },
  { name: "Mustard", description: "Mustard allergy", category: "Condiments" },
  { name: "Celery", description: "Celery allergy", category: "Vegetables" },
  { name: "Sulfites", description: "Sulfites sensitivity", category: "Additives" }
])

*/

db.on('error', error=>{console.log(error)})
db.once('open',()=>{console.log('connected to mongo DB')})

module.exports = client_app, res_app;
