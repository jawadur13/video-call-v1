import { nanoid } from "nanoid";

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

// In-memory room storage (for single-server deployments)
// NOTE: This won't work across multiple serverless instances on Vercel
// For production, consider using Redis, Supabase, or another shared state solution
export const rooms = new Map<string, Room>();

// Room cleanup timeout (15 minutes)
const ROOM_TTL_MS = 15 * 60 * 1000;

/**
 * Create a new room
 */
export function createRoom(): string {
  const roomId = nanoid(10);
  rooms.set(roomId, {
    roomId,
    createdAt: Date.now(),
    peers: new Map(),
  });
  return roomId;
}

/**
 * Get room info
 */
export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

/**
 * Join a room with a peer
 * Returns the other peer in the room (if exists)
 */
export function joinRoom(
  roomId: string,
  peerId: string,
  name: string
): RoomPeer | null {
  let room = rooms.get(roomId);

  if (!room) {
    // Create room if it doesn't exist
    room = {
      roomId,
      createdAt: Date.now(),
      peers: new Map(),
    };
    rooms.set(roomId, room);
  }

  // Check if room is full (max 2 peers)
  if (room.peers.size >= 2) {
    return null; // Room is full
  }

  // Get the other peer if exists
  let otherPeer: RoomPeer | null = null;
  if (room.peers.size === 1) {
    otherPeer = Array.from(room.peers.values())[0];
  }

  // Add this peer
  room.peers.set(peerId, {
    peerId,
    name,
    joinedAt: Date.now(),
  });

  return otherPeer;
}

/**
 * Leave a room
 */
export function leaveRoom(roomId: string, peerId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.peers.delete(peerId);

    // Delete room if empty
    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  }
}

/**
 * Get all peers in a room
 */
export function getRoomPeers(roomId: string): RoomPeer[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.peers.values());
}

/**
 * Check if room is full
 */
export function isRoomFull(roomId: string): boolean {
  const room = rooms.get(roomId);
  return room ? room.peers.size >= 2 : false;
}

/**
 * Clean up expired rooms (rooms older than TTL)
 * Call this periodically to prevent memory leaks
 */
export function cleanupExpiredRooms(): void {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(roomId);
    }
  }
}

// Cleanup expired rooms every 5 minutes
if (typeof global !== 'undefined') {
  setInterval(cleanupExpiredRooms, 5 * 60 * 1000);
}
