# PeerJS Server Deployment Guide

## Quick Fix: Deploy Free PeerJS Server on Render.com (5 minutes)

### Step 1: Create PeerJS Server Repository

1. Create a new GitHub repository (e.g., `peerjs-server`)
2. Add these files:

**package.json:**
```json
{
  "name": "peerjs-server",
  "version": "1.0.0",
  "scripts": {
    "start": "peerjs --port $PORT --path /peerjs"
  },
  "dependencies": {
    "peer": "^1.0.0"
  }
}
```

### Step 2: Deploy to Render.com

1. Go to https://render.com and sign up (free tier available)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** `kolin-peerjs`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Click "Create Web Service"
6. Note your service URL (e.g., `https://kolin-peerjs.onrender.com`)

### Step 3: Configure Vercel Environment Variables

Go to Vercel → Your Project → Settings → Environment Variables → Add:

```
NEXT_PUBLIC_PEERJS_HOST=kolin-peerjs.onrender.com
NEXT_PUBLIC_PEERJS_PORT=443
NEXT_PUBLIC_PEERJS_PATH=/peerjs
NEXT_PUBLIC_PEERJS_SECURE=true
```

### Step 4: Redeploy

1. Go to Vercel → Your Project → Deployments
2. Click "Redeploy" on the latest deployment
3. Wait for build to complete

---

## Alternative: Use Railway.app (Also Free)

Same process, but deploy on https://railway.app instead of Render.com.

---

## Alternative: Docker Deployment

```bash
docker run -p 9000:9000 -p 6881-6900:6881-6900/udp peers/peerjs-server
```

Then configure:
```
NEXT_PUBLIC_PEERJS_HOST=your-server-ip
NEXT_PUBLIC_PEERJS_PORT=9000
NEXT_PUBLIC_PEERJS_PATH=/peerjs
NEXT_PUBLIC_PEERJS_SECURE=false
```

---

## Verify It Works

1. Open browser DevTools (F12) → Console
2. Join a room
3. Look for: `"Using custom PeerJS server: kolin-peerjs.onrender.com"`
4. If you see this, the server is configured correctly!

---

## Troubleshooting

### "Cannot connect to new Peer"
- Check that your PeerJS server is running
- Verify environment variables are set correctly in Vercel
- Check browser console for connection errors

### "Connection timeout"
- Free tiers on Render/Railway may sleep after inactivity
- First connection may take 30-60 seconds to wake up the server
- Consider upgrading to paid tier for always-on service

### Still not working?
1. Check Vercel environment variables are set (not local .env)
2. Verify PeerJS server URL is accessible in browser
3. Check for CORS errors in browser console
4. Ensure NEXT_PUBLIC_PEERJS_SECURE matches your server (true for HTTPS, false for HTTP)
