// tests/chat_system.test.js
const ChatSystem = require('../MessageSystem/ChatSystem');

// Mock all the models
jest.mock('../models/Chat_Schema', () => {
  const mockFind = jest.fn();
  const mockCountDocuments = jest.fn();
  const mockAggregate = jest.fn();
  const mockSave = jest.fn();
  const mockFindByIdAndUpdate = jest.fn();
  const mockDeleteMany = jest.fn();
  
  const mockConstructor = jest.fn().mockImplementation((data) => ({
    ...data,
    save: mockSave,
    _id: 'mock-message-id'
  }));
  
  mockConstructor.find = mockFind;
  mockConstructor.countDocuments = mockCountDocuments;
  mockConstructor.aggregate = mockAggregate;
  mockConstructor.findByIdAndUpdate = mockFindByIdAndUpdate;
  mockConstructor.deleteMany = mockDeleteMany;
  mockConstructor.prototype.save = mockSave;
  
  return mockConstructor;
});

jest.mock('../models/Restarunt', () => ({
  findById: jest.fn(),
  findOne: jest.fn()
}));

jest.mock('../models/Client_User', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/User_Order', () => ({
  find: jest.fn(),
  findById: jest.fn()
}));

const ChatMessage = require('../models/Chat_Schema');
const Restaurant = require('../models/Restarunt');
const ClientUser = require('../models/Client_User');
const UserOrder = require('../models/User_Order');

describe('ChatSystem', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      params: {},
      body: {},
      query: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('get_chat_history', () => {
    beforeEach(() => {
      mockReq.params = {
        orderId: 'order123',
        customerEmail: 'customer@example.com'
      };
      mockReq.query = {
        page: '1',
        limit: '50'
      };
    });

    test('should return chat history successfully', async () => {
      const mockMessages = [
        {
          _id: 'msg1',
          content: 'Hello',
          sender_type: 'customer',
          timestamp: new Date('2024-01-01T10:00:00Z')
        },
        {
          _id: 'msg2',
          content: 'Hi there!',
          sender_type: 'restaurant',
          timestamp: new Date('2024-01-01T10:01:00Z')
        }
      ];

      ChatMessage.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockMessages.reverse()) // DB returns newest first
          })
        })
      });

      ChatMessage.countDocuments.mockResolvedValue(2);

      await ChatSystem.get_chat_history(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        messages: mockMessages.reverse(), // Should be reversed back to chronological
        pagination: {
          total: 2,
          page: 1,
          limit: 50,
          pages: 1
        }
      });
    });

    test('should validate required parameters', async () => {
      mockReq.params = { orderId: '', customerEmail: '' };

      await ChatSystem.get_chat_history(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order ID and customer email are required'
      });
    });

    test('should handle pagination correctly', async () => {
      mockReq.query = { page: '2', limit: '25' };

      ChatMessage.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });

      ChatMessage.countDocuments.mockResolvedValue(50);

      await ChatSystem.get_chat_history(mockReq, mockRes);

      // Verify skip calculation (page 2, limit 25 = skip 25)
      expect(ChatMessage.find().sort().skip).toHaveBeenCalledWith(25);
      expect(ChatMessage.find().sort().skip().limit).toHaveBeenCalledWith(25);
    });

    test('should handle database errors', async () => {
      ChatMessage.find.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await ChatSystem.get_chat_history(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error while retrieving chat history',
        error: 'Database connection failed'
      });
    });
  });

  describe('get_restaurant_chats', () => {
    beforeEach(() => {
      mockReq.params = { restaurantId: 'restaurant123' };
    });
    
    test('should validate restaurant ID parameter', async () => {
      mockReq.params = { restaurantId: '' };

      await ChatSystem.get_restaurant_chats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Restaurant ID is required'
      });
    });
  });

  describe('get_customer_chats', () => {
    beforeEach(() => {
      mockReq.params = { customerEmail: 'customer@example.com' };
    });

    test('should return 404 when customer not found', async () => {
      ClientUser.findOne.mockResolvedValue(null);

      await ChatSystem.get_customer_chats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found'
      });
    });
  });

  describe('save_message', () => {
    beforeEach(() => {
      mockReq.body = {
        order_id: 'order123',
        sender_type: 'customer',
        user_sender_email: 'customer@example.com',
        sender_name: 'John Doe',
        recipient_type: 'restaurant',
        restaurant_recipient_id: 'restaurant123',
        content: 'Hello, when will my order be ready?'
      };
    });

    test('should save message successfully', async () => {
      const mockSavedMessage = {
        _id: 'msg123',
        ...mockReq.body,
        timestamp: new Date(),
        read: false
      };

      ChatMessage.prototype.save.mockResolvedValue(mockSavedMessage);

      await ChatSystem.save_message(mockReq, mockRes);

      expect(ChatMessage).toHaveBeenCalledWith(expect.objectContaining({
        order_id: 'order123',
        sender_type: 'customer',
        content: 'Hello, when will my order be ready?'
      }));

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message sent successfully',
        messageId: 'msg123',
        messageData: mockSavedMessage
      });
    });

    test('should validate required fields', async () => {
      mockReq.body = {
        order_id: 'order123',
        // Missing required fields
        content: 'Hello'
      };

      await ChatSystem.save_message(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing required message fields'
      });
    });

    test('should validate customer sender requirements', async () => {
      mockReq.body = {
        order_id: 'order123',
        sender_type: 'customer',
        // Missing user_sender_email
        recipient_type: 'restaurant',
        restaurant_recipient_id: 'restaurant123',
        content: 'Hello'
      };

      await ChatSystem.save_message(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer sender requires user_sender_email'
      });
    });

    test('should handle save errors', async () => {
      ChatMessage.prototype.save.mockRejectedValue(new Error('Database error'));

      await ChatSystem.save_message(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error while sending message',
        error: 'Database error'
      });
    });
  });

  describe('mark_message_as_read', () => {
    beforeEach(() => {
      mockReq.params = { messageId: 'msg123' };
    });

    test('should mark message as read successfully', async () => {
      const mockUpdatedMessage = {
        _id: 'msg123',
        content: 'Hello',
        read: true,
        timestamp: new Date()
      };

      ChatMessage.findByIdAndUpdate.mockResolvedValue(mockUpdatedMessage);

      await ChatSystem.mark_message_as_read(mockReq, mockRes);

      expect(ChatMessage.findByIdAndUpdate).toHaveBeenCalledWith(
        'msg123',
        { read: true },
        { new: true }
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message marked as read',
        messageData: mockUpdatedMessage
      });
    });

    test('should handle message not found', async () => {
      ChatMessage.findByIdAndUpdate.mockResolvedValue(null);

      await ChatSystem.mark_message_as_read(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Message not found'
      });
    });

    test('Message not found', async () => {
      mockReq.params = { messageId: '' };

      await ChatSystem.mark_message_as_read(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Message not found'
      });
    });
  });

  describe('delete_chat', () => {
    beforeEach(() => {
      mockReq.params = {
        orderId: 'order123',
        customerEmail: 'customer@example.com'
      };
    });

    test('should delete chat successfully', async () => {
      const mockDeleteResult = { deletedCount: 5 };
      ChatMessage.deleteMany.mockResolvedValue(mockDeleteResult);

      await ChatSystem.delete_chat(mockReq, mockRes);

      expect(ChatMessage.deleteMany).toHaveBeenCalledWith({
        order_id: 'order123',
        $or: [
          {
            sender_type: 'restaurant',
            recipient_type: 'customer',
            user_recipient_email: 'customer@example.com'
          },
          {
            sender_type: 'customer',
            user_sender_email: 'customer@example.com',
            recipient_type: 'restaurant'
          }
        ]
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Chat deleted successfully',
        deletedCount: 5
      });
    });

    test('should validate required parameters', async () => {
      mockReq.params = { orderId: '', customerEmail: '' };

      await ChatSystem.delete_chat(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order ID and customer email are required'
      });
    });
  });

  describe('get_unread_count', () => {
    test('should get unread count for restaurant', async () => {
      mockReq.params = { type: 'restaurant', id: 'restaurant123' };
      ChatMessage.countDocuments.mockResolvedValue(3);

      await ChatSystem.get_unread_count(mockReq, mockRes);

      expect(ChatMessage.countDocuments).toHaveBeenCalledWith({
        recipient_type: 'restaurant',
        restaurant_recipient_id: 'restaurant123',
        read: false
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        unreadCount: 3
      });
    });

    test('should get unread count for customer', async () => {
      mockReq.params = { type: 'customer', id: 'customer@example.com' };
      ChatMessage.countDocuments.mockResolvedValue(1);

      await ChatSystem.get_unread_count(mockReq, mockRes);

      expect(ChatMessage.countDocuments).toHaveBeenCalledWith({
        recipient_type: 'customer',
        user_recipient_email: 'customer@example.com',
        read: false
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        unreadCount: 1
      });
    });

    test('should validate type parameter', async () => {
      mockReq.params = { type: 'invalid', id: '123' };

      await ChatSystem.get_unread_count(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Type must be "restaurant" or "customer"'
      });
    });

    test('should validate required parameters', async () => {
      mockReq.params = { type: '', id: '' };

      await ChatSystem.get_unread_count(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Type and ID are required'
      });
    });
  });

  describe('Socket.IO compatibility', () => {
    test('save_message should work without response object', async () => {
      const messageData = {
        order_id: 'order123',
        sender_type: 'customer',
        user_sender_email: 'customer@example.com',
        recipient_type: 'restaurant',
        restaurant_recipient_id: 'restaurant123',
        content: 'Hello'
      };

      const mockSavedMessage = { _id: 'msg123', ...messageData };
      ChatMessage.prototype.save.mockResolvedValue(mockSavedMessage);

      const result = await ChatSystem.save_message(messageData);

      expect(result).toEqual(mockSavedMessage);
    });

    test('mark_message_as_read should work without response object', async () => {
      const mockUpdatedMessage = { _id: 'msg123', read: true };
      ChatMessage.findByIdAndUpdate.mockResolvedValue(mockUpdatedMessage);

      const result = await ChatSystem.mark_message_as_read('msg123');

      expect(result).toEqual(mockUpdatedMessage);
    });

    test('should throw errors for Socket.IO calls when validation fails', async () => {
      const invalidMessageData = {
        // Missing required fields
        content: 'Hello'
      };

      await expect(ChatSystem.save_message(invalidMessageData)).rejects.toThrow('Missing required message fields');
    });
  });
});