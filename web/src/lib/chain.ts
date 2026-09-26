import { createPublicClient, defineChain, http } from "viem";

export const MONAD_RPC = "https://testnet-rpc.monad.xyz/";
export const EXPLORER = "https://testnet.monadexplorer.com";
export const FAUCET = "https://faucet.monad.xyz/";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
  blockExplorers: { default: { name: "Monad Explorer", url: EXPLORER } },
  testnet: true,
});

export const MONAD_CHAIN_HEX = "0x279f"; // 10143

// Params for wallet_addEthereumChain when MetaMask doesn't know Monad yet.
export const ADD_CHAIN_PARAMS = {
  chainId: MONAD_CHAIN_HEX,
  chainName: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: [MONAD_RPC],
  blockExplorerUrls: [EXPLORER],
};

export const publicClient = createPublicClient({ chain: monadTestnet, transport: http(MONAD_RPC) });

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER}/address/${addr}`;
