const bcrypt = require('bcrypt')
const ClientUser = require('../models/Client_User')
const ResUser = require('../models/Res_User')
const { sendMail } = require('../messages/email_message');
const { authenticator } = require ('otplib');




const checkClientUser = async (req, res) => {
    const req_email = req.body.email;
    if (!req_email.length) {
        return res.status(300).json({ 'error': 'Fill email' });
      }
      try {
        // Find the user by email
        const logUser = await ClientUser.findOne({ 'email': req_email });
        if (!logUser) {
          return res.status(300).json({ 'error': 'Incorrect user' });
        }
        authenticator.options = { step: 360}
        logUser.twoFa = authenticator.generateSecret()
        await logUser.save();
        const token = authenticator.generate(logUser.twoFa);
        sendMail(req_email, token,'totp')
        return res.status(200).json({ 'checkClientUser': logUser});
      } catch (err) {
        console.error(err);
        return res.status(500).json({ 'alert': 'Fail checking user' });
      }
}

const changeClientPassword = async (req, res) => {
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
  var req_email = req.body.email;
  var req_pass = req.body.password;
  var req_confirm_pass = req.body.confirm_password;

 try{
    const user = await ClientUser.findOne({'email': req_email})
    if (!user) {
      return res.status(300).json({ 'error': 'Incorrect user' });
    }
}catch(err){
  console.log(err,"in catch")
  return (res,err)
}
try{
  if (!passwordRegex.test(req_pass)) {
    return res.status(300).json({ 'error':
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 6 characters long."
    });
  }
  if (!passwordRegex.test(req_confirm_pass)) {
    return res.status(300).json({ 'error':
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 6 characters long."
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
    console.log(err,"in catch")
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
  console.log(err,"in catch")
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
