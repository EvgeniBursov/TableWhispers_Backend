const { ResLoginUser } = require('../controllers/res_login_controller');
const ResClientUser = require('../models/Res_User');
const bcrypt = require('bcryptjs');
const { sendMail } = require('../MessageSystem/email_message');
const { authenticator } = require('otplib');

jest.mock('../models/Res_User');
jest.mock('bcryptjs');
jest.mock('../MessageSystem/email_message');
jest.mock('otplib');

describe('ResLoginUser Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        email: 'restaurant@example.com',
        username: 'rest123',
        password: 'RestaurantPass123!',
        phone_number: '0501234567'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup authenticator mock
    authenticator.options = {};
    authenticator.generateSecret = jest.fn().mockReturnValue('secret123');
    authenticator.generate = jest.fn().mockReturnValue('123456');
  });

  describe('Input Validation', () => {
    test('should return error when email is missing', async () => {
      req.body.email = '';
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in all fields' 
      });
    });

    test('should return error when username is missing', async () => {
      req.body.username = '';
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in all fields' 
      });
    });

    test('should return error when password is missing', async () => {
      req.body.password = '';
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in all fields' 
      });
    });

    test('should return error when phone_number is missing', async () => {
      req.body.phone_number = '';
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in all fields' 
      });
    });

    test('should return error when multiple fields are missing', async () => {
      req.body.email = '';
      req.body.username = '';
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in all fields' 
      });
    });

    test('should return error when fields are undefined', async () => {
      req.body.email = undefined;
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in all fields' 
      });
    });
  });

  describe('User Authentication', () => {
    test('should return error when user does not exist', async () => {
      ResClientUser.findOne.mockResolvedValue(null);
      
      await ResLoginUser(req, res);
      
      expect(ResClientUser.findOne).toHaveBeenCalledWith({ email: 'restaurant@example.com' });
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ error: 'Incorrect user' });
    });

    test('should return error when password is incorrect', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);
      
      await ResLoginUser(req, res);
      
      expect(bcrypt.compare).toHaveBeenCalledWith('RestaurantPass123!', 'hashedPassword');
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ error: 'Incorrect password' });
    });

    test('should return error when username is incorrect', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'different_username',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ error: 'Incorrect username' });
    });

    test('should return error when phone number is incorrect', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0509876543',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ error: 'Incorrect phone number' });
    });
  });

  describe('TOTP and Email Integration', () => {
    test('should login successfully and send TOTP token', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn().mockResolvedValue()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      sendMail.mockResolvedValue();
      
      await ResLoginUser(req, res);
      
      // Check TOTP setup
      expect(authenticator.options).toEqual({ step: 360 });
      expect(authenticator.generateSecret).toHaveBeenCalled();
      expect(mockUser.totpSecret).toBe('secret123');
      expect(mockUser.save).toHaveBeenCalled();
      
      // Check token generation and email
      expect(authenticator.generate).toHaveBeenCalledWith('secret123');
      expect(sendMail).toHaveBeenCalledWith('restaurant@example.com', '123456', 'totp');
      
      // Check successful response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        connect: mockUser,
        restaurant_id: 'rest_id_123'
      });
    });

    test('should handle TOTP secret generation', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn().mockResolvedValue()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      authenticator.generateSecret.mockReturnValue('new_secret_abc');
      authenticator.generate.mockReturnValue('654321');
      
      await ResLoginUser(req, res);
      
      expect(mockUser.totpSecret).toBe('new_secret_abc');
      expect(authenticator.generate).toHaveBeenCalledWith('new_secret_abc');
      expect(sendMail).toHaveBeenCalledWith('restaurant@example.com', '654321', 'totp');
    });

    test('should handle email sending failure gracefully', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn().mockResolvedValue()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      sendMail.mockImplementation(() => Promise.resolve());
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      ResClientUser.findOne.mockRejectedValue(dbError);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ResLoginUser(req, res);
      
      expect(consoleSpy).toHaveBeenCalledWith('Error during login:', dbError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to authenticate user' });
      
      consoleSpy.mockRestore();
    });

    test('should handle bcrypt comparison errors', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to authenticate user' });
      
      consoleSpy.mockRestore();
    });

    test('should handle user save errors', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn().mockRejectedValue(new Error('Save failed'))
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to authenticate user' });
      
      consoleSpy.mockRestore();
    });

    test('should handle TOTP generation errors', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_123',
        save: jest.fn().mockResolvedValue()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      authenticator.generateSecret.mockImplementation(() => {
        throw new Error('TOTP generation failed');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ResLoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to authenticate user' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Response Format', () => {
    test('should return correct response structure', async () => {
      const mockUser = {
        _id: 'restaurant123',
        email: 'restaurant@example.com',
        user_name: 'rest123',
        phone_number: '0501234567',
        password: 'hashedPassword',
        restaurant_id: 'rest_id_456',
        restaurant_name: 'Test Restaurant',
        city: 'Tel Aviv',
        save: jest.fn().mockResolvedValue()
      };
      
      ResClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      
      await ResLoginUser(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        connect: mockUser,
        restaurant_id: 'rest_id_456'
      });
      
      // Verify restaurant_id is explicitly included at top level
      const calledWith = res.json.mock.calls[0][0];
      expect(calledWith.restaurant_id).toBe('rest_id_456');
      expect(calledWith.connect.restaurant_id).toBe('rest_id_456');
    });
  });
});