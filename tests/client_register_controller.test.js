const { createNewUser } = require('../controllers/client_register_controller');
const ClientUser = require('../models/Client_User');
const bcrypt = require('bcryptjs');
const { createToken } = require('../controllers/auth');

// Mock dependencies
jest.mock('../models/Client_User');
jest.mock('bcryptjs');
jest.mock('../controllers/auth');

describe('createNewUser Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        age: 25,
        phone_number: '0501234567',
        password: 'TestPass123!',
        confirm_password: 'TestPass123!'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('Name Validation', () => {
    test('should return error when first name is too short', async () => {
      req.body.first_name = 'J';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'the first name or last name cant be smaller of 2' 
      });
    });

    test('should return error when last name is too short', async () => {
      req.body.last_name = 'D';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'the first name or last name cant be smaller of 2' 
      });
    });

    test('should accept valid names with 2+ characters', async () => {
      req.body.first_name = 'Jo';
      req.body.last_name = 'Do';
      
      ClientUser.findOne.mockResolvedValue(null);
      ClientUser.prototype.save = jest.fn().mockResolvedValue({
        _id: 'user123',
        ...req.body
      });
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashedPassword');
      createToken.mockReturnValue('token123');
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Age Validation', () => {
    test('should return error when age is below 16', async () => {
      req.body.age = 15;
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'the minum age for using platform is 16' 
      });
    });

    test('should accept age 16 and above', async () => {
      req.body.age = 16;
      
      ClientUser.findOne.mockResolvedValue(null);
      ClientUser.prototype.save = jest.fn().mockResolvedValue({
        _id: 'user123',
        ...req.body
      });
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashedPassword');
      createToken.mockReturnValue('token123');
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Phone Number Validation', () => {
    test('should return error when phone number is not 10 digits', async () => {
      req.body.phone_number = '123456789'; // 9 digits
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'the number need be 10 digits' 
      });
    });

    test('should return error when phone number is more than 10 digits', async () => {
      req.body.phone_number = '12345678901'; // 11 digits
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'the number need be 10 digits' 
      });
    });

    test('should accept exactly 10 digit phone number', async () => {
      req.body.phone_number = '0501234567';
      
      ClientUser.findOne.mockResolvedValue(null);
      ClientUser.prototype.save = jest.fn().mockResolvedValue({
        _id: 'user123',
        ...req.body
      });
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashedPassword');
      createToken.mockReturnValue('token123');
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Password Validation', () => {
    const passwordErrorMessage = "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 6 characters long.";

    test('should return error for weak password', async () => {
      req.body.password = 'weak';
      req.body.confirm_password = 'weak';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: passwordErrorMessage });
    });

    test('should return error when password missing uppercase', async () => {
      req.body.password = 'testpass123!';
      req.body.confirm_password = 'testpass123!';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: passwordErrorMessage });
    });

    test('should return error when password missing lowercase', async () => {
      req.body.password = 'TESTPASS123!';
      req.body.confirm_password = 'TESTPASS123!';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: passwordErrorMessage });
    });

    test('should return error when password missing number', async () => {
      req.body.password = 'TestPass!';
      req.body.confirm_password = 'TestPass!';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: passwordErrorMessage });
    });

    test('should return error when password missing special character', async () => {
      req.body.password = 'TestPass123';
      req.body.confirm_password = 'TestPass123';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: passwordErrorMessage });
    });

    test('should return error when password is too short', async () => {
      req.body.password = 'Tp1!';
      req.body.confirm_password = 'Tp1!';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: passwordErrorMessage });
    });

    test('should return error when passwords do not match', async () => {
      req.body.password = 'TestPass123!';
      req.body.confirm_password = 'DifferentPass123!';
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'the passwords is not same' 
      });
    });

    test('should accept strong matching passwords', async () => {
      req.body.password = 'TestPass123!';
      req.body.confirm_password = 'TestPass123!';
      
      ClientUser.findOne.mockResolvedValue(null);
      ClientUser.prototype.save = jest.fn().mockResolvedValue({
        _id: 'user123',
        ...req.body
      });
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashedPassword');
      createToken.mockReturnValue('token123');
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('User Existence Check', () => {
    test('should return error when user already exists', async () => {
      const existingUser = { _id: 'existing123', email: 'test@example.com' };
      ClientUser.findOne.mockResolvedValue(existingUser);
      
      await createNewUser(req, res);
      
      expect(ClientUser.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'the user is exist' });
    });
  });

  describe('Successful Registration', () => {
    test('should create new user successfully', async () => {
      const mockSalt = 'mocksalt';
      const mockHashedPassword = 'mockhashedpassword';
      const mockToken = 'mocktoken123';
      const mockSavedUser = {
        _id: 'newuser123',
        user_type: 'Client',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        age: 25,
        phone_number: '0501234567',
        password: mockHashedPassword
      };

      ClientUser.findOne.mockResolvedValue(null);
      bcrypt.genSalt.mockResolvedValue(mockSalt);
      bcrypt.hash.mockResolvedValue(mockHashedPassword);
      
      // Mock the save method
      const mockSave = jest.fn().mockResolvedValue(mockSavedUser);
      ClientUser.mockImplementation(() => ({
        save: mockSave
      }));
      
      createToken.mockReturnValue(mockToken);
      
      await createNewUser(req, res);
      
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('TestPass123!', mockSalt);
      expect(createToken).toHaveBeenCalledWith('newuser123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        user: mockSavedUser,
        token: mockToken
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle save errors', async () => {
      ClientUser.findOne.mockResolvedValue(null);
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashedPassword');
      
      const saveError = new Error('Save failed');
      const mockSave = jest.fn().mockRejectedValue(saveError);
      ClientUser.mockImplementation(() => ({
        save: mockSave
      }));
      
      await createNewUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(saveError);
    });
  });
});