const ResClientUser = require('../models/Res_User')
const bcrypt = require('bcrypt')
const generator = require('username-generator');
const { sendMail } = require('../messages/email_message');


const ResLoginUser = async (req, res) => {
    const req_email = req.body.email;
    const req_username = req.body.username;
    const req_pass = req.body.password;
    const req_phone_number = req.body.phone_number;

    if (!req_email.length || !req_pass.length || req_username.length || req_phone_number) {
        return res.status(300).json({ 'error': 'Fill in all fields' });
      }
      try {
        // Find the user by email
        const logUser = await ResClientUser.findOne({ 'email': req_email });
        if (!logUser) {
          return res.status(300).json({ 'error': 'Incorrect user' });
        }

        const match_pass = await bcrypt.compare(req_pass, logUser.password)
        if(!match_pass) {
          return res.status(300).json({ 'error': "incorrect password"})
        }
        if(logUser.user_name !== req_username){
          return res.status(300).json({ 'error': "incorrect user name"})
        }
        if(logUser.phone_number !== req_phone_number){
          return res.status(300).json({ 'error': "incorrect phone number"})
        }
        authenticator.options = { step: 360}
        logUser.twoFa = authenticator.generateSecret()
        await logUser.save();
        const token = authenticator.generate(logUser.twoFa);
        sendMail(req_email, token)
        return res.status(200).json({ 'connect': logUser});
        }
       catch (err) {
        console.error(err);
        return res.status(500).json({ 'alert': 'Fail checking user' });
      }
}


module.exports = {
    ResLoginUser,
  }

  