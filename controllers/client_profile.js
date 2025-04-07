const ClientUser = require('../models/Client_User')
const allergies = require('../models/Allergies')

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const profileImagesDir = path.join(__dirname, '../public/profile_images/');

const userData = async (req, res) => {
  const req_email = req.query.email;
  try {
    const clientData = await ClientUser.findOne({ email: req_email })      
      .populate('allergies', 'name')
      .populate({
        path: 'orders',
        select: 'restaurant guests status orderDate',
        populate: {
          path: 'restaurant',
          select: 'res_name phone_number city description'
        }
      });

    if (!clientData) {
      console.log("In IF User Data");
      return res.status(404).json({ error: 'User not found' });
    }
    const ordersWithRestaurantDetails = Array.isArray(clientData.orders)
      ? clientData.orders.map(order => ({
          restaurantName: order.restaurant.res_name,
          restaurantPhone: order.restaurant.phone_number,
          restaurantCity: order.restaurant.city,
          restaurantDescription: order.restaurant.description,
          guests: order.guests,
          status: order.status,
          orderDate: order.orderDate,
      })
    ):ordersWithRestaurantDetails
    console.log(ordersWithRestaurantDetails)
    
    res.status(200).json({
      first_name: clientData.first_name,
      last_name: clientData.last_name,
      age: clientData.age,
      email: clientData.email,
      phone_number: clientData.phone_number,
      allergies: clientData.allergies.map(a => a.name),
      orders: ordersWithRestaurantDetails,
      profileImage: clientData.profileImage
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Server error' });
  }
};

if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profileImagesDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 megabytes
  },
  fileFilter: fileFilter
});

// Function to handle profile image updates
const updateUserProfileImage = async (req, res) => {
  try {
    const userEmail = req.body.email;
    
    // Find user in database
    const client_user = await ClientUser.findOne({ 'email': userEmail });
    if (!client_user) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'User not found' });
    }
    
    // Get path to the newly uploaded file
    const profileImagePath = '/public/profile_images/' + req.file.filename;
    
    // Delete previous image if it exists and isn't a default image
    if (client_user.profileImage && !client_user.profileImage.includes('default')) {
      const oldImagePath = path.join(__dirname, '../public', client_user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // Update image path in database
    client_user.profileImage = profileImagePath;
    
    // Ensure valid user_type to prevent validation error
    if (!client_user.user_type) {
      client_user.user_type = 'client';
    }
    
    await client_user.save();
    
    return res.status(200).json({
      message: 'Profile image updated successfully',
      profileImage: profileImagePath
    });
    
  } catch (error) {
    console.error('Error updating profile image:', error);
    
    // Delete uploaded file in case of error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      error: 'Failed to update profile image',
      details: error.message
    });
  }
};

// Middleware for single image upload
const uploadSingleImage = upload.single('profileImage');

// Create endpoint handler
const updateProfileImageHandler = (req, res) => {
  uploadSingleImage(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        error: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        error: `File upload failed: ${err.message}`
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file uploaded'
      });
    }
    
    updateUserProfileImage(req, res);
  });
};
/*
const userData = async (req,res) =>{
  const req_email = req.query.email;
  try {
      const clientData = await ClientUser.findOne({ email: "bursov19951@gmail.com" })
      .populate('allergies', 'name')
      .populate({
        path: 'orders',
        select: 'restaurant guests status orderDate', // בחר את השדות שאתה רוצה להחזיר מההזמנות
        populate: {
          path: 'restaurant',
          select: 'res_name phone_number city description' // שליפה של פרטי המסעדה
        }
      });
      console.log(clientData.orders)
    console.log("In User Data");
    if (!clientData) {
      console.log("In IF User Data");
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      first_name: clientData.first_name,
      last_name: clientData.last_name,
      age: clientData.age,
      email: clientData.email,
      phone_number: clientData.phone_number,
      allergies: clientData.allergies.map(a => a.name),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
*/




const deleteClientProfile = async (req, res) => {
    const { email: req_email } = req.body;
  
    try {
      const client_user = await ClientUser.findOne({ email: req_email });
      console.log("Found user:", client_user);
  
      if (!client_user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Perform the deletion and capture the result
      const result = await ClientUser.deleteOne({ email: req_email });
  
      // Check if a user was deleted
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'No user found to delete' });
      }
  
      // Return success message
      return res.status(200).json({ message: 'User deleted successfully' });
  
    } catch (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  };
  


  const updateUserAlergic = async (req, res) => {
    const { email, name_allergies, type } = req.body;
    console.log(email, name_allergies, type)
    try {
        const allergyDoc = await allergies.findOne({ name: name_allergies });
        if (!allergyDoc) {
            return res.status(404).json({ error: 'Allergy not found in database' });
        }
        const user = await ClientUser.findOne({ email }).populate('allergies');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
 
        if (type === "update") {
            const hasAllergy = user.allergies.some(a => a._id.equals(allergyDoc._id));
            if (hasAllergy) {
                return res.status(400).json({ error: 'User already has this allergy' });
            }
            user.allergies.push(allergyDoc._id);
        } 
        else if (type === "remove") {
            user.allergies = user.allergies.filter(a => !a._id.equals(allergyDoc._id));
        }
        await user.save();
        const updatedUser = await ClientUser.findOne({ email }).populate('allergies');
        
        return res.status(200).json({ 
            message: `Allergy ${type === "update" ? "added" : "removed"} successfully`,
            allergies: updatedUser.allergies.map(a => a.name)
        });
 
    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({ error: err.message });
    }
 }


const getListOfAllergies = async (req,res) =>{
  try {
    const ListOfAllergies = await allergies.find({}, 'name');
    if (!ListOfAllergies || ListOfAllergies.length === 0) {
      console.log("No allergies found");
      return res.status(404).json({ error: 'No allergies found' });
    }
    return res.status(200).json(ListOfAllergies);
    
  } catch (err) {
    console.error('Error getting allergies:', err);
    return res.status(500).json({ error: err.message });
  }
}


const updateUserPhoneNumber = async (req, res) => {
    const req_email = req.body.email;
    const req_number = req.body.phone_number;
    const phoneRegex = /^05\d{8}$/; // 10 digits, starting with 05
    try {
        const client_user = await ClientUser.findOne({ 'email': req_email })
        if (!client_user) {
            return res.status(400).json({ error: 'the user is not exist' });
        }
        if (!client_user.user_type) {
          client_user.user_type = 'Client';
        }
        if (!phoneRegex.test(req_number)) {
            return res.status(300).json({
                'error':
                    "Phone number must be 10 digits and start with 05."
            });
        }
        client_user.phone_number = req_number;
        await client_user.save();
        return res.status(200).json({ message: 'phone_number changed successfully' });
    } catch (err) {
        //return res.status(404).json({ error: 'Error phone number not changed' });
        console.error('Error updating phone number:', err);
        return res.status(500).json({ 
            error: 'Server error while updating phone number',
            details: err.message 
        });
    }
}

//const createNewOrder = async (req, res) => 

//const updateUserOrderList = async (req, res) =>

    module.exports = {
        userData,
        deleteClientProfile,
        getListOfAllergies,
        updateUserAlergic,
        updateUserPhoneNumber,
        updateProfileImageHandler
    }