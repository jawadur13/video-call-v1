import { NextApiRequest, NextApiResponse } from 'next';
import { updatePeerHeartbeatAsync } from '../../../../app/lib/rooms';

/**
 * POST /api/rooms/[roomId]/heartbeat
 * Called by the client every 30 seconds to signal it's still alive.
 * Prevents stale ghost peers from blocking the room after a crash/disconnect.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { roomId } = req.query;
  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({ error: 'Missing roomId' });
  }

  const { peerId } = req.body;
  if (!peerId) {
    return res.status(400).json({ error: 'Missing peerId' });
  }

  try {
    await updatePeerHeartbeatAsync(roomId, peerId);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(`[heartbeat] room=${roomId} peer=${peerId} error:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
