"use client";
import { useEffect, useState, useRef, useCallback } from "react";

interface Ghost {
  id: number;
  x: number;
  y: number;
  char: string;
}

const GHOST_CHARS = ['+', 'x', '·'];
const INTERACTIVE = 'button, a, input, select, textarea, [data-interactive]';

let ghostId = 0;

export function CustomCursor() {
  const [pos, setPos]       = useState({ x: -200, y: -200 });
  const [snapped, setSnapped] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const prevPos             = useRef({ x: -200, y: -200 });

  const handleMove = useCallback((e: MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    const dx = x - prevPos.current.x;
    const dy = y - prevPos.current.y;
    const velocity = Math.sqrt(dx * dx + dy * dy);

    setPos({ x, y });

    const el = document.elementFromPoint(x, y);
    setSnapped(!!(el && el.closest(INTERACTIVE)));

    if (velocity > 12 && prevPos.current.x > -200) {
      const ghost: Ghost = {
        id: ++ghostId,
        x: prevPos.current.x,
        y: prevPos.current.y,
        char: GHOST_CHARS[Math.floor(Math.random() * GHOST_CHARS.length)],
      };
      setGhosts((g) => [...g.slice(-5), ghost]);
      setTimeout(() => setGhosts((g) => g.filter((gh) => gh.id !== ghost.id)), 280);
    }

    prevPos.current = { x, y };
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMove);
    return () => document.removeEventListener('mousemove', handleMove);
  }, [handleMove]);

  return (
    <>
      <style>{`* { cursor: none !important; }`}</style>

      {/* Main cursor */}
      <div
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translate(-50%, -50%)',
          fontFamily: 'Courier New, monospace',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#FFFFFF',
          pointerEvents: 'none',
          zIndex: 9999,
          userSelect: 'none',
          mixBlendMode: snapped ? 'difference' : 'normal',
          animation: snapped ? 'none' : 'blink-cursor 0.5s steps(1) infinite',
          lineHeight: 1,
        }}
      >
        █
      </div>

      {/* Ghost trail */}
      {ghosts.map((g) => (
        <div
          key={g.id}
          style={{
            position: 'fixed',
            left: g.x,
            top: g.y,
            transform: 'translate(-50%, -50%)',
            fontFamily: 'Courier New, monospace',
            fontSize: '12px',
            color: '#666666',
            pointerEvents: 'none',
            zIndex: 9998,
            userSelect: 'none',
            animation: 'ghost-dissolve 280ms ease-out forwards',
            lineHeight: 1,
          }}
        >
          {g.char}
        </div>
      ))}
    </>
  );
}
