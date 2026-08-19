"use client";

import { useEffect, useState } from "react";
import { WS_URL } from "../../lib/api";


export default function OverlayClient() {
  const [status, setStatus] = useState("connecting");
  const [state, setState] = useState("idle");
  const [amplitude, setAmplitude] = useState(0);
  const [captions, setCaptions] = useState({ ja: "", en: "", id: "" });

  useEffect(() => {
    let retry: number | undefined;
    let socket: WebSocket;
    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setStatus("online · idle");
      socket.onclose = () => { setStatus("reconnecting"); retry = window.setTimeout(connect, 1500); };
      socket.onerror = () => socket.close();
      socket.onmessage = (message) => {
        const incoming = JSON.parse(message.data);
        if (incoming.type === "speech") {
          setState("speaking");
          setStatus("online · speaking");
          // Optionally handle text if present, but the body organ only sends speechId
        } else if (incoming.type === "state_transition" || incoming.type === "lifecycle") {
          setState(incoming.state === "speaking" ? "speaking" : "idle");
          setStatus(incoming.state === "speaking" ? "online · speaking" : "online · idle");
        } else if (incoming.type === "expression") {
          // ignore expression updates for now
        }
        
        // Mock amplitude for now since body organ doesn't stream it currently
        if (incoming.state === "speaking") {
          setAmplitude(0.8 + Math.random() * 0.4);
        } else {
          setAmplitude(0);
        }
      };
    };
    connect();
    return () => { if (retry) window.clearTimeout(retry); socket?.close(); };
  }, []);

  return <main id="overlay" aria-live="polite">
    <div id="venus" className={`venus ${state}`} style={{ "--amplitude": amplitude } as React.CSSProperties}><span className="halo" /><span className="core">✦</span></div>
    <div className="status">{status}</div>
    <section id="captions" hidden={!captions.ja && !captions.en && !captions.id}><p id="ja">{captions.ja}</p><p id="en">{captions.en}</p><p id="id">{captions.id}</p></section>
  </main>;
}
