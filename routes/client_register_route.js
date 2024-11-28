const express = require('express');
const router = express.Router();

const { createNewUser } = require('../controllers/client_register_controller')


//create a new user
router.post('/clientRegister', createNewUser);





module.exports = router;
