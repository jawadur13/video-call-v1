// File location: app/api/turn-credentials/route.ts
// This runs on the SERVER — your secret API token never reaches the browser

import { NextResponse } from "next/server";

const TURN_KEY_ID = process.env.TURN_KEY_ID!;
const TURN_KEY_API_TOKEN = process.env.TURN_KEY_API_TOKEN!;

export async function GET() {
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TURN_KEY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 86400 }), // 24 hours
      }
    );

    if (!res.ok) {
      const error = await res.text();
      console.error("Cloudflare TURN error:", error);
      return NextResponse.json({ error: "Failed to get TURN credentials" }, { status: 500 });
    }

    const data = await res.json();

    // Filter out port 53 URLs — browsers time out on them
    const filtered = data.iceServers.map((server: { urls: string | string[]; username?: string; credential?: string }) => ({
      ...server,
      urls: Array.isArray(server.urls)
        ? server.urls.filter((url: string) => !url.includes(":53"))
        : server.urls,
    }));

    return NextResponse.json({ iceServers: filtered });
  } catch (err) {
    console.error("TURN credentials fetch failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}