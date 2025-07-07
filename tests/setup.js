// tests/setup.js
// Global test setup file for Jest

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

// Mock critical modules FIRST before anything else
jest.mock('../app', () => ({
  io: {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }
}));

jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    join: jest.fn((...args) => originalPath.join(...args)),
    extname: jest.fn((filename) => originalPath.extname(filename))
  };
});

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn()
}));

jest.mock('../controllers/auth', () => ({
  changeClientPassword: jest.fn((req, res) => res.status(200).json({ message: 'Password changed' })),
  createToken: jest.fn().mockReturnValue('mock-token'),
  sendTotpCodeForClientUser: jest.fn((req, res) => res.status(200).json({ message: 'TOTP sent' })),
  verifyTotpCode: jest.fn((req, res) => res.status(200).json({ message: 'TOTP verified' }))
}));

// Global mocks for frequently used modules
jest.mock('../models/Client_User', () => {
  const mockSave = jest.fn();
  const mockConstructor = jest.fn().mockImplementation(() => ({
    save: mockSave
  }));
  mockConstructor.findOne = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    })
  });
  mockConstructor.deleteOne = jest.fn();
  mockConstructor.prototype.save = mockSave;
  return mockConstructor;
});

jest.mock('../models/Res_User', () => {
  const mockSave = jest.fn();
  const mockConstructor = jest.fn().mockImplementation(() => ({
    save: mockSave
  }));
  mockConstructor.findOne = jest.fn();
  mockConstructor.prototype.save = mockSave;
  return mockConstructor;
});

jest.mock('../models/Allergies', () => ({
  find: jest.fn(),
  findOne: jest.fn()
}));

// Mock external services
jest.mock('../MessageSystem/email_message', () => ({
  sendMail: jest.fn().mockResolvedValue(true)
}));

jest.mock('username-generator', () => ({
  generateUsername: jest.fn().mockReturnValue('testuser123')
}));

jest.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: jest.fn().mockReturnValue('secret123'),
    generate: jest.fn().mockReturnValue('123456')
  }
}));

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Console spy setup to suppress logs during tests
global.console = {
  ...console,
  // Suppress console.log in tests
  log: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper to create valid user data
  createValidUserData: () => ({
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    age: 25,
    phone_number: '0501234567',
    password: 'TestPass123!',
    confirm_password: 'TestPass123!'
  }),

  // Helper to create mock user response
  createMockUser: (overrides = {}) => ({
    _id: 'user123',
    user_type: 'Client',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    age: 25,
    phone_number: '0501234567',
    password: 'hashedPassword',
    ...overrides
  }),

  // Helper to create mock request object
  createMockReq: (body = {}) => ({
    body: {
      email: 'test@example.com',
      password: 'TestPass123!',
      ...body
    }
  }),

  // Helper to create mock response object
  createMockRes: () => {
    const res = {
      status: jest.fn(),
      json: jest.fn(),
      send: jest.fn()
    };
    // Chain methods
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    res.send.mockReturnValue(res);
    return res;
  }
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});