const ResClientUser = require('../models/Res_User')
const bcrypt = require('bcrypt')
const generator = require('username-generator');


const ResLoginUser = async (req, res) => {
    const req_email = req.body.email;
    const req_pass = req.body.password;
    if (!req_email.length || !req_pass.length) {
        return res.status(300).json({ 'error': 'Fill in both email and password' });
        //return res.json({ 'error': 'Fill in both email and password' });
      }
      try {
        // Find the user by email
        const logUser = await ResClientUser.findOne({ 'email': req_email });
        if (!logUser) {
          return res.json({ 'error': 'Incorrect user' });
        }
        const match_pass = await bcrypt.compare(req_pass, logUser.password)
        console.log('working',match_pass)
        if(!match_pass) {
          return res.json({ 'alert': "incorrect password"})
        }else{
          //authenticator.options = { step: 360}
          //logUser.access = false;
          //logUser.twoFa = authenticator.generateSecret()
          //await logUser.save();
          //const token = authenticator.generate(logUser.twoFa);
          //sendMail(req_email, token)
          return res.status(200).json({ 'connect': logUser});
        }
      } catch (err) {
        console.error(err);
        return res.status(500).json({ 'alert': 'Fail checking user' });
      }
}


module.exports = {
    ResLoginUser,
  }

/*
  var req_email = req.body.email;
  var req_first_name = req.body.first_name;
  var req_last_name = req.body.last_name;
  var req_age = req.body.age;
  var req_phone_number = req.body.phone_number;
  var req_pass = req.body.password;
  var req_city = req.body.city;
  var req_restaurant_name = req.body.restaurant_name;

  */

// Generate a username of exactly 6 characters
