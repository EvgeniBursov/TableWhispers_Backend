const ClientUser = require('../models/Client_User')
const allergies = require('../models/Allergies')
const UserOrder = require('../models/User_Order')

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { io } = require('../app')

const profileImagesDir = path.join(__dirname, '../public/profile_images/');

const userData = async (req, res) => {
  const req_email = req.query.email;
  try {
    const clientData = await ClientUser.findOne({ email: req_email })      
      .populate('allergies', 'name')
      .populate({
        path: 'orders',
        select: 'id restaurant guests status orderDate start_time end_time',
        populate: {
          path: 'restaurant',
          select: 'res_name phone_number city description'
        }
      });

    if (!clientData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Define date formatting functions
    const formatTime = (timeString) => {
      if (!timeString) return null;
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false // Use 24-hour format
      });
    };

    const formatDate = (dateString) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    const ordersWithRestaurantDetails = Array.isArray(clientData.orders)
      ? clientData.orders.map(order => {
          return {
            order_id: order._id,
            restaurantName: order.restaurant?.res_name || "Unknown Restaurant",
            restaurantPhone: order.restaurant?.phone_number || "",
            restaurantCity: order.restaurant?.city || "",
            restaurantDescription: order.restaurant?.description || "",
            guests: order.guests || 0,
            status: order.status || "",
            orderDate: formatDate(order.orderDate),
            orderStart: formatTime(order.start_time),
            orderEnd: formatTime(order.end_time)
          };
      })
      : [];  // Return empty array if no orders
    
    console.log(ordersWithRestaurantDetails);
    
    res.status(200).json({
      first_name: clientData.first_name || "",
      last_name: clientData.last_name || "",
      age: clientData.age || null,
      email: clientData.email || "",
      phone_number: clientData.phone_number || "",
      allergies: Array.isArray(clientData.allergies) 
        ? clientData.allergies.map(a => a.name)
        : [],
      orders: ordersWithRestaurantDetails, // Include the orders in the response
      profileImage: clientData.profileImage || ""
    });
  } catch (error) {
    console.error("Error in userData function:", error);
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

const cancelUpcomingOrders = async (req, res) => {
  console.log("Start cancel Upcoming Orders")
  const order_id = req.body.orderId;
  
  // Validate order ID
  if (!order_id) {
    return res.status(400).json({ error: 'Order ID is required' });
  }
  
  try {
    // Find the order by ID and populate restaurant and user details
    const order = await UserOrder.findById(order_id).populate('restaurant');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Update status to "Cancelled"
    order.status = 'Cancelled';
    await order.save();
    
    // Get the Socket.IO instance from the app
    const io = req.app.get('socketio');
    
    if (io) {
      // Create client name from available information
      const clientName = order.user ? 
        `${order.user.first_name} ${order.user.last_name}` : 
        (order.client_name || 'Customer');
      
      // Emit cancellation event to restaurant's room
      io.to(`restaurant_${order.restaurant._id}`).emit('orderCancelled', {
        orderId: order._id,
        clientName: clientName,
        clientEmail: order.user ? order.user.email : null,
        reservationDate: order.orderDate,
        startTime: order.start_time,
        endTime: order.end_time,
        guests: order.guests,
        reason: 'Cancelled by client',
        cancelledAt: new Date()
      });
      
      console.log(`Emitted orderCancelled event to restaurant_${order.restaurant._id}`);
    } else {
      console.warn('Socket.IO instance not available');
    }
    
    return res.status(200).json({ 
      message: 'Order cancelled successfully',
      orderId: order._id
    });
    
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({ 
      error: 'Failed to cancel order',
      details: error.message 
    });
  }
};



    module.exports = {
        userData,
        deleteClientProfile,
        getListOfAllergies,
        updateUserAlergic,
        updateUserPhoneNumber,
        updateProfileImageHandler,
        cancelUpcomingOrders
    }