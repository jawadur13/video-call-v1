import { NextApiRequest, NextApiResponse } from 'next';

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Fetches TURN credentials from Cloudflare TURN service.
 * Uses TURN_KEY_ID and TURN_KEY_API_TOKEN env vars (set in Vercel).
 * Falls back to Google STUN only if Cloudflare is unavailable.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always include reliable Google STUN servers
  const defaultStun: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const keyId = process.env.TURN_KEY_ID;
  const apiToken = process.env.TURN_KEY_API_TOKEN;

  if (!keyId || !apiToken) {
    console.warn('[turn] TURN_KEY_ID or TURN_KEY_API_TOKEN not set. Using STUN only.');
    return res.status(200).json({ iceServers: defaultStun });
  }

  try {
    // Cloudflare TURN credentials API — generates a short-lived username/credential
    const cfRes = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }), // credentials valid for 24 hours
      }
    );

    if (!cfRes.ok) {
      const errText = await cfRes.text();
      console.error('[turn] Cloudflare TURN API error:', cfRes.status, errText);
      return res.status(200).json({ iceServers: defaultStun });
    }

    const data = await cfRes.json();

    // Cloudflare returns: { iceServers: { urls: [...], username, credential } }
    // Normalize to always be an array
    const cfServers = data.iceServers
      ? (Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers])
      : [];

    console.log(`[turn] Cloudflare TURN: ${cfServers.length} server(s) fetched.`);

    return res.status(200).json({
      iceServers: [...defaultStun, ...cfServers],
    });
  } catch (error) {
    console.error('[turn] Fetch error:', error);
    // Always return something usable — STUN works for non-symmetric NAT
    return res.status(200).json({ iceServers: defaultStun });
  }
}
