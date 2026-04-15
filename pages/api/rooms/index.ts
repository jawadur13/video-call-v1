import { NextApiRequest, NextApiResponse } from 'next';
import { createRoom } from '../../../app/lib/rooms';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const roomId = createRoom();

    return res.status(200).json({
      roomId,
      link: `/room/${roomId}`,
    });
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}