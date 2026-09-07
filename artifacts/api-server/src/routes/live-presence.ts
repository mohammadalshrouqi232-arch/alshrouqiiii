import { db, partiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

type PresenceConnections = Map<string, Set<string>>;

const livePresence = new Map<number, PresenceConnections>();
const updateQueues = new Map<number, Promise<void>>();

function persistMemberCount(partyId: number, memberCount: number): Promise<void> {
  const previous = updateQueues.get(partyId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await db
        .update(partiesTable)
        .set({ memberCount })
        .where(eq(partiesTable.id, partyId));
    });

  updateQueues.set(partyId, next);
  void next
    .catch((error) => {
      logger.error({ err: error, partyId, memberCount }, "Could not persist live party presence");
    })
    .finally(() => {
      if (updateQueues.get(partyId) === next) {
        updateQueues.delete(partyId);
      }
    });
  return next;
}

function presenceCount(partyId: number): number {
  return [...(livePresence.get(partyId)?.values() ?? [])].filter((connections) => connections.size > 0).length;
}

export function getLivePresenceCount(partyId: number): number | undefined {
  return livePresence.has(partyId) ? presenceCount(partyId) : undefined;
}

export function addLivePresence(partyId: number, presenceId: string, connectionId: string): Promise<number> {
  const partyPresence = livePresence.get(partyId) ?? new Map<string, Set<string>>();
  const connections = partyPresence.get(presenceId) ?? new Set<string>();
  connections.add(connectionId);
  partyPresence.set(presenceId, connections);
  livePresence.set(partyId, partyPresence);

  const count = presenceCount(partyId);
  return persistMemberCount(partyId, count).then(() => count);
}

export function removeLivePresence(partyId: number, presenceId: string, connectionId: string): Promise<number> {
  const partyPresence = livePresence.get(partyId);
  if (!partyPresence) return Promise.resolve(0);

  const connections = partyPresence.get(presenceId);
  connections?.delete(connectionId);
  if (connections && connections.size === 0) {
    partyPresence.delete(presenceId);
  }

  const count = presenceCount(partyId);
  return persistMemberCount(partyId, count).then(() => count);
}