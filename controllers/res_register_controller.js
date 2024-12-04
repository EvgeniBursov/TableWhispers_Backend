const ResClientUser = require('../models/Res_User')
const bcrypt = require('bcrypt')
const generator = require('username-generator');
const { sendMail } = require('../messages/email_message');

const createNewResUser = async (req, res) => {
  //need add checking correct pass number age ...
  var req_email = req.body.email;
  var req_first_name = req.body.first_name;
  var req_last_name = req.body.last_name;
  var req_age = req.body.age;
  var req_phone_number = req.body.phone_number;
  var req_pass = req.body.password;
  var req_confirm_pass = req.body.confirm_password;
  var req_city = req.body.city;
  var req_restaurant_name = req.body.restaurant_name;

  const check = validResRegister(req_email,req_first_name,req_last_name,
    req_age,req_phone_number,req_pass,req_confirm_pass,req_city,req_restaurant_name)


  try{
    const user = await ResClientUser.findOne({'email': req_email})
    if(user != null){
      return res.status(400).json({ error: 'the user is exist' });
    }
}catch(err){
  return (res,err)
}

try{
  const salt = await bcrypt.genSalt(10)
  const encryptedPwd = await bcrypt.hash(req_pass,salt)
  const username = generator.generateUsername().substring(0, 5);
  const check_user_name = await ResClientUser.findOne({'user_name': username})
  
  if(check_user_name != null){
    username = generator.generateUsername().substring(0, 6);
  }

  console.log("Generated Username:", username);

  const data = new ResClientUser({
    email: req_email,
    first_name: req_first_name,
    last_name: req_last_name,
    age: req_age,
    phone_number: req_phone_number,
    password: encryptedPwd,
    city: req_city,
    restaurant_name: req_restaurant_name,
    user_name: username, // need send user name
  })
  const new_res_user = await data.save()
  sendMail(req_email, username, "username")
  res.status(200).send(new_res_user);
}catch(err){
  res.status(400).send(err);
}
}


function validResRegister(email,first_name,last_name,age,phone_number,
  password,confirm_password,city,restaurant) {
  
  const nameRegex = /^[a-zA-Z]{2,}$/; // Minimum 2 letters, only alphabets
  const ageMin = 18; // Minimum age
  const phoneRegex = /^05\d{8}$/; // 10 digits, starting with 05
  const emailRegex = /^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.[a-zA-Z]{2,}$/; // Basic email format
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  const resNamewRegex = /^[a-zA-Z0-9]{2,}$/

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
    if (!nameRegex.test(city)) {
      errors.nameRegex =
          "City name must have at least 2 letters.";
    }
    if (!resNamewRegex.test(restaurant)) {
      errors.restaurant =
          "Restaurant name must have at least 2 letters or digits."
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
    createNewResUser,
  }