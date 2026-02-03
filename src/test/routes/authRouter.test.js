const {
  mockRequest,
  mockResponse,
  mockNext,
  mockUser,
  // mockAdminUser,
} = require("../helpers/testHelpers");

// Mock dependencies
const mockDB = {
  addUser: jest.fn(),
  getUser: jest.fn(),
  loginUser: jest.fn(),
  isLoggedIn: jest.fn(),
  logoutUser: jest.fn(),
};

const mockConfig = {
  jwtSecret: "test-secret",
};

jest.mock("../../database/database.js", () => ({
  DB: mockDB,
  Role: {
    Diner: "diner",
    Franchisee: "franchisee",
    Admin: "admin",
  },
}));

jest.mock("../../config.js", () => mockConfig);

const jwt = require("jsonwebtoken");

// Import after mocks are set up
let authRouter, setAuthUser, setAuth;

describe("AuthRouter - Registration", () => {
  beforeAll(() => {
    const authModule = require("../../routes/authRouter");
    authRouter = authModule.authRouter;
    setAuthUser = authModule.setAuthUser;
    setAuth = authModule.setAuth;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/auth - should register new user", async () => {
    const req = mockRequest({
      body: {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      },
    });
    const res = mockResponse();
    const next = mockNext();

    const mockNewUser = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      roles: [{ role: "diner" }],
    };

    mockDB.addUser.mockResolvedValue(mockNewUser);

    const postRoute = authRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.post,
    );
    const handler = postRoute.route.stack[0].handle;

    await handler(req, res, next);

    expect(mockDB.addUser).toHaveBeenCalled();
    expect(mockDB.loginUser).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test("POST /api/auth - should handle registration errors", async () => {
    const req = mockRequest({
      body: {
        name: "Test User",
        email: "existing@example.com",
        password: "password123",
      },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.addUser.mockRejectedValue(new Error("Email already exists"));

    const postRoute = authRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.post,
    );
    const handler = postRoute.route.stack[0].handle;

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("AuthRouter - Login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("PUT /api/auth - should login user with valid credentials", async () => {
    const req = mockRequest({
      body: {
        email: "test@example.com",
        password: "password123",
      },
    });
    const res = mockResponse();
    const next = mockNext();

    const mockUserData = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      password: "hashedpassword",
      roles: [{ role: "diner" }],
    };

    mockDB.getUser.mockResolvedValue(mockUserData);

    const putRoute = authRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.put,
    );
    const handler = putRoute.route.stack[0].handle;

    await handler(req, res, next);

    expect(mockDB.getUser).toHaveBeenCalledWith(
      "test@example.com",
      "password123",
    );
    expect(mockDB.loginUser).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test("PUT /api/auth - should reject invalid credentials", async () => {
    const req = mockRequest({
      body: {
        email: "test@example.com",
        password: "wrongpassword",
      },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.getUser.mockResolvedValue(undefined);

    const putRoute = authRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.put,
    );
    const handler = putRoute.route.stack[0].handle;

    await handler(req, res, next);

    // Should call res.status or next with error
    const wasRejected =
      res.status.mock.calls.length > 0 ||
      next.mock.calls.some((call) => call[0] instanceof Error);
    expect(wasRejected).toBe(true);
  });
});

describe("AuthRouter - Logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("DELETE /api/auth - should logout authenticated user", async () => {
    const req = mockRequest({
      headers: {
        authorization: "Bearer validtoken.jwt.here",
      },
      user: mockUser(),
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.logoutUser.mockResolvedValue();

    const deleteRoute = authRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.delete,
    );
    const handler =
      deleteRoute.route.stack[deleteRoute.route.stack.length - 1].handle;

    await handler(req, res, next);

    expect(mockDB.logoutUser).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test("DELETE /api/auth - should require authentication", async () => {
    const req = mockRequest({
      user: null,
    });
    const res = mockResponse();
    const next = mockNext();

    const deleteRoute = authRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.delete,
    );

    const authMiddleware = deleteRoute.route.stack[0].handle;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "unauthorized" });
  });
});

describe("AuthRouter Middleware - setAuthUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should set user from valid JWT token", async () => {
    const mockUserData = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      roles: [{ role: "diner" }],
    };

    const token = jwt.sign(mockUserData, mockConfig.jwtSecret);

    const req = mockRequest({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.isLoggedIn.mockResolvedValue(true);

    await setAuthUser(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
    expect(next).toHaveBeenCalled();
  });

  test("should set user to null if no token provided", async () => {
    const req = mockRequest({
      headers: {},
    });
    const res = mockResponse();
    const next = mockNext();

    await setAuthUser(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  test("should handle invalid JWT token", async () => {
    const req = mockRequest({
      headers: {
        authorization: "Bearer invalid.token.here",
      },
    });
    const res = mockResponse();
    const next = mockNext();

    await setAuthUser(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  test("should handle logged out token", async () => {
    const mockUserData = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      roles: [{ role: "diner" }],
    };

    const token = jwt.sign(mockUserData, mockConfig.jwtSecret);

    const req = mockRequest({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.isLoggedIn.mockResolvedValue(false);

    await setAuthUser(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  test("should handle malformed authorization header", async () => {
    const req = mockRequest({
      headers: {
        authorization: "NotBearer token",
      },
    });
    const res = mockResponse();
    const next = mockNext();

    await setAuthUser(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  test("should handle database errors gracefully", async () => {
    const mockUserData = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      roles: [{ role: "diner" }],
    };

    const token = jwt.sign(mockUserData, mockConfig.jwtSecret);

    const req = mockRequest({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.isLoggedIn.mockRejectedValue(new Error("DB Error"));

    await setAuthUser(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});

describe("AuthRouter Middleware - authenticateToken", () => {
  test("should allow authenticated requests", () => {
    const req = mockRequest({
      user: mockUser(),
    });
    const res = mockResponse();
    const next = mockNext();

    authRouter.authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("should block unauthenticated requests", () => {
    const req = mockRequest({
      user: null,
    });
    const res = mockResponse();
    const next = mockNext();

    authRouter.authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("AuthRouter - setAuth helper", () => {
  test("setAuth function exists and can be called", () => {
    const user = mockUser();

    // setAuth may return object or string depending on implementation
    // Just verify it can be called without error
    expect(() => setAuth(user)).not.toThrow();
  });
});

describe("AuthRouter - Documentation", () => {
  test("should have docs array", () => {
    expect(authRouter.docs).toBeDefined();
    expect(Array.isArray(authRouter.docs)).toBe(true);
  });

  test("should have docs for all endpoints", () => {
    const methods = authRouter.docs.map((d) => d.method);
    expect(methods).toContain("POST");
    expect(methods).toContain("PUT");
    expect(methods).toContain("DELETE");
  });

  test("docs should have required fields", () => {
    authRouter.docs.forEach((doc) => {
      expect(doc.method).toBeDefined();
      expect(doc.path).toBeDefined();
      expect(doc.description).toBeDefined();
    });
  });
});

describe("AuthRouter - Route Structure", () => {
  test("should have POST route for registration", () => {
    const postRoute = authRouter.stack.find(
      (layer) => layer.route && layer.route.methods.post,
    );
    expect(postRoute).toBeDefined();
  });

  test("should have PUT route for login", () => {
    const putRoute = authRouter.stack.find(
      (layer) => layer.route && layer.route.methods.put,
    );
    expect(putRoute).toBeDefined();
  });

  test("should have DELETE route for logout", () => {
    const deleteRoute = authRouter.stack.find(
      (layer) => layer.route && layer.route.methods.delete,
    );
    expect(deleteRoute).toBeDefined();
  });

  test("DELETE route should have authentication middleware", () => {
    const deleteRoute = authRouter.stack.find(
      (layer) => layer.route && layer.route.methods.delete,
    );
    expect(deleteRoute.route.stack.length).toBeGreaterThan(1);
  });
});
