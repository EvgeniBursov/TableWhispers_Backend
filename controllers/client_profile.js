const ClientUser = require('../models/Client_User')



const updateUserAlergic = async (req, res) => {
    var req_email = req.body.email;
    var req_alergic = req.body.alergic;
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

