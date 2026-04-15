import { NextApiRequest, NextApiResponse } from 'next';
import { joinRoom, leaveRoom, getRoomPeers, isRoomFull } from '../../../../app/lib/rooms';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { roomId } = req.query;

  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({ error: 'Missing roomId' });
  }

  try {
    if (req.method === 'POST') {
      // Join room
      const { peerId, name } = req.body;

      if (!peerId || !name) {
        return res.status(400).json({ error: 'Missing peerId or name' });
      }

      // Check if room is full
      if (isRoomFull(roomId)) {
        return res.status(409).json({ error: 'Room is full', isFull: true });
      }

      // Join room and get other peer info
      const otherPeer = joinRoom(roomId, peerId, name);

      return res.status(200).json({
        success: true,
        roomId,
        peerId,
        otherPeer: otherPeer ? { peerId: otherPeer.peerId, name: otherPeer.name } : null,
        allPeers: getRoomPeers(roomId),
      });

    } else if (req.method === 'DELETE') {
      // Leave room
      const { peerId } = req.body;

      if (!peerId) {
        return res.status(400).json({ error: 'Missing peerId' });
      }

      leaveRoom(roomId, peerId);

      return res.status(200).json({
        success: true,
        roomId,
        peerId,
      });

    } else if (req.method === 'GET') {
      // Get room info
      const peers = getRoomPeers(roomId);
      const isFull = isRoomFull(roomId);

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