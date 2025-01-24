const express = require('express');
const router = express.Router();

const { userData, deleteClientProfile } = require('../controllers/client_profile')
const { changeClientPassword } = require('../controllers/auth')



router.get('/userProfile', userData);

router.post('/resetClientPassword',changeClientPassword);

router.delete('/deleteClientProfile',deleteClientProfile);




module.exports = router;