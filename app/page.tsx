"use client";
import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

export default function RoomPage() {
  const [myId, setMyId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<any>(null);

  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const peer = new Peer(); // In a real "room", you'd use a specific ID logic
    
    peer.on('open', (id) => {
      setMyId(id);
      setJoined(true);
      console.log("Your ID is: " + id);
    });

    // Handle incoming calls
    peer.on('call', (call) => {
      call.answer(stream);
      call.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      });
    });

    peerRef.current = peer;
  };

  return (
    <main className="flex flex-col items-center p-10 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8">Friends' Video Room</h1>

      {!joined ? (
        <div className="flex flex-col gap-4">
          <input 
            className="p-2 rounded text-black" 
            placeholder="Enter your name" 
            onChange={(e) => setName(e.target.value)}
          />
          <button 
            onClick={startCall}
            className="bg-blue-600 px-6 py-2 rounded font-bold hover:bg-blue-700"
          >
            Join Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
          <div className="relative">
            <p className="absolute bottom-2 left-2 bg-black/50 p-1">{name} (You)</p>
            <video ref={localVideoRef} autoPlay muted className="rounded-xl border-2 border-blue-500 w-full" />
          </div>
          <div className="relative">
            <p className="absolute bottom-2 left-2 bg-black/50 p-1">Friend</p>
            <video ref={remoteVideoRef} autoPlay className="rounded-xl border-2 border-gray-600 w-full bg-black" />
          </div>
          <div className="col-span-full mt-4 text-center">
            <p className="text-gray-400">Share your ID to connect: <span className="text-blue-400">{myId}</span></p>
          </div>
        </div>
      )}
    </main>
  );
}