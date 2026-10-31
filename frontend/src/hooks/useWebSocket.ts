import { useEffect, useRef, useState } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/events`;

export type WebSocketListener = (event: string, data: any) => void;

export function useWebSocket(onEvent?: WebSocketListener) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<{ event: string; data: any } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let isDisposed = false;

    function connect() {
      if (isDisposed) return;
      try {
        const ws = new WebSocket(WS_URL);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isDisposed) {
            setIsConnected(true);
            console.log('[WebSocket] Connected to ACO live feed');
          }
        };

        ws.onmessage = (messageEvent) => {
          try {
            const parsed = JSON.parse(messageEvent.data);
            if (!isDisposed) {
              setLastMessage(parsed);
              if (onEventRef.current && parsed.event) {
                onEventRef.current(parsed.event, parsed.data);
              }
            }
          } catch (err) {
            console.error('[WebSocket] Error parsing message:', err);
          }
        };

        ws.onclose = () => {
          if (!isDisposed) {
            setIsConnected(false);
            console.log('[WebSocket] Disconnected, scheduling reconnect in 3s...');
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, 3000);
          }
        };

        ws.onerror = (err) => {
          console.warn('[WebSocket] Error:', err);
          ws.close();
        };
      } catch (e) {
        console.error('[WebSocket] Connection failed:', e);
        if (!isDisposed) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      }
    }

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  return { isConnected, lastMessage };
}

