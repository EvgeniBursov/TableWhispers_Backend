const express = require('express');
const router = express.Router();

const { userData, deleteClientProfile, getListOfAllergies, updateUserAlergic } = require('../controllers/client_profile')
const { changeClientPassword } = require('../controllers/auth')



router.get('/userProfile', userData);

router.get('/getListOfAllergies', getListOfAllergies);

router.post('/resetClientPassword',changeClientPassword);

router.post('/updateUserAlergic',updateUserAlergic);


router.delete('/deleteClientProfile',deleteClientProfile);




module.exports = router;