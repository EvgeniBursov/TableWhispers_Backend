const express = require('express');
const router = express.Router();
const { sendTotpCodeForClientUser,verifyTotpCode,changeClientPassword } = require('../controllers/auth')
const { sendMail } = require('../messages/email_message')





router.post('/sendTotpCode', sendTotpCodeForClientUser);

router.post('/verifyTotpCode',verifyTotpCode);

router.post('/resetClientPassword',changeClientPassword);

//router.post('/checkResUser', checkClientUser);

router.post('/forgetPassword',sendMail)


module.exports = router;