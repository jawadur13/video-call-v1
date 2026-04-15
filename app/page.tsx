"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const createRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = await res.json();
      router.push(`/room/${data.roomId}`);
    } catch (err) {
      console.error("Error creating room:", err);
      alert("Failed to create room");
      setLoading(false);
    }
  };

  const joinRoom = () => {
    if (!roomId.trim()) return;
    router.push(`/room/${roomId.trim()}`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #090c10;
          font-family: 'DM Sans', sans-serif;
          color: #e2e8f0;
          min-height: 100vh;
        }

        .home-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99,102,241,0.06) 0%, transparent 60%),
            #090c10;
        }

        .header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 60px;
          text-align: center;
        }
        .header-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(32px, 8vw, 56px);
          font-weight: 800;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 50%, #818cf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 12px;
        }
        .header-sub {
          font-size: 16px;
          color: #94a3b8;
          font-weight: 400;
          letter-spacing: 0.02em;
        }

        .content {
          width: 100%;
          max-width: 500px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 40px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.4);
          backdrop-filter: blur(12px);
        }

        .card-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-desc {
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #475569;
          font-weight: 500;
        }

        .room-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 18px;
          color: #e2e8f0;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .room-input:focus {
          border-color: rgba(125,211,252,0.4);
          box-shadow: 0 0 0 3px rgba(125,211,252,0.08);
        }
        .room-input::placeholder { color: #475569; }

        .btn-primary {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          color: #fff;
          letter-spacing: 0.02em;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 24px rgba(56,189,248,0.2);
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

        .divider {
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 8px 0;
        }

        @media (max-width: 640px) {
          .home-wrapper {
            padding: 32px 20px;
          }
          .header {
            margin-bottom: 40px;
          }
          .header-title {
            font-size: 32px;
          }
          .header-sub {
            font-size: 14px;
          }
          .card {
            padding: 28px;
          }
        }
      `}</style>

      <div className="home-wrapper">
        <div className="header">
          <h1 className="header-title">KOLIN 📞</h1>
          <p className="header-sub">Simple, fast, peer-to-peer video calls</p>
        </div>

        <div className="content">
          {/* Create Room Card */}
          <div className="card">
            <div className="card-title">✨ Start New Call</div>
            <p className="card-desc">
              Create a new room and share the link with a friend. They&apos;ll join instantly.
            </p>
            <button className="btn-primary" onClick={createRoom} disabled={loading}>
              {loading ? "Creating…" : "Create Room →"}
            </button>
          </div>

          <div className="divider" />

          {/* Join Room Card */}
          <div className="card">
            <div className="card-title">🔗 Join by Link or ID</div>
            <p className="card-desc">
              Paste a room ID or join via a shared link.
            </p>
            <div className="input-group">
              <label className="input-label">Room ID</label>
              <input
                type="text"
                className="room-input"
                placeholder="Enter room ID (e.g., abc123def456)"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && roomId.trim() && joinRoom()}
              />
            </div>
            <button className="btn-primary" onClick={joinRoom} disabled={!roomId.trim()}>
              Join Room →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}