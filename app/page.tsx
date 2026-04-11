"use client";
import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

export default function RoomPage() {
  const [myId, setMyId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [name, setName] = useState("");
  const [remoteName, setRemoteName] = useState("Friend");
  const [joined, setJoined] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentUserStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (joined && localVideoRef.current && currentUserStream.current) {
      localVideoRef.current.srcObject = currentUserStream.current;
      localVideoRef.current.play().catch(e => console.error("Playback error:", e));
    }
  }, [joined]);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      currentUserStream.current = stream;

      const peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
          ],
          sdpSemantics: 'unified-plan'
        }
      });
      
      peer.on('open', (id) => {
        setMyId(id);
        setJoined(true);
      });

      // Handle incoming calls (Someone is calling YOU)
      peer.on('call', (call) => {
        // Capture friend's name from metadata
        if (call.metadata && call.metadata.callerName) {
          setRemoteName(call.metadata.callerName);
        }

        // Answer and send YOUR name back
(call as any).answer(stream, { metadata: { callerName: name } });
        call.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(console.error);
          }
        });
      });

      peerRef.current = peer;
    } catch (err) {
      console.error("Media Error:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const callUser = (id: string) => {
    if (!peerRef.current || !currentUserStream.current || !id) return;
    
    // Send YOUR name when you initiate the call
    const call = peerRef.current.call(id, currentUserStream.current, {
      metadata: { callerName: name }
    });

    call.on('stream', (remoteStream) => {
      // PeerJS provides the remote metadata via the peerConnection's internal state 
      // or often via the call object once the answer is received.
      // To ensure it updates, we check the metadata attached to the call object.
      if (call.metadata && call.metadata.callerName) {
        setRemoteName(call.metadata.callerName);
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
    });

    // Fallback: Some PeerJS versions require a data connection to swap names reliably.
    // However, metadata on the 'call' is the standard way for video.
  };

  return (
    <main className="flex flex-col items-center p-6 bg-slate-900 min-h-screen text-white font-sans">
      <h1 className="text-3xl font-bold mb-8 text-center">Friends' Video Room</h1>

      {!joined ? (
        <div className="flex flex-col gap-4 bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-slate-700">
          <input 
            className="p-3 rounded bg-slate-700 text-white border border-slate-600 outline-none focus:border-blue-500 transition-all" 
            placeholder="Enter your name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button 
            onClick={startCall} 
            className="bg-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-700 active:scale-95 transition-all"
          >
            Enter Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
          <div className="relative group overflow-hidden rounded-2xl border-2 border-blue-500 shadow-2xl bg-black">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10 border border-white/10">
              {name || "You"}
            </p>
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full aspect-video object-cover" 
            />
          </div>

          <div className="relative group overflow-hidden rounded-2xl border-2 border-slate-700 shadow-2xl bg-black">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10 border border-white/10">
              {remoteName}
            </p>
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full aspect-video object-cover" 
            />
          </div>

          <div className="col-span-full mt-6 bg-slate-800 p-6 rounded-2xl flex flex-col items-center gap-4 border border-slate-700">
            <div className="text-center">
              <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Your Personal ID</p>
              <p className="text-blue-400 font-mono font-bold select-all bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                {myId || "Generating..."}
              </p>
            </div>

            <div className="flex gap-2 w-full max-w-md">
              <input 
                type="text" 
                placeholder="Paste Friend's ID" 
                className="p-3 rounded-lg bg-slate-900 text-white border border-slate-700 flex-1 outline-none focus:border-green-500 transition-all text-sm"
                value={remotePeerId}
                onChange={(e) => setRemotePeerId(e.target.value)} 
              />
              <button 
                onClick={() => callUser(remotePeerId)} 
                className="bg-green-600 px-6 py-3 rounded-lg font-bold hover:bg-green-700 active:scale-95 transition-all"
              >
                Call
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}