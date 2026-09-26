import { formatEther } from "viem";

export function shortAddr(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Turkish-style MON amount: comma decimals, trailing zeros trimmed. */
export function formatMon(wei: bigint, maxDecimals = 4): string {
  const [whole, frac = ""] = formatEther(wei).split(".");
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  const wholeFmt = Number(whole).toLocaleString("tr-TR");
  if (!trimmed) {
    // Tiny non-zero amounts shouldn't read as 0.
    if (wei > 0n && whole === "0") return `<0,${"0".repeat(maxDecimals - 1)}1`;
    return wholeFmt;
  }
  return `${wholeFmt},${trimmed}`;
}

export function formatInt(n: number | bigint): string {
  return Number(n).toLocaleString("tr-TR");
}

/**
 * Demo gününün başlangıcı: bugün 09:00'dan önceki kayıtlar (geçmiş test
 * verileri) hiçbir listede/toplamda görünmesin, sadece bugünkü gerçek
 * aktivite kalsın.
 */
export function todayNineAM(): number {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s} sn önce`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.round(h / 24);
  return `${d} gün önce`;
}
