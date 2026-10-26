import { useEffect, useRef } from 'react';

export function useDevServerHeartbeat() {
  const lastHeartbeat = useRef(0);

  useEffect(() => {
    if ((window as any).__devServerHeartbeatRegistered) return;
    (window as any).__devServerHeartbeatRegistered = true;

    const throttleMs = 60_000 * 3;

    const sendHeartbeat = () => {
      const now = Date.now();
      if (now - lastHeartbeat.current < throttleMs) return;
      lastHeartbeat.current = now;
      fetch('/').catch(() => {});
    };

    sendHeartbeat();

    const events = [
      'mousemove', 'keydown', 'wheel', 'mousedown',
      'touchstart', 'pointerdown', 'visibilitychange',
    ];
    for (const event of events) {
      document.addEventListener(event, sendHeartbeat, { passive: true });
    }

    return () => {
      for (const event of events) {
        document.removeEventListener(event, sendHeartbeat);
      }
    };
  }, []);
}
