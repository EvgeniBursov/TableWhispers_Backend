// tests/routes.test.js
const request = require('supertest');
const express = require('express');
const loginRoutes = require('../routes/client_login_route');
const registerRoutes = require('../routes/client_register_route');
const ClientUser = require('../models/Client_User');
const bcrypt = require('bcryptjs');
const { createToken } = require('../controllers/auth');

// Mock dependencies
jest.mock('../models/Client_User');
jest.mock('bcryptjs');
jest.mock('../controllers/auth');

describe('Client Routes Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', loginRoutes);
    app.use('/api', registerRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/clientLogin', () => {
    test('should login successfully with valid credentials', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashedPassword'
      };
      const mockToken = 'jwt-token-123';

      ClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      createToken.mockReturnValue(mockToken);

      const response = await request(app)
        .post('/api/clientLogin')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: mockUser,
        token: mockToken
      });
    });

    test('should return 300 for missing email', async () => {
      const response = await request(app)
        .post('/api/clientLogin')
        .send({
          email: '',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(300);
      expect(response.body).toEqual({
        error: 'Fill in both email and password'
      });
    });

    test('should return 300 for missing password', async () => {
      const response = await request(app)
        .post('/api/clientLogin')
        .send({
          email: 'test@example.com',
          password: ''
        });

      expect(response.status).toBe(300);
      expect(response.body).toEqual({
        error: 'Fill in both email and password'
      });
    });

    test('should return 300 for non-existent user', async () => {
      ClientUser.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/clientLogin')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(300);
      expect(response.body).toEqual({
        error: 'Incorrect user'
      });
    });

    test('should return 300 for incorrect password', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashedPassword'
      };

      ClientUser.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/clientLogin')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(300);
      expect(response.body).toEqual({
        error: 'incorrect password'
      });
    });
  });

  describe('POST /api/clientRegister', () => {
    const validUserData = {
      email: 'newuser@example.com',
      first_name: 'John',
      last_name: 'Doe',
      age: 25,
      phone_number: '0501234567',
      password: 'TestPass123!',
      confirm_password: 'TestPass123!'
    };

    test('should register new user successfully', async () => {
      const mockSavedUser = {
        _id: 'newuser123',
        user_type: 'Client',
        ...validUserData,
        password: 'hashedPassword'
      };
      const mockToken = 'jwt-token-456';

      ClientUser.findOne.mockResolvedValue(null); // User doesn't exist
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashedPassword');
      
      const mockSave = jest.fn().mockResolvedValue(mockSavedUser);
      ClientUser.mockImplementation(() => ({
        save: mockSave
      }));
      
      createToken.mockReturnValue(mockToken);

      const response = await request(app)
        .post('/api/clientRegister')
        .send(validUserData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: mockSavedUser,
        token: mockToken
      });
    });

    test('should return 400 for short first name', async () => {
      const response = await request(app)
        .post('/api/clientRegister')
        .send({
          ...validUserData,
          first_name: 'J'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'the first name or last name cant be smaller of 2'
      });
    });

    test('should return 400 for short last name', async () => {
      const response = await request(app)
        .post('/api/clientRegister')
        .send({
          ...validUserData,
          last_name: 'D'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'the first name or last name cant be smaller of 2'
      });
    });

    test('should return 400 for age below 16', async () => {
      const response = await request(app)
        .post('/api/clientRegister')
        .send({
          ...validUserData,
          age: 15
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'the minum age for using platform is 16'
      });
    });

    test('should return 400 for invalid phone number length', async () => {
      const response = await request(app)
        .post('/api/clientRegister')
        .send({
          ...validUserData,
          phone_number: '123456789' // 9 digits instead of 10
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'the number need be 10 digits'
      });
    });

    test('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/clientRegister')
        .send({
          ...validUserData,
          password: 'weak',
          confirm_password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 special character, 1 number, and be at least 6 characters long.'
      });
    });

    test('should return 400 for password mismatch', async () => {
      const response = await request(app)
        .post('/api/clientRegister')
        .send({
          ...validUserData,
          password: 'TestPass123!',
          confirm_password: 'DifferentPass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'the passwords is not same'
      });
    });

    test('should return 400 for existing user', async () => {
      const existingUser = { _id: 'existing123', email: 'newuser@example.com' };
      ClientUser.findOne.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/api/clientRegister')
        .send(validUserData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'the user is exist'
      });
    });
  });

  describe('Route Error Handling', () => {
    test('should handle malformed JSON in login', async () => {
      const response = await request(app)
        .post('/api/clientLogin')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle malformed JSON in register', async () => {
      const response = await request(app)
        .post('/api/clientRegister')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle missing request body in login', async () => {
      const response = await request(app)
        .post('/api/clientLogin')
        .send({email:''});

      expect(response.status).toBe(300);
      expect(response.body).toEqual({
        error: 'Fill in both email and password'
      });
    });
  });
});