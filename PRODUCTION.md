# Production Deployment Guide

## ⚠️ CRITICAL: PeerJS Signaling Server Required

**The app will NOT work in production without a PeerJS signaling server.**

### Current Issue
You're seeing "Cannot connect to new Peer after disconnecting from server" because no PeerJS server is configured for production.

### Quick Fix (5 minutes)

**Deploy a free PeerJS server on Render.com:**

1. See **PEERJS_DEPLOY.md** for step-by-step instructions
2. Or follow this summary:
   - Create GitHub repo with PeerJS server code
   - Deploy to Render.com (free tier)
   - Add environment variables to Vercel
   - Redeploy

**Environment variables to add in Vercel:**
```
NEXT_PUBLIC_PEERJS_HOST=your-peerjs-server.onrender.com
NEXT_PUBLIC_PEERJS_PORT=443
NEXT_PUBLIC_PEERJS_PATH=/peerjs
NEXT_PUBLIC_PEERJS_SECURE=true
```

---

## Vercel Configuration

The `vercel.json` is configured for Next.js 16:
- Uses Vercel's default runtime for Next.js (no custom runtime needed)
- Single region deployment (`fra1`) for consistent state
- Optimized for serverless function execution

**Important**: Do NOT add custom `functions.runtime` configuration. Next.js 16 on Vercel uses the framework's built-in runtime automatically.

## Critical: In-Memory Storage Limitation

This app currently uses **in-memory storage** for room management, which means:

### The Problem
- Vercel serverless functions are **stateless** - each request can hit a different server instance
- Room data stored in memory on one instance won't be available on another
- This causes issues where User A creates a room on Server 1, but User B tries to join on Server 2 and the room doesn't exist

### Solutions (Choose One)

#### Option 1: Use Vercel with Single Region (Quick Fix)
The `vercel.json` already specifies `"regions": ["fra1"]` which helps, but doesn't guarantee single-instance deployment.

**Works for**: Low traffic, small deployments

#### Option 2: Add Redis/Supabase (Recommended for Production)

**Using Upstash Redis (Free tier available):**

1. Create account at https://upstash.com
2. Create a Redis database
3. Add environment variables to Vercel:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

4. Install dependencies:
   ```bash
   npm install @upstash/redis
   ```

5. Replace `app/lib/rooms.ts` with Redis-based implementation

#### Option 3: Use PeerJS Only (Simplest)
Since PeerJS handles peer discovery, you can bypass the room API entirely:

1. Generate room IDs client-side
2. Use PeerJS signaling server only
3. Remove all `/api/rooms` endpoints

**Trade-off**: No server-side room validation or "room full" checks

## Environment Variables Required

Set these in Vercel (Settings → Environment Variables):

### Required for Production:
```
NEXT_PUBLIC_PEERJS_KEY=your-peerjs-api-key
```

### Optional:
```
NEXT_PUBLIC_PEERJS_HOST=your-peerjs-server.com
NEXT_PUBLIC_PEERJS_PORT=443
NEXT_PUBLIC_PEERJS_PATH=/peerjs
NEXT_PUBLIC_PEERJS_SECURE=true
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_SERVER_USERNAME=your-username
TURN_SERVER_CREDENTIAL=your-credential
```

## WebRTC Requirements

- **HTTPS required** (except localhost)
- Users must grant camera/microphone permissions
- Some browsers block WebRTC in private/incognito mode

## Testing Production Locally

```bash
npm run build
npm start
```

This runs the production build on `localhost:3000`.

## Common Errors & Solutions

### "Failed to join room"
- Check PeerJS configuration
- Verify signaling server is accessible
- Check browser console for WebRTC errors

### "Room is full" (false positive)
- Caused by in-memory storage across multiple server instances
- See solutions above

### Connection timeout
- Add TURN servers for users behind strict NAT/firewalls
- Check ICE servers configuration
