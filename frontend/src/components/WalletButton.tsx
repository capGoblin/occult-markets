"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors }  = useConnect();
  const { disconnect }           = useDisconnect();

  if (isConnected && address) {
    return (
      <button className="wallet-btn connected" onClick={() => disconnect()}>
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }
  return (
    <button className="wallet-btn" onClick={() => connect({ connector: connectors[0] })}>
      Connect Wallet
    </button>
  );
}
