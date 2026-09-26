"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    Krom?: { cipher: (el: Element, opts?: { charset?: string; interval?: number }) => () => void };
  }
}

/** Krom's CipherCard (square, min 280px). krom.js touches window, so it loads client-side only. */
export function CipherCard({
  children,
  size = 420,
  charset,
  className,
}: {
  children: React.ReactNode;
  size?: number;
  charset?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    import("@/lib/krom.js").then(() => {
      if (alive && ref.current && window.Krom) stop = window.Krom.cipher(ref.current, { charset });
    });
    return () => {
      alive = false;
      stop?.();
    };
  }, [charset]);

  return (
    <div ref={ref} className={`krom-cipher ${className ?? ""}`} style={{ width: "100%", maxWidth: size, minWidth: 280, aspectRatio: "1" }}>
      <div className="krom-cipher__field" aria-hidden="true" />
      <div className="krom-cipher__glow" aria-hidden="true" />
      <div className="krom-cipher__badge">{children}</div>
    </div>
  );
}
