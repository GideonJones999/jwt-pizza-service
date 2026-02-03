const { mockDbConnection } = require("../helpers/testHelpers");


// Mock the config before requiring database
jest.mock("../../config.js", () => ({
  jwtSecret: "test-secret",
  db: {
    connection: {
      host: "127.0.0.1",
      user: "root",
      password: "password",
      database: "pizza_service",
      connectionTimeout: 60000,
    },
    listPerPage: 10,
  },
}));

// Create mock connection with all required methods
const mockConnection = {
  query: jest.fn(),
  execute: jest.fn(),
  end: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

// Mock mysql2/promise with createConnection
jest.mock("mysql2/promise", () => ({
  createConnection: jest.fn(() => Promise.resolve(mockConnection)),
}));

const mysql = require("mysql2/promise");
const { DB, Role } = require("../../database/database");

// Force the initialization to resolve immediately so it doesn't hang
jest
  .spyOn(DB.prototype, "initializeDatabase")
  .mockImplementation(() => Promise.resolve());

describe("Database - User Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addUser", () => {
    test("should create a new user successfully", async () => {
      const mockUser = {
        name: "Test User",
        email: "test@example.com",
        password: "hashedpassword",
        roles: [{ role: "diner" }],
      };

      // MySQL returns array with result object
      mockConnection.execute.mockResolvedValueOnce([{ insertId: 1 }, []]);
      mockConnection.execute.mockResolvedValueOnce([{ insertId: 1 }, []]);

      const result = await DB.addUser(mockUser);

      expect(result).toEqual({
        id: 1,
        name: mockUser.name,
        email: mockUser.email,
        roles: [{ role: Role.Diner }],
      });
    });

    test("should handle database errors", async () => {
      const mockUser = {
        name: "Test User",
        email: "test@example.com",
        password: "password",
        roles: [{ role: "diner" }],
      };

      mockConnection.execute.mockRejectedValueOnce(new Error("DB Error"));

      await expect(DB.addUser(mockUser)).rejects.toThrow("DB Error");
    });
  });

  describe("getUser", () => {
    test("should retrieve user by email and password", async () => {
      const mockUserData = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        password: "hashedpassword",
      };

      // execute returns [rows, fields]
      mockConnection.execute
        .mockResolvedValueOnce([[mockUserData], []])
        .mockResolvedValueOnce([[{ role: "diner" }], []]);

      const result = await DB.getUser("test@example.com", "password");

      expect(result).toBeDefined();
      expect(result.email).toBe("test@example.com");
    });

    test("should return undefined for non-existent user", async () => {
      mockConnection.execute.mockResolvedValueOnce([[], []]);

      const result = await DB.getUser("nonexistent@example.com", "password");

      expect(result).toBeUndefined();
    });
  });

  describe("updateUser", () => {
    test("should update user successfully", async () => {
      const userId = 1;
      const email = "updated@example.com";
      const password = "newpassword";

      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1 }], []]) // getUser query
        .mockResolvedValueOnce([[{ role: "diner" }], []]) // getRoles query
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // update query

      await DB.updateUser(userId, email, password);

      expect(mockConnection.execute).toHaveBeenCalled();
    });
  });

  describe("loginUser", () => {
    test("should create login token successfully", async () => {
      const userId = 1;
      const token = "test.jwt.token";

      mockConnection.execute.mockResolvedValueOnce([{ insertId: 1 }, []]);

      await DB.loginUser(userId, token);

      expect(mockConnection.execute).toHaveBeenCalled();
    });
  });

  describe("isLoggedIn", () => {
    test("should return true for valid token", async () => {
      const token = "header.payload.signature";

      mockConnection.execute.mockResolvedValueOnce([[{ userId: 1 }], []]);

      const result = await DB.isLoggedIn(token);

      expect(result).toBe(true);
    });

    test("should return false for invalid token", async () => {
      const token = "header.payload.signature";

      mockConnection.execute.mockResolvedValueOnce([[], []]);

      const result = await DB.isLoggedIn(token);

      expect(result).toBe(false);
    });
  });

  describe("logoutUser", () => {
    test("should delete auth token", async () => {
      const token = "header.payload.signature";

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      await DB.logoutUser(token);

      expect(mockConnection.execute).toHaveBeenCalled();
    });
  });
});

describe("Database - Menu Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMenu", () => {
    test("should return all menu items", async () => {
      const mockMenu = [
        { id: 1, title: "Veggie", price: 0.0038 },
        { id: 2, title: "Pepperoni", price: 0.0042 },
      ];

      mockConnection.execute.mockResolvedValueOnce([mockMenu]);

      const result = await DB.getMenu();

      expect(result).toEqual(mockMenu);
    });
  });

  describe("addMenuItem", () => {
    test("should add menu item successfully", async () => {
      const item = {
        title: "New Pizza",
        description: "Delicious",
        image: "pizza.png",
        price: 0.005,
      };

      mockConnection.execute.mockResolvedValueOnce([{ insertId: 5 }, []]);

      await DB.addMenuItem(item);

      expect(mockConnection.execute).toHaveBeenCalled();
    });
  });
});

describe("Database - Order Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrders", () => {
    test("should return paginated orders for user", async () => {
      const dinerId = 1;
      const mockOrders = [
        { id: 1, franchiseId: 1, storeId: 1, date: new Date() },
      ];

      mockConnection.execute
        .mockResolvedValueOnce([mockOrders, []])
        .mockResolvedValueOnce([[]]);

      const result = await DB.getOrders(dinerId, 1);

      expect(result).toBeDefined();
      expect(result.dinerId).toBe(dinerId);
    });
  });

  describe("addDinerOrder", () => {
    test("should create order with transaction", async () => {
      const order = {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
      };
      const dinerId = 1;

      mockConnection.beginTransaction.mockResolvedValueOnce();
      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1 }], []]) // getFranchise query
        .mockResolvedValueOnce([{ insertId: 10 }]) // insert order
        .mockResolvedValueOnce([{ insertId: 1 }]); // insert item
      mockConnection.commit.mockResolvedValueOnce();

      const result = await DB.addDinerOrder(dinerId, order);

      expect(result).toBeDefined();
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    test("should rollback on error", async () => {
      const order = {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
      };

      mockConnection.beginTransaction.mockResolvedValueOnce();
      mockConnection.execute.mockRejectedValueOnce(new Error("Insert failed"));
      mockConnection.rollback.mockResolvedValueOnce();

      await expect(DB.addDinerOrder(1, order)).rejects.toThrow();
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
  });
});

describe("Database - Franchise Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createFranchise", () => {
    test("should create franchise with admins", async () => {
      const franchise = {
        name: "New Franchise",
        admins: [{ email: "admin@example.com" }],
      };

      mockConnection.beginTransaction.mockResolvedValueOnce();
      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1, name: "Admin" }], []]) // getUser for admin
        .mockResolvedValueOnce([{ insertId: 5 }, []]) // insert franchise
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // insert role
      mockConnection.commit.mockResolvedValueOnce();

      const result = await DB.createFranchise(franchise);

      expect(result).toBeDefined();
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    test("should handle franchise creation errors", async () => {
      const franchise = {
        name: "New Franchise",
        admins: [{ email: "admin@example.com" }],
      };

      mockConnection.beginTransaction.mockResolvedValueOnce();
      mockConnection.execute.mockRejectedValueOnce(
        new Error("Creation failed"),
      );
      mockConnection.rollback.mockResolvedValueOnce();

      await expect(DB.createFranchise(franchise)).rejects.toThrow();
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
  });

  describe("deleteFranchise", () => {
    test("should delete franchise successfully", async () => {
      const franchiseId = 1;

      mockConnection.beginTransaction.mockResolvedValueOnce();
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]) // delete stores
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]) // delete roles
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // delete franchise
      mockConnection.commit.mockResolvedValueOnce();

      await DB.deleteFranchise(franchiseId);

      expect(mockConnection.execute).toHaveBeenCalled();
    });
  });

  describe("getFranchises", () => {
    test("should return paginated franchises", async () => {
      const mockFranchises = [
        { id: 1, name: "Franchise 1" },
        { id: 2, name: "Franchise 2" },
      ];

      mockConnection.execute
        .mockResolvedValueOnce([mockFranchises, []])
        .mockResolvedValueOnce([[{ id: 1, name: "Admin" }], []])
        .mockResolvedValueOnce([[{ id: 1, name: "Store 1" }], []])
        .mockResolvedValueOnce([[{ id: 2, name: "Admin2" }], []])
        .mockResolvedValueOnce([[{ id: 2, name: "Store 2" }], []]);

      const [franchises, hasMore] = await DB.getFranchises(null, 1);

      expect(franchises).toBeDefined();
      expect(Array.isArray(franchises)).toBe(true);
    });
  });

  describe("getUserFranchises", () => {
    test("should return franchises for specific user", async () => {
      const userId = 1;

      mockConnection.execute
        .mockResolvedValueOnce([[{ objectId: 1 }], []]) // get franchise IDs
        .mockResolvedValueOnce([[{ id: 1, name: "My Franchise" }], []]) // get franchises
        .mockResolvedValueOnce([[{ id: 1, name: "Admin" }], []]) // get admins
        .mockResolvedValueOnce([[{ id: 1, name: "Store 1" }], []]); // get stores

      const result = await DB.getUserFranchises(userId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getFranchise", () => {
    test("should return specific franchise", async () => {
      const mockFranchise = { id: 1, name: "Test Franchise" };

      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1, name: "Admin" }], []])
        .mockResolvedValueOnce([[{ id: 1, name: "Store 1" }], []]);

      const result = await DB.getFranchise(mockFranchise);

      expect(result).toBeDefined();
      expect(result.admins).toBeDefined();
      expect(result.stores).toBeDefined();
    });
  });
});

describe("Database - Store Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createStore", () => {
    test("should create store successfully", async () => {
      const franchiseId = 1;
      const store = { name: "New Store" };

      mockConnection.execute.mockResolvedValueOnce([{ insertId: 10 }, []]);

      const result = await DB.createStore(franchiseId, store);

      expect(result).toEqual({ id: 10, franchiseId, name: store.name });
    });
  });

  describe("deleteStore", () => {
    test("should delete store successfully", async () => {
      const franchiseId = 1;
      const storeId = 10;

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      await DB.deleteStore(franchiseId, storeId);

      expect(mockConnection.execute).toHaveBeenCalled();
    });
  });
});

describe("Database - Utility Functions", () => {
  test("getOffset calculates correct offset", () => {
    expect(DB.getOffset(1, 10)).toBe(0);
    expect(DB.getOffset(2, 10)).toBe(10);
    expect(DB.getOffset(3, 20)).toBe(40);
  });

  test("getTokenSignature extracts JWT signature", () => {
    expect(DB.getTokenSignature("a.b.c")).toBe("c");
    expect(DB.getTokenSignature("header.payload.signature")).toBe("signature");
  });

  test("getTokenSignature returns empty for invalid tokens", () => {
    expect(DB.getTokenSignature("invalid")).toBe("");
    expect(DB.getTokenSignature("a.b")).toBe("");
  });
});
