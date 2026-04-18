"use client";
import { useState, useEffect, useRef } from "react";
import {
  useReadContract,
  useWriteContract,
  usePublicClient,
  useWalletClient,
  useAccount,
  useWatchContractEvent,
} from "wagmi";
import { formatEther } from "viem";
import { OCCULT_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, priceToPercent, timeRemaining } from "@/lib/config";
import { BetForm } from "./BetForm";
import { decryptHandle } from "@/lib/cofhe";

interface Props { marketId: bigint }

const GAS_PARAMS = {
  gas: BigInt(2000000),
  maxFeePerGas: BigInt(30000000),
  maxPriorityFeePerGas: BigInt(30000000),
};

type UpdateStep = "idle" | "requesting" | "publishing" | "done";
type ClaimStep  = "idle" | "requesting" | "decrypting" | "pause" | "hexcycle" | "revealed" | "submitting" | "done";

/* Typewriter component — types text from scratch on mount */
function TypedText({ text, speed = 20 }: { text: string; speed?: number }) {
  const [d, setD] = useState("");
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => { setD(text.slice(0, ++i)); if (i >= text.length) clearInterval(t); }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return <>{d}</>;
}

export function MarketCard({ marketId }: Props) {
  const [showBetModal, setShowBetModal]         = useState(false);
  const [showClaimModal, setShowClaimModal]     = useState(false);
  const [claimStep, setClaimStep]               = useState<ClaimStep>("idle");
  const [payoutAmount, setPayoutAmount]         = useState("");
  const [claimDecryptedValue, setClaimDecryptedValue] = useState<bigint>(0n);
  const [claimSignature, setClaimSignature]     = useState<`0x${string}`>("0x");
  const [claimDisplayBlock, setClaimDisplayBlock] = useState("████████████");
  const [updateStep, setUpdateStep]             = useState<UpdateStep>("idle");
  const [updateElapsed, setUpdateElapsed]       = useState(0);
  const [updatePriceDelta, setUpdatePriceDelta] = useState("");
  const [tradeCount, setTradeCount]             = useState(0);
  const [mounted, setMounted]                   = useState(false);
  const [tearing, setTearing]                   = useState(false);

  /* Glitch state for FHE indicator */
  const [glitchText, setGlitchText]             = useState("████████");

  /* DECRYPTING... scramble for pending sync */
  const [decryptDisplay, setDecryptDisplay]     = useState("DECRYPTING...");

  const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const glitchRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const publicClient           = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address }            = useAccount();

  const { data: market, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    functionName: "getMarket",
    args: [marketId],
    query: { refetchInterval: 15_000 },
  });

  const { data: position, refetch: refetchPos } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    functionName: "getPosition",
    args: address ? [marketId, address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { writeContractAsync } = useWriteContract();

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    eventName: "BetPlaced",
    args: { marketId },
    onLogs: (logs) => setTradeCount((c) => c + logs.length),
  });
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    eventName: "PriceUpdated",
    args: { marketId },
    onLogs: () => setTradeCount(0),
  });

  /* Mount animation for price bar */
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  /* FHE indicator glitch: every 3-5s, show hex for 150ms */
  useEffect(() => {
    const HEX = '0123456789ABCDEF';
    const cycle = () => {
      glitchRef.current = setTimeout(() => {
        setGlitchText(Array.from({ length: 8 }, () => HEX[Math.floor(Math.random() * 16)]).join(''));
        glitchRef.current = setTimeout(() => { setGlitchText('████████'); cycle(); }, 150);
      }, 3000 + Math.random() * 2000);
    };
    cycle();
    return () => { if (glitchRef.current) clearTimeout(glitchRef.current); };
  }, []);

  /* DECRYPTING... scramble — active when actively processing or pending */
  const isDecryptingActive = updateStep === "requesting" || updateStep === "publishing";
  const isPriceUpdatePending = market ? market[6] : false;
  
  useEffect(() => {
    const CHARS = '!@#%^&*0123456789ABCDEF/\\[]{}';
    const target = 'DECRYPTING...';
    if (!isDecryptingActive && !(updateStep === "idle" && isPriceUpdatePending)) { 
      setDecryptDisplay(target); 
      return; 
    }
    scrambleRef.current = setInterval(() => {
      setDecryptDisplay(Array.from(target, (c) =>
        Math.random() < 0.25 ? CHARS[Math.floor(Math.random() * CHARS.length)] : c
      ).join(''));
    }, 200);
    return () => { if (scrambleRef.current) clearInterval(scrambleRef.current); setDecryptDisplay(target); };
  }, [isDecryptingActive, isPriceUpdatePending]);

  if (!market) {
    return <div className="market-card loading"><div className="skeleton" /></div>;
  }

  const [question, resolutionTime, currentPrice, lastPriceUpdate, resolved, outcome, priceUpdatePending, yesSnap, noSnap] = market;
  const nowSec    = BigInt(Math.floor(Date.now() / 1000));
  const canUpdate = !resolved && !priceUpdatePending && nowSec >= (lastPriceUpdate + BigInt(0));
  const yesProb   = currentPrice / 10;

  /* ── Update flow ─────────────────────────── */
  const handleFullUpdate = async () => {
    if (!publicClient || !walletClient) return;
    const prevYesProb = yesProb;
    try {
      setUpdateStep("requesting");
      setTearing(true);
      setTimeout(() => setTearing(false), 400);
      const start = Date.now();
      elapsedRef.current = setInterval(() => setUpdateElapsed(Math.floor((Date.now() - start) / 1000)), 1000);

      const reqTx = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI, functionName: "requestPriceUpdate", args: [marketId], ...GAS_PARAMS });
      await publicClient.waitForTransactionReceipt({ hash: reqTx });
      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
      setUpdateElapsed(0);
      setUpdateStep("publishing");

      const freshData = await refetch();
      const freshMarket = freshData.data;
      if (!freshMarket) return;
      const [, , , , , , , freshYesSnap, freshNoSnap] = freshMarket;

      const yesRes = await decryptHandle(freshYesSnap, publicClient, walletClient);
      const noRes  = await decryptHandle(freshNoSnap,  publicClient, walletClient);

      const publishTx = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI, functionName: "publishPriceUpdate", args: [marketId, yesRes.decryptedValue, yesRes.signature, noRes.decryptedValue, noRes.signature], ...GAS_PARAMS });
      await publicClient.waitForTransactionReceipt({ hash: publishTx });
      const finalizeTx = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI, functionName: "finalizePrice", args: [marketId], ...GAS_PARAMS });
      await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

      const newData = await refetch();
      const newYesProb = newData.data ? Number(newData.data[2]) / 10 : prevYesProb;
      setUpdatePriceDelta(`${prevYesProb.toFixed(1)}% → ${newYesProb.toFixed(1)}%`);
      setUpdateStep("done");
      setTimeout(() => { setUpdateStep("idle"); setUpdateElapsed(0); }, 2000);
    } catch (err) {
      console.error("Failed to update price", err);
      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
      setUpdateStep("idle"); setUpdateElapsed(0);
    }
  };

  const handleDecryptOnly = async () => {
    if (!publicClient || !walletClient) return;
    const prevYesProb = yesProb;
    try {
      setUpdateStep("publishing");
      const yesRes = await decryptHandle(yesSnap, publicClient, walletClient);
      const noRes  = await decryptHandle(noSnap,  publicClient, walletClient);
      const publishTx = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI, functionName: "publishPriceUpdate", args: [marketId, yesRes.decryptedValue, yesRes.signature, noRes.decryptedValue, noRes.signature], ...GAS_PARAMS });
      await publicClient.waitForTransactionReceipt({ hash: publishTx });
      const finalizeTx = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI, functionName: "finalizePrice", args: [marketId], ...GAS_PARAMS });
      await publicClient.waitForTransactionReceipt({ hash: finalizeTx });
      const newData = await refetch();
      const newYesProb = newData.data ? Number(newData.data[2]) / 10 : prevYesProb;
      setUpdatePriceDelta(`${prevYesProb.toFixed(1)}% → ${newYesProb.toFixed(1)}%`);
      setUpdateStep("done");
      setTimeout(() => setUpdateStep("idle"), 2000);
    } catch (err) {
      console.error("Failed to finalize price", err);
      setUpdateStep("idle");
    }
  };

  /* ── Claim flow ──────────────────────────── */
  const handleClaimDecrypt = async () => {
    if (!publicClient || !walletClient || !address || !position) return;
    try {
      if (!position[3]) {
        setClaimStep("requesting");
        const tx = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI, functionName: "requestClaim", args: [marketId], ...GAS_PARAMS });
        await publicClient.waitForTransactionReceipt({ hash: tx });
        await refetchPos();
      }
      setClaimStep("decrypting");
      const [yesPos, noPos] = position;
      const winningSnap = outcome ? yesPos : noPos;
      const res = await decryptHandle(winningSnap, publicClient, walletClient);
      setClaimDecryptedValue(res.decryptedValue);
      setClaimSignature(res.signature);
      const ethAmount = parseFloat(formatEther(res.decryptedValue * BigInt(1_000_000_000))).toFixed(4);
      setPayoutAmount(ethAmount);

      /* Cinematic: pause → hexcycle → revealed */
      setClaimStep("pause");
      setTimeout(() => {
        setClaimStep("hexcycle");
        const HEX = '0123456789ABCDEF';
        const start = Date.now();
        const iv = setInterval(() => {
          setClaimDisplayBlock(Array.from({ length: 12 }, () => HEX[Math.floor(Math.random() * 16)]).join(''));
          if (Date.now() - start >= 300) { clearInterval(iv); setClaimStep("revealed"); }
        }, 50);
      }, 400);
    } catch (err) {
      console.error("Claim decrypt failed", err);
      setShowClaimModal(false); setClaimStep("idle");
    }
  };

  const handleClaimSubmit = async () => {
    if (!publicClient || !walletClient || !address || !claimDecryptedValue) return;
    try {
      setClaimStep("submitting");
      const publishTx = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI, functionName: "publishClaim", args: [marketId, address, claimDecryptedValue, claimSignature], ...GAS_PARAMS });
      await publicClient.waitForTransactionReceipt({ hash: publishTx });
      const finalizeTx = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI, functionName: "finalizeClaim", args: [marketId], ...GAS_PARAMS });
      await publicClient.waitForTransactionReceipt({ hash: finalizeTx });
      setClaimStep("done");
      refetchPos();
      setTimeout(() => { setShowClaimModal(false); setClaimStep("idle"); }, 1500);
    } catch (err) {
      console.error("Claim submit failed", err);
      setClaimStep("revealed");
    }
  };

  const openClaimModal = () => { setShowClaimModal(true); setClaimStep("idle"); setClaimDisplayBlock("████████████"); handleClaimDecrypt(); };
  const closeClaimModal = () => { setShowClaimModal(false); setClaimStep("idle"); };

  return (
    <div className={`market-card ${resolved ? "resolved" : ""} ${tearing ? "tearing" : ""}`}>

      {/* Resolved stamp */}
      {resolved && (
        <div className="resolved-stamp-row">
          <span className="resolved-stamp">{outcome ? "RESOLVED / YES" : "RESOLVED / NO"}</span>
        </div>
      )}

      {/* Top row */}
      <div className="card-top">
        <p className="market-question">{question}</p>
        <span className="time-remaining">
          {resolved ? (outcome ? "RESOLVED" : "RESOLVED") : timeRemaining(resolutionTime)}
        </span>
      </div>

      {/* Price bar */}
      <div className="price-bar-labels">
        <span>YES {priceToPercent(currentPrice)}</span>
        <span>NO {priceToPercent(1000 - currentPrice)}</span>
      </div>
      <div className="price-bar-track">
        <div className="price-bar-yes" style={{ width: mounted ? `${yesProb}%` : "0%" }} />
      </div>

      {/* FHE indicator */}
      <div className="fhe-indicator">
        <span className="fhe-glitch">{glitchText}</span>
        {' '}pool encrypted — {tradeCount} trades
      </div>

      {/* Update status panel */}
      {updateStep !== "idle" && (
        <div className="update-panel">
          {(updateStep === "requesting" || updateStep === "publishing" || updateStep === "done") && (
            <div className="update-panel-line">
              <span className="update-caret">&gt;</span>
              <span className="update-text">
                {updateStep === "requesting"
                  ? <><TypedText text="ACTION REQUIRED: Confirm TX 1/2 in wallet (requesting threshold key...)" /> {updateElapsed > 0 && <span style={{ color: '#666666' }}>[{updateElapsed}s]</span>}</>
                  : "TX 1/2 Confirmed (key requested)."}
              </span>
            </div>
          )}
          {(updateStep === "publishing" || updateStep === "done") && (
            <div className="update-panel-line">
              <span className="update-caret">&gt;</span>
              <span className="update-text">
                {updateStep === "publishing"
                  ? <TypedText text="ACTION REQUIRED: Sign prompt to decrypt, then confirm TX 2/2 (publishing proof...)" />
                  : "TX 2/2 Confirmed (proof published)."}
              </span>
            </div>
          )}
          {updateStep === "done" && (
            <div className="update-panel-line">
              <span className="update-caret">&gt;</span>
              <span className="update-text">
                <TypedText text={`price resolved. ${updatePriceDelta}`} />
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="card-bottom">
        <span className="market-id">Market #{marketId.toString()}</span>
        <div className="card-actions">
          {!resolved && (
            <button className="btn-place-bet" onClick={() => setShowBetModal(true)}>Place Bet</button>
          )}
          {!resolved && canUpdate && updateStep === "idle" && (
            <button className="btn-update-price" onClick={handleFullUpdate}>Update Price</button>
          )}
          {!resolved && priceUpdatePending && updateStep === "idle" && (
            <span className="syncing-indicator" onClick={handleDecryptOnly}>
              {decryptDisplay}
            </span>
          )}
          {!resolved && updateStep !== "idle" && (
            <span className="syncing-indicator" style={{ cursor: 'default' }}>
              {decryptDisplay}
            </span>
          )}
          {resolved && position?.[2] && !position?.[4] && (
            <button className="btn-claim" onClick={openClaimModal}>CLAIM</button>
          )}
          {resolved && position?.[4] && (
            <span className="claimed-badge">CLAIMED</span>
          )}
        </div>
      </div>

      {/* Bet Modal */}
      {showBetModal && (
        <BetForm
          marketId={marketId}
          currentPrice={currentPrice}
          question={question}
          onSuccess={() => { setShowBetModal(false); refetch(); refetchPos(); }}
          onClose={() => setShowBetModal(false)}
        />
      )}

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeClaimModal(); }}>
          <div className="modal-box">
            <button className="modal-close" onClick={closeClaimModal}>[ ESC ]</button>

            <p className="modal-market-question">
              {outcome ? "Market resolved — YES won" : "Market resolved — NO won"}
            </p>

            {/* State: waiting / requesting / decrypting */}
            {(claimStep === "idle" || claimStep === "requesting" || claimStep === "decrypting") && (
              <div className="claim-body">
                <span className="claim-block">{claimDisplayBlock}</span>
                <span className="claim-await">&gt; awaiting_threshold_signature</span>
              </div>
            )}

            {/* State: 400ms blackout */}
            {claimStep === "pause" && (
              <div className="claim-body">
                <span className="claim-block">{claimDisplayBlock}</span>
              </div>
            )}

            {/* State: hex cycling */}
            {claimStep === "hexcycle" && (
              <div className="claim-body">
                <span className="claim-block">{claimDisplayBlock}</span>
              </div>
            )}

            {/* State: revealed — instant snap */}
            {(claimStep === "revealed" || claimStep === "submitting" || claimStep === "done") && (
              <div className="claim-body">
                <span className="claim-amount">{payoutAmount}</span>
                <span className="claim-eth">ETH</span>
              </div>
            )}

            {claimStep === "revealed" && (
              <button className="btn-claim-submit" onClick={handleClaimSubmit}>
                INITIATE_TRANSFER
              </button>
            )}
            {claimStep === "submitting" && (
              <button className="btn-claim-submit" disabled>CONFIRMING...</button>
            )}
            {claimStep === "done" && (
              <button className="btn-claim-submit" disabled>TRANSFERRED ✓</button>
            )}

            {(claimStep === "idle" || claimStep === "requesting" || claimStep === "decrypting" || claimStep === "pause" || claimStep === "hexcycle") && (
              <button className="btn-claim-close" onClick={closeClaimModal}>cancel</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
