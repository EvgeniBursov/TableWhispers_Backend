const ResClientUser = require('../models/Res_User')
const bcrypt = require('bcryptjs')
const generator = require('username-generator');
const { sendMail } = require('../MessageSystem/email_message');
const { authenticator } = require ('otplib');


const ResLoginUser = async (req, res) => {
  const req_email = req.body.email;
  const req_username = req.body.username;
  const req_pass = req.body.password;
  const req_phone_number = req.body.phone_number;
  
  //console.log(`Login attempt - email: ${req_email}, username: ${req_username}`);
  
  if (!req_email || !req_email.length || !req_pass || !req_pass.length || 
      !req_username || !req_username.length || !req_phone_number || !req_phone_number.length) {
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
          return res.status(300).json({ 'error': "Incorrect password"})
      }
      
      if(logUser.user_name !== req_username){
          return res.status(300).json({ 'error': "Incorrect username"})
      }
      
      if(logUser.phone_number !== req_phone_number){
          return res.status(300).json({ 'error': "Incorrect phone number"})
      }
      
      // Set options for the TOTP authenticator (time-based one-time password)
      authenticator.options = { step: 360 }
      logUser.totpSecret = authenticator.generateSecret()
      await logUser.save();
      
      // Generate token and send it via email
      const token = authenticator.generate(logUser.totpSecret);
      sendMail(req_email, token, 'totp')
      
      //console.log(`Login successful - User: ${logUser.user_name}, Restaurant ID: ${logUser.restaurant_id}`);
      
      // Return user data with restaurant_id explicitly included at the top level
      return res.status(200).json({
          'connect': logUser,
          'restaurant_id': logUser.restaurant_id
      });
  } catch (err) {
      console.error('Error during login:', err);
      return res.status(500).json({ 'error': 'Failed to authenticate user' });
  }
}


module.exports = {
    ResLoginUser,
  }

  