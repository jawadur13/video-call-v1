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

    const allPeers = await getRoomPeersAsync(roomId);
    
    const usingRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    console.log(`[join] room=${roomId} peerId=${peerId} allPeers=${allPeers.length} redis=${usingRedis}`);
    if (!usingRedis && process.env.NODE_ENV === 'production') {
      console.warn('[join] WARNING: No Redis configured! Room state is in-memory per-instance. This WILL break multi-user on Vercel. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.');
    }

    return res.status(200).json({
      success: true,
      roomId,
      peerId,
      allPeers,
    });
  } catch (error) {
    console.error(`POST /api/rooms/${roomId}/join error:`, error);
    return res.status(500).json({
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown')
    });
  }
}
