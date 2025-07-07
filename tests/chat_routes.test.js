// tests/chat_routes.test.js
const request = require('supertest');
const express = require('express');
const chatRoutes = require('../routes/chat_route');
const ChatSystem = require('../MessageSystem/ChatSystem');

// Mock the ChatSystem module
jest.mock('../MessageSystem/ChatSystem', () => ({
  get_chat_history: jest.fn(),
  get_restaurant_chats: jest.fn(),
  get_customer_chats: jest.fn(),
  save_message: jest.fn(),
  mark_message_as_read: jest.fn(),
  delete_chat: jest.fn(),
  get_unread_count: jest.fn()
}));

describe('Chat Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /chat_history/:orderId/:customerEmail', () => {
    test('should handle pagination parameters', async () => {
      ChatSystem.get_chat_history.mockImplementation((req, res) => {
        expect(req.query.page).toBe('2');
        expect(req.query.limit).toBe('25');
        res.status(200).json({ success: true, messages: [] });
      });

      await request(app)
        .get('/api/chat/chat_history/order123/test@example.com?page=2&limit=25')
        .expect(200);

      expect(ChatSystem.get_chat_history).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /restaurant_chats/:restaurantId', () => {
    test('should handle errors from get_restaurant_chats', async () => {
      ChatSystem.get_restaurant_chats.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Server error'
        });
      });

      await request(app)
        .get('/api/chat/restaurant_chats/restaurant123')
        .expect(500);
    });
  });

  describe('POST /send_message', () => {
    test('should call save_message with correct message data', async () => {
      const messageData = {
        order_id: 'order123',
        sender_type: 'customer',
        user_sender_email: 'customer@example.com',
        sender_name: 'John Doe',
        recipient_type: 'restaurant',
        restaurant_recipient_id: 'restaurant123',
        content: 'Hello, when will my order be ready?'
      };

      const mockResponse = {
        success: true,
        message: 'Message sent successfully',
        messageId: 'msg123'
      };

      ChatSystem.save_message.mockImplementation((req, res) => {
        expect(req.body).toEqual(messageData);
        res.status(201).json(mockResponse);
      });

      const response = await request(app)
        .post('/api/chat/send_message')
        .send(messageData)
        .expect(201);

      expect(ChatSystem.save_message).toHaveBeenCalledTimes(1);
      expect(response.body).toEqual(mockResponse);
    });

    test('should handle validation errors', async () => {
      const invalidMessageData = {
        order_id: 'order123',
        // Missing required fields
        content: 'Hello'
      };

      ChatSystem.save_message.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Missing required message fields'
        });
      });

      await request(app)
        .post('/api/chat/send_message')
        .send(invalidMessageData)
        .expect(400);
    });
  });

  describe('POST /mark_message_read/:messageId', () => {
    test('should call mark_message_as_read with correct message ID', async () => {
      const mockResponse = {
        success: true,
        message: 'Message marked as read'
      };

      ChatSystem.mark_message_as_read.mockImplementation((req, res) => {
        expect(req.params.messageId).toBe('msg123');
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .post('/api/chat/mark_message_read/msg123')
        .expect(200);

      expect(ChatSystem.mark_message_as_read).toHaveBeenCalledTimes(1);
      expect(response.body).toEqual(mockResponse);
    });

    test('should handle message not found', async () => {
      ChatSystem.mark_message_as_read.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      });

      await request(app)
        .post('/api/chat/mark_message_read/nonexistent')
        .expect(404);
    });
  });

  describe('DELETE /delete_chat/:orderId/:customerEmail', () => {
    test('should call delete_chat with correct parameters', async () => {
      const mockResponse = {
        success: true,
        message: 'Chat deleted successfully',
        deletedCount: 5
      };

      ChatSystem.delete_chat.mockImplementation((req, res) => {
        expect(req.params.orderId).toBe('order123');
        expect(req.params.customerEmail).toBe('customer@example.com');
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .delete('/api/chat/delete_chat/order123/customer@example.com')
        .expect(200);

      expect(ChatSystem.delete_chat).toHaveBeenCalledTimes(1);
      expect(response.body).toEqual(mockResponse);
    });
  });

  describe('GET /unread_count/:type/:id', () => {
    test('should call get_unread_count for restaurant', async () => {
      const mockResponse = {
        success: true,
        unreadCount: 3
      };

      ChatSystem.get_unread_count.mockImplementation((req, res) => {
        expect(req.params.type).toBe('restaurant');
        expect(req.params.id).toBe('restaurant123');
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .get('/api/chat/unread_count/restaurant/restaurant123')
        .expect(200);

      expect(ChatSystem.get_unread_count).toHaveBeenCalledTimes(1);
      expect(response.body).toEqual(mockResponse);
    });

    test('should call get_unread_count for customer', async () => {
      const mockResponse = {
        success: true,
        unreadCount: 1
      };

      ChatSystem.get_unread_count.mockImplementation((req, res) => {
        expect(req.params.type).toBe('customer');
        expect(req.params.id).toBe('customer@example.com');
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .get('/api/chat/unread_count/customer/customer@example.com')
        .expect(200);

      expect(ChatSystem.get_unread_count).toHaveBeenCalledTimes(1);
      expect(response.body).toEqual(mockResponse);
    });

    test('should handle invalid type parameter', async () => {
      ChatSystem.get_unread_count.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Type must be "restaurant" or "customer"'
        });
      });

      await request(app)
        .get('/api/chat/unread_count/invalid/123')
        .expect(400);
    });
  });

  describe('Route parameter validation', () => {
    test('should handle special characters in email parameters', async () => {
      const emailWithSpecialChars = 'test+user@example.com';
      
      ChatSystem.get_chat_history.mockImplementation((req, res) => {
        expect(req.params.customerEmail).toBe(emailWithSpecialChars);
        res.status(200).json({ success: true, messages: [] });
      });

      await request(app)
        .get(`/api/chat/chat_history/order123/${encodeURIComponent(emailWithSpecialChars)}`)
        .expect(200);
    });

    test('should handle MongoDB ObjectId format for order IDs', async () => {
      const objectId = '507f1f77bcf86cd799439011';
      
      ChatSystem.get_chat_history.mockImplementation((req, res) => {
        expect(req.params.orderId).toBe(objectId);
        res.status(200).json({ success: true, messages: [] });
      });

      await request(app)
        .get(`/api/chat/chat_history/${objectId}/test@example.com`)
        .expect(200);
    });
  });

  describe('Error handling', () => {
    test('should handle network errors gracefully', async () => {
      ChatSystem.get_chat_history.mockImplementation((req, res) => {
        // Simulate network error
        throw new Error('Network error');
      });

      await request(app)
        .get('/api/chat/chat_history/order123/test@example.com')
        .expect(500);
    });

    test('should handle malformed JSON in POST requests', async () => {
      await request(app)
        .post('/api/chat/send_message')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });
});