const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv')

const app = express();
app.use(bodyParser.json());

const DATABASE_URL = "mongodb+srv://evgenbu2:xq8zmS4ABlsldbMa@webproject.fupstrj.mongodb.net/?authMechanism=DEFAULT"
console.log('Connected to the DataBase successfully 1');

const result = dotenv.config()

mongoose.connect(DATABASE_URL)
const db = mongoose.connection
db.on('error', error=>{console.log(error)})
db.once('open',()=>{console.log('connected to mongo DB')})



module.exports = app;
