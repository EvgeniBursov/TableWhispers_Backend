const { OAuth2Client } = require('google-auth-library');
const ClientUser = require('../models/Client_User'); 
const jwt = require('jsonwebtoken'); 


const CLIENT_ID =  process.env.GOOGLE_AUTH;
const client = new OAuth2Client(CLIENT_ID);


const googleAuth = async (req, res) => {
  const { token, user_type } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Google token is required' });
  }
  
  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    
    // Get the payload from the verified token
    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture, sub: googleId } = payload;
    
    if (!email) {
      return res.status(400).json({ error: 'Email not provided in Google token' });
    }
    
    // Check if user already exists
    let user = await ClientUser.findOne({ email });
    
    if (!user) {
      // Create a new user if they don't exist
      user = new ClientUser({
        first_name: given_name || 'Google',
        last_name: family_name || 'User',
        email,
        user_type: user_type || 'Client',
        googleId,
        profileImage: picture,
        // Generate a secure random password for the user
        // They won't need to know this as they'll login with Google
        password: require('crypto').randomBytes(16).toString('hex'),
        phone_number: '', 
        age: 18, 
      });
      
      await user.save();
    } else {
      // Update existing user's Google info
      user.googleId = googleId;
      user.profileImage = picture || user.profileImage;
      
      // Only update names if they're empty in our DB
      if (!user.first_name && given_name) {
        user.first_name = given_name;
      }
      
      if (!user.last_name && family_name) {
        user.last_name = family_name;
      }
      
      await user.save();
    }
    
    // Create a JWT token for the user
    const userToken = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        userType: user.user_type
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // Return the success response with token
    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      token: userToken,
      user: {
        id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        profileImage: user.profileImage
      }
    });
    
  } catch (error) {
    console.error('Google authentication error:', error);
    return res.status(401).json({ 
      error: 'Invalid Google token',
      details: error.message
    });
  }
};

module.exports = {
  googleAuth
};