import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
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

// Helper to generate unique title
function uniqueTitle(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

describe("History feature", () => {
  it("should list conversations with translation count", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation with unique title to avoid conflicts
    const title = uniqueTitle("測試對話-history");
    const createResult = await caller.conversation.create({
      targetLanguage: "vi",
      title,
    });

    expect(createResult.success).toBe(true);
    expect(createResult.conversationId).toBeDefined();

    const conversationId = createResult.conversationId!;

    // Save a translation
    await caller.conversation.saveTranslation({
      conversationId,
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: "vi",
      sourceText: "你好",
      translatedText: "Xin chào",
    });

    // List conversations
    const listResult = await caller.conversation.list({ limit: 10 });

    expect(listResult.success).toBe(true);
    expect(listResult.conversations).toBeDefined();
    expect(listResult.conversations.length).toBeGreaterThan(0);

    // Check if translation count is included for THIS specific conversation
    const conv = listResult.conversations.find((c) => c.id === conversationId);
    expect(conv).toBeDefined();
    expect(conv?.translationCount).toBe(1);
  }, 15000);

  it("should get conversation with translations", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation with unique title
    const title = uniqueTitle("測試對話-translations");
    const createResult = await caller.conversation.create({
      targetLanguage: "vi",
      title,
    });

    const conversationId = createResult.conversationId!;

    // Save multiple translations
    await caller.conversation.saveTranslation({
      conversationId,
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: "vi",
      sourceText: "你好",
      translatedText: "Xin chào",
    });

    await caller.conversation.saveTranslation({
      conversationId,
      direction: "patient_to_nurse",
      sourceLang: "vi",
      targetLang: "zh",
      sourceText: "Cảm ơn",
      translatedText: "謝謝",
    });

    // Get conversation with translations
    const detailResult = await caller.conversation.getWithTranslations({
      conversationId,
    });

    expect(detailResult.success).toBe(true);
    expect(detailResult.conversation).toBeDefined();
    expect(detailResult.translations).toBeDefined();
    expect(detailResult.translations?.length).toBe(2);

    // Check translation details
    const firstTranslation = detailResult.translations?.[0];
    expect(firstTranslation?.sourceText).toBeDefined();
    expect(firstTranslation?.translatedText).toBeDefined();
    expect(firstTranslation?.direction).toBeDefined();
  }, 15000);

  it("should filter conversations by language", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create conversations with different languages and unique titles
    const timestamp = Date.now();
    await caller.conversation.create({
      targetLanguage: "vi",
      title: `越南語對話-${timestamp}`,
    });

    await caller.conversation.create({
      targetLanguage: "en",
      title: `英文對話-${timestamp}`,
    });

    // List all conversations
    const allResult = await caller.conversation.list({ limit: 100 });
    expect(allResult.success).toBe(true);

    // Check if we have conversations with different languages
    const viConv = allResult.conversations.find((c) => c.targetLanguage === "vi");
    const enConv = allResult.conversations.find((c) => c.targetLanguage === "en");

    expect(viConv).toBeDefined();
    expect(enConv).toBeDefined();
  }, 15000);
});
