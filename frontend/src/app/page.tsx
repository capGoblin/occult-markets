"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AsciiSphere } from '@/components/AsciiSphere';

/* ─── Shared hooks ──────────────────────────── */

const SCRAMBLE_CHARS = '!@#$%^&*[]{}ABCDEFGHabcdefgh0123456789/\\<>?';

function useScramble(target: string, duration = 800, active = true) {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    if (!active) return;
    setDisplay(Array.from(target, () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]).join(''));
    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const locked = Math.floor(p * target.length);
      setDisplay(
        target.slice(0, locked) +
        Array.from({ length: target.length - locked }, () =>
          Math.random() < 0.08
            ? SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
            : target[locked + Math.floor(Math.random() * (target.length - locked))] ?? SCRAMBLE_CHARS[0]
        ).join('')
      );
      if (p >= 1) clearInterval(iv);
    }, 50);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, active]);
  return display;
}

function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.disconnect(); }
    }, options);
    obs.observe(el);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, inView };
}

function useTypewriter(text: string, speed = 18, active = false) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!active) return;
    setDisplayed('');
    let i = 0;
    const t = setInterval(() => { setDisplayed(text.slice(0, ++i)); if (i >= text.length) clearInterval(t); }, speed);
    return () => clearInterval(t);
  }, [active, text, speed]);
  return { text: displayed, done: displayed.length >= text.length };
}

/* ─── Nav ───────────────────────────────────── */

function Nav() {
  const [loaded, setLoaded] = useState(false);
  const navLinks = [
    { label: 'Problem',       href: '#problem'      },
    { label: 'The Fix',       href: '#proof'        },
    { label: 'How It Works',  href: '#how-it-works' },
    { label: 'Built on Fhenix', href: '#fhenix'     },
  ];
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 60); return () => clearTimeout(t); }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 56,
      background: '#000000', borderBottom: '1px solid #333333',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(1.5rem, 4vw, 3rem)',
      opacity: loaded ? 1 : 0, transition: 'opacity 300ms',
    }}>
      <span style={{ fontFamily: 'Courier New, monospace', fontSize: 13, letterSpacing: '0.35em', color: '#FFFFFF' }}>
        OCCULT<span style={{ animation: 'blink-cursor 0.5s steps(1) infinite' }}>_</span>
      </span>

      <div style={{ display: 'flex', gap: '2.5rem' }}>
        {navLinks.map(link => (
          <a key={link.label} href={link.href} style={{
            fontFamily: 'Courier New, monospace', fontSize: 12, letterSpacing: '0.1em',
            color: '#666666', textDecoration: 'none', transition: 'color 150ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#666666')}
          >{link.label}</a>
        ))}
      </div>

      <Link href="/app">
        <button style={{
          background: '#000000', border: '1px solid #FFFFFF', color: '#FFFFFF',
          padding: '7px 18px', borderRadius: 0, cursor: 'pointer',
          fontFamily: 'Courier New, monospace', fontSize: 12, letterSpacing: '0.12em',
          transition: 'background 150ms, color 150ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#000000'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#000000'; e.currentTarget.style.color = '#FFFFFF'; }}
        >[ Launch App ]</button>
      </Link>
    </nav>
  );
}

/* ─── Hero ──────────────────────────────────── */

function ScrambleCTA({ text }: { text: string }) {
  const [display, setDisplay] = useState(text);
  const tiRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startScramble = () => {
    const start = Date.now();
    ivRef.current = setInterval(() => {
      const p = Math.min((Date.now() - start) / 100, 1);
      const locked = Math.floor(p * text.length);
      setDisplay(
        text.slice(0, locked) +
        Array.from({ length: text.length - locked }, () =>
          SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
        ).join('')
      );
      if (p >= 1) { if (ivRef.current) clearInterval(ivRef.current); setDisplay(text); }
    }, 20);
  };
  const stopScramble = () => {
    if (ivRef.current) clearInterval(ivRef.current);
    if (tiRef.current) clearTimeout(tiRef.current);
    setDisplay(text);
  };

  return (
    <Link href="/app">
      <button
        onMouseEnter={startScramble}
        onMouseLeave={stopScramble}
        style={{
          background: '#FFFFFF', color: '#000000', border: '1px solid #FFFFFF',
          padding: '14px 48px', borderRadius: 0, cursor: 'pointer',
          fontFamily: 'Courier New, monospace', fontSize: 13, letterSpacing: '0.15em',
          transition: 'background 150ms, color 150ms', minWidth: 220,
        }}
      >{display}</button>
    </Link>
  );
}

function Hero() {
  const line1 = useScramble('Finally, the price reflects', 400);
  const line2 = useScramble('what people actually believe about the market.', 500);

  return (
    <section style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(2rem,5vw,4rem)', paddingTop: '80px',
      position: 'relative', gap: '2rem',
    }}>
      {/* Left: text */}
      <div style={{ flex: 1, maxWidth: 560 }}>
        <div style={{ height: 1, background: '#FFFFFF', width: 48, marginBottom: '2.5rem' }} />

        <div style={{
          fontSize: 'clamp(2rem, 4vw, 4rem)', fontWeight: 300,
          letterSpacing: '-0.02em', lineHeight: 1.15,
          color: '#FFFFFF', fontFamily: 'Courier New, monospace',
        }}>{line1}</div>
        <div style={{
          fontSize: 'clamp(2rem, 4vw, 4rem)', fontWeight: 300,
          letterSpacing: '-0.02em', lineHeight: 1.15,
          color: '#FFFFFF', fontFamily: 'Courier New, monospace',
          marginBottom: '1.5rem',
        }}>{line2}</div>

        <p style={{
          fontSize: 'clamp(1rem, 1.8vw, 1.25rem)',
          fontWeight: 300,
          fontStyle: 'italic',
          color: '#9ca3af',
          lineHeight: 1.6,
          marginBottom: '2rem',
        }}>
          You predict the event, not the traders.
        </p>

        {/* <p style={{
          fontSize: 'clamp(0.82rem, 1.3vw, 0.95rem)', color: '#666666',
          lineHeight: 1.8, margin: '1.5rem 0 2.5rem',
          fontStyle: 'italic', maxWidth: 420,
        }}>
          (Because no one can see what others did —<br />
          you predict the event, not the traders.<br />
          Hence the most accurate prediction market to ever exist.)
        </p> */}

        <ScrambleCTA text="ENTER THE MARKET" />
      </div>

      {/* Right: ASCII sphere */}
      <div style={{ flexShrink: 0, opacity: 0.9 }}>
        <AsciiSphere />
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '0.5px', background: '#333333' }} />
    </section>
  );
}

/* ─── Problem Section ───────────────────────── */

const FLAW_ITEMS = [
  'Direction visible',
  // 'Size visible',
  // 'Timing visible',
  'Wallet history permanent',
  'Smart money identified',
  'Position front-run',
  'Conviction held back',
  // 'Price corrupted',
];

function RedactItem({ text, active, delay }: { text: string; active: boolean; delay: number }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{
        fontFamily: 'Courier New, monospace',
        fontSize: 'clamp(1.1rem, 2.2vw, 1.6rem)',
        fontWeight: 300,
        color: active ? '#888888' : '#FFFFFF',
        letterSpacing: '-0.01em',
        transition: `color 200ms ${delay + 280}ms`,
      }}>{text}</span>
      <span style={{
        position: 'absolute',
        left: 0,
        top: '50%',
        height: '2px',
        background: '#FFFFFF',
        width: active ? '105%' : '0%',
        transition: `width 280ms ease-in ${delay}ms`,
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

function SectionProblem() {
  const { ref, inView } = useInView({ rootMargin: '-40% 0px -40% 0px' });

  return (
    <section id="problem" style={{ padding: 'clamp(5rem,9vw,9rem) clamp(1.5rem,4vw,3rem)', background: '#000000' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, letterSpacing: '0.3em', color: '#FFFFFF', textTransform: 'uppercase', marginBottom: '2.5rem' }}>
          The Problem
        </p>

        <div style={{ marginBottom: '4rem' }}>
          {['Prediction markets don\'t fail', 'because people don\'t know things.', 'They fail because knowing costs you.'].map((l, i) => (
            <div key={i} style={{
              fontSize: 'clamp(1.8rem, 4vw, 3.5rem)', fontWeight: i === 1 ? 500 : 300,
              letterSpacing: '-0.015em', lineHeight: 1.2,
              color: i === 2 ? '#666666' : '#FFFFFF',
            }}>{l}</div>
          ))}
        </div>

        <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '4rem' }}>
          {FLAW_ITEMS.map((item, i) => (
            <RedactItem key={item} text={item} active={inView} delay={i * 80} />
          ))}
        </div>

        <div style={{ maxWidth: 700 }}>
          <p style={{
            fontFamily: 'Courier New, monospace', fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)',
            fontStyle: 'italic', color: '#666666', lineHeight: 1.8, marginBottom: '1rem',
          }}>
            "You don't pick the face you think is most beautiful. You pick the face you think other judges will think is most beautiful."
          </p>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, letterSpacing: '0.2em', color: '#333333' }}>
            — JOHN MAYNARD KEYNES, 1936
          </p>
          <p style={{
            fontSize: 'clamp(0.85rem, 1.5vw, 1rem)', color: '#666666',
            lineHeight: 1.8, marginTop: '2rem',
          }}>
            The <em style={{ fontStyle: 'italic', color: '#FFFFFF' }}>Keynesian beauty contest problem</em> — every prediction market since has had this. Nobody has structurally fixed it.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── The Fix Section ───────────────────────── */

function SectionProof() {
  return (
    <section id="proof" style={{ padding: 'clamp(5rem,9vw,9rem) clamp(1.5rem,4vw,3rem)', background: '#000000' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, letterSpacing: '0.3em', color: '#FFFFFF', textTransform: 'uppercase', marginBottom: '2.5rem' }}>
        The Fix
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Without */}
        <div style={{ border: '1px solid #333333', padding: '2rem' }}>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.25em', color: '#666666', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
            Without Occult
          </p>
          <pre style={{
            fontFamily: 'Courier New, monospace', fontSize: 'clamp(0.65rem, 1.1vw, 0.78rem)',
            color: '#666666', lineHeight: 2, margin: 0, whiteSpace: 'pre-wrap',
          }}>{`trade hits the market
price: 62.5% → 62.9%
direction: YES       `}<span style={{ color: '#FFFFFF' }}>← visible. immediately.</span>{`
size: $862           `}<span style={{ color: '#FFFFFF' }}>← visible. immediately.</span>{`
wallet: permanent record
your next bet: already being watched`}</pre>
        </div>

        {/* With */}
        <div style={{ border: '1px solid #FFFFFF', padding: '2rem' }}>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.25em', color: '#FFFFFF', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
            With Occult
          </p>
          <pre style={{
            fontFamily: 'Courier New, monospace', fontSize: 'clamp(0.65rem, 1.1vw, 0.78rem)',
            color: '#FFFFFF', lineHeight: 2, margin: 0, whiteSpace: 'pre-wrap',
          }}>{`100 trades accumulate silently
price: 62.5% → 58.1%  ← one update. that's all.

`}<span style={{ animation: 'flash-encrypted 0.8s infinite' }}>[ENCRYPTED]</span>{` direction
`}<span style={{ animation: 'flash-encrypted 0.8s infinite', animationDelay: '0.2s' }}>[ENCRYPTED]</span>{` pool composition
`}<span style={{ animation: 'flash-encrypted 0.8s infinite', animationDelay: '0.4s' }}>[ENCRYPTED]</span>{` position history
  `}<span style={{ animation: 'flash-encrypted 0.8s infinite', animationDelay: '0.6s' }}>[ENCRYPTED]</span>{`which trade moved it`}</pre>
        </div>
      </div>
      </div>
    </section>
  );
}

/* ─── How It Works ──────────────────────────── */

function StepItem({ number, title, body }: { number: string; title: string; body: string }) {
  const { ref, inView } = useInView({ threshold: 0.3 });
  const typed = useTypewriter(body, 15, inView);

  return (
    <div ref={ref} style={{ paddingLeft: 48, marginBottom: 60, position: 'relative' }}>
      <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#FFFFFF', marginBottom: '0.5rem' }}>{number}</p>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 400, color: '#FFFFFF', marginBottom: '0.75rem', lineHeight: 1.3 }}>{title}</h3>
      <p style={{ fontFamily: 'Courier New, monospace', fontSize: '0.82rem', color: '#666666', lineHeight: 1.9, minHeight: '3.5em' }}>
        {typed.text}{!typed.done && inView ? <span style={{ animation: 'blink-cursor 0.2s steps(1) infinite' }}>_</span> : null}
      </p>
    </div>
  );
}

function SectionHowItWorks() {
  const steps = [
    { number: '01', title: 'You encrypt your bet in the browser.', body: 'Direction. Amount. Sealed before it leaves your device. The network never sees plaintext. Not even for a millisecond.' },
    { number: '02', title: 'It enters the pool. Silently.', body: 'The pool updates homomorphically — addition on ciphertexts. The contract processes what it cannot read. No price movement. No signal. Nothing to trade against.' },
    { number: '03', title: 'Tens of trades later — one number surfaces.', body: 'A single threshold decryption. The new probability, computed from the aggregate of everything that happened. Individual trades: permanently dissolved into the collective.' },
    { number: '04', title: 'Your direction never left your browser. The pool never spoke.', body: 'On-chain record: a bet happened, from this address, at this time. That is the complete record. Forever.' },
  ];

  return (
    <section id="how-it-works" style={{ padding: 'clamp(5rem,9vw,9rem) clamp(1.5rem,4vw,3rem)', background: '#000000', borderTop: '1px solid #333333' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, letterSpacing: '0.3em', color: '#FFFFFF', textTransform: 'uppercase', marginBottom: '2.5rem' }}>
          The Mechanism
        </p>
        <div style={{ fontSize: 'clamp(1.8rem, 4vw, 3.5rem)', fontWeight: 300, letterSpacing: '-0.015em', color: '#FFFFFF', marginBottom: '4rem' }}>
          How It Works
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 80px' }}>
          {steps.map(s => <StepItem key={s.number} {...s} />)}
        </div>
      </div>
    </section>
  );
}

/* ─── Fhenix Section ────────────────────────── */

function FhenixTitle() {
  const { ref, inView } = useInView({ threshold: 0.3 });
  const text = useScramble('Built on Fhenix CoFHE', 900, inView);
  return (
    <div ref={ref} style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 300, letterSpacing: '-0.01em', color: '#FFFFFF', marginBottom: '1.25rem' }}>
      {text}
    </div>
  );
}

function SectionFhenix() {
  return (
    <section id="fhenix" style={{ padding: 'clamp(5rem,9vw,9rem) clamp(1.5rem,4vw,3rem)', background: '#000000', borderTop: '1px solid #333333' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, letterSpacing: '0.3em', color: '#FFFFFF', textTransform: 'uppercase', marginBottom: '2.5rem' }}>
        Foundation
      </p>

      <div style={{ border: '1px solid #333333', padding: '2rem 2.5rem', maxWidth: 700 }}>
        <FhenixTitle />
        <p style={{ fontFamily: 'Courier New, monospace', fontSize: '0.82rem', color: '#666666', lineHeight: 1.9, marginBottom: '1.5rem' }}>
          Fully Homomorphic Encryption — the only cryptographic primitive where computation happens on ciphertexts. No hardware trust. No interactivity required. Mathematically guaranteed.
        </p>
        <a
          href="https://fhenix.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'Courier New, monospace', fontSize: 12, letterSpacing: '0.1em',
            color: '#FFFFFF', textDecoration: 'none', borderBottom: '1px solid #666666',
            paddingBottom: 2, transition: 'border-color 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#FFFFFF')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#666666')}
        >fhenix.io →</a>
      </div>
      </div>
    </section>
  );
}

/* ─── CTA Section ───────────────────────────── */

function SectionCTA() {
  const { ref, inView } = useInView({ threshold: 0.3 });
  const line = useScramble('The market is open.', 700, inView);

  return (
    <section style={{
      minHeight: '80vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(4rem,8vw,8rem) clamp(1.5rem,6vw,6rem)',
      textAlign: 'center', background: '#000000', borderTop: '1px solid #333333',
    }}>
      <div ref={ref} style={{
        fontSize: 'clamp(2.5rem, 6vw, 5.5rem)', fontWeight: 300,
        letterSpacing: '-0.02em', color: '#FFFFFF',
        fontFamily: 'Courier New, monospace', marginBottom: '2.5rem',
      }}>{line}</div>

      <ScrambleCTA text="ENTER THE MARKET" />

      <p style={{
        fontFamily: 'Courier New, monospace', fontSize: 11,
        letterSpacing: '0.2em', color: '#333333', marginTop: '2.5rem',
      }}>OCCULT MARKETS · ARBITRUM SEPOLIA · WAVE 2</p>
    </section>
  );
}

/* ─── Root ──────────────────────────────────── */

export default function LandingPage() {
  return (
    <div style={{ background: '#000000', color: '#FFFFFF', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink-cursor { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes flash-encrypted { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>
      <Nav />
      <Hero />
      <SectionProblem />
      <SectionProof />
      <SectionHowItWorks />
      <SectionFhenix />
      <SectionCTA />
    </div>
  );
}
