import { nanoid } from "nanoid";
import { getRedis } from "./redis";

export interface RoomPeer {
  peerId: string;
  name: string;
  joinedAt: number;
}

export interface Room {
  roomId: string;
  createdAt: number;
  peers: Map<string, RoomPeer>;
}

// ─── In-memory fallback (local dev) ────────────────────────────────────────
export const rooms = new Map<string, Room>();
const ROOM_TTL_MS = 15 * 60 * 1000;
const REDIS_TTL_SECONDS = 15 * 60; // 15 minutes

// ─── Redis helpers ──────────────────────────────────────────────────────────
const roomKey = (roomId: string) => `room:${roomId}:peers`;

async function redisGetPeers(roomId: string): Promise<RoomPeer[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get<RoomPeer[]>(roomKey(roomId));
    return raw ?? [];
  } catch (e) {
    console.error("[rooms] redis GET error:", e);
    return [];
  }
}

async function redisSetPeers(roomId: string, peers: RoomPeer[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(roomKey(roomId), peers, { ex: REDIS_TTL_SECONDS });
  } catch (e) {
    console.error("[rooms] redis SET error:", e);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function createRoom(): string {
  const roomId = nanoid(10);
  // Create immediately in in-memory store so local dev works
  rooms.set(roomId, {
    roomId,
    createdAt: Date.now(),
    peers: new Map(),
  });
  return roomId;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export async function joinRoomAsync(
  roomId: string,
  peerId: string,
  name: string
): Promise<RoomPeer[]> {
  const redis = getRedis();

  if (redis) {
    // ── Redis path (production) ──
    const existing = await redisGetPeers(roomId);
    if (existing.length >= 4) return []; // full

    const newPeer: RoomPeer = { peerId, name, joinedAt: Date.now() };
    const updated = [...existing.filter(p => p.peerId !== peerId), newPeer];
    await redisSetPeers(roomId, updated);
    return existing; // return peers that were there BEFORE this join
  } else {
    // ── In-memory path (local) ──
    let room = rooms.get(roomId);
    if (!room) {
      room = { roomId, createdAt: Date.now(), peers: new Map() };
      rooms.set(roomId, room);
    }
    if (room.peers.size >= 4) return [];
    const existingPeers = Array.from(room.peers.values());
    room.peers.set(peerId, { peerId, name, joinedAt: Date.now() });
    return existingPeers;
  }
}

export async function isRoomFullAsync(roomId: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const peers = await redisGetPeers(roomId);
    return peers.length >= 4;
  }
  const room = rooms.get(roomId);
  return room ? room.peers.size >= 4 : false;
}

export async function leaveRoomAsync(roomId: string, peerId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const peers = await redisGetPeers(roomId);
    const updated = peers.filter(p => p.peerId !== peerId);
    if (updated.length === 0) {
      try { await redis.del(roomKey(roomId)); } catch {}
    } else {
      await redisSetPeers(roomId, updated);
    }
  } else {
    const room = rooms.get(roomId);
    if (room) {
      room.peers.delete(peerId);
      if (room.peers.size === 0) rooms.delete(roomId);
    }
  }
}

export async function getRoomPeersAsync(roomId: string): Promise<RoomPeer[]> {
  const redis = getRedis();
  if (redis) {
    return redisGetPeers(roomId);
  }
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.peers.values());
}

// ─── Legacy sync exports (kept for backwards compat — local only) ────────────
export function joinRoom(roomId: string, peerId: string, name: string): RoomPeer[] {
  let room = rooms.get(roomId);
  if (!room) {
    room = { roomId, createdAt: Date.now(), peers: new Map() };
    rooms.set(roomId, room);
  }
  if (room.peers.size >= 4) return [];
  const existingPeers = Array.from(room.peers.values());
  room.peers.set(peerId, { peerId, name, joinedAt: Date.now() });
  return existingPeers;
}

export function isRoomFull(roomId: string): boolean {
  const room = rooms.get(roomId);
  return room ? room.peers.size >= 4 : false;
}

export function leaveRoom(roomId: string, peerId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.peers.delete(peerId);
    if (room.peers.size === 0) rooms.delete(roomId);
  }
}

export function getRoomPeers(roomId: string): RoomPeer[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.peers.values());
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
export function cleanupExpiredRooms(): void {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) rooms.delete(roomId);
  }
}

if (typeof global !== "undefined") {
  setInterval(cleanupExpiredRooms, 5 * 60 * 1000);
}
