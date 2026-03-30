import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { targetNetwork } from "./config";

export const wagmiConfig = createConfig({
  chains: [targetNetwork],
  connectors: [injected()],
  transports: { [targetNetwork.id]: http() },
  ssr: true,
});
