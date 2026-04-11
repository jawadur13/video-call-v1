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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      currentUserStream.current = stream;

      const peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.voiparound.com' },
            { urls: 'stun:stun.voipbuster.com' },
          ],
        }
      });
      
      peer.on('open', (id) => {
        setMyId(id);
        setJoined(true);
      });

      peer.on('call', (call: any) => {
        // RECEIVER SIDE: Get the name of the person calling you
        if (call.metadata && call.metadata.callerName) {
          setRemoteName(call.metadata.callerName);
        }

        call.answer(stream, { metadata: { callerName: name } });

        call.on('stream', (remoteStream: MediaStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(console.error);
          }
        });
      });

      peerRef.current = peer;
    } catch (err) {
      alert("Camera blocked! Please allow access.");
    }
  };

  const callUser = (id: string) => {
    if (!peerRef.current || !currentUserStream.current || !id) return;
    
    // CALLER SIDE: Send your name to the friend
    const call = (peerRef.current as any).call(id, currentUserStream.current, {
      metadata: { callerName: name }
    });

    call.on('stream', (remoteStream: MediaStream) => {
      // Get the friend's name from THEIR answer metadata
      if (call.peerConnection) {
        // We wait for the connection to establish to pull the remote metadata
        const remoteMetadata = (call as any).metadata;
        if (remoteMetadata && remoteMetadata.callerName) {
          // This ensures we don't overwrite our own name
          setRemoteName(remoteMetadata.callerName);
        }
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
    });
  };

  return (
    <main className="flex flex-col items-center p-6 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8">Friends' Video Room</h1>

      {!joined ? (
        <div className="flex flex-col gap-4 bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-700">
          <input 
            className="p-3 rounded bg-slate-700 text-white border border-slate-600 outline-none" 
            placeholder="Enter your name" 
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={startCall} className="bg-blue-600 px-6 py-3 rounded-lg font-bold">Join Room</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
          <div className="relative rounded-2xl border-2 border-blue-500 overflow-hidden bg-black">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10">{name || "You"}</p>
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full aspect-video object-cover" />
          </div>

          <div className="relative rounded-2xl border-2 border-slate-700 overflow-hidden bg-black">
            <p className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs z-10">{remoteName}</p>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full aspect-video object-cover" />
          </div>

          <div className="col-span-full mt-6 bg-slate-800 p-6 rounded-2xl flex flex-col items-center gap-4">
            <p className="text-gray-400 text-xs">Your ID: <span className="text-blue-400 font-mono select-all">{myId}</span></p>
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