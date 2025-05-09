const express = require('express');
const router = express.Router();
const { sendTotpCodeForClientUser,verifyTotpCode,changeClientPassword } = require('../controllers/auth')
const { sendMail } = require('../MessageSystem/email_message')
const { googleAuth } = require('../controllers/google_auth')
 



router.post('/sendTotpCode', sendTotpCodeForClientUser);

router.post('/verifyTotpCode',verifyTotpCode);

router.post('/resetClientPassword',changeClientPassword);

//router.post('/checkResUser', checkClientUser);

router.post('/forgetPassword',sendMail)

router.post('/google_auth', googleAuth);


module.exports = router;