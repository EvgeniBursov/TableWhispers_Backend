const cron = require('node-cron');
const { sendMail } = require('../MessageSystem/email_message');
const UserOrder = require('../models/User_Order');

const dotenv = require('dotenv');
dotenv.config();
FRONT_API = process.env.FRONT_API

// Function to generate feedback link
const generateFeedbackLink = (order) => {
  return `${FRONT_API}/survey?order=${order._id}`;
};

// Function to generate personalized email message
function generateFeedbackMessage(order) {
  const link = generateFeedbackLink(order);
  // Check how to access client and restaurant data in your order model
  // These fields might have different names in your schema
  const clientName = order.client_id ? (order.client_id.firstName || 'Valued Customer') : 'Valued Customer';
  
  // Check which field holds the restaurant name in your schema
  let restaurantName = 'our restaurant';
  if (order.restaurant) {
    restaurantName = order.restaurant.name || 'our restaurant';
  } else if (order.restaurantId) {
    restaurantName = order.restaurantId.name || 'our restaurant';
  } else if (order.restaurant_name) {
    restaurantName = order.restaurant_name;
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
    // Adjust this query based on your schema structure
    // Find all orders from yesterday with status 'Done' or 'Seated'
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

    //console.log(`Found ${validOrders.length} valid orders from yesterday to send feedback emails`);

    // Send emails to each valid customer
    const emailPromises = validOrders.map(async (order) => {
      const feedbackMessage = generateFeedbackMessage(order);
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