"use client";
import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseEther } from "viem";
import { OCCULT_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { processFheBet } from "@/lib/cofhe";

interface Props {
  marketId:     bigint;
  currentPrice: number;
  onSuccess:    () => void;
}

export function BetForm({ marketId, currentPrice, onSuccess }: Props) {
  const { address }                    = useAccount();
  const publicClient                   = usePublicClient();
  const { data: walletClient }         = useWalletClient();
  const [direction, setDirection]      = useState<boolean | null>(null);
  const [ethAmount, setEthAmount]      = useState("");
  const [encrypting, setEncrypting]    = useState(false);
  const [error, setError]              = useState<string | null>(null);

  const [txHash, setTxHash]            = useState<`0x${string}` | undefined>();
  const { isLoading: isTxPending, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) onSuccess();

  const yesProb = currentPrice / 10;
  const noProb  = 100 - yesProb;

  async function handleBet() {
    if (direction === null)             { setError("Choose YES or NO"); return; }
    if (!ethAmount || parseFloat(ethAmount) <= 0) { setError("Enter an amount"); return; }
    if (!address)                       { setError("Connect wallet first"); return; }
    if (!publicClient || !walletClient) { setError("Wallet not ready"); return; }

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

  return (
    <div className="bet-form">
      <h3>Place Encrypted Bet</h3>
      <p className="bet-form-note">
        Direction and amount are encrypted before leaving your browser.
        Only the fact a bet occurred is visible on-chain.
      </p>

      <div className="direction-selector">
        <button
          className={`direction-btn yes ${direction === true ? "selected" : ""}`}
          onClick={() => setDirection(true)}
        >
          YES &nbsp;{yesProb.toFixed(1)}%
        </button>
        <button
          className={`direction-btn no ${direction === false ? "selected" : ""}`}
          onClick={() => setDirection(false)}
        >
          NO &nbsp;{noProb.toFixed(1)}%
        </button>
      </div>

      <div className="amount-input">
        <input
          type="number" placeholder="0.01" step="0.001" min="0"
          value={ethAmount}
          onChange={(e) => setEthAmount(e.target.value)}
        />
        <span className="currency">ETH</span>
      </div>

      {ethAmount && direction !== null && (
        <div className="payout-estimate">
          Est. payout if correct:{" "}
          <strong>
            {(parseFloat(ethAmount) / (direction ? yesProb / 100 : noProb / 100)).toFixed(4)} ETH
          </strong>
          <span className="payout-note"> (at current price)</span>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <button
        className="btn-primary bet-submit"
        onClick={handleBet}
        disabled={encrypting || isTxPending || direction === null || !ethAmount}
      >
        {encrypting ? "Encrypting…" : isTxPending ? "Confirming…" : `Bet ${direction === null ? "…" : direction ? "YES" : "NO"}`}
      </button>

      <div className="privacy-details">
        <details>
          <summary>What gets revealed on-chain?</summary>
          <ul>
            <li>That a bet occurred — visible</li>
            <li>Your wallet address — visible</li>
            <li>Timestamp — visible</li>
            <li>Amount — encrypted ✓</li>
            <li>Direction (YES/NO) — encrypted ✓</li>
            <li>Pool composition — encrypted until next price update ✓</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
