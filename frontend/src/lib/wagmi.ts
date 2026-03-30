import { createConfig, http } from "wagmi";
import { fhenixTestnet } from "./config";

export const wagmiConfig = createConfig({
  chains: [fhenixTestnet],
  transports: { [fhenixTestnet.id]: http() },
  ssr: true,
});
