import { NextRequest, NextResponse } from "next/server";
import { joinRoom, leaveRoom, getRoomPeers, isRoomFull } from "@/app/lib/rooms";

// POST /api/rooms/[roomId]/join - Join a room
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const { peerId, name } = await req.json();

  if (!roomId || !peerId || !name) {
    return NextResponse.json(
      { error: "Missing roomId, peerId, or name" },
      { status: 400 }
    );
  }

  // Check if room is full
  if (isRoomFull(roomId)) {
    return NextResponse.json(
      { error: "Room is full", isFull: true },
      { status: 409 }
    );
  }

  // Join room and get other peer info
  const otherPeer = joinRoom(roomId, peerId, name);

  return NextResponse.json({
    success: true,
    roomId,
    peerId,
    otherPeer: otherPeer ? { peerId: otherPeer.peerId, name: otherPeer.name } : null,
    allPeers: getRoomPeers(roomId),
  });
}

// DELETE /api/rooms/[roomId]/leave - Leave a room
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const { peerId } = await req.json();

  if (!roomId || !peerId) {
    return NextResponse.json(
      { error: "Missing roomId or peerId" },
      { status: 400 }
    );
  }

  leaveRoom(roomId, peerId);

  return NextResponse.json({
    success: true,
    roomId,
    peerId,
  });
}

// GET /api/rooms/[roomId] - Get room info
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  if (!roomId) {
    return NextResponse.json({ error: "Room ID required" }, { status: 400 });
  }

  const peers = getRoomPeers(roomId);
  const isFull = isRoomFull(roomId);

  return NextResponse.json({
    roomId,
    peerCount: peers.length,
    isFull,
    peers,
  });
}
