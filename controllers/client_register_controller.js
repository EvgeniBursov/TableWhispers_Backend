const ClientUser = require('../models/Client_User')
const bcrypt = require('bcrypt')
//TODO תנאי שימוש חסרים

const createNewUser = async (req, res) => {
  //need add checking correct pass number age ...
  console.log("front",req)
  var req_email = req.body.email;
  var req_first_name = req.body.first_name;
  var req_last_name = req.body.last_name;
  var req_age = req.body.age;
  var req_phone_number = req.body.phone_number;
  var req_pass = req.body.password;
  var req_confirm_pass = req.body.confirm_password;

  const check = validatRegister(req_email,req_first_name,req_last_name,req_age,req_phone_number,req_pass,req_confirm_pass)

  if (check.errors !== null) {
    return res.status(400).json({
        success: false,
        errors: check.errors,
        message: check.message,
    });
}
if (req_confirm_pass!== req_pass) {
  return res.status(400).json({ 'error': 'the passwords is not same' })
}
 try{
    const user = await ClientUser.findOne({'email': req_email})
    console.log(user,"in email")
    if(user != null){
      return res.status(400).json({ error: 'the user is exist' });
      //return res.status(400).json({ 'alert': 'the user is exist' });
    }
}catch(err){
  console.log(err,"in catch")
  return (res,err)
}
console.log("after email")
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
  console.log("after data")
  const new_user = await data.save()
  res.status(200).send(new_user);
}catch(err){
  res.status(400).send(err);
}
}



function validatRegister(email,first_name,last_name,age,phone_number,password,confirm_password) {
  
  const nameRegex = /^[a-zA-Z]{2,}$/; // Minimum 2 letters, only alphabets
  const ageMin = 16; // Minimum age
  const phoneRegex = /^05\d{8}$/; // 10 digits, starting with 05
  const emailRegex = /^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.[a-zA-Z]{2,}$/; // Basic email format
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

  /*
  const isFirstNameValid = nameRegex.test(firstName);
  const isLastNameValid = nameRegex.test(lastName);
  const isAgeValid = age >= ageMin;
  const isPhoneNumberValid = phoneRegex.test(phoneNumber);
  const isEmailValid = emailRegex.test(email);
  const isPasswordValid = passwordRegex.test(password);
  */

  const errors = {};

    if (!nameRegex.test(first_name)) {
        errors.firstName = "First name must have at least 2 letters.";
    }
    if (!nameRegex.test(last_name)) {
        errors.lastName = "Last name must have at least 2 letters.";
    }
    if (age < ageMin) {
        errors.age = "Age must be 16 or older.";
    }
    if (!phoneRegex.test(phone_number)) {
        errors.phoneNumber = "Phone number must be 10 digits and start with 05.";
    }
    if (!emailRegex.test(email)) {
        errors.email = "Email must be in the format name@name.com.";
    }
    if (!passwordRegex.test(password)) {
        errors.password =
            "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 6 characters long.";
    }
    if (!passwordRegex.test(confirm_password)) {
      errors.password =
          "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 6 characters long.";
  }

    return {
        success: Object.keys(errors).length === 0,
        errors: Object.keys(errors).length === 0 ? null : errors,
        message:
            Object.keys(errors).length === 0
                ? "Validation successful."
                : "Validation failed. Check the errors for more details.",
    };
}


  module.exports = {
    createNewUser,
  }