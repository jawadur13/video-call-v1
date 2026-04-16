import { NextApiRequest, NextApiResponse } from 'next';

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Returns TURN/STUN server credentials for WebRTC connections.
 * This version supports Metered.ca dynamic credentials if configured.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Default STUN servers
  let iceServers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  try {
    const meteredApiKey = process.env.TURN_KEY_API_TOKEN;
    const meteredAppId = process.env.TURN_KEY_ID;

    // 1. Check for Metered.ca credentials (preferred for production)
    if (meteredApiKey) {
      // If we have an App ID, we use the metered.live endpoint, otherwise the generic one
      const endpoint = meteredAppId 
        ? `https://${meteredAppId}.metered.live/api/v1/turn/credentials`
        : `https://metered.ca/api/v1/turn/credentials`;

      try {
        const response = await fetch(`${endpoint}?apiKey=${meteredApiKey}`);
        if (response.ok) {
          const meteredServers = await response.json();
          if (Array.isArray(meteredServers)) {
            // Found Metered servers! We use these alongside our STUN servers.
            iceServers = [...iceServers, ...meteredServers];
            return res.status(200).json({ iceServers });
          }
        }
      } catch (err) {
        console.warn("Metered TURN fetch failed, falling back to static/STUN:", err);
      }
    }

    // 2. Fallback to static TURN servers if configured manually
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
    // Absolute fallback: Google STUN + Public OpenRelay for emergency NAT traversal
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
