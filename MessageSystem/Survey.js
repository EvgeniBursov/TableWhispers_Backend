const SurveyResponse = require('../models/Survey_Schema');
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const ClientGuest = require('../models/ClientGuest');
const restaurants = require('../models/Restarunt')

// Validate survey request and get order details
const validateSurvey = async (req, res) => {
  try {
    const { order_id } = req.query;
    
    if (!order_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request. Order ID is required.' 
      });
    }
    
    // Check if survey already submitted for this order
    const existingSurvey = await SurveyResponse.findOne({ order_id });
    if (existingSurvey) {
      return res.status(400).json({ 
        success: false, 
        message: 'A survey has already been submitted for this order.' 
      });
    }
    
    // Get order details - adjust populate paths based on your schema
    const order = await UserOrder.findById(order_id)
      .populate('client_id', 'email firstName lastName');
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found.' 
      });
    }
    
    // Check if order status is valid for survey
    if (!['Done', 'Seated'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'This order is not eligible for a survey.' 
      });
    }
    
    // Build restaurant name from whichever field is available in your schema
    let restaurantName = "Restaurant";
    if (order.restaurant && order.restaurant.name) {
      restaurantName = order.restaurant.name;
    } else if (order.restaurantId && order.restaurantId.name) {
      restaurantName = order.restaurantId.name;
    } else if (order.restaurant_name) {
      restaurantName = order.restaurant_name;
    }
    
    res.json({
      success: true,
      orderDetails: {
        order_id: order._id,
        restaurantName: restaurantName,
        clientName: order.client_id ? `${order.client_id.firstName || ''} ${order.client_id.lastName || ''}`.trim() : '',
        orderDate: order.start_time,
        status: order.status
      }
    });
    
  } catch (error) {
    console.error('Error validating survey:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

// Submit survey
const submitSurvey = async (req, res) => {
  try {
    const { order_id, ratings } = req.body;
    
    if (!order_id || !ratings) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request. Order ID and ratings are required.' 
      });
    }
    
    // Validate all ratings
    const ratingFields = ['food', 'service', 'ambiance', 'cleanliness', 'overall'];
    for (const field of ratingFields) {
      if (!ratings[field] || ratings[field] < 1 || ratings[field] > 5) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid ${field} rating. Must be between 1 and 5.` 
        });
      }
    }
    
    // Check if survey already submitted for this order
    const existingSurvey = await SurveyResponse.findOne({ order_id: order_id });
    if (existingSurvey) {
      return res.status(400).json({ 
        success: false, 
        message: 'A survey has already been submitted for this order.' 
      });
    }
    
    // Create new survey response
    const surveyResponse = new SurveyResponse({
      order_id,
      ratings
    });
    
    await surveyResponse.save();
    
    const sumRatings = ratingFields.reduce((sum, field) => sum + ratings[field], 0);
    const rawAvg = sumRatings / ratingFields.length;
    let roundedAvg;
    const floorPart = Math.floor(rawAvg);
    const fraction = rawAvg - floorPart;
    if (fraction >= 0.5) {
      roundedAvg = Math.ceil(rawAvg);
    } else {
      roundedAvg = Math.floor(rawAvg);
    }
    const populatedRestaurant = await UserOrder.findById(order_id)
    .populate('restaurant');
    const restaurant = populatedRestaurant.restaurant;
    const oldCount = restaurant.number_of_rating || 0;
    const newCount = oldCount + 1;
    restaurant.number_of_rating = newCount;
    const oldRating = restaurant.rating;
    const newTotal = oldRating * oldCount + roundedAvg;
    const newAvg = parseFloat((newTotal / newCount).toFixed(1));
    restaurant.rating = newAvg;
    await restaurant.save();
    
    res.status(201).json({
      success: true,
      message: 'Survey submitted successfully.',
      survey_id: surveyResponse._id
    });
    
  } catch (error) {
    console.error('Error submitting survey:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

// Get surveys for a restaurant - use appropriate field names based on your schema
const getRestaurantSurveys = async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    
    // Verify restaurant ownership (assuming auth middleware has already run)
    if (req.user.restaurant_id && req.user.restaurant_id.toString() !== restaurant_id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view surveys for this restaurant.'
      });
    }
    const restaurantOrders = await UserOrder.find({
      $or: [
        { restaurant: restaurant_id },
        { restaurantId: restaurant_id },
        { restaurant_id: restaurant_id }
      ]
    }).select('_id');
    
    const orderIds = restaurantOrders.map(order => order._id);
    
    // Get all surveys for these orders
    const surveys = await SurveyResponse.find({ 
      order_id: { $in: orderIds } 
    }).populate({
      path: 'order_id',
      select: 'start_time end_time status',
      populate: {
        path: 'client_id',
        select: 'firstName lastName email'
      }
    }).sort({ submitted_at: -1 });
    
    // Calculate average ratings
    const ratingFields = ['food', 'service', 'ambiance', 'cleanliness', 'overall'];
    let totalRatings = {
      food: 0,
      service: 0,
      ambiance: 0,
      cleanliness: 0,
      overall: 0,
      count: surveys.length
    };
    
    surveys.forEach(survey => {
      ratingFields.forEach(field => {
        totalRatings[field] += survey.ratings[field];
      });
    });
    
    // Calculate averages
    const averageRatings = {};
    if (surveys.length > 0) {
      ratingFields.forEach(field => {
        averageRatings[field] = (totalRatings[field] / surveys.length).toFixed(1);
      });
    } else {
      ratingFields.forEach(field => {
        averageRatings[field] = "0.0";
      });
    }
    
    res.json({
      success: true,
      surveys: surveys,
      statistics: {
        total_surveys: surveys.length,
        average_ratings: averageRatings
      }
    });
    
  } catch (error) {
    console.error('Error fetching restaurant surveys:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

const getRestaurantSurveysDetailed = async (req, res) => {
    try {
      const restaurant_id = req.params.id;
      if (!restaurant_id) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant ID is required'
        });
      }
      
      // Find all orders for this restaurant
      const restaurantOrders = await UserOrder.find({
        restaurant: restaurant_id
      }).select('_id client_id client_type status start_time end_time guests tableNumber');
      
      const orderIds = restaurantOrders.map(order => order._id);
      
      // Get all surveys for these orders
      const surveyResponses = await SurveyResponse.find({ 
        order_id: { $in: orderIds } 
      }).sort({ submitted_at: -1 });
      
      // Create a map of orderIds to orders for easier lookup
      const orderMap = new Map();
      restaurantOrders.forEach(order => {
        orderMap.set(order._id.toString(), order);
      });
      
      // Get unique client IDs from orders
      const clientIds = [...new Set(restaurantOrders
        .filter(order => order.client_id)
        .map(order => order.client_id.toString()))];
      
      // Fetch all client users in one query
      const clientUsers = await ClientUser.find({
        _id: { $in: clientIds }
      }).select('_id first_name last_name email phone_number profileImage');
      
      // Create map of client IDs to client information
      const clientMap = new Map();
      clientUsers.forEach(client => {
        clientMap.set(client._id.toString(), client);
      });
      
      // Fetch all guest clients if needed
      const guestClientIds = [...new Set(restaurantOrders
        .filter(order => order.client_type === 'ClientGuest')
        .map(order => order.client_id.toString()))];
      
      if (guestClientIds.length > 0) {
        const guestClients = await ClientGuest.find({
          _id: { $in: guestClientIds }
        }).select('_id first_name last_name email phone_number');
        
        guestClients.forEach(client => {
          clientMap.set(client._id.toString(), client);
        });
      }
      
      // Build detailed survey responses with order and client information
      const detailedSurveys = surveyResponses.map(survey => {
        const order = orderMap.get(survey.order_id.toString());
        let clientInfo = null;
        
        if (order && order.client_id) {
          clientInfo = clientMap.get(order.client_id.toString()) || null;
        }
        
        return {
          survey_id: survey._id,
          order_id: survey.order_id,
          submitted_at: survey.submitted_at,
          ratings: survey.ratings,
          average_rating: (
            survey.ratings.food + 
            survey.ratings.service + 
            survey.ratings.ambiance + 
            survey.ratings.cleanliness + 
            survey.ratings.overall
          ) / 5,
          order_details: order ? {
            order_date: order.start_time,
            status: order.status,
            guests: order.guests,
            table_number: order.tableNumber
          } : null,
          client: clientInfo ? {
            id: clientInfo._id,
            name: `${clientInfo.first_name} ${clientInfo.last_name}`,
            email: clientInfo.email,
            phone: clientInfo.phone_number,
            profile_image: clientInfo.profileImage || null,
            client_type: order ? order.client_type : null
          } : null
        };
      });
      
      // Calculate statistics
      const totalSurveys = detailedSurveys.length;
      let totalRatings = {
        food: 0,
        service: 0,
        ambiance: 0,
        cleanliness: 0,
        overall: 0
      };
      
      // Rating distribution (1-5 stars for each category)
      const ratingDistribution = {
        food: [0, 0, 0, 0, 0],
        service: [0, 0, 0, 0, 0],
        ambiance: [0, 0, 0, 0, 0],
        cleanliness: [0, 0, 0, 0, 0],
        overall: [0, 0, 0, 0, 0]
      };
      
      detailedSurveys.forEach(survey => {
        // Add to totals
        totalRatings.food += survey.ratings.food;
        totalRatings.service += survey.ratings.service;
        totalRatings.ambiance += survey.ratings.ambiance;
        totalRatings.cleanliness += survey.ratings.cleanliness;
        totalRatings.overall += survey.ratings.overall;
        
        // Add to distribution
        ratingDistribution.food[survey.ratings.food - 1]++;
        ratingDistribution.service[survey.ratings.service - 1]++;
        ratingDistribution.ambiance[survey.ratings.ambiance - 1]++;
        ratingDistribution.cleanliness[survey.ratings.cleanliness - 1]++;
        ratingDistribution.overall[survey.ratings.overall - 1]++;
      });
      
      // Calculate averages
      const averageRatings = {};
      if (totalSurveys > 0) {
        averageRatings.food = (totalRatings.food / totalSurveys).toFixed(1);
        averageRatings.service = (totalRatings.service / totalSurveys).toFixed(1);
        averageRatings.ambiance = (totalRatings.ambiance / totalSurveys).toFixed(1);
        averageRatings.cleanliness = (totalRatings.cleanliness / totalSurveys).toFixed(1);
        averageRatings.overall = (totalRatings.overall / totalSurveys).toFixed(1);
        averageRatings.combined = ((totalRatings.food + totalRatings.service + 
                                  totalRatings.ambiance + totalRatings.cleanliness + 
                                  totalRatings.overall) / (totalSurveys * 5)).toFixed(1);
      }
      
      res.json({
        success: true,
        total_surveys: totalSurveys,
        statistics: {
          average_ratings: averageRatings,
          rating_distribution: ratingDistribution
        },
        surveys: detailedSurveys
      });
      
    } catch (error) {
      console.error('Error fetching detailed restaurant surveys:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error. Unable to fetch survey data.' 
      });
    }
  };










module.exports = {
  validateSurvey,
  submitSurvey,
  getRestaurantSurveys,
  getRestaurantSurveysDetailed
};