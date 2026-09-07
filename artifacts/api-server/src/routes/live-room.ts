import type { IncomingMessage, Server } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { logger } from "../lib/logger";
import { addLivePresence, removeLivePresence } from "./live-presence";

const LIVE_ROOM_PATH = "/ws";
const MAX_PARTICIPANTS_PER_ROOM = 50;
const MAX_NAME_LENGTH = 80;
const MAX_PRESENCE_ID_LENGTH = 100;

type Participant = {
  id: string;
  presenceId: string;
  name: string;
  tone: string;
  micEnabled: boolean;
  videoEnabled: boolean;
  socket: WebSocket;
};

type Room = Map<string, Participant>;

type ClientMessage =
  | {
      type: "join";
      partyId: number;
      presenceId: string;
      name: string;
      tone: string;
      micEnabled: boolean;
      videoEnabled: boolean;
    }
  | {
      type: "signal";
      targetId: string;
      signal: unknown;
    }
  | {
      type: "media-state";
      micEnabled: boolean;
      videoEnabled: boolean;
    };

function publicParticipant(participant: Participant) {
  return {
    id: participant.id,
    name: participant.name,
    tone: participant.tone,
    micEnabled: participant.micEnabled,
    videoEnabled: participant.videoEnabled,
  };
}

function send(socket: WebSocket, message: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function parseMessage(value: string): ClientMessage | null {
  try {
    const message: unknown = JSON.parse(value);
    if (!message || typeof message !== "object" || !("type" in message)) return null;
    const data = message as Record<string, unknown>;

    if (
      data.type === "join" &&
      typeof data.partyId === "number" &&
      Number.isSafeInteger(data.partyId) &&
      data.partyId > 0 &&
      typeof data.presenceId === "string" &&
      data.presenceId.trim().length > 0 &&
      data.presenceId.length <= MAX_PRESENCE_ID_LENGTH &&
      typeof data.name === "string" &&
      typeof data.tone === "string" &&
      typeof data.micEnabled === "boolean" &&
      typeof data.videoEnabled === "boolean"
    ) {
      return {
        type: "join",
        partyId: data.partyId,
        presenceId: data.presenceId.trim(),
        name: data.name.trim().slice(0, MAX_NAME_LENGTH) || "Study friend",
        tone: data.tone.slice(0, 32),
        micEnabled: data.micEnabled,
        videoEnabled: data.videoEnabled,
      };
    }

    if (
      data.type === "signal" &&
      typeof data.targetId === "string" &&
      data.targetId.length <= 100 &&
      "signal" in data
    ) {
      return { type: "signal", targetId: data.targetId, signal: data.signal };
    }

    if (
      data.type === "media-state" &&
      typeof data.micEnabled === "boolean" &&
      typeof data.videoEnabled === "boolean"
    ) {
      return {
        type: "media-state",
        micEnabled: data.micEnabled,
        videoEnabled: data.videoEnabled,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function roomFromUrl(request: IncomingMessage) {
  try {
    return new URL(request.url ?? "/", "http://localhost").pathname;
  } catch {
    return null;
  }
}

export function attachLiveRoomSignaling(server: Server) {
  const rooms = new Map<number, Room>();
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  server.on("upgrade", (request, socket, head) => {
    if (roomFromUrl(request) !== LIVE_ROOM_PATH) {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit("connection", client, request);
    });
  });

  webSocketServer.on("connection", (socket) => {
    let participant: Participant | null = null;
    let room: Room | null = null;
    let partyId: number | null = null;

    const leaveRoom = () => {
      if (!participant || !room) return;

      const departingParticipant = participant;
      const departingRoom = room;
      const departingPartyId = partyId;
      room.delete(participant.id);
      for (const member of departingRoom.values()) {
        send(member.socket, { type: "participant-left", participantId: departingParticipant.id });
      }
      if (departingRoom.size === 0 && departingPartyId !== null) rooms.delete(departingPartyId);
      participant = null;
      room = null;
      partyId = null;

      if (departingPartyId !== null) {
        void removeLivePresence(departingPartyId, departingParticipant.presenceId, departingParticipant.id)
          .then((memberCount) => {
            for (const member of departingRoom.values()) {
              send(member.socket, { type: "presence-updated", memberCount });
            }
          })
          .catch((error) => {
            logger.error({ err: error, partyId: departingPartyId }, "Could not update presence after leaving live room");
          });
      }
    };

    socket.on("message", (raw) => {
      const message = parseMessage(raw.toString());
      if (!message) {
        send(socket, { type: "error", message: "That room message was not valid." });
        return;
      }

      if (message.type === "join") {
        if (participant) return;
        const existingRoom = rooms.get(message.partyId) ?? new Map<string, Participant>();
        if (existingRoom.size >= MAX_PARTICIPANTS_PER_ROOM) {
          send(socket, { type: "error", message: "This live room has reached its connection limit." });
          socket.close(1008, "Room is full");
          return;
        }

        participant = {
          id: randomUUID(),
          presenceId: message.presenceId,
          name: message.name,
          tone: message.tone,
          micEnabled: message.micEnabled,
          videoEnabled: message.videoEnabled,
          socket,
        };
        room = existingRoom;
        partyId = message.partyId;
        rooms.set(message.partyId, existingRoom);

        send(socket, {
          type: "room-state",
          participantId: participant.id,
          participants: [...room.values()].map(publicParticipant),
        });
        for (const member of room.values()) {
          if (member.id !== participant.id) {
            send(member.socket, { type: "participant-joined", participant: publicParticipant(participant) });
          }
        }
        room.set(participant.id, participant);
        void addLivePresence(message.partyId, message.presenceId, participant.id)
          .then((memberCount) => {
            for (const member of existingRoom.values()) {
              send(member.socket, { type: "presence-updated", memberCount });
            }
          })
          .catch((error) => {
            logger.error({ err: error, partyId: message.partyId }, "Could not update presence after joining live room");
          });
        return;
      }

      if (!participant || !room) {
        send(socket, { type: "error", message: "Join the room before sending room updates." });
        return;
      }

      if (message.type === "signal") {
        const target = room.get(message.targetId);
        if (target) {
          send(target.socket, {
            type: "signal",
            fromId: participant.id,
            signal: message.signal,
          });
        }
        return;
      }

      participant.micEnabled = message.micEnabled;
      participant.videoEnabled = message.videoEnabled;
      for (const member of room.values()) {
        if (member.id !== participant.id) {
          send(member.socket, {
            type: "participant-updated",
            participant: publicParticipant(participant),
          });
        }
      }
    });

    socket.on("close", leaveRoom);
    socket.on("error", (error) => {
      logger.warn({ err: error }, "Live room WebSocket error");
    });
  });

  logger.info({ path: LIVE_ROOM_PATH }, "Live room signaling ready");
  return webSocketServer;
}