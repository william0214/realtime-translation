import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Translation records table - stores all translation history
 */
export const translations = mysqlTable("translations", {
  id: int("id").autoincrement().primaryKey(),
  /** Translation direction: nurse_to_patient or patient_to_nurse */
  direction: varchar("direction", { length: 32 }).notNull(),
  /** Source language code (e.g., zh, vi, en) */
  sourceLang: varchar("sourceLang", { length: 16 }).notNull(),
  /** Target language code */
  targetLang: varchar("targetLang", { length: 16 }).notNull(),
  /** Original text from speech recognition */
  sourceText: text("sourceText").notNull(),
  /** Translated text */
  translatedText: text("translatedText").notNull(),
  /** Audio URL for TTS output (optional) */
  audioUrl: text("audioUrl"),
  /** User ID who initiated the translation (optional) */
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = typeof translations.$inferInsert;

/**
 * Language configuration table - manages supported languages
 */
export const languageConfig = mysqlTable("languageConfig", {
  id: int("id").autoincrement().primaryKey(),
  /** Language code (e.g., zh, vi, en) */
  code: varchar("code", { length: 16 }).notNull().unique(),
  /** Display name */
  name: varchar("name", { length: 64 }).notNull(),
  /** Role: nurse or patient */
  role: mysqlEnum("role", ["nurse", "patient"]).notNull(),
  /** Whether this language is active */
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LanguageConfig = typeof languageConfig.$inferSelect;
export type InsertLanguageConfig = typeof languageConfig.$inferInsert;