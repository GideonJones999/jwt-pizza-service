// Test Helpers - Shared mocking utilities for tests

/**
 * Creates a mock Express request object
 */
function mockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides,
  };
}

/**
 * Creates a mock Express response object
 */
function mockResponse() {
  const res = {
    statusCode: 200,
    data: null,
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((data) => {
    res.data = data;
    return res;
  });

  res.send = jest.fn((data) => {
    res.data = data;
    return res;
  });

  return res;
}

/**
 * Creates a mock Express next function
 */
function mockNext() {
  return jest.fn();
}

/**
 * Creates a mock database connection
 */
function mockDbConnection() {
  return {
    query: jest.fn(),
    execute: jest.fn(),
    end: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
  };
}

/**
 * Creates a mock user object
 */
function mockUser(overrides = {}) {
  return {
    id: 1,
    name: "Test User",
    email: "test@example.com",
    roles: [{ role: "diner" }],
    isRole: function (role) {
      return this.roles.some((r) => r.role === role);
    },
    ...overrides,
  };
}

/**
 * Creates a mock admin user
 */
function mockAdminUser(overrides = {}) {
  return mockUser({
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    roles: [{ role: "admin" }],
    ...overrides,
  });
}

/**
 * Creates a mock franchisee user
 */
function mockFranchiseeUser(franchiseId = 1, overrides = {}) {
  return mockUser({
    id: 2,
    name: "Franchisee User",
    email: "franchisee@example.com",
    roles: [{ role: "diner" }, { role: "franchisee", objectId: franchiseId }],
    ...overrides,
  });
}

/**
 * Creates mock menu items
 */
function mockMenuItems() {
  return [
    {
      id: 1,
      title: "Veggie",
      description: "A garden of delight",
      image: "pizza1.png",
      price: 0.0038,
    },
    {
      id: 2,
      title: "Pepperoni",
      description: "Spicy treat",
      image: "pizza2.png",
      price: 0.0042,
    },
    {
      id: 3,
      title: "Margarita",
      description: "Essential classic",
      image: "pizza3.png",
      price: 0.0035,
    },
  ];
}

/**
 * Creates a mock franchise
 */
function mockFranchise(overrides = {}) {
  return {
    id: 1,
    name: "PizzaPocket",
    admins: [{ id: 1, name: "Admin", email: "admin@example.com" }],
    stores: [],
    ...overrides,
  };
}

/**
 * Creates a mock store
 */
function mockStore(overrides = {}) {
  return {
    id: 1,
    franchiseId: 1,
    name: "SLC",
    ...overrides,
  };
}

/**
 * Creates a mock order
 */
function mockOrder(overrides = {}) {
  return {
    id: 1,
    franchiseId: 1,
    storeId: 1,
    date: new Date().toISOString(),
    items: [{ id: 1, menuId: 1, description: "Veggie", price: 0.05 }],
    ...overrides,
  };
}

/**
 * Clears all Jest mocks
 */
function clearAllMocks() {
  jest.clearAllMocks();
}

/**
 * Resets all Jest mocks
 */
function resetAllMocks() {
  jest.resetAllMocks();
}

module.exports = {
  mockRequest,
  mockResponse,
  mockNext,
  mockDbConnection,
  mockUser,
  mockAdminUser,
  mockFranchiseeUser,
  mockMenuItems,
  mockFranchise,
  mockStore,
  mockOrder,
  clearAllMocks,
  resetAllMocks,
};
