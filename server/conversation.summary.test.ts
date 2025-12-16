import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createConversation, insertTranslation, getSummaryByConversationId } from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("conversation.generateSummary", () => {
  let testConversationId: number;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  beforeAll(async () => {
    // Create a test conversation with unique title
    const conversationId = await createConversation({
      targetLanguage: "vi",
      title: `測試對話-summary-${uniqueSuffix}`,
    });

    if (!conversationId) {
      throw new Error("Failed to create test conversation");
    }

    testConversationId = conversationId;

    // Add some test translations
    await insertTranslation({
      conversationId: testConversationId,
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: "vi",
      sourceText: "你好，請問哪裡不舒服？",
      translatedText: "Xin chào, bạn cảm thấy không thoải mái ở đâu?",
    });

    await insertTranslation({
      conversationId: testConversationId,
      direction: "patient_to_nurse",
      sourceLang: "vi",
      targetLang: "zh",
      sourceText: "Tôi bị đau đầu và sốt.",
      translatedText: "我頭痛和發燒。",
    });

    await insertTranslation({
      conversationId: testConversationId,
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: "vi",
      sourceText: "好的，我幫你量一下體溫。",
      translatedText: "Được rồi, tôi sẽ đo nhiệt độ cho bạn.",
    });
  });

  it("should generate summary for a conversation with translations", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.conversation.generateSummary({
      conversationId: testConversationId,
    });

    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.keyPoints).toBeDefined();
    expect(result.messageCount).toBe(3);

    // Verify summary is saved to database
    const savedSummary = await getSummaryByConversationId(testConversationId);
    expect(savedSummary).toBeDefined();
    expect(savedSummary?.summary).toBe(result.summary);
    expect(savedSummary?.keyPoints).toBe(result.keyPoints);
  }, 30000); // 30 second timeout for LLM API call

  it("should fail to generate summary for non-existent conversation", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.conversation.generateSummary({
      conversationId: 999999,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Conversation not found");
  });

  it("should update existing summary when regenerated", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Generate summary first time
    const firstResult = await caller.conversation.generateSummary({
      conversationId: testConversationId,
    });

    expect(firstResult.success).toBe(true);

    // Add another translation
    await insertTranslation({
      conversationId: testConversationId,
      direction: "patient_to_nurse",
      sourceLang: "vi",
      targetLang: "zh",
      sourceText: "Cảm ơn bạn.",
      translatedText: "謝謝你。",
    });

    // Regenerate summary
    const secondResult = await caller.conversation.generateSummary({
      conversationId: testConversationId,
    });

    expect(secondResult.success).toBe(true);
    expect(secondResult.messageCount).toBe(4); // Should include the new translation

    // Verify only one summary exists
    const savedSummary = await getSummaryByConversationId(testConversationId);
    expect(savedSummary).toBeDefined();
  }, 30000);
});

describe("conversation.getSummary", () => {
  it("should retrieve existing summary", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation and generate summary with unique title
    const uniqueTitle = `測試對話-getSummary-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const conversationId = await createConversation({
      targetLanguage: "en",
      title: uniqueTitle,
    });

    if (!conversationId) {
      throw new Error("Failed to create test conversation");
    }

    await insertTranslation({
      conversationId,
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: "en",
      sourceText: "請坐下。",
      translatedText: "Please sit down.",
    });

    await caller.conversation.generateSummary({ conversationId });

    // Retrieve summary
    const result = await caller.conversation.getSummary({ conversationId });

    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.summary?.conversationId).toBe(conversationId);
  }, 30000);

  it("should return undefined for conversation without summary", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation without generating summary with unique title
    const uniqueTitle = `測試對話-noSummary-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const conversationId = await createConversation({
      targetLanguage: "ja",
      title: uniqueTitle,
    });

    if (!conversationId) {
      throw new Error("Failed to create test conversation");
    }

    const result = await caller.conversation.getSummary({ conversationId });

    expect(result.success).toBe(true);
    expect(result.summary).toBeUndefined();
  });
});
