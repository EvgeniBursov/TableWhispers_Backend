const { LoginUser } = require('../controllers/client_login_controller');
const ClientUser = require('../models/Client_User');
const bcrypt = require('bcryptjs');
const { createToken } = require('../controllers/auth');

jest.mock('../models/Client_User');
jest.mock('bcryptjs');
jest.mock('../controllers/auth');

describe('LoginUser Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        email: 'test@example.com',
        password: 'TestPassword123!'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    test('should return error when email is empty', async () => {
      req.body.email = '';
      
      await LoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in both email and password' 
      });
    });

    test('should return error when password is empty', async () => {
      req.body.password = '';
      
      await LoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in both email and password' 
      });
    });

    test('should return error when both fields are empty', async () => {
      req.body.email = '';
      req.body.password = '';
      
      await LoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Fill in both email and password' 
      });
    });
  });

  describe('User Authentication', () => {
    test('should return error when user does not exist', async () => {
      ClientUser.findOne.mockResolvedValue(null);
      
      await LoginUser(req, res);
      
      expect(ClientUser.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ error: 'Incorrect user' });
    });

    test('should return error when password is incorrect', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashedPassword'
      };
      
      ClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);
      
      await LoginUser(req, res);
      
      expect(bcrypt.compare).toHaveBeenCalledWith('TestPassword123!', 'hashedPassword');
      expect(res.status).toHaveBeenCalledWith(300);
      expect(res.json).toHaveBeenCalledWith({ error: 'incorrect password' });
    });

    test('should login successfully with correct credentials', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashedPassword'
      };
      const mockToken = 'jwt-token-123';
      
      ClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      createToken.mockReturnValue(mockToken);
      
      await LoginUser(req, res);
      
      expect(createToken).toHaveBeenCalledWith('user123', 'test@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        user: mockUser,
        token: mockToken
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      ClientUser.findOne.mockRejectedValue(dbError);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await LoginUser(req, res);
      
      expect(consoleSpy).toHaveBeenCalledWith(dbError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Fail checking user' });
      
      consoleSpy.mockRestore();
    });

    test('should handle bcrypt comparison errors', async () => {
      const mockUser = { _id: 'user123', email: 'test@example.com', password: 'hashedPassword' };
      ClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await LoginUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Fail checking user' });
      
      consoleSpy.mockRestore();
    });
  });
});