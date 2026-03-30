"use client";
import { useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWalletClient, useAccount } from "wagmi";
import { OCCULT_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, priceToPercent, timeRemaining } from "@/lib/config";
import { BetForm } from "./BetForm";
import { decryptHandle } from "@/lib/cofhe";

interface Props { marketId: bigint }

export function MarketCard({ marketId }: Props) {
  const [showBetForm, setShowBetForm] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

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

  const { writeContract: reqUpdate, data: reqHash }  = useWriteContract();
  const { writeContractAsync } = useWriteContract();

  useWaitForTransactionReceipt({ hash: reqHash, query: { enabled: !!reqHash } });

  if (!market) {
    return <div className="market-card loading"><div className="skeleton" /></div>;
  }

  const [question, resolutionTime, currentPrice, lastPriceUpdate, resolved, outcome, priceUpdatePending, yesSnap, noSnap] = market;

  const handleDecryptAndFinalize = async () => {
    if (!publicClient || !walletClient) return;
    try {
      setIsDecrypting(true);

      // Step 2: Decrypt off-chain
      const yesRes = await decryptHandle(yesSnap, publicClient, walletClient);
      const noRes = await decryptHandle(noSnap, publicClient, walletClient);

      // Step 3: Publish results on-chain with proofs
      const publishTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "publishPriceUpdate",
        args: [
          marketId,
          Number(yesRes.decryptedValue),
          yesRes.signature,
          Number(noRes.decryptedValue),
          noRes.signature
        ],
      });

      // Simple wait for publish to be mined (in a robust app, use useWaitForTransactionReceipt asynchronously)
      await publicClient.waitForTransactionReceipt({ hash: publishTx });

      // Step 4: Finalize price
      const finalizeTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "finalizePrice",
        args: [marketId],
      });
      await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

      refetch();
    } catch (err) {
      console.error("Failed to decrypt and finalize", err);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDecryptAndClaim = async () => {
    if (!publicClient || !walletClient || !address || !position) return;
    try {
      setIsClaiming(true);
      const [yesPos, noPos, , , ] = position;
      const winningSnap = outcome ? yesPos : noPos;

      const res = await decryptHandle(winningSnap, publicClient, walletClient);

      const publishTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "publishClaim",
        args: [
          marketId,
          address,
          Number(res.decryptedValue),
          res.signature
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: publishTx });

      const finalizeTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: OCCULT_MARKET_ABI,
        functionName: "finalizeClaim",
        args: [marketId],
      });
      await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

      refetchPos();
    } catch (err) {
      console.error("Failed to decrypt and claim", err);
    } finally {
      setIsClaiming(false);
    }
  };

  const nowSec    = BigInt(Math.floor(Date.now() / 1000));
  const canUpdate = !resolved && !priceUpdatePending && nowSec >= lastPriceUpdate + 600n;
  const yesProb   = currentPrice / 10;

  return (
    <div className={`market-card ${resolved ? "resolved" : ""}`}>
      <div className="market-header">
        <h2 className="market-question">{question}</h2>
        <span className={`market-status ${resolved ? "resolved" : "active"}`}>
          {resolved ? (outcome ? "YES" : "NO") : timeRemaining(resolutionTime)}
        </span>
      </div>

      <div className="price-display">
        <div className="price-bar-container">
          <div className="price-bar-yes" style={{ width: `${yesProb}%` }} />
        </div>
        <div className="price-labels">
          <span className="yes-label">YES {priceToPercent(currentPrice)}</span>
          <span className="no-label">NO {priceToPercent(1000 - currentPrice)}</span>
        </div>
      </div>

      <div className="privacy-note">
        Pool state encrypted — no individual trade visible on-chain
      </div>

      {!resolved && (
        <div className="market-actions">
          <button className="btn-primary" onClick={() => setShowBetForm(!showBetForm)}>
            {showBetForm ? "Cancel" : "Place Bet"}
          </button>

          {canUpdate && (
            <button
              className="btn-secondary"
              onClick={() => reqUpdate({
                address: CONTRACT_ADDRESS, abi: OCCULT_MARKET_ABI,
                functionName: "requestPriceUpdate", args: [marketId],
              })}
            >
              Request Price Update
            </button>
          )}

          {priceUpdatePending && (
            <button
              className="btn-secondary"
              onClick={handleDecryptAndFinalize}
              disabled={isDecrypting || !publicClient || !walletClient}
            >
              {isDecrypting ? "Decrypting..." : "Decrypt & Finalize Price"}
            </button>
          )}
        </div>
      )}

      {showBetForm && (
        <BetForm
          marketId={marketId}
          currentPrice={currentPrice}
          onSuccess={() => { setShowBetForm(false); refetch(); refetchPos(); }}
        />
      )}

      {resolved && position && position[2] && (
        <div className="market-actions">
          {!position[3] && !position[4] && (
            <button
              className="btn-primary"
              onClick={async () => {
                const tx = await writeContractAsync({
                  address: CONTRACT_ADDRESS,
                  abi: OCCULT_MARKET_ABI,
                  functionName: "requestClaim",
                  args: [marketId],
                });
                await publicClient?.waitForTransactionReceipt({ hash: tx });
                refetchPos();
              }}
            >
              Request Claim
            </button>
          )}

          {position[3] && !position[4] && (
            <button
              className="btn-secondary"
              onClick={handleDecryptAndClaim}
              disabled={isClaiming || !publicClient || !walletClient}
            >
              {isClaiming ? "Claiming..." : "Decrypt & Claim Payout"}
            </button>
          )}

          {position[4] && (
            <span className="success-badge">Payout Claimed</span>
          )}
        </div>
      )}

      <div className="market-footer">
        <span className="market-id">Market #{marketId.toString()}</span>
        {priceUpdatePending && <span className="pending-badge">Price update pending…</span>}
      </div>
    </div>
  );
}
