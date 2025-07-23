// tests/restaurant_routes.test.js
const request = require('supertest');
const express = require('express');

// Mock all dependencies BEFORE importing anything else
jest.mock('../models/Restarunt', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

jest.mock('../models/User_Order', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  mockImplementation: jest.fn(() => ({
    save: jest.fn().mockResolvedValue()
  }))
}));

jest.mock('../models/Client_User', () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

jest.mock('../models/Reviews', () => {
  const mockSave = jest.fn();
  const mockConstructor = jest.fn().mockImplementation(() => ({
    save: mockSave
  }));
  mockConstructor.findById = jest.fn();
  return mockConstructor;
});

jest.mock('../models/Tables', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

jest.mock('../models/ClientGuest', () => ({}));
jest.mock('../models/Restaurants_Bills', () => ({}));
jest.mock('../MessageSystem/email_message', () => ({
  sendMail: jest.fn().mockResolvedValue()
}));

const restaurantRoutes = require('../routes/restaurants_route');
const restaurants = require('../models/Restarunt');
const UserOrder = require('../models/User_Order');
const ClientUser = require('../models/Client_User');
const Review = require('../models/Reviews');

describe('Restaurant Routes Integration Tests', () => {
  let app;
  const RESTAURANT_ID = '67937038eb604c7927e85d2a';

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.set('socketio', {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis()
    });
    app.use('/api', restaurantRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/all_Restaurants_Data', () => {
    test('should return all restaurants', async () => {
      const mockRestaurants = [
        { _id: '1', res_name: 'Restaurant 1' },
        { _id: '2', res_name: 'Restaurant 2' }
      ];

      restaurants.find.mockResolvedValue(mockRestaurants);

      const response = await request(app)
        .get('/api/all_Restaurants_Data');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRestaurants);
    });

    test('should handle database errors', async () => {
      restaurants.find.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .get('/api/all_Restaurants_Data');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error' });
    });
  });

  describe('GET /api/restaurant/:id', () => {
    test('should return specific restaurant', async () => {
      const mockRestaurant = {
        _id: RESTAURANT_ID,
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

      const response = await request(app)
        .get(`/api/restaurant/${RESTAURANT_ID}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRestaurant);
    });

    test('should return 404 for non-existent restaurant', async () => {
      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      const response = await request(app)
        .get('/api/restaurant/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Restaurant not found' });
    });
  });

  describe('POST /api/add_New_Reviews/restaurant/:id', () => {
    test('should return 400 for missing fields', async () => {
      const incompleteData = {
        restaurant_Id: RESTAURANT_ID
        // Missing other required fields
      };

      const response = await request(app)
        .post(`/api/add_New_Reviews/restaurant/${RESTAURANT_ID}`)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Missing required fields');
    });
  });

  describe('POST /api/create_Reservation/restaurant/:id', () => {
    test('should return 400 for missing email', async () => {
      const incompleteData = {
        restaurant_Id: RESTAURANT_ID,
        time: '7:00 PM',
        day: 'monday',
        guests: 4
      };

      const response = await request(app)
        .post(`/api/create_Reservation/restaurant/${RESTAURANT_ID}`)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email is required for reservation');
    });
  });

  describe('POST /api/update_Reservation/restaurant/', () => {
    /*test('should update reservation status successfully', async () => {
      const updateData = {
        reservation_id: 'reservation123',
        status: 'Confirmed',
        restaurant_id: RESTAURANT_ID
      };

      const mockReservation = {
        _id: 'reservation123',
        status: 'Planning',
        client_type: 'ClientUser',
        client_id: 'user123',
        restaurant: { _id: RESTAURANT_ID, res_name: 'Test Restaurant' },
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

      const response = await request(app)
        .post('/api/update_Reservation/restaurant/')
        .send(updateData);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Reservation status updated successfully');
    });*/

    test('should return 404 for non-existent reservation', async () => {
      const updateData = {
        reservation_id: 'nonexistent',
        status: 'Confirmed'
      };

      UserOrder.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/update_Reservation/restaurant/')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Reservation not found');
    });
  });

  describe('GET /api/get_Restaurant_Menu/restaurant/:id', () => {
    test('should return restaurant menu', async () => {
      const mockMenu = [
        {
          title: 'Main Courses',
          items: [
            { name: 'Pasta', price: 35, description: 'Delicious pasta' }
          ]
        }
      ];
      const mockRestaurant = {
        _id: RESTAURANT_ID,
        menu: mockMenu
      };

      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockRestaurant)
      });

      const response = await request(app)
        .get(`/api/get_Restaurant_Menu/restaurant/${RESTAURANT_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.menu).toEqual(mockMenu);
    });

    test('should return empty menu when no items', async () => {
      const mockRestaurant = {
        _id: RESTAURANT_ID,
        menu: []
      };

      restaurants.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockRestaurant)
      });

      const response = await request(app)
        .get(`/api/get_Restaurant_Menu/restaurant/${RESTAURANT_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('No menu items found for this restaurant');
      expect(response.body.menu).toEqual([]);
    });
  });

  describe('Route Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post(`/api/add_New_Reviews/restaurant/${RESTAURANT_ID}`)
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/update_Reservation/restaurant/')
        .send({});

      expect(response.status).toBe(404);
    });
  });
});