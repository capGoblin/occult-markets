"use client";
import { useState, useEffect, useRef } from "react";
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

const SCRAMBLE_CHARS = '!@#$%^&*[]0123456789ABCDEF/\\{}';

export function BetForm({ marketId, currentPrice, question, onSuccess, onClose }: Props) {
  const { address }                    = useAccount();
  const publicClient                   = usePublicClient();
  const { data: walletClient }         = useWalletClient();
  const [direction, setDirection]      = useState<boolean | null>(null);
  const [ethAmount, setEthAmount]      = useState("");
  const [encrypting, setEncrypting]    = useState(false);
  const [done, setDone]                = useState(false);
  const [error, setError]              = useState<string | null>(null);

  /* Submit button scramble while encrypting */
  const [btnDisplay, setBtnDisplay]    = useState("");
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [txHash, setTxHash]            = useState<`0x${string}` | undefined>();
  const { isLoading: isTxPending, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) { setDone(true); setTimeout(() => onSuccess(), 400); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  /* Scramble submit button text while encrypting */
  useEffect(() => {
    if (!encrypting) { if (scrambleRef.current) clearInterval(scrambleRef.current); setBtnDisplay(""); return; }
    const target = 'ENCRYPTING...';
    scrambleRef.current = setInterval(() => {
      setBtnDisplay(Array.from(target, (c) =>
        Math.random() < 0.2 ? SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)] : c
      ).join(''));
    }, 180);
    return () => { if (scrambleRef.current) clearInterval(scrambleRef.current); };
  }, [encrypting]);

  const yesProb = currentPrice / 10;
  const noProb  = 100 - yesProb;

  async function handleBet() {
    if (direction === null)                         { setError("Choose YES or NO"); return; }
    if (!ethAmount || parseFloat(ethAmount) <= 0)  { setError("Enter an amount"); return; }
    if (!address)                                   { setError("Connect wallet first"); return; }
    if (!publicClient || !walletClient)             { setError("Wallet not ready"); return; }

    setError(null);
    setEncrypting(true);
    // document.documentElement.style.filter = 'invert(1)';
    // setTimeout(() => { document.documentElement.style.filter = ''; }, 50);
    try {
      const amountWei  = parseEther(ethAmount);
      const amountGwei = amountWei / BigInt(1000000000);
      const hash = await processFheBet(marketId, direction, amountGwei, amountWei, address, publicClient, walletClient);
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

  let btnText = `ENCRYPT & BET ${direction === true ? "YES" : direction === false ? "NO" : "..."}`;
  if (encrypting)  btnText = btnDisplay || 'ENCRYPTING...';
  if (isTxPending) btnText = 'CONFIRMING...';
  if (done)        btnText = 'DONE ✓';

  const btnClass = ["submit-btn", encrypting ? "glitching" : ""].filter(Boolean).join(" ");

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>[ ESC ]</button>

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
          >YES</button>
          <button
            className={`dir-btn no ${direction === false ? "sel" : ""} ${direction === true ? "dim" : ""}`}
            onClick={() => setDirection(false)}
          >NO</button>
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
          <summary>&gt; view_chain_exposure</summary>
          <div className="privacy-rows">
            <div><span className="vis">[VISIBLE]</span>  bet_event, wallet, timestamp</div>
            <div><span className="redact">[REDACTED]</span> direction, pool_state</div>
          </div>
        </details>

        {error && <div className="error-msg">{error}</div>}

        <button
          className={btnClass}
          onClick={handleBet}
          disabled={encrypting || isTxPending || done || direction === null || !ethAmount}
        >{btnText}</button>
      </div>
    </div>
  );
}
