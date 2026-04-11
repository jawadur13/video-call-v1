"use client";
import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

export default function RoomPage() {
  const [myId, setMyId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState(""); // State for the ID you want to call
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<any>(null);
  const currentUserStream = useRef<MediaStream | null>(null);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      currentUserStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const peer = new Peer();
      
      peer.on('open', (id) => {
        setMyId(id);
        setJoined(true);
      });

      // Handle incoming calls from friends
      peer.on('call', (call) => {
        call.answer(stream); // Send your stream to them
        call.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });
      });

      peerRef.current = peer;
    } catch (err) {
      console.error("Failed to get local stream", err);
      alert("Please allow camera/microphone access!");
    }
  };

  // Function to initiate a call to a friend
  const callUser = (id: string) => {
    if (!peerRef.current || !currentUserStream.current) return;

    const call = peerRef.current.call(id, currentUserStream.current);

    call.on('stream', (remoteStream: MediaStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });
  };

  return (
    <main className="flex flex-col items-center p-10 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8">Friends' Video Room</h1>

      {!joined ? (
        <div className="flex flex-col gap-4 bg-slate-800 p-8 rounded-2xl shadow-xl">
          <input 
            className="p-3 rounded bg-slate-700 text-white border border-slate-600 outline-none focus:border-blue-500" 
            placeholder="Enter your name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button 
            onClick={startCall}
            className="bg-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
          >
            Enter Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
          {/* Local Video */}
          <div className="relative group">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-sm z-10">
              {name || "You"}
            </p>
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              className="rounded-2xl border-2 border-blue-500 w-full aspect-video object-cover bg-black shadow-2xl" 
            />
          </div>

          {/* Remote Video */}
          <div className="relative group">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-sm z-10">
              Friend
            </p>
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              className="rounded-2xl border-2 border-slate-700 w-full aspect-video object-cover bg-black shadow-2xl" 
            />
          </div>

          {/* Connection Controls */}
          <div className="col-span-full mt-6 bg-slate-800 p-6 rounded-2xl flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Your Personal ID</p>
              <p className="text-blue-400 font-mono font-bold select-all cursor-pointer bg-slate-900 px-4 py-2 rounded border border-slate-700">
                {myId}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 w-full">
              <input 
                type="text" 
                placeholder="Paste Friend's ID here" 
                className="p-3 rounded-lg bg-slate-900 text-white border border-slate-700 w-full max-w-xs outline-none focus:border-green-500"
                value={remotePeerId}
                onChange={(e) => setRemotePeerId(e.target.value)} 
              />
              <button 
                onClick={() => callUser(remotePeerId)}
                className="bg-green-600 px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <span>📞</span> Call Friend
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}