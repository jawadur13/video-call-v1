# Kolin — Private Peer-to-Peer Video Calls

A real-time peer-to-peer video calling application built with **Next.js** and **PeerJS**, featuring direct WebRTC connections for private, end-to-end communication.

**Live at: [kolin.pro.bd](https://kolin.pro.bd)**

## Features

- **Peer-to-Peer Video Calls** — Direct WebRTC connections with no central media server
- **Screen Sharing** — Share your screen during an active call
- **Audio & Video Controls** — Mute microphone, toggle camera on/off
- **TURN/STUN Support** — Cloudflare TURN servers for reliable NAT traversal
- **Private Rooms** — Each user gets a unique PeerJS ID to share with a friend
- **Connection Status** — Real-time ICE connection state indicator
- **Responsive Design** — Works on desktop and mobile

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **WebRTC Library:** PeerJS
- **Styling:** Tailwind CSS v4
- **TURN/STUN:** Cloudflare Calls TURN API
- **Language:** TypeScript
- **Runtime:** React 19

## Environment Variables

Create a `.env.local` file with your Cloudflare Calls TURN credentials:

```
TURN_KEY_ID=your_turn_key_id
TURN_KEY_API_TOKEN=your_api_token
```

These can be obtained from your [Cloudflare Calls dashboard](https://developers.cloudflare.com/calls/).

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

## How It Works

1. Enter your name and click **Enter Room** to generate a unique PeerJS ID
2. Share your ID with a friend
3. Paste their ID and click **Call** to start the connection
4. Use the in-call controls to mute, toggle video, share screen, or end the call

All media streams flow directly between peers — no server relays video or audio (unless a TURN server is required for NAT traversal).
