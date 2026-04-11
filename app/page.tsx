"use client";
import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

export default function RoomPage() {
  const [myId, setMyId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentUserStream = useRef<MediaStream | null>(null);

  // CRITICAL: This effect ensures the local video plays once the UI renders
  useEffect(() => {
    if (joined && localVideoRef.current && currentUserStream.current) {
      localVideoRef.current.srcObject = currentUserStream.current;
      localVideoRef.current.play().catch(e => console.error("Playback error:", e));
    }
  }, [joined]);

  const startCall = async () => {
    try {
      // 1. Get the media stream first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      currentUserStream.current = stream;

      // 2. Initialize PeerJS with STUN servers
      const peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        }
      });
      
      peer.on('open', (id) => {
        setMyId(id);
        setJoined(true); // This triggers the useEffect above
      });

      // Handle incoming calls
      peer.on('call', (call) => {
        call.answer(stream);
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
    
    const call = peerRef.current.call(id, currentUserStream.current);
    call.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
    });
  };

  return (
    <main className="flex flex-col items-center p-6 bg-slate-900 min-h-screen text-white font-sans">
      <h1 className="text-3xl font-bold mb-8">Friends' Video Room</h1>

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
          {/* Local Video Section */}
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

          {/* Remote Video Section */}
          <div className="relative group overflow-hidden rounded-2xl border-2 border-slate-700 shadow-2xl bg-black">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10 border border-white/10">
              Friend
            </p>
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full aspect-video object-cover" 
            />
          </div>

          {/* Interaction Bar */}
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
                className="p-3 rounded-lg bg-slate-900 text-white border border-slate-700 flex-1 outline-none focus:border-green-500 transition-all"
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