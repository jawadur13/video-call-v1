"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Peer, { DataConnection } from "peerjs";

export default function RoomPage() {
  const params = useParams();
  const roomId = params?.roomId && typeof params.roomId === 'string' ? params.roomId : '';

  const [myId, setMyId] = useState("");
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ from: "me" | "them"; text: string; time: string }[]>([]);
  const [_toast, setToast] = useState<{ text: string; from: string } | null>(null);
  const [roomFull, setRoomFull] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const nameRef = useRef(name);
  useEffect(() => { nameRef.current = name; }, [name]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentUserStream = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<ReturnType<Peer["call"]> | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const localAudioCleanupRef = useRef<(() => void) | null>(null);
  const remoteAudioCleanupRef = useRef<(() => void) | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const peerOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setupAudioAnalysis = (stream: MediaStream, setVolume: (v: number) => void) => {
    try {
      if (typeof window === 'undefined') return () => {};
      const AudioContextClass = window.AudioContext || (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext;
      if (!AudioContextClass) return () => {};

      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animationFrameId: number;

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setVolume(Math.min(average / 40, 1));
        animationFrameId = requestAnimationFrame(updateVolume);
      };

      updateVolume();

      return () => {
        cancelAnimationFrame(animationFrameId);
        source.disconnect();
        audioContext.close().catch(console.error);
      };
    } catch (e) {
      console.error("Audio analysis setup failed:", e);
      return () => {};
    }
  };

  useEffect(() => {
    return () => {
      if (peerOpenTimeoutRef.current) {
        clearTimeout(peerOpenTimeoutRef.current);
      }
      peerRef.current?.destroy();
      currentUserStream.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (localAudioCleanupRef.current) localAudioCleanupRef.current();
      if (remoteAudioCleanupRef.current) remoteAudioCleanupRef.current();
      
      // Leave room on unmount
      if (myId) {
        fetch(`/api/rooms/${roomId}/leave`, {
          method: "DELETE",
          body: JSON.stringify({ peerId: myId }),
        }).catch(console.error);
      }
    };
  }, [myId, roomId]);

  useEffect(() => {
    if (joined && localVideoRef.current && currentUserStream.current) {
      localVideoRef.current.srcObject = currentUserStream.current;
    }
  }, [joined]);

  const attachCallListeners = (call: ReturnType<Peer["call"]>, remotePeerId: string) => {
    remotePeerIdRef.current = remotePeerId;
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
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      if (remoteAudioCleanupRef.current) remoteAudioCleanupRef.current();
      remoteAudioCleanupRef.current = setupAudioAnalysis(remoteStream, setRemoteVolume);
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

  const handleDataConnection = (conn: DataConnection, _remotePeerId: string) => {
    dataConnRef.current = conn;
    conn.on("open", () => { conn.send({ callerName: nameRef.current }); });
    conn.on("data", (data: unknown) => {
      if (data && typeof data === "object") {
        const payload = data as Record<string, unknown>;
        if ("callerName" in payload) {
          setRemoteName((payload as { callerName: string }).callerName || "Friend");
        }
        if (payload.type === "chat" && typeof payload.text === "string" && typeof payload.time === "string") {
          const chatMsg = { from: "them" as const, text: payload.text, time: payload.time };
          setMessages((prev) => [...prev, chatMsg]);
          const senderName = typeof payload.from === "string" ? payload.from : remoteName;
          setToast({ text: payload.text, from: senderName });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setToast(null), 4000);
        }
      }
    });
    conn.on("error", (err) => console.error("DataConnection error:", err));
  };

  const connectToPeer = (stream: MediaStream, remotePeerId: string) => {
    if (!peerRef.current) return;

    const dataConn = peerRef.current.connect(remotePeerId, { reliable: true });
    handleDataConnection(dataConn, remotePeerId);

    const call = peerRef.current.call(remotePeerId, stream);
    attachCallListeners(call, remotePeerId);
  };

  const startCall = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setWaiting(true);

    try {
      // Fetch TURN credentials (optional - will work without them, just less reliable)
      let iceServers = [];
      try {
        const credRes = await fetch("/api/turn-credentials");
        if (credRes.ok) {
          const { iceServers: servers } = await credRes.json();
          iceServers = servers;
        }
      } catch (err) {
        console.warn("TURN credentials fetch failed, continuing without TURN:", err);
      }

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      currentUserStream.current = stream;

      if (localAudioCleanupRef.current) localAudioCleanupRef.current();
      localAudioCleanupRef.current = setupAudioAnalysis(stream, setLocalVolume);

      // Create peer with optional TURN credentials
      // For production, set NEXT_PUBLIC_PEERJS_KEY env var, or configure custom server
      const peerKey = process.env.NEXT_PUBLIC_PEERJS_KEY || undefined;
      const customHost = process.env.NEXT_PUBLIC_PEERJS_HOST;
      const customPort = process.env.NEXT_PUBLIC_PEERJS_PORT;
      const customPath = process.env.NEXT_PUBLIC_PEERJS_PATH;
      const customSecure = process.env.NEXT_PUBLIC_PEERJS_SECURE;
      const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      const peerConfig: Record<string, unknown> = {
        config: { iceServers, sdpSemantics: "unified-plan" },
      };

      // Configuration priority: custom env vars > localhost > PeerJS Cloud
      if (customHost) {
        peerConfig.host = customHost;
        peerConfig.port = parseInt(customPort || '443');
        peerConfig.path = customPath || '/peerjs';
        peerConfig.secure = customSecure !== 'false';
        console.log("Using custom PeerJS server:", peerConfig.host);
      } else if (isLocalhost) {
        peerConfig.host = 'localhost';
        peerConfig.port = 9000;
        peerConfig.path = '/peerjs';
        peerConfig.secure = false;
        console.log("Using local PeerJS server on port 9000");
      } else if (peerKey) {
        peerConfig.key = peerKey;
        console.log("Using PeerJS Cloud with API key");
      } else {
        // Try to use default PeerJS Cloud (may not work without key)
        console.warn("⚠️ No PeerJS configuration found!");
        console.warn("For production, set NEXT_PUBLIC_PEERJS_KEY env var");
        console.warn("Or use custom server with NEXT_PUBLIC_PEERJS_HOST");
        console.warn("See PEERJS_DEPLOY.md for setup instructions");
      }

      console.log("Peer config:", { 
        host: peerConfig.host || 'cloud.peerjs.com',
        port: peerConfig.port, 
        path: peerConfig.path,
        secure: peerConfig.secure,
        hasKey: !!peerKey
      });
      
      const peer = new Peer(peerConfig);

      peer.on("open", async (id) => {
        setMyId(id);
        
        // Clear the open timeout since we connected successfully
        if (peerOpenTimeoutRef.current) {
          clearTimeout(peerOpenTimeoutRef.current);
          peerOpenTimeoutRef.current = null;
        }

        // Validate roomId before making API call
        if (!roomId || typeof roomId !== 'string') {
          console.error("Invalid roomId:", roomId);
          alert("Invalid room ID");
          setLoading(false);
          setWaiting(false);
          peer.destroy();
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Join room
        try {
          console.log("Joining room:", roomId, "with peerId:", id);
          
          const joinRes = await fetch(`/api/rooms/${roomId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ peerId: id, name: name.trim() }),
          });

          console.log("Join response status:", joinRes.status);
          console.log("Join response headers:", Object.fromEntries(joinRes.headers));

          let joinData;
          let responseText = "";
          
          try {
            responseText = await joinRes.text();
            joinData = JSON.parse(responseText);
          } catch {
            console.error("Failed to parse response as JSON. Response text:", responseText.substring(0, 200));
            throw new Error(`API returned invalid JSON (status ${joinRes.status}). Check browser console for details.`);
          }

          if (joinRes.status === 409) {
            // Room is full
            setRoomFull(true);
            setLoading(false);
            setWaiting(false);
            peer.destroy();
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          if (!joinRes.ok) {
            throw new Error(joinData.error || `Failed to join room (${joinRes.status})`);
          }

          // Connect to other peer if they exist
          if (joinData.otherPeer) {
            connectToPeer(stream, joinData.otherPeer.peerId);
            setRemoteName(joinData.otherPeer.name);
          }

          setJoined(true);
          setLoading(false);
          setWaiting(false);
        } catch (err) {
          console.error("Join room error:", err);
          const errorMsg = err instanceof Error ? err.message : "Failed to join room";
          alert(`Failed to join room: ${errorMsg}`);
          setLoading(false);
          setWaiting(false);
          peer.destroy();
          stream.getTracks().forEach((t) => t.stop());
        }
      });

      peer.on("connection", (conn) => { handleDataConnection(conn, conn.peer); });
      peer.on("call", (call) => {
        call.answer(stream);
        attachCallListeners(call, call.peer);
      });
      peer.on("error", (err) => {
        console.error("Peer error:", err);
        // Reset loading state if still waiting/loading
        if (loading || waiting) {
          setLoading(false);
          setWaiting(false);
        }
        // Only show error if not already connected
        if (!joined) {
          let errorMsg = "Connection error";
          
          if (err.type === "browser-incompatible") {
            errorMsg = "Your browser doesn't support WebRTC. Try Chrome or Firefox.";
          } else if (err.type === "unavailable-id") {
            errorMsg = "Peer ID already in use, trying again...";
          } else if (err.type === "server-error" || err.message?.includes("disconnecting from server")) {
            errorMsg = "Cannot connect to signaling server. The server may be down or not configured. Check browser console (F12) for details. See PEERJS_DEPLOY.md for setup.";
          } else {
            errorMsg = err.message || "Connection error. Check browser console for details.";
          }
          
          alert(`Connection error: ${errorMsg}`);
        }
      });

      // Add timeout for peer open event
      peerOpenTimeoutRef.current = setTimeout(() => {
        if (!joined) {
          console.error("Peer open timeout");
          alert("Connection timeout. Please check your internet and try again.");
          setLoading(false);
          setWaiting(false);
          peer.destroy();
          stream.getTracks().forEach((t) => t.stop());
        }
      }, 15000); // 15 second timeout

      peerRef.current = peer;
    } catch (err) {
      console.error("Setup error:", err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      alert(`Setup failed: ${errorMsg}\n\nMake sure:\n- You have camera/microphone permissions\n- You are on HTTPS (or localhost)\n- Browser supports WebRTC`);
      setLoading(false);
      setWaiting(false);
    }
  };

  const endCall = () => {
    if (screenSharing) stopScreenShare();
    activeCallRef.current?.close();
    activeCallRef.current = null;
    dataConnRef.current?.close();
    dataConnRef.current = null;
    setCallActive(false);
    setIceStatus("");
    setRemoteName("Friend");
    setMessages([]);
    setChatOpen(false);
    setChatInput("");
    setToast(null);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    if (remoteAudioCleanupRef.current) {
      remoteAudioCleanupRef.current();
      remoteAudioCleanupRef.current = null;
    }
    setRemoteVolume(0);
  };

  const toggleMic = () => {
    const audioTrack = currentUserStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicMuted(!audioTrack.enabled);
    }
  };

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

  const copyRoomId = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error("Failed to copy room ID:", err));
  };

  const copyRoomLink = () => {
    if (typeof window === 'undefined') return;
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error("Failed to copy link:", err));
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !dataConnRef.current) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    dataConnRef.current.send({ type: "chat", text: chatInput.trim(), time, from: nameRef.current });
    setMessages((prev) => [...prev, { from: "me", text: chatInput.trim(), time }]);
    setChatInput("");
  };

  const isConnected = iceStatus === "connected" || iceStatus === "completed";

  const [_callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      setCallDuration(0);
      return;
    }
    const interval = setInterval(() => setCallDuration((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const _formatDuration = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const iceIndicatorColor =
    isConnected ? "#22c55e"
    : iceStatus === "failed" || iceStatus === "closed" ? "#ef4444"
    : iceStatus === "checking" ? "#f59e0b"
    : "#6b7280";

  if (!roomId) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", background: "#090c10", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>
        <h1 style={{ fontSize: "24px" }}>Loading...</h1>
        <p style={{ color: "#94a3b8", marginBottom: "24px" }}>Setting up your room...</p>
      </div>
    );
  }

  if (roomFull) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", background: "#090c10", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>
        <h1 style={{ fontSize: "24px" }}>Room Full</h1>
        <p style={{ color: "#94a3b8", marginBottom: "24px" }}>This room is currently full. Max 2 participants allowed.</p>
        <button
          onClick={() => typeof window !== 'undefined' && (window.location.href = '/')}
          style={{ padding: "12px 24px", background: "linear-gradient(135deg, #38bdf8, #818cf8)", color: "#fff", borderRadius: "12px", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
        >
          Create New Room
        </button>
      </div>
    );
  }

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

        .room-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(125,211,252,0.1);
          border: 1px solid rgba(125,211,252,0.2);
          border-radius: 999px;
          padding: 4px 14px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7dd3fc;
          margin-bottom: 16px;
        }

        .room-info {
          width: 100%;
          max-width: 420px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .room-info-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .room-info-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
          font-weight: 500;
        }
        .room-id {
          font-family: 'DM Mono', 'Fira Code', monospace;
          font-size: 13px;
          color: #7dd3fc;
          background: rgba(125,211,252,0.06);
          border: 1px solid rgba(125,211,252,0.15);
          padding: 6px 12px;
          border-radius: 6px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .btn-small {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-small:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }
        .btn-small.copied { color: #22c55e; border-color: rgba(34,197,94,0.3); }

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

        .waiting-text {
          text-align: center;
          color: #64748b;
          font-size: 14px;
          margin-bottom: 16px;
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
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .video-container.speaker-active {
          border-color: rgba(34,197,94,0.6);
          box-shadow: 0 0 0 3px rgba(34,197,94,0.3), 0 16px 48px rgba(0,0,0,0.5);
        }

        .video-container video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          background: #000;
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
          transition: transform 0.2s, box-shadow 0.3s ease, border-color 0.3s ease;
          cursor: grab;
        }

        .local-pip.speaker-active {
          border-color: rgba(34,197,94,0.8);
          box-shadow: 0 0 0 3px rgba(34,197,94,0.4), 0 8px 32px rgba(0,0,0,0.6);
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

        .name-tag {
          position: absolute;
          bottom: 14px; left: 14px;
          background: rgba(9,12,16,0.75);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(8px);
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          display: flex; align-items: center; gap: 6px;
          font-weight: 500;
          color: #cbd5e1;
          z-index: 10;
        }
        .remote-name-tag {
          bottom: 14px; left: 14px;
          padding: 5px 12px;
          font-size: 12px;
        }
        .local-name-tag {
          bottom: 10px; left: 10px;
          padding: 4px 10px;
          font-size: 11px;
        }
        .name-tag-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 2s infinite;
          transition: transform 0.1s ease-out, background-color 0.2s;
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

        .chat-panel {
          width: 100%;
          max-width: 1100px;
          max-height: 320px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          backdrop-filter: blur(12px);
          animation: chatSlideIn 0.25s ease-out;
        }
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .chat-header-title {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .chat-close-btn {
          background: none; border: none;
          color: #64748b; font-size: 18px;
          cursor: pointer; padding: 2px 6px;
          border-radius: 6px;
          transition: background 0.2s, color 0.2s;
        }
        .chat-close-btn:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 120px;
          max-height: 200px;
        }
        .chat-msg {
          max-width: 75%;
          padding: 8px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.45;
          word-break: break-word;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .chat-msg.me {
          align-self: flex-end;
          background: linear-gradient(135deg, rgba(56,189,248,0.2), rgba(129,140,248,0.2));
          border: 1px solid rgba(125,211,252,0.15);
          color: #e2e8f0;
          border-bottom-right-radius: 4px;
        }
        .chat-msg.them {
          align-self: flex-start;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          color: #cbd5e1;
          border-bottom-left-radius: 4px;
        }
        .chat-msg-time {
          font-size: 10px;
          color: #475569;
          align-self: flex-end;
        }

        .chat-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #334155;
          font-size: 13px;
        }

        .chat-input-row {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .chat-input {
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
        }
        .chat-input:focus { border-color: rgba(125,211,252,0.4); }
        .chat-input::placeholder { color: #334155; }

        .chat-send-btn {
          padding: 10px 18px;
          border-radius: 10px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          color: #fff;
          transition: opacity 0.2s, transform 0.15s;
          white-space: nowrap;
        }
        .chat-send-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .chat-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        @media (max-width: 640px) {
          .room-wrapper { padding: 16px 12px 32px; }
          .video-container { aspect-ratio: 9/16; max-height: 65vh; }
          .local-pip { width: clamp(80px, 24vw, 120px); aspect-ratio: 9/16; }
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
          <>
            <div className="room-badge">
              Room: <span style={{ fontFamily: "'DM Mono', monospace" }}>{roomId}</span>
            </div>

            <div className="room-info">
              <div>
                <div className="room-info-label">Room ID</div>
                <div className="room-info-row">
                  <span className="room-id">{roomId}</span>
                  <button className={`btn-small${copied ? " copied" : ""}`} onClick={copyRoomId}>
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <div className="room-info-label">Share Link</div>
                <div className="room-info-row">
                  <button className={`btn-small${copied ? " copied" : ""}`} onClick={copyRoomLink} style={{ flex: 1, textAlign: "center" }}>
                    {copied ? "✓ Copied" : "Copy Link"}
                  </button>
                </div>
              </div>
            </div>

            <div className="join-card">
              <p className="join-label">Enter your name to join</p>
              <input
                className="join-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && startCall()}
                disabled={loading}
                autoFocus
              />
              {waiting && <p className="waiting-text">Waiting for another user to join...</p>}
              <button
                className="btn-primary"
                onClick={startCall}
                disabled={!name.trim() || loading}
              >
                {loading ? "Joining…" : "Join Call →"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`video-container ${remoteVolume > 0.05 ? "speaker-active" : ""}`}>
              <video ref={remoteVideoRef} autoPlay playsInline />

              {!isConnected && (
                <div className="waiting-overlay">
                  <div>👥</div>
                  <span>Waiting for friend…</span>
                </div>
              )}

              <div className="name-tag remote-name-tag" style={{ opacity: isConnected ? 1 : 0 }}>
                <span
                  className="name-tag-dot"
                  style={{
                    transform: `scale(${1 + remoteVolume * 2})`,
                    background: remoteVolume > 0.05 ? "#22c55e" : "#94a3b8",
                  }}
                />
                {remoteName}
              </div>

              <div className={`local-pip ${localVolume > 0.05 && !micMuted ? "speaker-active" : ""}`}>
                <video ref={localVideoRef} autoPlay muted playsInline />
                {camOff && (
                  <div className="cam-off-overlay">
                    <div className="cam-off-avatar">{name.charAt(0).toUpperCase()}</div>
                  </div>
                )}
                <div className="name-tag local-name-tag">
                  <span
                    className="name-tag-dot"
                    style={{
                      transform: `scale(${micMuted ? 1 : 1 + localVolume * 2})`,
                      background: micMuted ? "#ef4444" : localVolume > 0.05 ? "#22c55e" : "#94a3b8",
                    }}
                  />
                  {name || "You"}
                </div>
              </div>
            </div>

            {callActive && (
              <div className="action-buttons">
                <button className={`btn-action${micMuted ? " muted" : ""}`} onClick={toggleMic}>
                  <span className="btn-icon">{micMuted ? "🔇" : "🎙️"}</span>
                  {micMuted ? "Unmute" : "Mute"}
                </button>
                <button className={`btn-action${camOff ? " muted" : ""}`} onClick={toggleCam}>
                  <span className="btn-icon">{camOff ? "📷" : "📹"}</span>
                  {camOff ? "Start Video" : "Stop Video"}
                </button>
                <button className={`btn-action${screenSharing ? " muted" : ""}`} onClick={screenSharing ? stopScreenShare : startScreenShare}>
                  <span className="btn-icon">{screenSharing ? "🛑" : "📺"}</span>
                  {screenSharing ? "Stop" : "Share"}
                </button>
                <button className={`btn-action${chatOpen ? " muted" : ""}`} onClick={() => setChatOpen(!chatOpen)}>
                  <span className="btn-icon">💬</span>
                  Chat
                </button>
                <button className="btn-action btn-end" onClick={endCall}>
                  <span className="btn-icon">📵</span>
                  End
                </button>
              </div>
            )}

            {callActive && chatOpen && (
              <div className="chat-panel">
                <div className="chat-header">
                  <span className="chat-header-title">💬 Chat</span>
                  <button className="chat-close-btn" onClick={() => setChatOpen(false)}>✕</button>
                </div>
                {messages.length > 0 ? (
                  <div className="chat-messages">
                    {messages.map((msg, i) => (
                      <div key={i} className={`chat-msg ${msg.from}`}>
                        <span>{msg.text}</span>
                        <span className="chat-msg-time">{msg.time}</span>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="chat-empty">No messages yet</div>
                )}
                <div className="chat-input-row">
                  <input
                    className="chat-input"
                    placeholder="Type a message…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <button className="chat-send-btn" onClick={sendMessage} disabled={!chatInput.trim()}>
                    Send
                  </button>
                </div>
              </div>
            )}

            <div className="controls-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", fontWeight: "500" }}>
                  Room
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "13px", color: "#7dd3fc" }}>
                  {roomId}
                </span>
              </div>
              <button className="btn-small" onClick={copyRoomLink}>
                {copied ? "✓ Copied" : "Share Link"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
