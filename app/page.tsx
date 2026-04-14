"use client";
import { useEffect, useRef, useState } from "react";
import Peer, { DataConnection } from "peerjs";

export default function RoomPage() {
  const [myId, setMyId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [name, setName] = useState("");
  const [remoteName, setRemoteName] = useState("Friend");
  const [joined, setJoined] = useState(false);
  const [iceStatus, setIceStatus] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  const nameRef = useRef(name);
  useEffect(() => { nameRef.current = name; }, [name]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentUserStream = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<ReturnType<Peer["call"]> | null>(null);

  useEffect(() => {
    return () => {
      peerRef.current?.destroy();
      currentUserStream.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Set local video srcObject once on join — never unmount the video element
  useEffect(() => {
    if (joined && localVideoRef.current && currentUserStream.current) {
      localVideoRef.current.srcObject = currentUserStream.current;
    }
  }, [joined]);

  const attachCallListeners = (call: ReturnType<Peer["call"]>) => {
    activeCallRef.current = call;
    setCallActive(true);

    call.peerConnection.oniceconnectionstatechange = () => {
      const state = call.peerConnection.iceConnectionState;
      setIceStatus(state);
      console.log("ICE state:", state);
    };
    call.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", call.peerConnection.connectionState);
    };
    call.on("stream", (remoteStream) => {
      // Directly set on the ref — the <video> element is always mounted
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });
    call.on("error", (err) => console.error("Call error:", err));
    call.on("close", () => {
      if (screenSharing) stopScreenShare();
      setIceStatus("closed");
      setCallActive(false);
      setRemoteName("Friend");
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });
  };

  const handleDataConnection = (conn: DataConnection) => {
    conn.on("open", () => { conn.send({ callerName: nameRef.current }); });
    conn.on("data", (data: unknown) => {
      if (data && typeof data === "object" && "callerName" in data) {
        setRemoteName((data as { callerName: string }).callerName || "Friend");
      }
    });
    conn.on("error", (err) => console.error("DataConnection error:", err));
  };

  const startCall = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const credRes = await fetch("/api/turn-credentials");
      if (!credRes.ok) throw new Error("Could not fetch TURN credentials");
      const { iceServers } = await credRes.json();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      currentUserStream.current = stream;

      const peer = new Peer({
        config: { iceServers, sdpSemantics: "unified-plan" },
      });

      peer.on("open", (id) => { setMyId(id); setJoined(true); setLoading(false); });
      peer.on("connection", (conn) => { handleDataConnection(conn); });
      peer.on("call", (call) => { call.answer(stream); attachCallListeners(call); });
      peer.on("error", (err) => {
        console.error("Peer error:", err);
        alert(`Connection error: ${err.message}`);
        setLoading(false);
      });

      peerRef.current = peer;
    } catch (err) {
      console.error("Setup error:", err);
      alert("Setup failed. Check permissions and ensure you are on HTTPS.");
      setLoading(false);
    }
  };

  const callUser = (id: string) => {
    if (!peerRef.current || !currentUserStream.current || !id.trim()) return;
    const dataConn = peerRef.current.connect(id, { reliable: true });
    handleDataConnection(dataConn);
    const call = peerRef.current.call(id, currentUserStream.current);
    attachCallListeners(call);
  };

  const endCall = () => {
    if (screenSharing) stopScreenShare();
    activeCallRef.current?.close();
    activeCallRef.current = null;
    setCallActive(false);
    setIceStatus("");
    setRemoteName("Friend");
    setRemotePeerId("");
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const toggleMic = () => {
    const audioTrack = currentUserStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicMuted(!audioTrack.enabled);
    }
  };

  // FIX: Only toggle the track — never unmount the <video> element
  const toggleCam = () => {
    const videoTrack = currentUserStream.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamOff(!videoTrack.enabled);
    }
  };

  const replaceVideoTrack = (newTrack: MediaStreamTrack | null) => {
    const call = activeCallRef.current;
    if (!call) return;

    const sender = call.peerConnection
      .getSenders()
      .find((peerSender) => peerSender.track?.kind === "video");

    if (sender) {
      sender.replaceTrack(newTrack).catch((err) => {
        console.error("Replace video track failed:", err);
      });
    }
  };

  const startScreenShare = async () => {
    if (!activeCallRef.current || screenSharing) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) throw new Error("Screen sharing media missing");

      screenStreamRef.current = screenStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      replaceVideoTrack(screenTrack);
      setScreenSharing(true);

      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  };

  const stopScreenShare = () => {
    if (!screenSharing && !screenStreamRef.current) return;

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;

    const cameraTrack = currentUserStream.current?.getVideoTracks()[0] ?? null;
    if (localVideoRef.current) localVideoRef.current.srcObject = currentUserStream.current;
    replaceVideoTrack(cameraTrack);
    setScreenSharing(false);
  };

  const copyId = () => {
    navigator.clipboard.writeText(myId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isConnected = iceStatus === "connected" || iceStatus === "completed";

  const iceIndicatorColor =
    isConnected ? "#22c55e"
    : iceStatus === "failed" || iceStatus === "closed" ? "#ef4444"
    : iceStatus === "checking" ? "#f59e0b"
    : "#6b7280";

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

        .room-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 20px 48px;
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
          margin-bottom: 40px;
        }
        .header-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(26px, 5vw, 38px);
          font-weight: 800;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 50%, #818cf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .header-sub {
          font-size: 13px;
          color: #64748b;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 500;
        }

        .ice-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 24px;
        }
        .ice-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          transition: background 0.4s;
        }

        .join-card {
          width: 100%;
          max-width: 420px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 40px 36px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.4);
          backdrop-filter: blur(12px);
        }
        .join-label {
          font-size: 13px;
          color: #64748b;
          text-align: center;
          margin-bottom: 4px;
        }
        .join-input {
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
        .join-input:focus {
          border-color: rgba(125,211,252,0.4);
          box-shadow: 0 0 0 3px rgba(125,211,252,0.08);
        }
        .join-input::placeholder { color: #475569; }

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

        .video-container {
          position: relative;
          width: 100%;
          max-width: 1100px;
          aspect-ratio: 16/9;
          border-radius: 20px;
          overflow: hidden;
          background: #0f1419;
          box-shadow: 0 16px 48px rgba(0,0,0,0.5);
          border: 1.5px solid rgba(255,255,255,0.07);
        }

        .video-container video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .local-pip {
          position: absolute;
          bottom: 16px;
          right: 16px;
          width: clamp(140px, 22vw, 240px);
          aspect-ratio: 16/9;
          border-radius: 14px;
          overflow: hidden;
          border: 2px solid rgba(56,189,248,0.4);
          box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.15);
          background: #0f1419;
          z-index: 20;
          transition: transform 0.2s;
          cursor: grab;
        }
        .local-pip:active { cursor: grabbing; }
        .local-pip:hover { transform: scale(1.03); }

        .local-pip video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform: scaleX(-1);
        }

        .local-pip .cam-off-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f1419;
        }
        .local-pip .cam-off-avatar {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e3a5f, #312e81);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #7dd3fc;
          border: 2px solid rgba(125,211,252,0.2);
        }

        .local-pip .name-tag {
          bottom: 6px;
          left: 6px;
          font-size: 10px;
          padding: 3px 8px;
        }

        .remote-name-tag {
          position: absolute;
          bottom: 14px; left: 14px;
          background: rgba(9,12,16,0.75);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(8px);
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
          color: #cbd5e1;
          display: flex; align-items: center; gap: 6px;
          z-index: 10;
        }
        .remote-name-tag .name-tag-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .waiting-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #334155;
          font-size: 14px;
          z-index: 2;
          background: #0f1419;
        }
        .waiting-icon {
          width: 48px; height: 48px;
          border-radius: 50%;
          border: 2px solid #1e293b;
          display: flex; align-items: center; justify-content: center;
        }

        .controls-bar {
          width: 100%;
          max-width: 1100px;
          margin-top: 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 20px 28px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          backdrop-filter: blur(12px);
        }

        .id-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 200px;
        }
        .id-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #475569;
          font-weight: 500;
        }
        .id-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .id-value {
          font-family: 'DM Mono', 'Fira Code', monospace;
          font-size: 13px;
          color: #7dd3fc;
          background: rgba(125,211,252,0.06);
          border: 1px solid rgba(125,211,252,0.15);
          padding: 6px 12px;
          border-radius: 8px;
          user-select: all;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
        }
        .btn-copy {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 6px 12px;
          color: #94a3b8;
          font-size: 12px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-copy:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
        .btn-copy.copied { color: #22c55e; border-color: rgba(34,197,94,0.3); }

        .call-row {
          display: flex;
          gap: 8px;
          flex: 2;
          min-width: 280px;
        }
        .call-input {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 10px 14px;
          color: #e2e8f0;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s;
          min-width: 0;
        }
        .call-input:focus { border-color: rgba(34,197,94,0.4); }
        .call-input::placeholder { color: #334155; }
        .call-input:disabled { opacity: 0.4; cursor: not-allowed; }

        .btn-call {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #fff;
          transition: opacity 0.2s, transform 0.15s;
          white-space: nowrap;
        }
        .btn-call:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .btn-call:disabled { opacity: 0.35; cursor: not-allowed; }

        .action-buttons {
          width: 100%;
          max-width: 1100px;
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .btn-action {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 22px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: #cbd5e1;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-action:hover { background: rgba(255,255,255,0.09); color: #fff; }
        .btn-action.muted {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.3);
          color: #f87171;
        }
        .btn-end {
          background: rgba(239,68,68,0.15);
          border-color: rgba(239,68,68,0.35);
          color: #f87171;
          font-weight: 600;
        }
        .btn-end:hover { background: rgba(239,68,68,0.28) !important; color: #fca5a5 !important; }
        .btn-icon { font-size: 16px; line-height: 1; }

        /* ── Mobile portrait layout ── */
        @media (max-width: 640px) {
          .room-wrapper {
            padding: 16px 12px 32px;
          }
          .header {
            margin-bottom: 16px;
          }
          .header-title {
            font-size: 22px;
          }
          .header-sub {
            font-size: 11px;
          }
          .ice-badge {
            margin-bottom: 12px;
            font-size: 10px;
            padding: 3px 10px;
          }

          .video-container {
            aspect-ratio: 9/16;
            max-height: 72vh;
            border-radius: 16px;
          }

          .local-pip {
            width: clamp(90px, 26vw, 130px);
            bottom: 10px;
            right: 10px;
            border-radius: 10px;
            border-width: 1.5px;
          }
          .local-pip .cam-off-avatar {
            width: 28px; height: 28px;
            font-size: 12px;
          }
          .local-pip .name-tag {
            font-size: 8px;
            padding: 2px 5px;
            bottom: 4px;
            left: 4px;
          }

          .remote-name-tag {
            bottom: 10px;
            left: 10px;
            font-size: 11px;
            padding: 4px 10px;
          }

          .controls-bar {
            border-radius: 16px;
            padding: 14px 16px;
            gap: 10px;
          }
          .action-buttons {
            gap: 8px;
          }
          .btn-action {
            padding: 9px 14px;
            font-size: 12px;
            border-radius: 10px;
          }
          .btn-icon {
            font-size: 14px;
          }
        }
      `}</style>

      <div className="room-wrapper">
        <div className="header">
          <h1 className="header-title">KOLIN 📞</h1>
          <p className="header-sub">Private peer-to-peer calls</p>
        </div>

        {iceStatus && (
          <div className="ice-badge">
            <span className="ice-dot" style={{ background: iceIndicatorColor }} />
            {iceStatus}
          </div>
        )}
        
        {!joined ? (
          <div className="join-card">
            <p className="join-label">Enter your name to get started</p>
            <input
              className="join-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && startCall()}
              disabled={loading}
              autoFocus
            />
            <button
              className="btn-primary"
              onClick={startCall}
              disabled={!name.trim() || loading}
            >
              {loading ? "Connecting…" : "Enter Room →"}
            </button>
          </div>
        ) : (
          <>
            <div className="video-container">
              {/* ── Remote (friend) — full-size background video ── */}
              <video ref={remoteVideoRef} autoPlay playsInline />

              {/* Waiting overlay when not connected */}
              {!isConnected && (
                <div className="waiting-overlay">
                  <div className="waiting-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <span>Waiting for friend…</span>
                </div>
              )}

              {/* Remote name tag */}
              <div className="remote-name-tag" style={{ opacity: isConnected ? 1 : 0 }}>
                <span className="name-tag-dot" />
                {remoteName}
              </div>

              {/* ── Local (self) — picture-in-picture overlay ── */}
              <div className="local-pip">
                <video ref={localVideoRef} autoPlay muted playsInline />
                {camOff && (
                  <div className="cam-off-overlay">
                    <div className="cam-off-avatar">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="name-tag">
                  <span className="name-tag-dot" />
                  {name || "You"}
                </div>
              </div>
            </div>

            {/* ── In-call action buttons ── */}
            {callActive && (
              <div className="action-buttons">
                <button
                  className={`btn-action${micMuted ? " muted" : ""}`}
                  onClick={toggleMic}
                >
                  <span className="btn-icon">{micMuted ? "🔇" : "🎙️"}</span>
                  {micMuted ? "Unmute" : "Mute"}
                </button>
                <button
                  className={`btn-action${camOff ? " muted" : ""}`}
                  onClick={toggleCam}
                >
                  <span className="btn-icon">{camOff ? "📷" : "📹"}</span>
                  {camOff ? "Start Video" : "Stop Video"}
                </button>
                <button
                  className={`btn-action${screenSharing ? " muted" : ""}`}
                  onClick={screenSharing ? stopScreenShare : startScreenShare}
                >
                  <span className="btn-icon">{screenSharing ? "🛑" : "📺"}</span>
                  {screenSharing ? "Stop Sharing" : "Share Screen"}
                </button>
                <button className="btn-action btn-end" onClick={endCall}>
                  <span className="btn-icon">📵</span>
                  End Call
                </button>
              </div>
            )}

            {/* ── Controls bar ── */}
            <div className="controls-bar">
              <div className="id-section">
                <span className="id-label">Your ID — share with friend</span>
                <div className="id-row">
                  <span className="id-value">{myId || "Generating…"}</span>
                  <button
                    className={`btn-copy${copied ? " copied" : ""}`}
                    onClick={copyId}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="call-row">
                <input
                  type="text"
                  className="call-input"
                  placeholder="Paste friend's ID to call…"
                  value={remotePeerId}
                  onChange={(e) => setRemotePeerId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && callUser(remotePeerId)}
                  disabled={callActive}
                />
                <button
                  className="btn-call"
                  onClick={() => callUser(remotePeerId)}
                  disabled={!remotePeerId.trim() || callActive}
                >
                  {callActive ? "In Call" : "📞 Call"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}