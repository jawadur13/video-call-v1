import { NextRequest, NextResponse } from "next/server";
import { joinRoom, leaveRoom, getRoomPeers, isRoomFull } from "@/app/lib/rooms";

// POST /api/rooms/[roomId]/join - Join a room
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    
    if (!roomId) {
      return NextResponse.json(
        { error: "Missing roomId" },
        { status: 400 }
      );
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return NextResponse.json(
        { error: "Invalid request body - must be valid JSON" },
        { status: 400 }
      );
    }

    const { peerId, name } = requestBody;

    if (!peerId || !name) {
      return NextResponse.json(
        { error: "Missing peerId or name" },
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
  } catch (error) {
    console.error("POST /api/rooms/[roomId] error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error instanceof Error ? error.message : "Unknown") },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[roomId]/leave - Leave a room
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    
    if (!roomId) {
      return NextResponse.json(
        { error: "Missing roomId" },
        { status: 400 }
      );
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return NextResponse.json(
        { error: "Invalid request body - must be valid JSON" },
        { status: 400 }
      );
    }

    const { peerId } = requestBody;

    if (!peerId) {
      return NextResponse.json(
        { error: "Missing peerId" },
        { status: 400 }
      );
    }

    leaveRoom(roomId, peerId);

    return NextResponse.json({
      success: true,
      roomId,
      peerId,
    });
  } catch (error) {
    console.error("DELETE /api/rooms/[roomId] error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error instanceof Error ? error.message : "Unknown") },
      { status: 500 }
    );
  }
}

// GET /api/rooms/[roomId] - Get room info
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
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
  } catch (error) {
    console.error("GET /api/rooms/[roomId] error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error instanceof Error ? error.message : "Unknown") },
      { status: 500 }
    );
  }
}
