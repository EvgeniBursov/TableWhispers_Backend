// tests/restaurant_data_controller.test.js
const {
  all_Restaurants_Data,
  add_New_Reviews,
  create_Reservation,
  update_Reservation_Status,
  get_Restaurant_Menu
} = require('../restaurant_data/restaurant_data');

const restaurants = require('../models/Restarunt');
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const Review = require('../models/Reviews');
const Table = require('../models/Tables');

// Mock dependencies
jest.mock('../models/Restarunt');
jest.mock('../models/User_Order');
jest.mock('../models/Client_User');
jest.mock('../models/Reviews');
jest.mock('../models/Tables');
jest.mock('../MessageSystem/email_message');

describe('Restaurant Data Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      app: {
        get: jest.fn().mockReturnValue({
          emit: jest.fn(),
          to: jest.fn().mockReturnThis()
        })
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('all_Restaurants_Data', () => {
    test('should return specific restaurant data when ID provided', async () => {
      req.params.id = '67937038eb604c7927e85d2a';
      
      const mockRestaurant = {
        _id: '67937038eb604c7927e85d2a',
        res_name: 'Test Restaurant',
        phone_number: '0501234567',
        city: 'Tel Aviv',
        menu: [],
        reviews: []
      };

      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockRestaurant)
        })
      });

      await all_Restaurants_Data(req, res);

      expect(restaurants.findById).toHaveBeenCalledWith('67937038eb604c7927e85d2a');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockRestaurant);
    });

    test('should return 404 when restaurant not found', async () => {
      req.params.id = 'nonexistent';
      
      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      await all_Restaurants_Data(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Restaurant not found' });
    });

    test('should return all restaurants when no ID provided', async () => {
      const mockRestaurants = [
        { _id: '1', res_name: 'Restaurant 1' },
        { _id: '2', res_name: 'Restaurant 2' }
      ];

      restaurants.find.mockResolvedValue(mockRestaurants);

      await all_Restaurants_Data(req, res);

      expect(restaurants.find).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockRestaurants);
    });

    test('should handle database errors', async () => {
      req.params.id = '67937038eb604c7927e85d2a';
      
      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockRejectedValue(new Error('DB Error'))
        })
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await all_Restaurants_Data(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('add_New_Reviews', () => {

    test('should return 400 when required fields missing', async () => {
      req.body = {
        restaurant_Id: '67937038eb604c7927e85d2a'
        // Missing other required fields
      };

      await add_New_Reviews(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing required fields'
      });
    });

    test('should return 404 when user not found', async () => {
      req.body = {
        restaurant_Id: '67937038eb604c7927e85d2a',
        user_email: 'notfound@example.com',
        review: 'Great restaurant!',
        rating: 5
      };

      ClientUser.findOne.mockResolvedValue(null);

      await add_New_Reviews(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('create_Reservation', () => {
    test('should return 404 when restaurant not found', async () => {
      req.body = {
        restaurant_Id: 'nonexistent',
        user_email: 'test@example.com',
        time: '7:00 PM',
        day: 'monday',
        guests: 4
      };

      restaurants.findById.mockResolvedValue(null);

      await create_Reservation(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Restaurant not found'
      });
    });

    test('should return 400 when email missing', async () => {
      req.body = {
        restaurant_Id: '67937038eb604c7927e85d2a',
        time: '7:00 PM',
        day: 'monday',
        guests: 4
      };

      await create_Reservation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required for reservation'
      });
    });
  });

  describe('update_Reservation_Status', () => {
    test('should update reservation status successfully', async () => {
      req.body = {
        reservation_id: 'reservation123',
        status: 'Confirmed',
        restaurant_id: '67937038eb604c7927e85d2a'
      };

      const mockReservation = {
        _id: 'reservation123',
        status: 'Planning',
        client_type: 'ClientUser',
        client_id: 'user123',
        restaurant: { _id: '67937038eb604c7927e85d2a', res_name: 'Test Restaurant' },
        guests: 4,
        start_time: new Date(),
        end_time: new Date(),
        tableNumber: 1,
        save: jest.fn().mockResolvedValue()
      };

      UserOrder.findById.mockResolvedValue(mockReservation);
      UserOrder.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            ...mockReservation,
            status: 'Confirmed'
          })
        })
      });

      await update_Reservation_Status(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reservation status updated successfully',
        reservation: expect.any(Object)
      });
    });

    test('should return 404 when reservation not found', async () => {
      req.body = {
        reservation_id: 'nonexistent',
        status: 'Confirmed'
      };

      UserOrder.findById.mockResolvedValue(null);

      await update_Reservation_Status(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Reservation not found'
      });
    });
  });

  describe('get_Restaurant_Menu', () => {
    test('should return restaurant menu successfully', async () => {
      req.params.id = '67937038eb604c7927e85d2a';
      
      const mockMenu = [
        {
          title: 'Main Courses',
          items: [
            { name: 'Pasta', price: 35, description: 'Delicious pasta' }
          ]
        }
      ];
      const mockRestaurant = {
        _id: '67937038eb604c7927e85d2a',
        menu: mockMenu
      };

      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockRestaurant)
      });

      await get_Restaurant_Menu(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        menu: mockMenu
      });
    });

    test('should return 400 when restaurant ID missing', async () => {
      req.params = {};

      await get_Restaurant_Menu(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Restaurant ID is required'
      });
    });

    test('should return 404 when restaurant not found', async () => {
      req.params.id = 'nonexistent';

      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await get_Restaurant_Menu(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Restaurant not found'
      });
    });

    test('should return empty menu when no menu items', async () => {
      req.params.id = '67937038eb604c7927e85d2a';
      
      const mockRestaurant = {
        _id: '67937038eb604c7927e85d2a',
        menu: []
      };

      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockRestaurant)
      });

      await get_Restaurant_Menu(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'No menu items found for this restaurant',
        menu: []
      });
    });
  });
});