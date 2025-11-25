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

describe("conversation.create", () => {
  it("creates a new conversation", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.conversation.create({
      targetLanguage: "vi",
      title: "Test Conversation",
    });

    expect(result.success).toBe(true);
    expect(result.conversationId).toBeDefined();
  });
});

describe("conversation.saveTranslation", () => {
  it("saves a translation to conversation", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // First create a conversation
    const createResult = await caller.conversation.create({
      targetLanguage: "vi",
      title: "Test Conversation",
    });

    expect(createResult.success).toBe(true);
    const conversationId = createResult.conversationId!;

    // Then save a translation
    const saveResult = await caller.conversation.saveTranslation({
      conversationId,
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: "vi",
      sourceText: "你好",
      translatedText: "Xin chào",
    });

    expect(saveResult.success).toBe(true);
  });
});

describe("conversation.list", () => {
  it("lists recent conversations", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.conversation.list({
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.conversations)).toBe(true);
  });
});

describe("conversation.getWithTranslations", () => {
  it("gets conversation with translations", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // First create a conversation
    const createResult = await caller.conversation.create({
      targetLanguage: "vi",
      title: "Test Conversation",
    });

    expect(createResult.success).toBe(true);
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

    // Get conversation with translations
    const getResult = await caller.conversation.getWithTranslations({
      conversationId,
    });

    expect(getResult.success).toBe(true);
    expect(getResult.conversation).toBeDefined();
    expect(Array.isArray(getResult.translations)).toBe(true);
    expect(getResult.translations!.length).toBeGreaterThan(0);
  });
});

describe("conversation.end", () => {
  it("ends a conversation", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // First create a conversation
    const createResult = await caller.conversation.create({
      targetLanguage: "vi",
      title: "Test Conversation",
    });

    expect(createResult.success).toBe(true);
    const conversationId = createResult.conversationId!;

    // End the conversation
    const endResult = await caller.conversation.end({
      conversationId,
    });

    expect(endResult.success).toBe(true);
  });
});
