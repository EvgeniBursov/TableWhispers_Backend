const ClientUser = require('../models/Client_User')
const bcrypt = require('bcrypt')


const createNewUser = async (req, res) => {
  //need add checking correct pass number age ...
  var req_email = req.body.email;
  var req_first_name = req.body.first_name;
  var req_last_name = req.body.last_name;
  var req_age = req.body.age;
  var req_phone_number = req.body.phone_number;
  var req_pass = req.body.password;
  
  try{
    const user = await ClientUser.findOne({'email': req_email})
    if(user != null){
      return res.json({ 'error': 'the user is exist' });
    }
}catch(err){
  return (res,err)
}

try{
  const salt = await bcrypt.genSalt(10)
  const encryptedPwd = await bcrypt.hash(req_pass,salt)
  const data = new ClientUser({
    email: req_email,
    first_name: req_first_name,
    last_name: req_last_name,
    age: req_age,
    phone_number: req_phone_number,
    password: encryptedPwd,
  })
  const new_user = await data.save()
  res.status(200).send(new_user);
}catch(err){
  res.status(400).send(err);
}
}



  module.exports = {
    createNewUser,
  }