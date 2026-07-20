const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/modules/ai/service/ai.service", () => ({
  chat: jest.fn(),
  listConversations: jest.fn(),
  getConversation: jest.fn(),
  deleteConversation: jest.fn(),
  updateConversationTitle: jest.fn(),
}));

jest.mock("../../src/utils/redisTest", () => {
  return jest.requireActual("express").Router();
});

const { createApp } = require("../../src/app");
const aiService = require("../../src/modules/ai/service/ai.service");

describe("AI Chat API Role Authorization", () => {
  const app = createApp();
  const tenantId = "64a000000000000000000001";
  const userId = "64a000000000000000000002";
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "defaultsecret";

  const ownerToken = jwt.sign(
    { userId, tenantId, role: "TENANT_OWNER", phoneNumber: "0901000001" },
    secret,
    { expiresIn: "15m" }
  );

  const bmToken = jwt.sign(
    { userId, tenantId, role: "BRANCH_MANAGER", phoneNumber: "0901000002" },
    secret,
    { expiresIn: "15m" }
  );

  const staffToken = jwt.sign(
    { userId, tenantId, role: "STAFF", phoneNumber: "0901000003" },
    secret,
    { expiresIn: "15m" }
  );

  beforeEach(() => jest.clearAllMocks());

  test("TENANT_OWNER can access AI chat", async () => {
    aiService.chat.mockResolvedValue({
      reply: "Hello owner",
      conversationId: "conv123",
    });

    const response = await request(app)
      .post("/ai/chat")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ message: "Hello" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(aiService.chat).toHaveBeenCalledWith(tenantId, userId, "Hello", undefined);
  });

  test("BRANCH_MANAGER can access AI chat on mobile/backend", async () => {
    aiService.chat.mockResolvedValue({
      reply: "Hello manager",
      conversationId: "conv124",
    });

    const response = await request(app)
      .post("/ai/chat")
      .set("Authorization", `Bearer ${bmToken}`)
      .send({ message: "Show sales" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(aiService.chat).toHaveBeenCalledWith(tenantId, userId, "Show sales", undefined);
  });

  test("STAFF is forbidden from AI chat", async () => {
    const response = await request(app)
      .post("/ai/chat")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ message: "Hello" });

    expect(response.status).toBe(403);
    expect(aiService.chat).not.toHaveBeenCalled();
  });
});
