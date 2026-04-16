import { NextApiRequest, NextApiResponse } from 'next';
import { leaveRoomAsync } from '../../../../app/lib/rooms';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { roomId } = req.query;

  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({ error: 'Missing roomId' });
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
  } catch (error) {
    console.error(`DELETE /api/rooms/${roomId}/leave error:`, error);
    return res.status(500).json({
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown')
    });
  }
}
