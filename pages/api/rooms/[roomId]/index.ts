import { NextApiRequest, NextApiResponse } from 'next';
import { getRoomPeersAsync, isRoomFullAsync, leaveRoomAsync } from '../../../../app/lib/rooms';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { roomId } = req.query;

  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({ error: 'Missing roomId' });
  }

  try {
    if (req.method === 'DELETE') {
      const { peerId } = req.body;

      if (!peerId) {
        return res.status(400).json({ error: 'Missing peerId' });
      }

      await leaveRoomAsync(roomId, peerId);

      return res.status(200).json({
        success: true,
        roomId,
        peerId,
      });
    } else if (req.method === 'GET') {
      const peers = await getRoomPeersAsync(roomId);
      const isFull = await isRoomFullAsync(roomId);

      return res.status(200).json({
        roomId,
        peerCount: peers.length,
        isFull,
        peers,
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error(`${req.method} /api/rooms/${roomId} error:`, error);
    return res.status(500).json({
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown')
    });
  }
}