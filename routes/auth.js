const express = require('express');
const router = express.Router();
const { sendTotpCodeForClientUser,verifyTotpCode,changeClientPassword,  changeResPassword, sendUserName,
  checkResUser } = require('../controllers/auth')
const { sendMail } = require('../MessageSystem/email_message')
const { googleAuth } = require('../controllers/google_auth')
 



router.post('/sendTotpCode', sendTotpCodeForClientUser);

router.post('/verifyTotpCode',verifyTotpCode);

router.post('/resetClientPassword',changeClientPassword);

//router.post('/checkResUser', checkClientUser);

router.post('/forgetPassword',sendMail)

router.post('/google_auth', googleAuth);

router.post('/changeResPassword', changeResPassword);

router.post('/sendUserName', sendUserName);


module.exports = router;