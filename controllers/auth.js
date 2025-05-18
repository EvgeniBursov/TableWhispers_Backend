const bcrypt = require('bcryptjs')
const ClientUser = require('../models/Client_User')
const ResUser = require('../models/Res_User')
const { sendMail } = require('../MessageSystem/email_message');
const { authenticator } = require ('otplib');



const jwt = require('jsonwebtoken')

const dotenv = require('dotenv')
dotenv.config()


const sendTotpCodeForClientUser = async (req, res) => {
    const req_email = req.body.email;
    const req_user_type = req.body.user_type;
    //console.log("Start send Totp Code For Client User")
    if(req_user_type === "Client"){
      if (!req_email.length) {
        return res.status(300).json({ 'error': 'Fill email' });
      }
      try {
        const logUser = await ClientUser.findOne({ 'email': req_email });
        if (!logUser) {
          return res.status(300).json({ 'error': 'Incorrect user' });
        }
        authenticator.options = { step: 360}
        logUser.totpSecret = authenticator.generateSecret()
        await logUser.save();
        const totp_token = authenticator.generate(logUser.totpSecret);
        sendMail(req_email, totp_token,'totp')
        return res.status(200).json({ 'checkClientUser': logUser});
      } catch (err) {
        console.error(err);
        return res.status(500).json({ 'alert': 'Fail checking user' });
      }
    }
    else if(req_user_type === "Restaurant"){
      if (!req_email.length) {
        return res.status(300).json({ 'error': 'Fill email' });
      }
      try {
        const restaurantUser = await ResUser.findOne({ 'email': req_email });
        if (!restaurantUser) {
          return res.status(300).json({ 'error': 'Incorrect user' });
        }
        authenticator.options = { step: 360}
        restaurantUser.totpSecret = authenticator.generateSecret()
        await restaurantUser.save();
        const totp_token = authenticator.generate(restaurantUser.totpSecret);
        sendMail(req_email, totp_token,'totp')
        return res.status(200).json({ 'restaurantUser': logUser});
      } catch (err) {
        console.error(err);
        return res.status(500).json({ 'error': 'Fail checking user' });
      }
    }
    else{
      return res.status(500).json({ 'error': 'Error user type' });
    }
    
}

const verifyTotpCode = async(req,res) =>{
    const req_email = req.body.email 
    const req_code = req.body.totp_code;
    const req_user_type = req.body.user_type
    //console.log("Start verify Totp Code")
    //console.log(req_email,req_code,req_user_type)
    if(req_user_type === "Client"){
      try {
        const logUser = await ClientUser.findOne({ 'email': req_email });
        if (!logUser) {
          return res.status(400).json({ 'error': 'Incorrect user' });
        }
        const match_secret = authenticator.check(req_code,logUser.totpSecret)
        //console.log(match_secret)
        if(!match_secret) {
          return res.status(400).json({ 'error': "incorrect token"})
        }else{
          //console.log("Correct totp")
          return res.status(200).json({ 'verifyClientUser': match_secret});
        } 
      } catch (err) {
        console.error(err);
        return res.status(500).json({ 'error': 'Fail checking user' });
      }
    }
    else if(req_user_type === "Restaurant"){
      try {
        const restaurantUser = await ResUser.findOne({ 'email': req_email });
        if (!restaurantUser) {
          return res.status(400).json({ 'error': 'Incorrect user' });
        }
        const match_secret = authenticator.check(req_code,restaurantUser.totpSecret)
        //console.log(match_secret)
        if(!match_secret) {
          return res.status(400).json({ 'error': "incorrect token"})
        }else{
          //console.log("Correct totp")
          return res.status(200).json({ 'verifyClientUser': match_secret});
        } 
      } catch (err) {
        console.error(err);
        return res.status(500).json({ 'error': 'Fail checking Restaurant user' });
      }
    }else{
      return res.status(500).json({ 'error': 'Error user type' });
    }
}

const changeClientPassword = async (req, res) => {
  //console.log(req.body)
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
  const { email: req_email, password: req_pass, confirm_password: req_confirm_pass } = req.body;

  try {
    const client_user = await ClientUser.findOne({ email: req_email });
    //console.log("Found user:", client_user);
    
    if (!client_user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!passwordRegex.test(req_pass)) {
      return res.status(400).json({ 
        error: "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 6 characters long."
      });
    }

    if (req_pass !== req_confirm_pass) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const salt = await bcrypt.genSalt(10);
    const encryptedPwd = await bcrypt.hash(req_pass, salt);
    
    client_user.password = encryptedPwd;
    await client_user.save();
    const updatedUser = await ClientUser.findById(client_user._id);
    //console.log("Updated password:", updatedUser.password);

    return res.status(200).json({ message: 'Password updated successfully' });

  } catch (err) {
    console.error('Error updating password:', err);
    return res.status(500).json({ error: 'Failed to update password' });
  }
};

const checkResUser = async (req, res) => {
  const req_email = req.body.email;
  if (!req_email.length) {
      return res.status(300).json({ 'error': 'Fill email' });
    }
    try {
      // Find the user by email
      const logUser = await ResUser.findOne({ 'email': req_email });
      if (!logUser) {
        return res.status(300).json({ 'error': 'Incorrect user' });
      }
      authenticator.options = { step: 360}
      logUser.twoFa = authenticator.generateSecret()
      await logUser.save();
      const token = authenticator.generate(logUser.twoFa);
      sendMail(req_email, token,'totp')
      return res.status(200).json({ 'checkResUser': logUser});
    } catch (err) {
      console.error(err);
      return res.status(500).json({ 'error': 'Fail checking user' });
    }
}

const sendUserName = async (req, res) =>{
  var req_email = req.body.email;

  try{
    const user = await ResUser.findOne({'email': req_email})
    if (!user) {
      return res.status(300).json({ 'error': 'Incorrect user' });
    }
    sendMail(req_email,user.user_name,'username')
  }catch(err){
    //console.log(err,"in catch")
    return (res,err)
  }

}

const changeResPassword = async (req, res) => {
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  var req_email = req.body.email;
  var req_pass = req.body.password;
  var req_confirm_pass = req.body.confirm_password;

 try{
    const user = await ResUser.findOne({'email': req_email})
    if (!user) {
      return res.status(300).json({ 'error': 'Incorrect user' });
    }
}catch(err){
  //console.log(err,"in catch")
  return (res,err)
}
try{
  if (!passwordRegex.test(req_pass)) {
    return res.status(300).json({ 'error':
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 8 characters long."
    });
  }
  if (!passwordRegex.test(req_confirm_pass)) {
    return res.status(300).json({ 'error':
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 8 characters long."
    });
  }
  if(req_pass !== req_confirm_pass){
    return res.status(300).json({ 'error': 'The passwords must be the same.' });
  }
  const salt = await bcrypt.genSalt(10)
  const encryptedPwd = await bcrypt.hash(req_pass,salt)
  user.password = encryptedPwd;
  await user.save();
  res.status(200).send(user);
}catch(err){
  res.status(400).send(err);
}
}


const createToken = (id,email) => {
  return jwt.sign(
    {
      id,
      email 
    }, 
    process.env.JWT_SECRET
  );
}


module.exports = {
  createToken,
  sendTotpCodeForClientUser,
  verifyTotpCode,
  changeClientPassword,
 };
