// tests/client_profile_controller.test.js
const {
  userData,
  deleteClientProfile,
  updateUserAlergic,
  updateUserPhoneNumber,
  cancelUpcomingOrders,
  getListOfAllergies
} = require('../controllers/client_profile');

const ClientUser = require('../models/Client_User');
const allergies = require('../models/Allergies');
const UserOrder = require('../models/User_Order');

// Mock dependencies
jest.mock('../models/Client_User');
jest.mock('../models/Allergies');
jest.mock('../models/User_Order');

describe('Client Profile Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      body: {},
      app: {
        get: jest.fn().mockReturnValue({
          to: jest.fn().mockReturnThis(),
          emit: jest.fn()
        })
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('userData', () => {
    test('should return user data with orders and allergies', async () => {
      req.query.email = 'test@example.com';
      
      const mockUser = {
        _id: 'user123',
        first_name: 'John',
        last_name: 'Doe',
        age: 25,
        email: 'test@example.com',
        phone_number: '0501234567',
        profileImage: '/profile/image.jpg',
        allergies: [{ name: 'Nuts' }, { name: 'Dairy' }],
        orders: [{
          _id: 'order123',
          guests: 4,
          status: 'Confirmed',
          start_time: '2024-01-15T19:00:00Z',
          end_time: '2024-01-15T21:00:00Z',
          restaurant: {
            res_name: 'Test Restaurant',
            phone_number: '0501111111',
            city: 'Tel Aviv',
            description: 'Great food'
          }
        }]
      };

      ClientUser.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser)
        })
      });

      await userData(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        first_name: 'John',
        last_name: 'Doe',
        age: 25,
        email: 'test@example.com',
        phone_number: '0501234567',
        allergies: ['Nuts', 'Dairy'],
        orders: expect.arrayContaining([{
          order_id: 'order123',
          restaurantName: 'Test Restaurant',
          restaurantPhone: '0501111111',
          restaurantCity: 'Tel Aviv',
          restaurantDescription: 'Great food',
          guests: 4,
          status: 'Confirmed',
          orderDate: expect.any(String),
          orderStart: expect.any(String),
          orderEnd: expect.any(String)
        }]),
        profileImage: '/profile/image.jpg'
      });
    });

    test('should return 404 when user not found', async () => {
      req.query.email = 'notfound@example.com';
      
      ClientUser.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      await userData(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    test('should handle database errors', async () => {
      req.query.email = 'test@example.com';
      
      ClientUser.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockRejectedValue(new Error('DB Error'))
        })
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await userData(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('deleteClientProfile', () => {
    test('should return 404 when user not found', async () => {
      req.body.email = 'notfound@example.com';
      
      ClientUser.findOne.mockResolvedValue(null);

      await deleteClientProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

  });

  describe('updateUserAlergic', () => {
    1
    test('should return 404 when allergy not found', async () => {
      req.body = {
        email: 'test@example.com',
        name_allergies: 'Unknown',
        type: 'update'
      };

      allergies.findOne.mockResolvedValue(null);

      await updateUserAlergic(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Allergy not found in database' });
    });

    test('should return 400 when user already has allergy', async () => {
      req.body = {
        email: 'test@example.com',
        name_allergies: 'Nuts',
        type: 'update'
      };

      const mockAllergy = { _id: 'allergy123', name: 'Nuts' };
      const mockUser = {
        allergies: [{ 
          _id: { 
            equals: jest.fn().mockReturnValue(true) 
          } 
        }]
      };

      allergies.findOne.mockResolvedValue(mockAllergy);
      ClientUser.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });

      await updateUserAlergic(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'User already has this allergy' });
    });
  });

  describe('updateUserPhoneNumber', () => {
    test('should update phone number successfully', async () => {
      req.body = {
        email: 'test@example.com',
        phone_number: '0501234567'
      };

      const mockUser = {
        phone_number: '0509876543',
        user_type: 'Client',
        save: jest.fn().mockResolvedValue()
      };

      ClientUser.findOne.mockResolvedValue(mockUser);

      await updateUserPhoneNumber(req, res);

      expect(mockUser.phone_number).toBe('0501234567');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'phone_number changed successfully' });
    });

    test('should return 400 when user not found', async () => {
      req.body = {
        email: 'notfound@example.com',
        phone_number: '0501234567'
      };

      ClientUser.findOne.mockResolvedValue(null);

      await updateUserPhoneNumber(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'the user is not exist' });
    });

    test('should return 300 for invalid phone number', async () => {
      req.body = {
        email: 'test@example.com',
        phone_number: '123456789'
      };

      const mockUser = { user_type: 'Client' };
      ClientUser.findOne.mockResolvedValue(mockUser);

      await updateUserPhoneNumber(req, res);

      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Phone number must be 10 digits and start with 05.'
      });
    });
  });

  describe('getListOfAllergies', () => {
    test('should return list of allergies', async () => {
      const mockAllergies = [
        { name: 'Nuts' },
        { name: 'Dairy' },
        { name: 'Gluten' }
      ];

      allergies.find.mockResolvedValue(mockAllergies);

      await getListOfAllergies(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockAllergies);
    });

    test('should return 404 when no allergies found', async () => {
      allergies.find.mockResolvedValue([]);

      await getListOfAllergies(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'No allergies found' });
    });
  });

  describe('cancelUpcomingOrders', () => {
    test('should cancel order successfully', async () => {
      req.body.orderId = 'order123';

      const mockOrder = {
        _id: 'order123',
        status: 'Confirmed',
        restaurant: { _id: 'restaurant123' },
        user: { first_name: 'John', last_name: 'Doe', email: 'test@example.com' },
        orderDate: '2024-01-15',
        start_time: '19:00',
        end_time: '21:00',
        guests: 4,
        save: jest.fn().mockResolvedValue()
      };

      UserOrder.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrder)
      });

      await cancelUpcomingOrders(req, res);

      expect(mockOrder.status).toBe('Cancelled');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Order cancelled successfully',
        orderId: 'order123'
      });
    });

    test('should return 400 when order ID missing', async () => {
      req.body = {};

      await cancelUpcomingOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Order ID is required' });
    });

    test('should return 404 when order not found', async () => {
      req.body.orderId = 'nonexistent';

      UserOrder.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await cancelUpcomingOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
    });
  });
});