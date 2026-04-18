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

// Unified Overrides for Arbitrum Sepolia & CoFHE simulation bypass
const GAS_PARAMS = {
  gas: BigInt(2000000),
  maxFeePerGas: BigInt(30000000),
  maxPriorityFeePerGas: BigInt(30000000),
};

type UpdateStep = "idle" | "requesting" | "publishing" | "done";
type ClaimStep  = "idle" | "requesting" | "decrypting" | "fading" | "revealed" | "submitting" | "done";

export function MarketCard({ marketId }: Props) {
  const [showBetModal, setShowBetModal]       = useState(false);
  const [showClaimModal, setShowClaimModal]   = useState(false);
  const [claimStep, setClaimStep]             = useState<ClaimStep>("idle");
  const [payoutAmount, setPayoutAmount]       = useState("");
  const [claimDecryptedValue, setClaimDecryptedValue] = useState<bigint>(0n);
  const [claimSignature, setClaimSignature]   = useState<`0x${string}`>("0x");
  const [updateStep, setUpdateStep]           = useState<UpdateStep>("idle");
  const [updateElapsed, setUpdateElapsed]     = useState(0);
  const [updatePriceDelta, setUpdatePriceDelta] = useState("");
  const [tradeCount, setTradeCount]           = useState(0);
  const [mounted, setMounted]                 = useState(false);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!market) {
    return (
      <div className="market-card loading">
        <div className="skeleton" />
      </div>
    );
  }

  const [question, resolutionTime, currentPrice, lastPriceUpdate, resolved, outcome, priceUpdatePending, yesSnap, noSnap] = market;

  const nowSec    = BigInt(Math.floor(Date.now() / 1000));
  const canUpdate = !resolved && !priceUpdatePending && nowSec >= (lastPriceUpdate + BigInt(0));
  const yesProb   = currentPrice / 10;

  // Full update: requestPriceUpdate → decrypt → publish → finalize
  const handleFullUpdate = async () => {
    if (!publicClient || !walletClient) return;
    const prevYesProb = yesProb;

    try {
      setUpdateStep("requesting");
      const startTime = Date.now();
      elapsedRef.current = setInterval(() => {
        setUpdateElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      const reqTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "requestPriceUpdate",
        args: [marketId],
        ...GAS_PARAMS,
      });
      await publicClient.waitForTransactionReceipt({ hash: reqTx });

      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
      setUpdateElapsed(0);
      setUpdateStep("publishing");

      // Refetch to get fresh snapshots after requestPriceUpdate
      const freshData = await refetch();
      const freshMarket = freshData.data;
      if (!freshMarket) return;
      const [, , , , , , , freshYesSnap, freshNoSnap] = freshMarket;

      const yesRes = await decryptHandle(freshYesSnap, publicClient, walletClient);
      const noRes  = await decryptHandle(freshNoSnap,  publicClient, walletClient);

      const publishTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "publishPriceUpdate",
        args: [marketId, yesRes.decryptedValue, yesRes.signature, noRes.decryptedValue, noRes.signature],
        ...GAS_PARAMS,
      });
      await publicClient.waitForTransactionReceipt({ hash: publishTx });

      const finalizeTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "finalizePrice",
        args: [marketId],
        ...GAS_PARAMS,
      });
      await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

      const newData = await refetch();
      const newYesProb = newData.data ? Number(newData.data[2]) / 10 : prevYesProb;
      setUpdatePriceDelta(`${prevYesProb.toFixed(1)}% → ${newYesProb.toFixed(1)}%`);
      setUpdateStep("done");
      setTimeout(() => { setUpdateStep("idle"); setUpdateElapsed(0); }, 2000);
    } catch (err) {
      console.error("Failed to update price", err);
      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
      setUpdateStep("idle");
      setUpdateElapsed(0);
    }
  };

  // Decrypt-only: for when requestPriceUpdate was already called (priceUpdatePending = true)
  const handleDecryptOnly = async () => {
    if (!publicClient || !walletClient) return;
    const prevYesProb = yesProb;

    try {
      setUpdateStep("publishing");

      const yesRes = await decryptHandle(yesSnap, publicClient, walletClient);
      const noRes  = await decryptHandle(noSnap,  publicClient, walletClient);

      const publishTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "publishPriceUpdate",
        args: [marketId, yesRes.decryptedValue, yesRes.signature, noRes.decryptedValue, noRes.signature],
        ...GAS_PARAMS,
      });
      await publicClient.waitForTransactionReceipt({ hash: publishTx });

      const finalizeTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "finalizePrice",
        args: [marketId],
        ...GAS_PARAMS,
      });
      await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

      const newData = await refetch();
      const newYesProb = newData.data ? Number(newData.data[2]) / 10 : prevYesProb;
      setUpdatePriceDelta(`${prevYesProb.toFixed(1)}% → ${newYesProb.toFixed(1)}%`);
      setUpdateStep("done");
      setTimeout(() => { setUpdateStep("idle"); }, 2000);
    } catch (err) {
      console.error("Failed to finalize price", err);
      setUpdateStep("idle");
    }
  };

  // Claim: requestClaim → decrypt → reveal payout amount
  const handleClaimDecrypt = async () => {
    if (!publicClient || !walletClient || !address || !position) return;

    try {
      if (!position[3]) {
        setClaimStep("requesting");
        const tx = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: OCCULT_MARKET_ABI,
          functionName: "requestClaim",
          args: [marketId],
          ...GAS_PARAMS,
        });
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

      // Cinematic reveal: fading → revealed
      setClaimStep("fading");
      setTimeout(() => setClaimStep("revealed"), 700);
    } catch (err) {
      console.error("Claim decrypt failed", err);
      setShowClaimModal(false);
      setClaimStep("idle");
    }
  };

  // Claim submit: publishClaim → finalizeClaim
  const handleClaimSubmit = async () => {
    if (!publicClient || !walletClient || !address || !claimDecryptedValue) return;

    try {
      setClaimStep("submitting");

      const publishTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "publishClaim",
        args: [marketId, address, claimDecryptedValue, claimSignature],
        ...GAS_PARAMS,
      });
      await publicClient.waitForTransactionReceipt({ hash: publishTx });

      const finalizeTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "finalizeClaim",
        args: [marketId],
        ...GAS_PARAMS,
      });
      await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

      setClaimStep("done");
      refetchPos();
      setTimeout(() => { setShowClaimModal(false); setClaimStep("idle"); }, 1500);
    } catch (err) {
      console.error("Claim submit failed", err);
      setClaimStep("revealed");
    }
  };

  const openClaimModal = () => {
    setShowClaimModal(true);
    setClaimStep("idle");
    handleClaimDecrypt();
  };

  const closeClaimModal = () => {
    setShowClaimModal(false);
    setClaimStep("idle");
  };

  return (
    <div className={`market-card ${resolved ? "resolved" : ""} ${priceUpdatePending && updateStep === "idle" ? "pending-sync" : ""}`}>
      {resolved && <div className={`resolved-bar ${outcome ? "yes" : "no"}`} />}

      {/* Top row */}
      <div className="card-top">
        <p className="market-question">{question}</p>
        <span className="time-remaining">
          {resolved
            ? outcome ? "RESOLVED — YES" : "RESOLVED — NO"
            : timeRemaining(resolutionTime)}
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

      {/* FHE heartbeat */}
      <div className="fhe-indicator">
        <span className="fhe-dot">●</span>
        pool encrypted — {tradeCount} trades since last update
      </div>

      {/* Update status panel */}
      {updateStep !== "idle" && (
        <div className={`update-panel ${updateStep === "done" ? "done" : ""}`}>
          {updateStep === "requesting" && (
            <>
              <span className="fhe-dot">●</span>
              <span>requesting threshold decryption...</span>
              <span className="update-elapsed">[{updateElapsed}s]</span>
            </>
          )}
          {updateStep === "publishing" && (
            <>
              <span className="fhe-dot">●</span>
              <span>proof received — publishing on-chain...</span>
            </>
          )}
          {updateStep === "done" && (
            <>
              <span className="update-check">✓</span>
              <span>price updated &nbsp;{updatePriceDelta}</span>
            </>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="card-bottom">
        <span className="market-id">Market #{marketId.toString()}</span>
        <div className="card-actions">
          {!resolved && (
            <button className="btn-place-bet" onClick={() => setShowBetModal(true)}>
              Place Bet
            </button>
          )}
          {!resolved && canUpdate && updateStep === "idle" && (
            <button className="btn-update-price" onClick={handleFullUpdate}>
              Update Price
            </button>
          )}
          {!resolved && priceUpdatePending && updateStep === "idle" && (
            <span className="syncing-indicator" onClick={handleDecryptOnly}>
              <span className="spin-glyph">⟳</span> syncing...
            </span>
          )}
          {resolved && position?.[2] && !position?.[4] && (
            <button className="btn-claim" onClick={openClaimModal}>
              CLAIM
            </button>
          )}
          {resolved && position?.[4] && (
            <span className="claimed-badge">Payout Claimed</span>
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
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeClaimModal(); }}
        >
          <div className="modal-box">
            <p className="modal-market-question">
              {outcome ? "Market resolved — YES won" : "Market resolved — NO won"}
            </p>

            {(claimStep === "idle" || claimStep === "requesting") && (
              <div className="claim-decrypting">
                <span className="fhe-dot">●</span>
                <span>requesting claim...</span>
                <span className="spin-glyph">⟳</span>
              </div>
            )}
            {claimStep === "decrypting" && (
              <div className="claim-decrypting">
                <span className="enc-label">[encrypted]</span>
                <span className="spin-glyph">⟳</span>
              </div>
            )}
            {claimStep === "fading" && (
              <div className="claim-decrypting">
                <span className="enc-label-fading">[encrypted]</span>
              </div>
            )}
            {(claimStep === "revealed" || claimStep === "submitting" || claimStep === "done") && (
              <div className="claim-revealed">
                <span className="payout-amount">{payoutAmount}</span>
                <span className="payout-eth">ETH</span>
              </div>
            )}

            {claimStep === "revealed" && (
              <button className="btn-claim-submit" onClick={handleClaimSubmit}>
                Claim {payoutAmount} ETH
              </button>
            )}
            {claimStep === "submitting" && (
              <button className="btn-claim-submit shimmer" disabled>
                Confirming...
              </button>
            )}
            {claimStep === "done" && (
              <button className="btn-claim-submit" disabled>
                Claimed ✓
              </button>
            )}

            {(claimStep === "idle" || claimStep === "requesting" || claimStep === "decrypting" || claimStep === "fading") && (
              <button className="btn-claim-close" onClick={closeClaimModal}>
                cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
