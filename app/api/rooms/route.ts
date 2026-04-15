import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/app/lib/rooms";

// POST /api/rooms - Create a new room
export async function POST(req: NextRequest) {
  const roomId = createRoom();

  return NextResponse.json({
    roomId,
    link: `/room/${roomId}`,
  });
}
