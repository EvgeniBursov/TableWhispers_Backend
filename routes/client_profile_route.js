const express = require('express');
const router = express.Router();

const { userData, deleteClientProfile, getListOfAllergies, updateUserAlergic,updateUserPhoneNumber,updateProfileImageHandler,cancelUpcomingOrders } = require('../controllers/client_profile')
const { changeClientPassword } = require('../controllers/auth')



router.get('/userProfile', userData);

router.get('/getListOfAllergies', getListOfAllergies);

router.post('/resetClientPassword',changeClientPassword);

router.post('/updateUserAlergic',updateUserAlergic);

router.post('/updateUserPhoneNumber',updateUserPhoneNumber);

router.post('/updateUserProfileImage', updateProfileImageHandler);

router.delete('/deleteClientProfile',deleteClientProfile);

router.post('/cancelUpcomingOrders', cancelUpcomingOrders);




module.exports = router;