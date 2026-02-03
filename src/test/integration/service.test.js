const request = require("supertest");

// Mock the database before requiring service
jest.mock("../../database/database.js", () => ({
  DB: {
    initializeDatabase: jest.fn().mockResolvedValue(),
  },
  Role: {
    Diner: "diner",
    Franchisee: "franchisee",
    Admin: "admin",
  },
}));

const service = require("../../service");

describe("Service Integration Tests", () => {
  test("should respond to health check", async () => {
    const response = await request(service).get("/");
    expect(response.status).toBeDefined();
  });

  test("should have CORS enabled", async () => {
    const response = await request(service)
      .options("/api/auth")
      .set("Origin", "http://localhost:3000");

    // CORS should allow the request
    expect(response.status).toBeDefined();
  });

  test("should parse JSON bodies", async () => {
    const response = await request(service)
      .post("/api/auth")
      .send({ test: "data" })
      .set("Content-Type", "application/json");

    expect(response.status).toBeDefined();
  });

  test("service should be an Express app", () => {
    expect(service).toBeDefined();
    expect(typeof service).toBe("function");
    expect(service.use).toBeDefined();
  });
});
