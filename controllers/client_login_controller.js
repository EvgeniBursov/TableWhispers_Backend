const ClientUser = require('../models/Client_User')
const bcrypt = require('bcrypt');
const { createToken } = require('./auth');


const LoginUser = async (req, res) => {
    const req_email = req.body.email;
    const req_pass = req.body.password;
    if (!req_email.length || !req_pass.length) {
        return res.status(300).json({ 'error': 'Fill in both email and password' });
      }
      try {
        // Find the user by email
        const logUser = await ClientUser.findOne({ 'email': req_email });
        if (!logUser) {
          return res.status(300).json({ 'error': 'Incorrect user' });
        }
        const match_pass = await bcrypt.compare(req_pass, logUser.password)
        if(!match_pass) {
          return res.status(300).json({ 'alert': "incorrect password"})
        }else{
          const token = createToken(logUser._id,logUser.email)
          return res.status(200).send({"user":logUser,"token":token});
        }
      } catch (err) {
        console.error(err);
        return res.status(500).json({ 'alert': 'Fail checking user' });
      }
}


module.exports = {
    LoginUser,
  }
