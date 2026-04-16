const fs = require('fs');
let content = fs.readFileSync('app/room/[roomId]/page.tsx', 'utf8');

// 1. STATE REPLACEMENTS
content = content.replace(
`  const [remoteName, setRemoteName] = useState("Friend");
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
  const [reactions, setReactions] = useState<{ id: string; emoji: string; from: "me" | "them" }[]>([]);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);`,
`  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ from: string; text: string; time: string }[]>([]);
  const [_toast, setToast] = useState<{ text: string; from: string } | null>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; from: string; left?: string }[]>([]);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [localVolume, setLocalVolume] = useState(0);
  const [remotePeersState, setRemotePeersState] = useState<Record<string, { name: string; volume: number }>>({});`
);

// 2. REFs REPLACEMENTS
content = content.replace(
`  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentUserStream = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<ReturnType<Peer["call"]> | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const localAudioCleanupRef = useRef<(() => void) | null>(null);
  const remoteAudioCleanupRef = useRef<(() => void) | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const peerOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);`,
`  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const peerRef = useRef<Peer | null>(null);
  const currentUserStream = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  const remotePeersRef = useRef<Record<string, {
    call: ReturnType<Peer["call"]>;
    dataConn?: DataConnection;
    cleanupAudio?: () => void;
    stream?: MediaStream;
  }>>({});
  
  const peerOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localAudioCleanupRef = useRef<(() => void) | null>(null);

  const updateRemotePeerState = (peerId: string, updates: Partial<{ name: string; volume: number }>) => {
    setRemotePeersState(prev => ({
      ...prev,
      [peerId]: {
        name: prev[peerId]?.name || "Friend",
        volume: prev[peerId]?.volume || 0,
        ...updates
      }
    }));
  };

  const removeRemotePeer = (peerId: string) => {
    const p = remotePeersRef.current[peerId];
    if (p) {
      p.call?.close();
      p.dataConn?.close();
      p.cleanupAudio?.();
      delete remotePeersRef.current[peerId];
      if (remoteVideoRefs.current[peerId]) delete remoteVideoRefs.current[peerId];
    }
    setRemotePeersState(prev => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    // Check ref directly instead of state to prevent race conditions during unmount/cleanup
    if (Object.keys(remotePeersRef.current).length === 0) setCallActive(false);
  };`
);

// 3. UNMOUNT CLEANUP
content = content.replace(
`      peerRef.current?.destroy();
      currentUserStream.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (localAudioCleanupRef.current) localAudioCleanupRef.current();
      if (remoteAudioCleanupRef.current) remoteAudioCleanupRef.current();`,
`      peerRef.current?.destroy();
      currentUserStream.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (localAudioCleanupRef.current) localAudioCleanupRef.current();
      Object.keys(remotePeersRef.current).forEach(removeRemotePeer);`
);

// 4. ATTACH CALL LISTENERS + DATA CONNECTION
content = content.replace(
`  const attachCallListeners = (call: ReturnType<Peer["call"]>, remotePeerId: string) => {
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
        if (payload.type === "reaction" && typeof payload.emoji === "string") {
          const newReaction = { id: Math.random().toString(36).substring(2, 11), emoji: payload.emoji, from: "them" as const };
          setReactions(prev => [...prev, newReaction]);
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== newReaction.id));
          }, 2500);
        }
      }
    });
    conn.on("error", (err) => console.error("DataConnection error:", err));
  };

  const sendReaction = (emoji: string) => {
    if (!dataConnRef.current) return;
    dataConnRef.current.send({ type: "reaction", emoji });
    
    const newReaction = { id: Math.random().toString(36).substring(2, 11), emoji, from: "me" as const };
    setReactions(prev => [...prev, newReaction]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 2500);
  };`,
`  const attachCallListeners = (call: ReturnType<Peer["call"]>, remotePeerId: string) => {
    if (!remotePeersRef.current[remotePeerId]) {
      remotePeersRef.current[remotePeerId] = { call };
    } else {
      remotePeersRef.current[remotePeerId].call = call;
    }
    setCallActive(true);

    call.on("stream", (remoteStream) => {
      remotePeersRef.current[remotePeerId].stream = remoteStream;
      const videoEl = remoteVideoRefs.current[remotePeerId];
      if (videoEl) videoEl.srcObject = remoteStream;

      if (remotePeersRef.current[remotePeerId].cleanupAudio) remotePeersRef.current[remotePeerId].cleanupAudio!();
      remotePeersRef.current[remotePeerId].cleanupAudio = setupAudioAnalysis(remoteStream, (v) => updateRemotePeerState(remotePeerId, { volume: v }));
      
      updateRemotePeerState(remotePeerId, {});
    });
    call.on("error", (err) => console.error("Call error:", err));
    call.on("close", () => {
      removeRemotePeer(remotePeerId);
    });
  };

  const handleDataConnection = (conn: DataConnection, remotePeerId: string) => {
    if (!remotePeersRef.current[remotePeerId]) {
      remotePeersRef.current[remotePeerId] = { call: null as any, dataConn: conn };
    } else {
      remotePeersRef.current[remotePeerId].dataConn = conn;
    }

    conn.on("open", () => { conn.send({ callerName: nameRef.current }); });
    conn.on("data", (data: unknown) => {
      if (data && typeof data === "object") {
        const payload = data as Record<string, unknown>;
        if ("callerName" in payload) {
          updateRemotePeerState(remotePeerId, { name: (payload as any).callerName || "Friend" });
        }
        if (payload.type === "chat" && typeof payload.text === "string" && typeof payload.time === "string") {
          const chatMsg = { from: remotePeerId, text: payload.text, time: payload.time };
          setMessages((prev) => [...prev, chatMsg]);
          
          setRemotePeersState(prev => {
             const senderName = prev[remotePeerId]?.name || "Friend";
             setToast({ text: payload.text as string, from: senderName });
             if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
             toastTimerRef.current = setTimeout(() => setToast(null), 4000);
             return prev;
          });
        }
        if (payload.type === "reaction" && typeof payload.emoji === "string") {
          const rLeft = 20 + (Math.random() * 60);
          const newReaction = { id: Math.random().toString(36).substring(2, 11), emoji: payload.emoji, from: remotePeerId, left: \`\${rLeft}%\` };
          setReactions(prev => [...prev, newReaction]);
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== newReaction.id));
          }, 2500);
        }
      }
    });
    conn.on("error", (err) => console.error("DataConnection error:", err));
    conn.on("close", () => removeRemotePeer(remotePeerId));
  };

  const sendReaction = (emoji: string) => {
    Object.values(remotePeersRef.current).forEach(p => {
      p.dataConn?.send({ type: "reaction", emoji });
    });
    
    // Position randomly from bottom edge
    const rLeft = 40 + (Math.random() * 20);
    const newReaction = { id: Math.random().toString(36).substring(2, 11), emoji, from: "me", left: \`\${rLeft}%\` };
    setReactions(prev => [...prev, newReaction]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 2500);
  };`
);

// 5. START CALL
content = content.replace(
`          // Connect to other peer if they exist
          if (joinData.otherPeer) {
            connectToPeer(stream, joinData.otherPeer.peerId);
            setRemoteName(joinData.otherPeer.name);
          }`,
`          // Connect to all other existing peers
          if (joinData.allPeers && Array.isArray(joinData.allPeers)) {
            const others = joinData.allPeers.filter((p: any) => p.peerId !== id);
            for (const p of others) {
              connectToPeer(stream, p.peerId);
            }
          }`
);

// 6. END CALL & SEND MESSAGE & REPLACE VIDEO TRACK
content = content.replace(
`  const endCall = () => {
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
    
    router.push('/');
  };`,
`  const endCall = () => {
    if (screenSharing) stopScreenShare();
    Object.keys(remotePeersRef.current).forEach(peerId => removeRemotePeer(peerId));
    setCallActive(false);
    setMessages([]);
    setChatOpen(false);
    setChatInput("");
    setToast(null);
    router.push('/');
  };`
);

content = content.replace(
`  const replaceVideoTrack = (newTrack: MediaStreamTrack | null) => {
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
  };`,
`  const replaceVideoTrack = (newTrack: MediaStreamTrack | null) => {
    Object.values(remotePeersRef.current).forEach(p => {
      const call = p.call;
      if (!call) return;
      
      const sender = call.peerConnection
        .getSenders()
        .find((peerSender) => peerSender.track?.kind === "video");

      if (sender) {
        sender.replaceTrack(newTrack).catch((err) => {
          console.error("Replace video track failed:", err);
        });
      }
    });
  };`
);

content = content.replace(
`  const sendMessage = () => {
    if (!chatInput.trim() || !dataConnRef.current) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    dataConnRef.current.send({ type: "chat", text: chatInput.trim(), time, from: nameRef.current });
    setMessages((prev) => [...prev, { from: "me", text: chatInput.trim(), time }]);
    setChatInput("");
  };`,
`  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
    Object.values(remotePeersRef.current).forEach(p => {
      p.dataConn?.send({ type: "chat", text: chatInput.trim(), time, from: nameRef.current });
    });
    
    setMessages((prev) => [...prev, { from: "me", text: chatInput.trim(), time }]);
    setChatInput("");
  };`
);

content = content.replace(
`  const isConnected = iceStatus === "connected" || iceStatus === "completed";`,
`  const isConnected = Object.keys(remotePeersState).length > 0;`
);

// 7. UI CSS & RENDER REPLACEMENT
content = content.replace(
`        .video-container {
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
          box-shadow: 0 0 0 4px rgba(34,197,94,0.25), 0 8px 32px rgba(0,0,0,0.6);
        }

        .local-pip video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        
        .cam-off-overlay {
          position: absolute;
          inset: 0;
          background: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        
        .cam-off-avatar {
          width: 50%;
          border-radius: 50%;
          aspect-ratio: 1/1;
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2vw;
          font-weight: 700;
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .name-tag {
          position: absolute;
          background: rgba(15,20,25,0.7);
          backdrop-filter: blur(8px);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #e2e8f0;
          border: 1px solid rgba(255,255,255,0.1);
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .remote-name-tag { bottom: 20px; left: 24px; }
        .local-name-tag { bottom: 10px; left: 10px; padding: 4px 10px; font-size: 11px; }

        .name-tag-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34,197,94,0.6);
          transition: transform 0.1s;
        }

        .waiting-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15,20,25,0.9);
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 15;
          gap: 16px;
        }
        .waiting-overlay div { font-size: 48px; opacity: 0.5; animation: pulse 2s infinite; }
        .waiting-overlay span { color: #94a3b8; font-size: 15px; letter-spacing: 0.05em; text-transform: uppercase; }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }`,
`        .video-container {
          position: relative;
          width: 100%;
          max-width: 1200px;
          aspect-ratio: 16/9;
          border-radius: 20px;
          overflow: hidden;
          background: #0f1419;
          box-shadow: 0 16px 48px rgba(0,0,0,0.5);
          border: 1.5px solid rgba(255,255,255,0.07);
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
          display: grid;
          gap: 12px;
          padding: 12px;
        }
        
        .video-container[data-peers="1"] { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .video-container[data-peers="2"] { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .video-container[data-peers="3"] { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .video-container[data-peers="4"] { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }

        .peer-box {
          position: relative;
          width: 100%;
          height: 100%;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid transparent;
          transition: border-color 0.3s;
        }
        
        .peer-box.speaker-active {
          border-color: rgba(34,197,94,0.8);
          box-shadow: 0 0 0 2px rgba(34,197,94,0.4) inset;
        }

        .peer-box video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          background: #000;
        }

        .cam-off-overlay {
          position: absolute;
          inset: 0;
          background: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        
        .cam-off-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 700;
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .name-tag {
          position: absolute;
          bottom: 12px;
          left: 12px;
          background: rgba(15,20,25,0.7);
          backdrop-filter: blur(8px);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #e2e8f0;
          border: 1px solid rgba(255,255,255,0.1);
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .name-tag-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34,197,94,0.6);
          transition: transform 0.1s;
        }

        .waiting-overlay {
          position: absolute;
          inset: 0;
          background: #0f1419;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 15;
          gap: 16px;
        }
        .waiting-overlay div { font-size: 48px; opacity: 0.5; animation: pulse 2s infinite; }
        .waiting-overlay span { color: #94a3b8; font-size: 15px; letter-spacing: 0.05em; text-transform: uppercase; }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }`
);

content = content.replace(
`        {iceStatus && (
          <div className="ice-badge">
            <span className="ice-dot" style={{ background: iceIndicatorColor }} />
            {iceStatus}
          </div>
        )}`,
`        {isConnected && (
          <div className="ice-badge">
            <span className="ice-dot" style={{ background: "#22c55e" }} />
            connected
          </div>
        )}`
);

content = content.replace(
`            <div className={\`video-container \${remoteVolume > 0.05 ? "speaker-active" : ""}\`}>
              <video ref={remoteVideoRef} autoPlay playsInline />

              {_toast && (
                <div className="toast-popup">
                  <span className="toast-from">{_toast.from}:</span> {_toast.text}
                </div>
              )}

              {reactions.map(r => (
                <div key={r.id} className={\`floating-reaction \${r.from}\`}>
                  {r.emoji}
                </div>
              ))}

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
                    transform: \`scale(\${1 + remoteVolume * 2})\`,
                    background: remoteVolume > 0.05 ? "#22c55e" : "#94a3b8",
                  }}
                />
                {remoteName}
              </div>

              <div className={\`local-pip \${localVolume > 0.05 && !micMuted ? "speaker-active" : ""}\`}>
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
                      transform: \`scale(\${micMuted ? 1 : 1 + localVolume * 2})\`,
                      background: micMuted ? "#ef4444" : localVolume > 0.05 ? "#22c55e" : "#94a3b8",
                    }}
                  />
                  {name || "You"}
                </div>
              </div>
            </div>`,
`            <div className="video-container" data-peers={Object.keys(remotePeersState).length + 1}>
              {/* Local Peer Box */}
              <div className={\`peer-box \${localVolume > 0.05 && !micMuted ? "speaker-active" : ""}\`}>
                <video ref={localVideoRef} autoPlay muted playsInline style={{ transform: "scaleX(-1)" }} />
                {camOff && (
                  <div className="cam-off-overlay">
                    <div className="cam-off-avatar">{name.charAt(0).toUpperCase()}</div>
                  </div>
                )}
                <div className="name-tag">
                  <span
                    className="name-tag-dot"
                    style={{
                      transform: \`scale(\${micMuted ? 1 : 1 + localVolume * 2})\`,
                      background: micMuted ? "#ef4444" : localVolume > 0.05 ? "#22c55e" : "#94a3b8",
                    }}
                  />
                  {name || "You"}
                </div>
              </div>
              
              {/* Remote Peers Grid */}
              {Object.entries(remotePeersState).map(([peerId, p]) => (
                <div key={peerId} className={\`peer-box \${p.volume > 0.05 ? "speaker-active" : ""}\`}>
                  <video ref={el => { remoteVideoRefs.current[peerId] = el; }} autoPlay playsInline />
                  <div className="name-tag">
                    <span
                      className="name-tag-dot"
                      style={{
                        transform: \`scale(\${1 + p.volume * 2})\`,
                        background: p.volume > 0.05 ? "#22c55e" : "#94a3b8",
                      }}
                    />
                    {p.name}
                  </div>
                </div>
              ))}

              {!isConnected && (
                <div className="waiting-overlay">
                  <div>👥</div>
                  <span>Waiting for others to join…</span>
                </div>
              )}

              {/* Toasts and UI overlays */}
              {_toast && (
                <div className="toast-popup">
                  <span className="toast-from">{_toast.from}:</span> {_toast.text}
                </div>
              )}

              {reactions.map(r => (
                <div key={r.id} className="floating-reaction" style={{ bottom: r.from === "me" ? "20px" : "40%", left: r.left || "50%" }}>
                  {r.emoji}
                </div>
              ))}
            </div>`
);

// We need to also clean up the unused iceIndicatorColor function.
content = content.replace(
`  const iceIndicatorColor =
    isConnected ? "#22c55e"
    : iceStatus === "failed" || iceStatus === "closed" ? "#ef4444"
    : iceStatus === "checking" ? "#f59e0b"
    : "#6b7280";`,
` `
);

fs.writeFileSync('temp_rewrite.tsx', content);
console.log("Rewrites applied successfully to temp_rewrite.tsx!");
