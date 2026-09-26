"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider, type WalletClient } from "viem";
import { ADD_CHAIN_PARAMS, MONAD_CHAIN_HEX, monadTestnet, publicClient } from "@/lib/chain";

type Status = "detecting" | "unavailable" | "disconnected" | "connecting" | "connected";

interface WalletContextValue {
  status: Status;
  address?: Address;
  chainId?: number;
  onMonad: boolean;
  balance?: bigint;
  error?: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToMonad: () => Promise<void>;
  refreshBalance: () => void;
  /** A viem wallet client bound to the connected account on Monad testnet. */
  walletClient: () => WalletClient | undefined;
}

const WalletContext = createContext<WalletContextValue | null>(null);
const REMEMBER_KEY = "up.wallet.connected";

interface ProviderDetail {
  info: { rdns: string; name: string };
  provider: EIP1193Provider;
}

// Finds MetaMask through EIP-6963 so another injected wallet can't shadow it,
// falling back to window.ethereum for older extensions.
function useInjectedProvider() {
  const [provider, setProvider] = useState<EIP1193Provider | null | undefined>(undefined);
  useEffect(() => {
    let found: ProviderDetail | undefined;
    const onAnnounce = (e: Event) => {
      const detail = (e as CustomEvent<ProviderDetail>).detail;
      if (!found || detail.info.rdns === "io.metamask") found = detail;
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const t = setTimeout(() => {
      const legacy = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      setProvider(found?.provider ?? legacy ?? null);
    }, 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
    };
  }, []);
  return provider;
}

function describe(err: unknown): string {
  const e = err as { code?: number; shortMessage?: string; message?: string };
  if (e?.code === 4001) return "İstek cüzdanda reddedildi.";
  if (e?.code === -32002) return "MetaMask'ta bekleyen bir istek var. Uzantıyı açıp onayla.";
  return e?.shortMessage ?? e?.message ?? "Cüzdan isteği başarısız oldu.";
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const provider = useInjectedProvider();
  const [status, setStatus] = useState<Status>("detecting");
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [balance, setBalance] = useState<bigint>();
  const [error, setError] = useState<string>();
  const balanceTick = useRef(0);
  const [tick, setTick] = useState(0);

  const applyAccounts = useCallback((accounts: readonly string[]) => {
    if (accounts.length === 0) {
      setAddress(undefined);
      setBalance(undefined);
      setStatus("disconnected");
      localStorage.removeItem(REMEMBER_KEY);
      return;
    }
    setAddress(getAddress(accounts[0]));
    setStatus("connected");
  }, []);

  // Initial detection + silent reconnect (eth_accounts never prompts).
  useEffect(() => {
    if (provider === undefined) return;
    if (provider === null) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const hex = (await provider.request({ method: "eth_chainId" })) as string;
        if (!cancelled) setChainId(parseInt(hex, 16));
        if (localStorage.getItem(REMEMBER_KEY) === "1") {
          const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
          if (!cancelled) applyAccounts(accounts);
        } else if (!cancelled) {
          setStatus("disconnected");
        }
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
    })();

    const onAccounts = (accounts: string[]) => applyAccounts(accounts);
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      cancelled = true;
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider, applyAccounts]);

  // Balance is read from Monad directly, so it's right even when the wallet
  // itself is pointed at another network.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const read = () =>
      publicClient
        .getBalance({ address })
        .then((b) => !cancelled && setBalance(b))
        .catch(() => {});
    read();
    const id = setInterval(read, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, tick]);

  const connect = useCallback(async () => {
    if (!provider) return;
    setError(undefined);
    setStatus("connecting");
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      localStorage.setItem(REMEMBER_KEY, "1");
      applyAccounts(accounts);
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(parseInt(hex, 16));
    } catch (err) {
      setError(describe(err));
      setStatus("disconnected");
    }
  }, [provider, applyAccounts]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(REMEMBER_KEY);
    setAddress(undefined);
    setBalance(undefined);
    setStatus("disconnected");
    // MetaMask supports revoking the site permission; other wallets may not.
    provider?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] } as never).catch(() => {});
  }, [provider]);

  const switchToMonad = useCallback(async () => {
    if (!provider) return;
    setError(undefined);
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD_CHAIN_HEX }] });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4902 || code === -32603) {
        try {
          await provider.request({ method: "wallet_addEthereumChain", params: [ADD_CHAIN_PARAMS] });
        } catch (addErr) {
          setError(describe(addErr));
        }
      } else {
        setError(describe(err));
      }
    }
  }, [provider]);

  const refreshBalance = useCallback(() => {
    balanceTick.current += 1;
    setTick(balanceTick.current);
  }, []);

  const walletClient = useCallback(() => {
    if (!provider || !address) return undefined;
    return createWalletClient({ account: address, chain: monadTestnet, transport: custom(provider) });
  }, [provider, address]);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      chainId,
      onMonad: chainId === monadTestnet.id,
      balance,
      error,
      connect,
      disconnect,
      switchToMonad,
      refreshBalance,
      walletClient,
    }),
    [status, address, chainId, balance, error, connect, disconnect, switchToMonad, refreshBalance, walletClient],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
