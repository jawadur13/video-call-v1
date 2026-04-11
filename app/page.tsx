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

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      currentUserStream.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Force play for Chrome/Mobile
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current?.play().catch(e => console.error("Local play error:", e));
        };
      }

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
        setJoined(true);
      });

      peer.on('call', (call) => {
        call.answer(stream);
        call.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.onloadedmetadata = () => {
              remoteVideoRef.current?.play().catch(e => console.error("Remote play error:", e));
            };
          }
        });
      });

      peerRef.current = peer;
    } catch (err) {
      console.error("Media Error:", err);
      alert("Permission denied or camera in use by another app!");
    }
  };

  const callUser = (id: string) => {
    if (!peerRef.current || !currentUserStream.current || !id) return;
    const call = peerRef.current.call(id, currentUserStream.current);
    call.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.onloadedmetadata = () => {
          remoteVideoRef.current?.play().catch(e => console.error("Remote play error:", e));
        };
      }
    });
  };

  return (
    <main className="flex flex-col items-center p-6 bg-slate-900 min-h-screen text-white font-sans">
      <h1 className="text-3xl font-bold mb-8">Friends' Video Room</h1>

      {!joined ? (
        <div className="flex flex-col gap-4 bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
          <input 
            className="p-3 rounded bg-slate-700 text-white border border-slate-600 outline-none focus:border-blue-500" 
            placeholder="Enter your name" 
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={startCall} className="bg-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all">
            Enter Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
          <div className="relative">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10">{name || "You"}</p>
            <video ref={localVideoRef} autoPlay muted playsInline className="rounded-2xl border-2 border-blue-500 w-full aspect-video object-cover bg-black" />
          </div>

          <div className="relative">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10">Friend</p>
            <video ref={remoteVideoRef} autoPlay playsInline className="rounded-2xl border-2 border-slate-700 w-full aspect-video object-cover bg-black" />
          </div>

          <div className="col-span-full mt-6 bg-slate-800 p-6 rounded-2xl flex flex-col items-center gap-4">
            <p className="text-gray-400 text-xs">Your ID: <span className="text-blue-400 font-mono font-bold">{myId}</span></p>
            <div className="flex gap-2 w-full max-w-md">
              <input 
                type="text" 
                placeholder="Paste Friend's ID" 
                className="p-3 rounded-lg bg-slate-900 text-white border border-slate-700 flex-1 outline-none"
                value={remotePeerId}
                onChange={(e) => setRemotePeerId(e.target.value)} 
              />
              <button onClick={() => callUser(remotePeerId)} className="bg-green-600 px-6 py-3 rounded-lg font-bold">Call</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}