import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, partiesTable, partyMessagesTable } from "@workspace/db";
import {
  CreatePartyBody,
  CreatePartyMessageBody,
  CreatePartyMessageParams,
  CreatePartyMessageResponse,
  CreatePartyResponse,
  DeletePartyMessageBody,
  DeletePartyMessageParams,
  GetDashboardResponse,
  GetPartyParams,
  GetPartyResponse,
  JoinPartyBody,
  JoinPartyParams,
  JoinPartyResponse,
  ListDeletedPartyMessagesParams,
  ListPartiesResponse,
  ListPartyMessagesParams,
  ListPartyMessagesResponse,
  SetPartyPremiumBody,
  SetPartyPremiumParams,
} from "@workspace/api-zod";
import { getLivePresenceCount } from "./live-presence";

const router: IRouter = Router();
const DEFAULT_ACCENTS = ["#8B5CF6", "#14B8A6", "#F97316", "#EC4899"];
let seedPromise: Promise<void> | null = null;

// A short, non-exhaustive list of common profanity. This is a lightweight
// courtesy filter for a study app, not a moderation system for slurs or
// harassment — extend it if you need broader coverage.
const FLAGGED_WORDS = ["fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt"];
const FLAGGED_WORD_PATTERN = new RegExp(`\\b(${FLAGGED_WORDS.join("|")})\\b`, "i");

// In-memory, per-server mute tracking keyed by the client's self-reported clientId.
// This resets on server restart and can be bypassed by clearing local storage —
// there is no real account system to tie a durable ban to. Good enough as a
// friction-adding cooldown, not a security control.
const mutedUntilByClientId = new Map<string, number>();
const MUTE_DURATION_MS = 60_000;

function isMuted(clientId: string | undefined): number | null {
  if (!clientId) return null;
  const until = mutedUntilByClientId.get(clientId);
  if (!until || until <= Date.now()) return null;
  return until;
}

type DbParty = typeof partiesTable.$inferSelect;
type DbMessage = typeof partyMessagesTable.$inferSelect;

function partyResponse(party: DbParty) {
  return {
    ...party,
    memberCount: getLivePresenceCount(party.id) ?? party.memberCount,
    createdAt: party.createdAt.toISOString(),
  };
}

function messageResponse(message: DbMessage) {
  // Deliberately whitelisted (not `...message`) so deleteToken can never leak
  // through this path — it must only ever be sent back once, at creation.
  return {
    id: message.id,
    partyId: message.partyId,
    sender: message.sender,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
  };
}

function createdMessageResponse(message: DbMessage) {
  return {
    ...messageResponse(message),
    deleteToken: message.deleteToken,
  };
}

async function ensureSeeded(): Promise<void> {
  if (seedPromise) {
    await seedPromise;
    return;
  }

  seedPromise = (async () => {
    const existing = await db.select({ id: partiesTable.id }).from(partiesTable).limit(1);
    if (existing.length > 0) return;

    const seededParties = await db
      .insert(partiesTable)
      .values([
        {
          name: "Late Night Calculus",
          subject: "Mathematics",
          description: "Derivatives, limits, and exam prep with good energy.",
          host: "Maya",
          accent: "#8B5CF6",
          visibility: "public",
          memberCount: 8,
          maxMembers: 12,
          isLive: true,
        },
        {
          name: "Bio Buddies",
          subject: "Biology",
          description: "Cell cycles and genetics, explained without the headache.",
          host: "Noah",
          accent: "#14B8A6",
          visibility: "public",
          memberCount: 5,
          maxMembers: 10,
          isLive: true,
        },
        {
          name: "History Sprint",
          subject: "World History",
          description: "45-minute focus sprint for the industrial revolution unit.",
          host: "Lina",
          accent: "#F97316",
          visibility: "public",
          memberCount: 3,
          maxMembers: 8,
          isLive: false,
        },
      ])
      .returning();

    if (seededParties[0]) {
      await db.insert(partyMessagesTable).values([
        {
          partyId: seededParties[0].id,
          sender: "Maya",
          content: "Welcome in. We are doing a 25-minute focus sprint, then comparing answers.",
          deleteToken: randomBytes(16).toString("hex"),
        },
        {
          partyId: seededParties[0].id,
          sender: "Jordan",
          content: "Perfect, I am on question 4 if anyone wants to pair up after the sprint.",
          deleteToken: randomBytes(16).toString("hex"),
        },
      ]);
    }
  })();

  try {
    await seedPromise;
  } finally {
    seedPromise = null;
  }
}

router.get("/parties", async (req, res): Promise<void> => {
  await ensureSeeded();
  req.log.info("Fetching study parties");
  const parties = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.visibility, "public"))
    .orderBy(desc(partiesTable.id));
  res.json(ListPartiesResponse.parse(parties.map(partyResponse)));
});

router.post("/parties", async (req, res): Promise<void> => {
  const parsed = CreatePartyBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid party body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [party] = await db
    .insert(partiesTable)
    .values({
      ...parsed.data,
      accent: parsed.data.accent ?? DEFAULT_ACCENTS[Math.floor(Math.random() * DEFAULT_ACCENTS.length)],
      visibility: parsed.data.visibility ?? "public",
      maxMembers: parsed.data.maxMembers ?? 12,
      memberCount: 1,
      isLive: true,
    })
    .returning();

  if (!party) {
    res.status(500).json({ error: "Could not create party" });
    return;
  }

  req.log.info({ partyId: party.id }, "Created study party");
  res.status(201).json(CreatePartyResponse.parse(partyResponse(party)));
});

router.get("/parties/:partyId", async (req, res): Promise<void> => {
  const params = GetPartyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, params.data.partyId));

  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }

  res.json(GetPartyResponse.parse(partyResponse(party)));
});

router.post("/parties/:partyId", async (req, res): Promise<void> => {
  const params = JoinPartyParams.safeParse(req.params);
  const parsed = JoinPartyBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, params.data.partyId));

  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }
  const memberCount = getLivePresenceCount(party.id) ?? party.memberCount;
  if (memberCount >= party.maxMembers) {
    res.status(409).json({ error: "This party is full" });
    return;
  }

  req.log.info({ partyId: party.id, memberName: parsed.data.memberName }, "Joined study party");
  res.json(JoinPartyResponse.parse(partyResponse(party)));
});

router.get("/parties/:partyId/messages", async (req, res): Promise<void> => {
  const params = ListPartyMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const messages = await db
    .select()
    .from(partyMessagesTable)
    .where(and(eq(partyMessagesTable.partyId, params.data.partyId), isNull(partyMessagesTable.deletedAt)))
    .orderBy(partyMessagesTable.createdAt);
  res.json(ListPartyMessagesResponse.parse(messages.map((message) => messageResponse(message))));
});

router.get("/parties/:partyId/messages/deleted", async (req, res): Promise<void> => {
  const params = ListDeletedPartyMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [party] = await db
    .select({ id: partiesTable.id, isPremium: partiesTable.isPremium })
    .from(partiesTable)
    .where(eq(partiesTable.id, params.data.partyId));
  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }
  if (!party.isPremium) {
    res.status(403).json({ error: "This party does not have premium enabled" });
    return;
  }

  const messages = await db
    .select()
    .from(partyMessagesTable)
    .where(and(eq(partyMessagesTable.partyId, params.data.partyId), isNotNull(partyMessagesTable.deletedAt)))
    .orderBy(partyMessagesTable.createdAt);
  res.json(messages.map((message) => messageResponse(message)));
});

router.post("/parties/:partyId/messages", async (req, res): Promise<void> => {
  const params = CreatePartyMessageParams.safeParse(req.params);
  const parsed = CreatePartyMessageBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { clientId } = parsed.data;
  const mutedUntil = isMuted(clientId);
  if (mutedUntil) {
    res.status(429).json({
      error: "You're muted for language. Try again shortly.",
      retryAfterSeconds: Math.ceil((mutedUntil - Date.now()) / 1000),
    });
    return;
  }

  const [party] = await db
    .select({ id: partiesTable.id })
    .from(partiesTable)
    .where(eq(partiesTable.id, params.data.partyId));
  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }

  if (FLAGGED_WORD_PATTERN.test(parsed.data.content)) {
    if (clientId) {
      mutedUntilByClientId.set(clientId, Date.now() + MUTE_DURATION_MS);
    }
    res.status(429).json({
      error: "That message was flagged for language. You're muted for a minute.",
      retryAfterSeconds: Math.ceil(MUTE_DURATION_MS / 1000),
    });
    return;
  }

  const [message] = await db
    .insert(partyMessagesTable)
    .values({
      partyId: params.data.partyId,
      sender: parsed.data.sender,
      content: parsed.data.content,
      deleteToken: randomBytes(16).toString("hex"),
    })
    .returning();

  if (!message) {
    res.status(500).json({ error: "Could not send message" });
    return;
  }
  res.status(201).json(CreatePartyMessageResponse.parse(createdMessageResponse(message)));
});

router.delete("/parties/:partyId/messages/:messageId", async (req, res): Promise<void> => {
  const params = DeletePartyMessageParams.safeParse(req.params);
  const parsed = DeletePartyMessageBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [message] = await db
    .select()
    .from(partyMessagesTable)
    .where(and(eq(partyMessagesTable.id, params.data.messageId), eq(partyMessagesTable.partyId, params.data.partyId)));

  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (message.deleteToken !== parsed.data.deleteToken) {
    res.status(403).json({ error: "Delete token did not match" });
    return;
  }

  const [updated] = await db
    .update(partyMessagesTable)
    .set({ deletedAt: new Date() })
    .where(eq(partyMessagesTable.id, message.id))
    .returning();

  res.json(messageResponse(updated ?? { ...message, deletedAt: new Date() }));
});

router.post("/parties/:partyId/premium", async (req, res): Promise<void> => {
  const params = SetPartyPremiumParams.safeParse(req.params);
  const parsed = SetPartyPremiumBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, params.data.partyId));
  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }
  // Lightweight owner check: there are no per-party accounts, so the host
  // display name doubles as the only available credential.
  if (party.host !== parsed.data.host) {
    res.status(403).json({ error: "Only the party's host can change this" });
    return;
  }

  const [updated] = await db
    .update(partiesTable)
    .set({ isPremium: parsed.data.isPremium })
    .where(eq(partiesTable.id, params.data.partyId))
    .returning({ id: partiesTable.id, isPremium: partiesTable.isPremium });

  res.json(updated);
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const parties = await db.select().from(partiesTable).where(eq(partiesTable.visibility, "public")).orderBy(desc(partiesTable.id));
  const [{ count: messageCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(partyMessagesTable);
  const dashboard = {
    partyCount: parties.length,
    liveCount: parties.filter((party) => party.isLive).length,
    totalMembers: parties.reduce((sum, party) => sum + (getLivePresenceCount(party.id) ?? party.memberCount), 0),
    messagesSent: messageCount ?? 0,
    recentParties: parties.slice(0, 3).map(partyResponse),
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

export default router;