"use client";

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({
  children,
  className = '',
  delay = 0,
  style = {},
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  style?: React.CSSProperties
}) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Nav() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  const navLinks = [
    { label: 'Problem', href: '#problem' },
    { label: 'The Fix', href: '#proof' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Built on Fhenix', href: '#fhenix' },
  ]

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      height: 56,
      background: 'rgba(8,8,8,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 clamp(1.5rem, 4vw, 3rem)',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        opacity: loaded ? 1 : 0,
        transform: loaded ? 'translateX(0)' : 'translateX(-20px)',
        transition: 'opacity 300ms ease-out, transform 300ms ease-out',
      }}>
        <span style={{
          fontSize: 13,
          letterSpacing: '0.35em',
          fontWeight: 500,
          color: '#ffffff',
        }}>OCCULT</span>
        <span style={{
          color: '#DC2626',
          fontSize: 10,
          animation: 'heartbeat 1.5s ease-in-out infinite',
        }}>●</span>
      </div>

      <div style={{
        display: 'flex',
        gap: '2.5rem',
        opacity: loaded ? 1 : 0,
        transform: loaded ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity 300ms ease-out 80ms, transform 300ms ease-out 80ms',
      }}>
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            style={{
              fontSize: 13,
              letterSpacing: '0.12em',
              color: '#6b7280',
              textDecoration: 'none',
              transition: 'color 200ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          >
            {link.label}
          </a>
        ))}
      </div>

      <Link href="/app">
        <button
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'translateX(0)' : 'translateX(20px)',
            transition: 'opacity 300ms ease-out 160ms, transform 300ms ease-out 160ms, background 150ms, color 150ms, border-color 150ms',
            background: '#ffffff',
            color: '#000000',
            border: '1px solid #ffffff',
            borderRadius: 0,
            padding: '7px 18px',
            fontSize: 13,
            letterSpacing: '0.08em',
            fontWeight: 500,
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget
            b.style.background = '#000000'
            b.style.color = '#ffffff'
            b.style.borderColor = '#ffffff'
          }}
          onMouseLeave={e => {
            const b = e.currentTarget
            b.style.background = '#ffffff'
            b.style.color = '#000000'
            b.style.borderColor = '#ffffff'
          }}
        >
          Launch App →
        </button>
      </Link>
    </nav>
  )
}

function HeroButton({ children, primary }: { children: React.ReactNode; primary: boolean }) {
  const [hovered, setHovered] = useState(false)

  const base: React.CSSProperties = {
    borderRadius: 0,
    padding: '14px 32px',
    fontSize: 14,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'background 150ms, color 150ms, border-color 150ms',
    fontWeight: 400,
  }

  const style: React.CSSProperties = primary
    ? {
        ...base,
        background: hovered ? '#DC2626' : '#ffffff',
        color: hovered ? '#ffffff' : '#000000',
        border: `1px solid ${hovered ? '#DC2626' : '#ffffff'}`,
      }
    : {
        ...base,
        background: 'transparent',
        color: '#ffffff',
        border: `1px solid ${hovered ? '#ffffff' : 'rgba(255,255,255,0.2)'}`,
      }

  return (
    <button
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

function Hero() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const lines = [
    'Finally, the price reflects',
    'what people actually believe about the market.',
  ]

  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(2rem, 5vw, 4rem)',
      paddingTop: '80px',
      textAlign: 'center',
      position: 'relative',
    }}>
      <div style={{
        height: 1,
        background: '#DC2626',
        width: phase >= 1 ? 60 : 0,
        transition: 'width 800ms ease-out',
        marginBottom: '2rem',
      }} />

      <div style={{ maxWidth: 860 }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: phase >= 2 ? 'translateY(0)' : 'translateY(12px)',
              transition: `opacity 400ms ease-out ${i * 120}ms, transform 400ms ease-out ${i * 120}ms`,
              fontSize: 'clamp(2.4rem, 5.5vw, 5rem)',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: '#ffffff',
            }}
          >
            {line}
          </div>
        ))}

        <div style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translateY(0)' : 'translateY(12px)',
          transition: `opacity 400ms ease-out ${3 * 120}ms, transform 400ms ease-out ${3 * 120}ms`,
        }}>
          <div style={{ height: 32 }} />
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            fontWeight: 300,
            fontStyle: 'italic',
            color: '#9ca3af',
            lineHeight: 1.6,
          }}>
            Not what they believe other traders believe.
          </p>

          <div style={{ height: 24 }} />
          <p style={{
            fontSize: '0.875rem',
            letterSpacing: '0.05em',
            color: '#6b7280',
            lineHeight: 1.8,
            maxWidth: 580,
            margin: '0 auto',
          }}>
            (Because no one can see what others did —<br />
            you predict the event, not the traders.<br />
            Hence the most accurate prediction market to ever exist.)
          </p>

          <div style={{ height: 48 }} />
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/app">
              <HeroButton primary>Enter the Market</HeroButton>
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: 0,
                padding: '14px 32px',
                fontSize: 14,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                transition: 'all 150ms',
                fontWeight: 400,
                background: '#1f2937',
                color: '#ffffff',
                border: '1px solid #374151',
                textDecoration: 'none',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.background = '#111827'
                el.style.borderColor = '#4b5563'
                el.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.background = '#1f2937'
                el.style.borderColor = '#374151'
                el.style.transform = 'scale(1)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'flex', alignItems: 'center' }}>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Read the Architecture
            </a>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '0.5px',
        background: 'rgba(255,255,255,0.1)',
      }} />
    </section>
  )
}

function Ticker() {
  const items = [
    'Direction visible',
    'Size visible',
    'Timing visible',
    'Wallet history permanent',
    'Smart money identified',
    'Position front-run',
    'Conviction held back',
    'Price corrupted',
  ]

  const [paused, setPaused] = useState(false)
  const content = [...items, ...items]

  return (
    <div
      style={{ overflow: 'hidden', width: '100%', cursor: 'default' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{
        display: 'flex',
        whiteSpace: 'nowrap',
        animation: 'tickerScroll 30s linear infinite',
        animationPlayState: paused ? 'paused' : 'running',
      }}>
        {content.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span style={{
              fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
              fontWeight: 300,
              color: '#374151',
              padding: '0 2rem',
            }}>
              {item}
            </span>
            <span style={{ color: '#DC2626', fontSize: 'clamp(1.2rem, 2.5vw, 2rem)' }}>|</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function SectionProblem() {
  return (
    <section id="problem" style={{ padding: 'clamp(6rem, 10vw, 10rem) clamp(1.5rem, 6vw, 6rem)', background: '#080808' }}>
      <Reveal>
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          letterSpacing: '0.3em',
          color: '#DC2626',
          textTransform: 'uppercase',
          marginBottom: '2.5rem',
        }}>
          The Problem
        </p>

        <div style={{ maxWidth: 720, marginBottom: '5rem' }}>
          <span style={{
            display: 'block',
            fontSize: 'clamp(2rem, 4.5vw, 3.8rem)',
            fontWeight: 300,
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
            color: '#ffffff',
          }}>
            Prediction markets don't fail
          </span>
          <span style={{
            display: 'block',
            fontSize: 'clamp(2rem, 4.5vw, 3.8rem)',
            fontWeight: 500,
            letterSpacing: '-0.015em',
            lineHeight: 1.15,
            color: '#ffffff',
          }}>
            because people don't know things.
          </span>
          <span style={{
            display: 'block',
            fontSize: 'clamp(2rem, 4.5vw, 3.8rem)',
            fontWeight: 300,
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
            color: '#6b7280',
          }}>
            They fail because knowing costs you.
          </span>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <Ticker />
      </Reveal>

      <div style={{ height: 80 }} />

      <Reveal delay={150}>
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
          <p style={{
            fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)',
            fontStyle: 'italic',
            color: '#9ca3af',
            lineHeight: 1.8,
            marginBottom: '1.25rem',
          }}>
            "You don't pick the face you think is most beautiful.
            You pick the face you think other judges will think is most beautiful."
          </p>
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 12,
            letterSpacing: '0.2em',
            color: '#4b5563',
            marginBottom: '2rem',
          }}>
            — JOHN MAYNARD KEYNES, 1936
          </p>
          <p style={{ fontSize: '1rem', color: '#6b7280', lineHeight: 1.7 }}>
            The <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Keynesian beauty contest problem</span> — every prediction market since has had this. Nobody has structurally fixed it.
          </p>
        </div>
      </Reveal>
    </section>
  )
}

function SectionProof() {
  return (
    <section id="proof" style={{ padding: 'clamp(6rem, 10vw, 10rem) clamp(1.5rem, 6vw, 6rem)', background: '#080808' }}>
      <Reveal>
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          letterSpacing: '0.3em',
          color: '#DC2626',
          textTransform: 'uppercase',
          marginBottom: '2.5rem',
        }}>
          The Fix
        </p>
      </Reveal>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        maxWidth: 900,
      }}>
        <Reveal delay={0}>
          <div style={{ background: '#111111', padding: '2rem', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
            <p style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 11,
              letterSpacing: '0.2em',
              color: '#7f1d1d',
              textTransform: 'uppercase',
              marginBottom: '1.5rem',
            }}>
              Without Occult
            </p>
            <pre style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
              color: '#9ca3af',
              lineHeight: 2,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>{`trade hits the market
price: 62.5% → 62.9%
direction: YES       `}<span style={{ color: '#DC2626' }}>{`← visible. immediately.`}</span>{`
size: $862           `}<span style={{ color: '#DC2626' }}>{`← visible. immediately.`}</span>{`
wallet: permanent record
your next bet: already being watched`}</pre>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div style={{ background: '#111111', padding: '2rem', borderTop: '0.5px solid #DC2626' }}>
            <p style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 11,
              letterSpacing: 0.2,
              color: '#9ca3af',
              textTransform: 'uppercase',
              marginBottom: '1.5rem',
            }}>
              With Occult
            </p>
            <pre style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
              color: '#9ca3af',
              lineHeight: 2,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}>{`100 trades accumulate silently
price: 62.5% → 58.1%  ← one update. that's all.
a bet happened. that's all anyone knows.

`}<span style={{ color: '#DC2626' }}>{`✗ direction`}</span>{`
`}<span style={{ color: '#DC2626' }}>{`✗ which trade moved it`}</span>{`
`}<span style={{ color: '#DC2626' }}>{`✗ position history`}</span>{`
`}<span style={{ color: '#DC2626' }}>{`✗ pool composition`}</span></pre>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function SectionHowItWorks() {
  const [lineHeight, setLineHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTimeout(() => {
            if (lineRef.current) {
              setLineHeight(lineRef.current.scrollHeight)
            }
          }, 0)
        }
      },
      { threshold: 0.2 }
    )
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  const steps = [
    {
      number: '01',
      title: 'You encrypt your bet in the browser.',
      body: 'Direction. Amount. Sealed before it leaves your device. The network never sees plaintext. Not even for a millisecond.',
    },
    {
      number: '02',
      title: 'It enters the pool. Silently.',
      body: 'The pool updates homomorphically — addition on ciphertexts. The contract processes what it cannot read. No price movement. No signal. Nothing to trade against.',
    },
    {
      number: '03',
      title: 'Tens of trades later — one number surfaces.',
      body: 'A single threshold decryption. The new probability, computed from the aggregate of everything that happened. Individual trades: permanently dissolved into the collective.',
    },
    {
      number: '04',
      title: 'Your direction never left your browser. The pool never spoke.',
      body: 'On-chain record: a bet happened, from this address, at this time. That is the complete record. Forever.',
      isLast: true,
    },
  ]

  return (
    <section id="how-it-works" style={{ padding: 'clamp(6rem, 10vw, 10rem) clamp(1.5rem, 6vw, 6rem)', background: '#0d0d0d' }}>
      <Reveal>
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          letterSpacing: '0.3em',
          color: '#DC2626',
          textTransform: 'uppercase',
          marginBottom: '2.5rem',
        }}>
          The Mechanism
        </p>
        <div style={{
          fontSize: 'clamp(2rem, 4.5vw, 3.8rem)',
          fontWeight: 300,
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
          color: '#ffffff',
          marginBottom: '6rem',
        }}>
          How It Works
        </div>
      </Reveal>

      <div ref={containerRef} style={{ maxWidth: 560, position: 'relative' }}>
        <div
          ref={lineRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '1px',
            background: 'rgba(255,255,255,0.08)',
            height: lineHeight ? '100%' : 0,
            transition: 'height 800ms ease-out',
            display: 'none',
          }}
          className="desktop-line"
        />

        {steps.map((step, i) => (
          <Reveal key={step.number} delay={i * 150}>
            <div style={{ paddingLeft: '48px', marginBottom: i < steps.length - 1 ? '64px' : 0, position: 'relative' }}>
              <p style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 11,
                color: '#DC2626',
                marginBottom: '0.5rem',
              }}>
                {step.number}
              </p>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: step.isLast ? 500 : 400,
                color: '#ffffff',
                marginBottom: '0.75rem',
                lineHeight: 1.3,
              }}>
                {step.title}
              </h3>
              <p style={{
                fontSize: '0.9rem',
                color: '#6b7280',
                lineHeight: 1.8,
              }}>
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .desktop-line { display: block !important; }
          .mobile-bullet { display: none !important; }
        }
        @media (max-width: 767px) {
          .desktop-line { display: none !important; }
          .mobile-bullet { display: inline-block !important; margin-right: 0.5rem; color: #DC2626; }
        }
      `}</style>
    </section>
  )
}

function SectionFhenix() {
  return (
    <section id="fhenix" style={{ padding: 'clamp(6rem, 10vw, 10rem) clamp(1.5rem, 6vw, 6rem)', background: '#080808' }}>
      <Reveal>
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          letterSpacing: '0.3em',
          color: '#DC2626',
          textTransform: 'uppercase',
          marginBottom: '2.5rem',
        }}>
          Foundation
        </p>

        <div style={{
          fontSize: 'clamp(1.8rem, 3.5vw, 3rem)',
          fontWeight: 300,
          letterSpacing: '-0.01em',
          marginBottom: '2rem',
          color: '#ffffff',
        }}>
          Built on <span style={{ color: '#00D4D4' }}>Fhenix</span> CoFHE
        </div>

        <p style={{
          fontSize: 'clamp(0.95rem, 1.8vw, 1.1rem)',
          fontWeight: 300,
          color: '#6b7280',
          lineHeight: 1.8,
          maxWidth: 600,
          marginBottom: '2rem',
        }}>
          Fully Homomorphic Encryption — the only cryptographic primitive where computation happens on ciphertexts. No hardware trust. No interactivity required. Mathematically guaranteed.
        </p>

        <a
          href="https://fhenix.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 13,
            letterSpacing: '0.1em',
            color: '#00D4D4',
            textDecoration: 'none',
            borderBottom: '0.5px solid #00D4D4',
            paddingBottom: 2,
            transition: 'opacity 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          fhenix.io →
        </a>
      </Reveal>
    </section>
  )
}

function CTAButton() {
  const [hovered, setHovered] = useState(false)
  return (
    <Link href="/app">
      <button
        style={{
          background: hovered ? '#DC2626' : '#ffffff',
          color: hovered ? '#ffffff' : '#000000',
          border: `1px solid ${hovered ? '#DC2626' : '#ffffff'}`,
          borderRadius: 0,
          padding: '14px 48px',
          fontSize: 14,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          transition: 'background 150ms, color 150ms, border-color 150ms',
          fontWeight: 400,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        Enter the Market
      </button>
    </Link>
  )
}

function SectionCTA() {
  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(4rem, 8vw, 8rem) clamp(1.5rem, 6vw, 6rem)',
      textAlign: 'center',
      background: '#080808',
      borderTop: '0.5px solid rgba(255,255,255,0.06)',
    }}>
      <Reveal>
        <div style={{
          fontSize: 'clamp(3rem, 7vw, 6rem)',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          color: '#ffffff',
          marginBottom: '3rem',
        }}>
          The market is open.
        </div>

        <CTAButton />

        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 12,
          letterSpacing: '0.2em',
          color: '#374151',
          marginTop: '2.5rem',
        }}>
          OCCULT MARKETS · ARBITRUM SEPOLIA · WAVE 2
        </p>
      </Reveal>
    </section>
  )
}

export default function App() {
  return (
    <div style={{
      background: '#080808',
      color: '#ffffff',
      minHeight: '100vh',
      overflowX: 'hidden',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes heartbeat {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        pre { tab-size: 2; }
        a { transition: opacity 150ms; }
      `}</style>
      <Nav />
      <Hero />
      <SectionProblem />
      <SectionProof />
      <SectionHowItWorks />
      <SectionFhenix />
      <SectionCTA />
    </div>
  )
}
