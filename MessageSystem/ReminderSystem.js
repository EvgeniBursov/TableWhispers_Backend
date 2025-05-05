const cron = require('node-cron');
const { sendMail } = require('./email_message');
const UserOrder = require('../models/User_Order');
const ClientGuest = require('../models/ClientGuest');
const ClientUser = require('../models/Client_User');

async function sendRestaurantReminderEmails() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1); // Set to tomorrow

  const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
  const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

  try {
    // Find orders scheduled for tomorrow with status "Planning"
    const orders = await UserOrder.find({
      start_time: {
        $gte: startOfTomorrow,
        $lte: endOfTomorrow
      },
      status: { $in: ['Planning'] } // Status changed to "Planning"
    }).populate('restaurant','res_name phone_number full_address');

    // Process each order individually
    const emailPromises = orders.map(async (order) => {
      if (!order.client_id) {
        console.error(`Order ${order._id} does not have a client_id`);
        return; // Skip this order if client_id is missing
      }
      console.log(order)

      let user = null;
      let email = null;

      // Check if the client_type is 'ClientUser' or 'ClientGuest'
      if (order.client_type === 'ClientUser') {
        // Client is a registered user
        user = await ClientUser.findById(order.client_id);
      } else if (order.client_type === 'ClientGuest') {
        // Client is a guest
        user = await ClientGuest.findById(order.client_id);
      }

      // Make sure the user object is valid and email is available
      if (user && user.email) {
        email = user.email;
      }

      // If email exists, send reminder
      if (email) {
        const reminderMessage = generateReminderMessage(order);
        try {
          await sendMail(email, reminderMessage, 'reminder_request');
          console.log(`Reminder email sent to ${email}`);
        } catch (err) {
          console.error(`Failed to send reminder to ${email}:`, err);
        }
      } else {
        console.error(`No valid email found for order ${order._id}`);
      }
    });

    // Wait for all emails to be sent
    await Promise.all(emailPromises);
  } catch (err) {
    console.error('Error sending reminder emails:', err);
  }
}

function generateReminderMessage(order) {
    const { start_time, end_time, restaurant, guests } = order;
    const formattedStartTime = start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedEndTime = end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = start_time.toLocaleDateString();
    
    const res_name = restaurant.res_name;
    const phone = restaurant.phone_number;
    const address = restaurant.full_address;
  
    return `
  Hello,
  
  This is a friendly reminder about your reservation at ${res_name} for ${guests} guests, scheduled for ${date}.
  
  Order details:
  - Start time: ${formattedStartTime}
  - End time: ${formattedEndTime}
  
  If you have any questions or need further assistance, feel free to contact us ${phone}.
  Our address: ${address}
  
  Thank you for choosing ${res_name}. We look forward to serving you!
  
  Best regards,
  The ${res_name} Team
  `;
  }


function scheduleDailyReminderEmails() {
  cron.schedule('30 10 * * *', async () => {
    console.log('Triggering scheduled reminder emails...');
    await sendRestaurantReminderEmails();
  });
}

module.exports = {
  scheduleDailyReminderEmails
};

