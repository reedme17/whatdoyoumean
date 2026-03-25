/**
 * WebSocket hook — connects to backend via socket.io-client.
 * Provides send/subscribe for real-time session events.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerEvent } from "@wdym/shared";

const WS_URL = "http://localhost:3001";

export type ServerEventHandler = (event: ServerEvent) => void;

export interface UseSocketReturn {
  connected: boolean;
  send: (event: { type: string; [key: string]: unknown }) => void;
  socket: Socket | null;
}

export function useSocket(onEvent: ServerEventHandler): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ["polling", "websocket"],
      autoConnect: true,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => { console.log("[WS] Connected!"); setConnected(true); });
    socket.on("disconnect", () => { console.log("[WS] Disconnected"); setConnected(false); });
    socket.on("connect_error", (err) => { console.log("[WS] Connect error:", err.message); });

    // Listen for all server event types
    const eventTypes = [
      "transcript:interim",
      "transcript:final",
      "card:created",
      "card:updated",
      "recommendation:new",
      "topic:updated",
      "stt:provider_switch",
      "pending:preview",
      "error",
      "session:state",
    ];

    for (const type of eventTypes) {
      socket.on(type, (payload: unknown) => {
        const data = typeof payload === "object" && payload !== null ? payload : {};
        handlerRef.current({ type, ...data } as unknown as ServerEvent);
      });
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const send = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      console.log("[WS] Sending:", event.type, socketRef.current?.connected ? "(connected)" : "(NOT connected)");
      socketRef.current?.emit(event.type, event);
    },
    []
  );

  return { connected, send, socket: socketRef.current };
}
