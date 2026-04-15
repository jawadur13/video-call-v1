# PeerJS Production Setup Guide

The "failed to join room" error happens because **PeerJS requires a signaling server** to coordinate peer connections.

## Options to Fix This

### Option 1: Use PeerJS Cloud (Easiest but Paid)
1. Go to https://peerjs.com/
2. Sign up for an account and get an API key
3. Set environment variable on Vercel:
   - Go to Project Settings → Environment Variables
   - Add `NEXT_PUBLIC_PEERJS_KEY=your_api_key`
4. Redeploy

### Option 2: Self-Hosted PeerJS Server (Recommended & Free)

**Using Docker:**
```bash
docker run -p 9000:9000 -p 6881-6900:6881-6900/udp peers/peerjs-server
```

**Using Node.js:**
```bash
npm install -g peerjs-server
peerjs --port 9000
```

Then set on Vercel:
- `NEXT_PUBLIC_PEERJS_HOST=your-server-domain.com`
- `NEXT_PUBLIC_PEERJS_PORT=443`
- `NEXT_PUBLIC_PEERJS_PATH=/peerjs`
- `NEXT_PUBLIC_PEERJS_SECURE=true`

**Deploy PeerJS Server** (free options):
- Railway.app
- Render.com  
- AWS EC2 free tier
- Heroku (paid now)

### Option 3: For Local Development
```bash
npm install -g peerjs-server
peerjs --port 9000
```
Then run your Next.js app on `localhost:3000` and it will automatically connect to the local server.

## How the Fix Works

The updated code now:
1. **Checks for environment variables** for custom PeerJS server
2. **Detects localhost** and uses local dev server automatically
3. **Falls back to PeerJS Cloud** if API key is provided
4. **Logs detailed errors** in console to debug issues

## Verify It Works

After setting up:
1. Open browser DevTools (F12) → Console
2. Create a room and enter name
3. Look for: `"Using PeerJS Cloud..."` or `"Using custom PeerJS server..."`
4. This confirms the server is configured correctly

## Troubleshooting

If still getting "failed to join room":
1. Check browser console for peer errors
2. Verify network request to `/api/rooms/{roomId}/join` succeeds
3. Make sure PeerJS server is running (for self-hosted option)
4. Check WebRTC is available (not in private/incognito on some browsers)
