const nodemailer = require('nodemailer')
const { authenticator } = require('otplib');

const dotenv = require('dotenv')
dotenv.config()


authenticator.options = { step: 360 };
console.log("Current time step:", authenticator.options.step);

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    service: 'gmail',
    port: '465',
    secure: true,
    auth: {
      user: process.env.EMAIL, 
      pass: process.env.EMAIL_PASSWORD,
    },
  });

async function sendMail(mail, token, scenario) {
  let message;
  switch (scenario) {
    case 'username':
        message = `Your username is: ${token}`;
        break;
    case 'totp':
        message = `Your TOTP is: ${token}`;
        break;
    case 'password':
        message = `Your password is: ${token}`;
        break;
    default:
        message = `Your information is: ${token}`;
        break;
      
}

  const mailOptions = {
      from: {
          name: 'Evgeni',
          address: process.env.EMAIL,
      },  
      to: mail,
      subject: 'Your Inforamtion from TableWhispers',
      text: message,
  };

  try {
      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully");
  } catch (error) {
      console.error("Error sending email:", error);
  }
}

module.exports = { sendMail };
