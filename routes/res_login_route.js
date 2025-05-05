const express = require('express');
const router = express.Router();

const { ResLoginUser } = require('../controllers/res_login_controller')


//create a new user
router.post('/resLogin', ResLoginUser);





module.exports = router;
