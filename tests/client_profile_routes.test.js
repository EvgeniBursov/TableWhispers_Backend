// tests/client_profile_routes.test.js
const request = require('supertest');
const express = require('express');
const clientProfileRoutes = require('../routes/client_profile_route');
const ClientUser = require('../models/Client_User');
const allergies = require('../models/Allergies');
const UserOrder = require('../models/User_Order');
const { changeClientPassword } = require('../controllers/auth');

// Mock dependencies
jest.mock('../models/Client_User');
jest.mock('../models/Allergies');
jest.mock('../models/User_Order');

describe('Client Profile Routes Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.set('socketio', {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    });
    app.use('/api', clientProfileRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/userProfile', () => {
    test('should return user profile data', async () => {
      const mockUser = {
        first_name: 'John',
        last_name: 'Doe',
        age: 25,
        email: 'test@example.com',
        phone_number: '0501234567',
        profileImage: '/profile/image.jpg',
        allergies: [{ name: 'Nuts' }],
        orders: []
      };

      ClientUser.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser)
        })
      });

      const response = await request(app)
        .get('/api/userProfile')
        .query({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe('John');
      expect(response.body.last_name).toBe('Doe');
      expect(response.body.email).toBe('test@example.com');
    });

    test('should return 404 when user not found', async () => {
      ClientUser.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      const response = await request(app)
        .get('/api/userProfile')
        .query({ email: 'notfound@example.com' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });
  });

  describe('GET /api/getListOfAllergies', () => {
    test('should return list of allergies', async () => {
      const mockAllergies = [
        { name: 'Nuts' },
        { name: 'Dairy' },
        { name: 'Gluten' }
      ];

      allergies.find.mockResolvedValue(mockAllergies);

      const response = await request(app)
        .get('/api/getListOfAllergies');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAllergies);
    });

    test('should return 404 when no allergies found', async () => {
      allergies.find.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/getListOfAllergies');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'No allergies found' });
    });
  });

  describe('POST /api/resetClientPassword', () => {
    test('should reset password successfully', async () => {
      changeClientPassword.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Password changed successfully' });
      });

      const response = await request(app)
        .post('/api/resetClientPassword')
        .send({
          email: 'test@example.com',
          currentPassword: 'oldPass123!',
          newPassword: 'newPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password changed successfully');
    });
  });

  describe('POST /api/updateUserAlergic', () => {
    test('should return 404 when allergy not found', async () => {
      allergies.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/updateUserAlergic')
        .send({
          email: 'test@example.com',
          name_allergies: 'Unknown',
          type: 'update'
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Allergy not found in database' });
    });
  });

  describe('POST /api/updateUserPhoneNumber', () => {
    test('should update phone number successfully', async () => {
      const mockUser = {
        phone_number: '0509876543',
        user_type: 'Client',
        save: jest.fn().mockResolvedValue()
      };

      ClientUser.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/updateUserPhoneNumber')
        .send({
          email: 'test@example.com',
          phone_number: '0501234567'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('phone_number changed successfully');
    });

    test('should return 300 for invalid phone number', async () => {
      const mockUser = { user_type: 'Client' };
      ClientUser.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/updateUserPhoneNumber')
        .send({
          email: 'test@example.com',
          phone_number: '123456789'
        });

      expect(response.status).toBe(300);
      expect(response.body.error).toBe('Phone number must be 10 digits and start with 05.');
    });
  });

  describe('DELETE /api/deleteClientProfile', () => {
    test('should return 404 when user not found', async () => {
      ClientUser.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/deleteClientProfile')
        .send({ email: 'notfound@example.com' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/cancelUpcomingOrders', () => {
    test('should return 400 when order ID missing', async () => {
      const response = await request(app)
        .post('/api/cancelUpcomingOrders')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Order ID is required');
    });

    test('should return 404 when order not found', async () => {
      UserOrder.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const response = await request(app)
        .post('/api/cancelUpcomingOrders')
        .send({ orderId: 'nonexistent' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Order not found');
    });
  });

  describe('Route Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/updateUserPhoneNumber')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/updateUserPhoneNumber')
        .send({});

      expect(response.status).toBe(400);
    });
  });
});