const ClientUser = require('../models/Client_User')
const allergies = require('../models/Allergies')

const userData = async (req, res) => {
  const req_email = req.query.email;
  try {
    const clientData = await ClientUser.findOne({ email: "bursov19951@gmail.com" })      
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
      orders: ordersWithRestaurantDetails, // הוסף את ההזמנות עם פרטי המסעדה
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Server error' });
  }
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
    var req_email = req.body.email;
    var req_number = req.body.phone_number;
    const phoneRegex = /^05\d{8}$/; // 10 digits, starting with 05
    try {
        const user = await ClientUser.findOne({ 'email': req_email })
        if (user != null) {
            return res.status(400).json({ error: 'the user is exist' });
        }
        if (!phoneRegex.test(req_number)) {
            return res.status(300).json({
                'error':
                    "Phone number must be 10 digits and start with 05."
            });
        }
        user.phone_number = req_number;
        await user.save();
        console.log('phone_number changed successfully:', user.allergies);
    } catch (err) {
        console.error('Error phone_number not changed ');
        return (res, err)
    }

}

//const createNewOrder = async (req, res) => 

//const updateUserOrderList = async (req, res) =>

    module.exports = {
        userData,
        deleteClientProfile,
        getListOfAllergies,
        updateUserAlergic
    }