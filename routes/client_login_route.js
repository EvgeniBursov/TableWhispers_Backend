const express = require('express');
const router = express.Router();

const { LoginUser } = require('../controllers/client_login_controller')


//create a new user
router.post('/clientLogin', LoginUser);


/*
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/pages', 'signup.html'));
  })
  */



module.exports = router;
