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
    <div className="app-shell">
      <nav className="app-nav">
        <div className="nav-inner">
          <span className="nav-logo">
            OCCULT<span className="nav-cursor">_</span>
          </span>
          <WalletButton />
        </div>
      </nav>

      <main className="markets-container">
        {count === 0 ? (
          <div className="empty-state">no markets yet.</div>
        ) : (
          <div className="markets-grid">
            {Array.from({ length: count }, (_, i) => (
              <MarketCard key={i} marketId={BigInt(i)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
