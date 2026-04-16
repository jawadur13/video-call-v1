import { NextApiRequest, NextApiResponse } from 'next';
import { joinRoomAsync, isRoomFullAsync, getRoomPeersAsync } from '../../../../app/lib/rooms';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { roomId } = req.query;

  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({ error: 'Missing roomId' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { peerId, name } = req.body;

    if (!peerId || !name) {
      return res.status(400).json({ error: 'Missing peerId or name' });
    }

    // Check if room is full
    if (await isRoomFullAsync(roomId)) {
      return res.status(409).json({ error: 'Room is full', isFull: true });
    }

    // Join room and get other peer info
    await joinRoomAsync(roomId, peerId, name);

    return res.status(200).json({
      success: true,
      roomId,
      peerId,
      allPeers: await getRoomPeersAsync(roomId),
    });
  } catch (error) {
    console.error(`POST /api/rooms/${roomId}/join error:`, error);
    return res.status(500).json({
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown')
    });
  }
}
