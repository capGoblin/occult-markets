"use client";
import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseEther } from "viem";
import { OCCULT_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { processFheBet } from "@/lib/cofhe";

interface Props {
  marketId:     bigint;
  currentPrice: number;
  question:     string;
  onSuccess:    () => void;
  onClose:      () => void;
}

export function BetForm({ marketId, currentPrice, question, onSuccess, onClose }: Props) {
  const { address }                    = useAccount();
  const publicClient                   = usePublicClient();
  const { data: walletClient }         = useWalletClient();
  const [direction, setDirection]      = useState<boolean | null>(null);
  const [ethAmount, setEthAmount]      = useState("");
  const [encrypting, setEncrypting]    = useState(false);
  const [done, setDone]                = useState(false);
  const [error, setError]              = useState<string | null>(null);

  const [txHash, setTxHash]            = useState<`0x${string}` | undefined>();
  const { isLoading: isTxPending, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      setDone(true);
      setTimeout(() => onSuccess(), 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const yesProb = currentPrice / 10;
  const noProb  = 100 - yesProb;

  async function handleBet() {
    if (direction === null)                            { setError("Choose YES or NO"); return; }
    if (!ethAmount || parseFloat(ethAmount) <= 0)     { setError("Enter an amount"); return; }
    if (!address)                                      { setError("Connect wallet first"); return; }
    if (!publicClient || !walletClient)                { setError("Wallet not ready"); return; }

    setError(null);
    setEncrypting(true);

    try {
      const amountWei  = parseEther(ethAmount);
      const amountGwei = amountWei / BigInt(1000000000);

      const hash = await processFheBet(
        marketId,
        direction,
        amountGwei,
        amountWei,
        address,
        publicClient,
        walletClient
      );

      setTxHash(hash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Encryption failed");
    } finally {
      setEncrypting(false);
    }
  }

  const estimatedPayout = ethAmount && direction !== null
    ? (parseFloat(ethAmount) / (direction ? yesProb / 100 : noProb / 100)).toFixed(4)
    : null;

  let btnText = `Encrypt & Bet ${direction === true ? "YES" : direction === false ? "NO" : "..."}`;
  if (encrypting)  btnText = "Encrypting...";
  if (isTxPending) btnText = "Confirming...";
  if (done)        btnText = "Done ✓";

  const btnClass = [
    "submit-btn",
    encrypting || isTxPending ? "shimmer" : "",
    done ? "done" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box">
        <p className="modal-market-question">{question}</p>

        {/* Mini price bar */}
        <div className="price-bar-mini-track">
          <div className="price-bar-yes" style={{ width: `${yesProb}%` }} />
        </div>

        {/* YES / NO selector */}
        <div className="direction-selector">
          <button
            className={`dir-btn yes ${direction === true ? "sel" : ""} ${direction === false ? "dim" : ""}`}
            onClick={() => setDirection(true)}
          >
            YES
          </button>
          <button
            className={`dir-btn no ${direction === false ? "sel" : ""} ${direction === true ? "dim" : ""}`}
            onClick={() => setDirection(false)}
          >
            NO
          </button>
        </div>

        {/* Amount input */}
        <div className="amount-field">
          <input
            className="amount-input"
            type="number"
            placeholder="0.00"
            step="0.001"
            min="0"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
          />
          <span className="amount-currency">ETH</span>
        </div>

        {/* Estimated payout */}
        {estimatedPayout && (
          <div className="est-return">
            est. return if correct &nbsp;<span className="mono">{estimatedPayout} ETH</span>
          </div>
        )}

        {/* Privacy disclosure */}
        <details className="privacy-details">
          <summary>what gets revealed on-chain ↓</summary>
          <div className="privacy-rows">
            <div><span className="vis">visible</span>   — a bet happened</div>
            <div><span className="vis">visible</span>   — your wallet address</div>
            <div><span className="vis">visible</span>   — timestamp</div>
            <div><span className="enc">encrypted</span> — direction</div>
            <div><span className="enc">encrypted</span> — pool composition</div>
            <div><span className="enc">encrypted</span> — position history</div>
          </div>
        </details>

        {error && <div className="error-msg">{error}</div>}

        <button
          className={btnClass}
          onClick={handleBet}
          disabled={encrypting || isTxPending || done || direction === null || !ethAmount}
        >
          {btnText}
        </button>
      </div>
    </div>
  );
}
