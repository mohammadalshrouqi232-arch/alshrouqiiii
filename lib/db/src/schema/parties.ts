import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const partiesTable = pgTable("study_parties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  host: text("host").notNull(),
  accent: text("accent").notNull().default("#8B5CF6"),
  visibility: text("visibility").notNull().default("public"),
  memberCount: integer("member_count").notNull().default(1),
  maxMembers: integer("max_members").notNull().default(12),
  isLive: boolean("is_live").notNull().default(true),
  isPremium: boolean("is_premium").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPartySchema = createInsertSchema(partiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertParty = z.infer<typeof insertPartySchema>;
export type Party = typeof partiesTable.$inferSelect;