"use client";
import { useReadContract } from "wagmi";
import { OCCULT_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { MarketCard } from "@/components/MarketCard";
import { WalletButton } from "@/components/WalletButton";

export default function Home() {
  const { data: marketCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    functionName: "marketCount",
    query: { refetchInterval: 10_000 },
  });

  const count = Number(marketCount ?? 0n);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-group">
            <h1 className="logo">Occult Markets</h1>
            <span className="tagline">
              Finally, the price reflects what people actually believe.
            </span>
          </div>
          <WalletButton />
        </div>

        <div className="header-explainer">
          <div className="explainer-item">
            <span className="explainer-icon">🔒</span>
            <span>Pool state encrypted</span>
          </div>
          <div className="explainer-item">
            <span className="explainer-icon">⛔</span>
            <span>No trade signal between updates</span>
          </div>
          <div className="explainer-item">
            <span className="explainer-icon">🧠</span>
            <span>Meta-game structurally impossible</span>
          </div>
        </div>
      </header>

      <main className="markets-container">
        {count === 0 ? (
          <div className="empty-state">
            <p>No markets deployed yet.</p>
            <p className="empty-note">
              Deploy the contract and run the deploy script to create the first market.
            </p>
          </div>
        ) : (
          <div className="markets-grid">
            {Array.from({ length: count }, (_, i) => (
              <MarketCard key={i} marketId={BigInt(i)} />
            ))}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Built on{" "}
          <a href="https://fhenix.io" target="_blank" rel="noreferrer">Fhenix</a>
          {" "}using CoFHE — Fully Homomorphic Encryption.
        </p>
        <p className="footer-note">Wave 1 — Fhenix Privacy-by-Design Buildathon</p>
      </footer>
    </div>
  );
}
