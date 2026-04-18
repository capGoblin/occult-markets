"use client";
import { useEffect, useRef } from "react";

const W = 600;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const R = 260;
const FOV = 2000;
const N_PARTICLES = 500;
const CHARS = '!@#$%^&*[]{}ABCDEFGHabcdefgh0123456789/\\<>?';

function randChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface Particle {
  nx: number; ny: number; nz: number;
  char: string;
  vx: number; vy: number; vz: number;
}

interface TrailPoint { x: number; y: number; }

interface Bolt {
  x: number; y: number;
  tx: number; ty: number;
  char: string;
  life: number;
  speed: number;
  trail: TrailPoint[];
  hit: boolean;
}

function buildParticles(): Particle[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const ps: Particle[] = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    const ny = 1 - (i / (N_PARTICLES - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - ny * ny));
    const theta = golden * i;
    ps.push({ nx: r * Math.cos(theta), ny, nz: r * Math.sin(theta), char: randChar(), vx: 0, vy: 0, vz: 0 });
  }
  return ps;
}

function project(p: Particle, rotY: number, vScale = 1): [number, number, number] {
  const cosR = Math.cos(rotY), sinR = Math.sin(rotY);
  const rx = p.nx * cosR + p.nz * sinR;
  const ry = p.ny;
  const rz = -p.nx * sinR + p.nz * cosR;
  const wx = rx * R + p.vx * vScale;
  const wy = ry * R + p.vy * vScale;
  const wz = rz * R + p.vz * vScale;
  const scale = FOV / (FOV + wz + R);
  return [CX + wx * scale, CY + wy * scale, rz];
}

export function AsciiSphere() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rotRef     = useRef(0);
  const rafRef     = useRef<number>(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout>>();
  const particles  = useRef<Particle[]>(buildParticles());
  const bolts      = useRef<Bolt[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    function scatterNearby(impX: number, impY: number) {
      particles.current.forEach(p => {
        const [sx, sy] = project(p, rotRef.current, 1);
        const dx = sx - impX, dy = sy - impY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 140 && d > 0) {
          const force = ((140 - d) / 140) * 0.55;
          p.vx += (dx / d) * force;
          p.vy += (dy / d) * force;
          p.vz += (Math.random() - 0.5) * force * 0.4;
          p.char = randChar();
        }
      });
    }

    function fireBolt() {
      const edge = Math.floor(Math.random() * 4);
      let ox = 0, oy = 0;
      if (edge === 0) { ox = Math.random() * W; oy = 0; }
      else if (edge === 1) { ox = W; oy = Math.random() * H; }
      else if (edge === 2) { ox = Math.random() * W; oy = H; }
      else { ox = 0; oy = Math.random() * H; }

      for (let i = 0; i < 22; i++) {
        const spread = (Math.random() - 0.5) * 40;
        bolts.current.push({
          x: ox, y: oy,
          tx: CX + spread, ty: CY + spread,
          char: randChar(),
          life: 1.0,
          speed: 5 + Math.random() * 5,
          trail: [],
          hit: false,
        });
      }
    }

    function schedule() {
      timerRef.current = setTimeout(() => { fireBolt(); schedule(); }, 6000 + Math.random() * 6000);
    }
    schedule();

    function animate() {
      rotRef.current += 0.003;
      const rotY = rotRef.current;

      // decay scatter
      particles.current.forEach(p => {
        p.vx *= 0.91; p.vy *= 0.91; p.vz *= 0.91;
      });

      ctx.clearRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // sort back-to-front
      const sorted = particles.current
        .map(p => { const [sx, sy, rz] = project(p, rotY, 1); return { p, sx, sy, rz }; })
        .sort((a, b) => a.rz - b.rz);

      sorted.forEach(({ p, sx, sy, rz }) => {
        const depth = (rz + 1) / 2;
        const opacity = 0.07 + depth * 0.85;
        const fontSize = 8 + depth * 12;
        ctx.font = `${fontSize.toFixed(1)}px "Courier New"`;
        ctx.fillStyle = `rgba(255,255,255,${opacity.toFixed(3)})`;
        ctx.fillText(p.char, sx, sy);
      });

      // update + draw bolts
      const alive: Bolt[] = [];
      bolts.current.forEach(b => {
        if (b.hit) {
          b.life -= 0.06;
          if (b.life > 0) alive.push(b);
          return;
        }
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 18) {
          b.hit = true;
          scatterNearby(b.tx, b.ty);
          alive.push(b);
          return;
        }

        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 5) b.trail.shift();

        b.x += (dx / dist) * b.speed;
        b.y += (dy / dist) * b.speed;
        b.life -= 0.012;

        // draw trail
        b.trail.forEach((t, i) => {
          const a = (i / b.trail.length) * 0.35 * b.life;
          ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
          ctx.font = `9px "Courier New"`;
          ctx.fillText(b.char, t.x, t.y);
        });

        // draw head
        ctx.fillStyle = `rgba(255,255,255,${(b.life * 0.9).toFixed(3)})`;
        ctx.font = `11px "Courier New"`;
        ctx.fillText(b.char, b.x, b.y);

        if (b.life > 0) alive.push(b);
      });
      bolts.current = alive;

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}
