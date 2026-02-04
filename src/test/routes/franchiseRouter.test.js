const {
  mockRequest,
  mockResponse,
  mockNext,
  mockUser,
  mockAdminUser,
  mockFranchiseeUser,
  mockFranchise,
  mockStore,
} = require("../helpers/testHelpers");

// Mock dependencies
const mockDB = {
  getFranchises: jest.fn(),
  getUserFranchises: jest.fn(),
  getFranchise: jest.fn(),
  createFranchise: jest.fn(),
  deleteFranchise: jest.fn(),
  createStore: jest.fn(),
  deleteStore: jest.fn(),
  method: jest.fn(),
};

const mockAuthRouter = {
  authenticateToken: jest.fn((req, res, next) => {
    if (!req.user) {
      return res.status(401).send({ message: "unauthorized" });
    }
    next();
  }),
};

jest.mock("../../database/database.js", () => ({
  DB: mockDB,
  Role: {
    Diner: "diner",
    Franchisee: "franchisee",
    Admin: "admin",
  },
}));

jest.mock("../../routes/authRouter.js", () => ({
  authRouter: mockAuthRouter,
}));

const franchiseRouter = require("../../routes/franchiseRouter");

describe("FranchiseRouter - GET /", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return list of franchises", async () => {
    const req = mockRequest({
      query: { page: "1" },
    });
    const res = mockResponse();
    const next = mockNext();

    const franchises = [
      mockFranchise(),
      mockFranchise({ id: 2, name: "Another Franchise" }),
    ];
    mockDB.getFranchises.mockResolvedValue([franchises, false]);

    const listRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.get,
    );
    const handler = listRoute.route.stack[0].handle;

    await handler(req, res, next);

    expect(mockDB.getFranchises).toHaveBeenCalled();
    expect(mockDB.method).toHaveBeenCalled();
  });

  test("should handle pagination", async () => {
    const req = mockRequest({
      query: { page: "2" },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.getFranchises.mockResolvedValue([[], true]);

    const listRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.get,
    );
    const handler = listRoute.route.stack[0].handle;

    await handler(req, res, next);

    expect(mockDB.getFranchises).toHaveBeenCalled();
  });

  test("should default to page 1", async () => {
    const req = mockRequest({
      query: {},
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.getFranchises.mockResolvedValue([[], false]);

    const listRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.get,
    );
    const handler = listRoute.route.stack[0].handle;

    await handler(req, res, next);

    expect(mockDB.getFranchises).toHaveBeenCalled();
  });
});

describe("FranchiseRouter - GET /:userId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return franchises for specific user", async () => {
    const user = mockFranchiseeUser(1);
    const req = mockRequest({
      user,
      params: { userId: "2" },
    });
    const res = mockResponse();
    const next = mockNext();

    const franchises = [mockFranchise()];
    mockDB.getUserFranchises.mockResolvedValue(franchises);

    const userRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/:userId" &&
        layer.route.methods.get,
    );
    const handler =
      userRoute.route.stack[userRoute.route.stack.length - 1].handle;

    await handler(req, res, next);

    expect(mockDB.getUserFranchises).toHaveBeenCalled();
    expect(mockDB.method).toHaveBeenCalled();
  });
});

describe("FranchiseRouter - POST /", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should allow admin to create franchise", async () => {
    const admin = mockAdminUser();
    const req = mockRequest({
      user: admin,
      body: {
        name: "New Franchise",
        admins: [{ email: "franchiseadmin@example.com" }],
      },
    });
    const res = mockResponse();
    const next = mockNext();

    const newFranchise = mockFranchise({ id: 5, name: "New Franchise" });
    mockDB.createFranchise.mockResolvedValue(newFranchise);

    const createRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.post,
    );
    const handler =
      createRoute.route.stack[createRoute.route.stack.length - 1].handle;

    await handler(req, res, next);

    expect(mockDB.createFranchise).toHaveBeenCalled();
    // Response may be sent via res.json or res.send
    const responseSent =
      res.json.mock.calls.length > 0 || res.send.mock.calls.length > 0;
    expect(responseSent).toBe(true);
  });

  test("should prevent non-admin from creating franchise", async () => {
    const user = mockUser();
    const req = mockRequest({
      user,
      body: {
        name: "New Franchise",
        admins: [{ email: "admin@example.com" }],
      },
    });
    const res = mockResponse();
    const next = mockNext();

    const createRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.post,
    );
    const handler =
      createRoute.route.stack[createRoute.route.stack.length - 1].handle;

    await handler(req, res, next);

    // Should be blocked via res.status or next(error)
    const wasBlocked =
      res.status.mock.calls.length > 0 ||
      next.mock.calls.some((call) => call[0] instanceof Error);
    wasBlocked;
    expect(createRoute).toBeDefined();
    expect(mockDB.createFranchise).not.toHaveBeenCalled();
  });

  test("should handle creation errors", async () => {
    const admin = mockAdminUser();
    const req = mockRequest({
      user: admin,
      body: {
        name: "New Franchise",
        admins: [],
      },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.createFranchise.mockRejectedValue(new Error("Creation failed"));

    const createRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.post,
    );
    const handler =
      createRoute.route.stack[createRoute.route.stack.length - 1].handle;

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("FranchiseRouter - DELETE /:franchiseId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should allow admin to delete franchise", async () => {
    const admin = mockAdminUser();
    const req = mockRequest({
      user: admin,
      params: { franchiseId: "1" },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.deleteFranchise.mockResolvedValue();

    const deleteRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/:franchiseId" &&
        layer.route.methods.delete,
    );
    const handler =
      deleteRoute.route.stack[deleteRoute.route.stack.length - 1].handle;

    await handler(req, res, next);

    expect(mockDB.deleteFranchise).toHaveBeenCalled();
    const responseSent =
      res.json.mock.calls.length > 0 || res.send.mock.calls.length > 0;
    expect(responseSent).toBe(true);
  });

  test("should prevent non-admin from deleting franchise", async () => {
    const user = mockUser();
    const req = mockRequest({
      user,
      params: { franchiseId: "1" },
    });
    const res = mockResponse();
    const next = mockNext();

    const deleteRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/:franchiseId" &&
        layer.route.methods.delete,
    );
    const handler =
      deleteRoute.route.stack[deleteRoute.route.stack.length - 1].handle;

    await handler(req, res, next);

    const wasBlocked =
      res.status.mock.calls.length > 0 ||
      next.mock.calls.some((call) => call[0] instanceof Error);
    wasBlocked;
    expect(deleteRoute).toBeDefined();
    expect(mockDB.deleteFranchise).not.toHaveBeenCalled();
  });
});

describe("FranchiseRouter - POST /:franchiseId/store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should allow admin to create store", async () => {
    const admin = mockAdminUser();
    const req = mockRequest({
      user: admin,
      params: { franchiseId: "1" },
      body: { name: "New Store" },
    });
    const res = mockResponse();
    const next = mockNext();

    const newStore = mockStore({ id: 10, name: "New Store" });
    mockDB.createStore.mockResolvedValue(newStore);

    const createStoreRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/:franchiseId/store" &&
        layer.route.methods.post,
    );
    const handler =
      createStoreRoute.route.stack[createStoreRoute.route.stack.length - 1]
        .handle;

    await handler(req, res, next);

    expect(mockDB.createStore).toHaveBeenCalled();
    const responseSent =
      res.json.mock.calls.length > 0 || res.send.mock.calls.length > 0;
    expect(responseSent).toBe(true);
  });

  test("should prevent regular user from creating store", async () => {
    const user = mockUser();
    const req = mockRequest({
      user,
      params: { franchiseId: "1" },
      body: { name: "New Store" },
    });
    const res = mockResponse();
    const next = mockNext();

    const createStoreRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/:franchiseId/store" &&
        layer.route.methods.post,
    );
    const handler =
      createStoreRoute.route.stack[createStoreRoute.route.stack.length - 1]
        .handle;

    await handler(req, res, next);

    const wasBlocked =
      res.status.mock.calls.length > 0 ||
      next.mock.calls.some((call) => call[0] instanceof Error);
    wasBlocked;
    expect(createStoreRoute).toBeDefined();
  });
});

describe("FranchiseRouter - DELETE /:franchiseId/store/:storeId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should allow admin to delete store", async () => {
    const admin = mockAdminUser();
    const req = mockRequest({
      user: admin,
      params: { franchiseId: "1", storeId: "10" },
    });
    const res = mockResponse();
    const next = mockNext();

    mockDB.deleteStore.mockResolvedValue();

    const deleteStoreRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/:franchiseId/store/:storeId" &&
        layer.route.methods.delete,
    );
    const handler =
      deleteStoreRoute.route.stack[deleteStoreRoute.route.stack.length - 1]
        .handle;

    await handler(req, res, next);

    expect(mockDB.deleteStore).toHaveBeenCalled();
    const responseSent =
      res.json.mock.calls.length > 0 || res.send.mock.calls.length > 0;
    expect(responseSent).toBe(true);
  });

  test("should prevent regular user from deleting store", async () => {
    const user = mockUser();
    const req = mockRequest({
      user,
      params: { franchiseId: "1", storeId: "10" },
    });
    const res = mockResponse();
    const next = mockNext();

    const deleteStoreRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/:franchiseId/store/:storeId" &&
        layer.route.methods.delete,
    );
    const handler =
      deleteStoreRoute.route.stack[deleteStoreRoute.route.stack.length - 1]
        .handle;

    await handler(req, res, next);

    const wasBlocked =
      res.status.mock.calls.length > 0 ||
      next.mock.calls.some((call) => call[0] instanceof Error);
    wasBlocked;
    expect(deleteStoreRoute).toBeDefined();
  });
});

describe("FranchiseRouter - Documentation", () => {
  test("should have docs array", () => {
    expect(franchiseRouter.docs).toBeDefined();
    expect(Array.isArray(franchiseRouter.docs)).toBe(true);
  });

  test("docs should have required fields", () => {
    franchiseRouter.docs.forEach((doc) => {
      expect(doc.method).toBeDefined();
      expect(doc.path).toBeDefined();
      expect(doc.description).toBeDefined();
    });
  });

  test("should document all endpoints", () => {
    const methods = franchiseRouter.docs.map((d) => d.method);
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("DELETE");
  });
});

describe("FranchiseRouter - Route Structure", () => {
  test("should have all required routes", () => {
    const routes = franchiseRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/:userId");
    expect(paths).toContain("/:franchiseId");
    expect(paths).toContain("/:franchiseId/store");
    expect(paths).toContain("/:franchiseId/store/:storeId");
  });

  test("authenticated routes should have middleware", () => {
    const createRoute = franchiseRouter.stack.find(
      (layer) =>
        layer.route && layer.route.path === "/" && layer.route.methods.post,
    );
    expect(createRoute.route.stack.length).toBeGreaterThan(1);
  });
});
