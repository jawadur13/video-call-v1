import { NextApiRequest, NextApiResponse } from 'next';

interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

/**
 * Returns TURN/STUN server credentials for WebRTC connections.
 * Uses Google's public STUN server by default.
 * For production, consider paid TURN services (Twilio, Xirsys, etc.)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Default STUN servers (free, no authentication required)
    const iceServers: IceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Public free TURN server fallback for NAT traversal if STUN fails
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      }
    ];

    // Optional: Add TURN servers if configured
    const turnUrl = process.env.TURN_SERVER_URL;
    const turnUsername = process.env.TURN_SERVER_USERNAME;
    const turnCredential = process.env.TURN_SERVER_CREDENTIAL;

    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    return res.status(200).json({ iceServers });
  } catch (error) {
    console.error('TURN credentials error:', error);
    // Return fallback servers even if there's an error
    return res.status(200).json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        }
      ],
    });
  }
}
