const cron = require('node-cron');
const { sendMail } = require('../MessageSystem/email_message');
const UserOrder = require('../models/User_Order');
const ClientGuest = require('../models/ClientGuest');
const ClientUser = require('../models/Client_User');
const restaurants = require('../models/Restarunt')


const dotenv = require('dotenv');
dotenv.config();
FRONT_API = process.env.FRONT_API

// Function to generate feedback link
const generateFeedbackLink = (order) => {
  return `${FRONT_API}/survey?order=${order._id}`;
};

// Function to generate personalized email message
async function generateFeedbackMessage(order) {
  console.log(order)
  const link = generateFeedbackLink(order);
  let user;
  if (order.client_type === 'ClientUser') {
          user = await ClientGuest.findById(order.client_id._id);
        } else if (order.client_type === 'ClientGuest') {
          user = await ClientGuest.findById(order.client_id);
        }

  const clientName = user.first_name ? (user.first_name || 'Customer') : 'Customer';
  const restaurantData = await restaurants.findById(order.restaurant)

  let restaurantName = restaurantData.res_name;
  if (restaurantName) {
    restaurantName = 'our restaurant';
  }
  
  return `
Hello ${clientName},
Thank you for dining with us at ${restaurantName}!

We hope you enjoyed your experience with us. Your feedback is important to us and helps us continuously improve our service.

Please take a moment to rate your experience by clicking the link below:
${link}

This survey will only take a minute of your time, and your feedback is invaluable to us.

Thank you for choosing ${restaurantName}!

Best regards,
The Restaurant Team
`;
}

// Main function to send feedback emails
async function sendRestaurantFeedbackEmails() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
  const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));
  
  
  try {
    const orders = await UserOrder.find({
      start_time: {
        $gte: startOfYesterday,
        $lte: endOfYesterday
      },
      status: { $in: ['Done', 'Seated'] }
    })
    // Populate client information - adjust field name if needed
    .populate({
      path: 'client_id',
      match: { email: { $exists: true, $ne: null } },
      select: 'email firstName lastName'
    });
    // Filter out orders without valid client email
    const validOrders = orders.filter(order =>
      order.client_id &&
      order.client_id.email &&
      order.client_id.email.trim() !== ''
    );

    const emailPromises = validOrders.map(async (order) => {
      
      const feedbackMessage = await generateFeedbackMessage(order);
      const email = order.client_id.email;

      try {
        await sendMail(email, feedbackMessage, 'feedback_request');
        //console.log(`Feedback email sent to ${email}`);
      } catch (err) {
        console.error(`Failed to send feedback to ${email}:`, err);
      }
    });

    await Promise.all(emailPromises);
    //console.log(`Successfully sent ${emailPromises.length} feedback emails`);
  } catch (err) {
    console.error('Error sending feedback emails:', err);
  }
}

// Schedule daily feedback emails
function scheduleDailyFeedbackEmails() {
  //sendRestaurantFeedbackEmails()
  cron.schedule('0 10 * * *', async () => {
    console.log('Triggering scheduled feedback emails...');
    await sendRestaurantFeedbackEmails();
  });
}

module.exports = {
  scheduleDailyFeedbackEmails,
  sendRestaurantFeedbackEmails,
  generateFeedbackLink
};