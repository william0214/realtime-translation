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

describe("Conversation History Integration", () => {
  it("complete conversation flow: create -> save translations -> end", { timeout: 15000 }, async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Step 1: Create a conversation
    const createResult = await caller.conversation.create({
      targetLanguage: "vi",
      title: "Integration Test Conversation",
    });

    expect(createResult.success).toBe(true);
    expect(createResult.conversationId).toBeDefined();
    const conversationId = createResult.conversationId!;

    // Step 2: Save multiple translations
    const translation1 = await caller.conversation.saveTranslation({
      conversationId,
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: "vi",
      sourceText: "你好嗎？",
      translatedText: "Bạn khỏe không?",
    });
    expect(translation1.success).toBe(true);

    const translation2 = await caller.conversation.saveTranslation({
      conversationId,
      direction: "patient_to_nurse",
      sourceLang: "vi",
      targetLang: "zh",
      sourceText: "Tôi khỏe, cảm ơn.",
      translatedText: "我很好，謝謝。",
    });
    expect(translation2.success).toBe(true);

    // Step 3: Get conversation with translations
    const getResult = await caller.conversation.getWithTranslations({
      conversationId,
    });

    expect(getResult.success).toBe(true);
    expect(getResult.conversation).toBeDefined();
    expect(getResult.translations).toBeDefined();
    expect(getResult.translations!.length).toBe(2);
    expect(getResult.conversation!.endedAt).toBeNull();

    // Step 4: End conversation
    const endResult = await caller.conversation.end({
      conversationId,
    });
    expect(endResult.success).toBe(true);

    // Step 5: Verify conversation is ended
    const getResultAfterEnd = await caller.conversation.getWithTranslations({
      conversationId,
    });
    expect(getResultAfterEnd.success).toBe(true);
    expect(getResultAfterEnd.conversation!.endedAt).not.toBeNull();
  });

  it("list conversations shows recent conversations", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation
    const createResult = await caller.conversation.create({
      targetLanguage: "vi",
      title: "List Test Conversation",
    });

    expect(createResult.success).toBe(true);

    // List conversations
    const listResult = await caller.conversation.list({
      limit: 10,
    });

    expect(listResult.success).toBe(true);
    expect(Array.isArray(listResult.conversations)).toBe(true);
    expect(listResult.conversations!.length).toBeGreaterThan(0);
  });
});
