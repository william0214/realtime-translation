import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, translations, InsertTranslation, languageConfig, conversations, InsertConversation } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Translation queries
export async function insertTranslation(translation: InsertTranslation) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert translation: database not available");
    return undefined;
  }

  const result = await db.insert(translations).values(translation);
  return result;
}

export async function getRecentTranslations(limit: number = 20) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get translations: database not available");
    return [];
  }

  const result = await db.select().from(translations).limit(limit);
  return result;
}

// Language configuration queries
export async function getActiveLanguages() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get languages: database not available");
    return [];
  }

  const result = await db.select().from(languageConfig).where(eq(languageConfig.isActive, 1));
  return result;
}

export async function getLanguageByCode(code: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get language: database not available");
    return undefined;
  }

  const result = await db.select().from(languageConfig).where(eq(languageConfig.code, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Conversation queries
export async function createConversation(conversation: InsertConversation) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create conversation: database not available");
    return undefined;
  }

  const result = await db.insert(conversations).values(conversation);
  // Get the last inserted ID
  const inserted = await db.select().from(conversations).orderBy(desc(conversations.id)).limit(1);
  return inserted.length > 0 ? inserted[0].id : undefined;
}

export async function endConversation(conversationId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot end conversation: database not available");
    return;
  }

  await db.update(conversations)
    .set({ endedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

export async function getConversationById(conversationId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get conversation: database not available");
    return undefined;
  }

  const result = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecentConversations(limit: number = 20) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get conversations: database not available");
    return [];
  }

  const result = await db.select().from(conversations).orderBy(desc(conversations.startedAt)).limit(limit);
  
  // Add translation count for each conversation
  const conversationsWithCount = await Promise.all(
    result.map(async (conv) => {
      const translationCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(translations)
        .where(eq(translations.conversationId, conv.id));
      
      return {
        ...conv,
        translationCount: Number(translationCount[0]?.count || 0),
      };
    })
  );
  
  return conversationsWithCount;
}

export async function getTranslationsByConversationId(conversationId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get translations: database not available");
    return [];
  }

  const result = await db.select().from(translations).where(eq(translations.conversationId, conversationId));
  return result;
}
