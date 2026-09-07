import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { partiesTable } from "./parties";

export const partyMessagesTable = pgTable("party_messages", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id")
    .notNull()
    .references(() => partiesTable.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deleteToken: text("delete_token").notNull(),
});

export const insertPartyMessageSchema = createInsertSchema(partyMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPartyMessage = z.infer<typeof insertPartyMessageSchema>;
export type PartyMessage = typeof partyMessagesTable.$inferSelect;