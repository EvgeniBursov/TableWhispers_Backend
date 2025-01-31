const express = require('express');
const router = express.Router();

const { userData, deleteClientProfile, getListOfAllergies } = require('../controllers/client_profile')
const { changeClientPassword } = require('../controllers/auth')



router.get('/userProfile', userData);

router.get('/getListOfAllergies', getListOfAllergies);

router.post('/resetClientPassword',changeClientPassword);

router.delete('/deleteClientProfile',deleteClientProfile);




module.exports = router;