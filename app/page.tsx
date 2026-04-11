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

  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentUserStream = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerRef.current?.destroy();
      currentUserStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (joined && localVideoRef.current && currentUserStream.current) {
      localVideoRef.current.srcObject = currentUserStream.current;
    }
  }, [joined]);

  const attachCallListeners = (call: ReturnType<Peer["call"]>) => {
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
    });
    call.on("error", (err) => console.error("Call error:", err));
    call.on("close", () => {
      setIceStatus("closed");
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });
  };

  const handleDataConnection = (conn: DataConnection) => {
    conn.on("open", () => {
      conn.send({ callerName: nameRef.current });
    });
    conn.on("data", (data: unknown) => {
      if (data && typeof data === "object" && "callerName" in data) {
        setRemoteName((data as { callerName: string }).callerName || "Friend");
      }
    });
    conn.on("error", (err) => console.error("DataConnection error:", err));
  };

  const startCall = async () => {
    if (!name.trim()) {
      alert("Please enter your name first.");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Fetch real short-lived TURN credentials from our API route
      const credRes = await fetch("/api/turn-credentials");
      if (!credRes.ok) throw new Error("Could not fetch TURN credentials");
      const { iceServers } = await credRes.json();
      console.log("Got ICE servers:", iceServers);

      // Step 2: Get camera/mic
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      currentUserStream.current = stream;

      // Step 3: Create peer with real credentials
      const peer = new Peer({
        config: {
          iceServers, // real credentials from Cloudflare
          sdpSemantics: "unified-plan",
        },
      });

      peer.on("open", (id) => {
        setMyId(id);
        setJoined(true);
        setLoading(false);
      });

      peer.on("connection", (conn) => {
        handleDataConnection(conn);
      });

      peer.on("call", (call) => {
        call.answer(stream);
        attachCallListeners(call);
      });

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

  const copyId = () => {
    navigator.clipboard.writeText(myId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const iceColor =
    iceStatus === "connected" || iceStatus === "completed"
      ? "text-green-400"
      : iceStatus === "failed" || iceStatus === "closed"
      ? "text-red-400"
      : iceStatus === "checking"
      ? "text-yellow-400"
      : "text-gray-500";

  const isConnected = iceStatus === "connected" || iceStatus === "completed";

  return (
    <main className="flex flex-col items-center p-6 bg-slate-900 min-h-screen text-white font-sans">
      <h1 className="text-3xl font-bold mb-2 text-center">Friends&apos; Video Room</h1>

      {iceStatus && (
        <p className={`text-xs mb-4 font-mono uppercase tracking-widest ${iceColor}`}>
          ● ICE: {iceStatus}
        </p>
      )}

      {!joined ? (
        <div className="flex flex-col gap-4 bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-slate-700 mt-6">
          <p className="text-gray-400 text-sm">Enter your name to get started</p>
          <input
            className="p-3 rounded bg-slate-700 text-white border border-slate-600 outline-none focus:border-blue-500 transition-all"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && startCall()}
            disabled={loading}
          />
          <button
            onClick={startCall}
            disabled={!name.trim() || loading}
            className="bg-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Connecting..." : "Enter Room"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mt-4">
          {/* Local Video */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-blue-500 shadow-2xl bg-black">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10 border border-white/10">
              {name} (You)
            </p>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-video object-cover"
            />
          </div>

          {/* Remote Video */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-slate-700 shadow-2xl bg-black">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10 border border-white/10">
              {remoteName}
            </p>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full aspect-video object-cover"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                Waiting for friend...
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="col-span-full mt-2 bg-slate-800 p-6 rounded-2xl flex flex-col items-center gap-4 border border-slate-700">
            <div className="text-center">
              <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">
                Your Personal ID — share this with your friend
              </p>
              <div className="flex items-center gap-2">
                <p className="text-blue-400 font-mono font-bold select-all bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                  {myId || "Generating..."}
                </p>
                <button
                  onClick={copyId}
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg border border-slate-600 transition-all"
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex gap-2 w-full max-w-md">
              <input
                type="text"
                placeholder="Paste Friend's ID here"
                className="p-3 rounded-lg bg-slate-900 text-white border border-slate-700 flex-1 outline-none focus:border-green-500 transition-all text-sm"
                value={remotePeerId}
                onChange={(e) => setRemotePeerId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && callUser(remotePeerId)}
              />
              <button
                onClick={() => callUser(remotePeerId)}
                disabled={!remotePeerId.trim()}
                className="bg-green-600 px-6 py-3 rounded-lg font-bold hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
              >
                Call
              </button>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              ⚠️ This app requires HTTPS to access your camera on remote devices.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}