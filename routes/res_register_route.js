const express = require('express');
const router = express.Router();

const { createNewResUser } = require('../controllers/res_register_controller')


//create a new user
router.post('/resRegister', createNewResUser);





module.exports = router;
