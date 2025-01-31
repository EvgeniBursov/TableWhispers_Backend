const ClientUser = require('../models/Client_User')
const allergies = require('../models/Allergies')

const userData = async (req,res) =>{
    const req_email = req.query.email;
    try {
        const clientData = await ClientUser.findOne({ email: "bursov19951@gmail.com" }).populate('allergies', 'name');

        console.log("In User Data")
        if (!clientData) {
            console.log("In IF User Data")
          return res.status(404).json({ error: 'User not found' });
        }
        /*const now = new Date();
        const { upcomingReservations, pastReservations } = client.reservations.reduce(
          (acc, res) => {
            const reservationDate = new Date(res.date);
            if (reservationDate > now) {
              acc.upcomingReservations.push(res);
            } else {
              acc.pastReservations.push(res); 
            }
            return acc;
          },
          { upcomingReservations: [], pastReservations: [] }
        );*/

        res.status(200).json({
          first_name: clientData.first_name,
          last_name: clientData.last_name,
          age: clientData.age,
          email: clientData.email,
          phone_number: clientData.phone_number,
          //profileImage: clientData.profileImage,
          allergies: clientData.allergies.map(a => a.name),
          //upcomingReservations,
          //pastReservations
        });
      } catch (error) {
        res.status(500).json({ error: 'Server error' });
      }
}

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
    var req_email = req.body.email;
    var req_alergic = req.body.allergies;
    try {
        const user = await ClientUser.findOne({ 'email': req_email })
        if (user != null) {
            return res.status(400).json({ error: 'the user is exist' });
        }
        const updatedAllergies = user.allergies
            ? `${user.allergies}, ${newAllergy}`.trim()
            : newAllergy;
        user.allergies = updatedAllergies;
        await user.save();
        console.log('Allergy added successfully:', user.allergies);
    } catch (err) {
        console.error('Error adding allergy:');
        return (res, err)
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
        getListOfAllergies
    }