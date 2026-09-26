"use client";

import { useEffect, useState } from "react";
import { publicClient } from "@/lib/chain";
import { formatInt } from "@/lib/format";
import styles from "./LiveBlock.module.css";

/** The current Monad testnet block, read straight from the RPC. */
export function LiveBlock() {
  const [block, setBlock] = useState<bigint>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const read = () =>
      publicClient
        .getBlockNumber({ cacheTime: 0 })
        .then((b) => {
          if (!alive) return;
          setBlock(b);
          setFailed(false);
        })
        .catch(() => alive && setFailed(true));
    read();
    const id = setInterval(read, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <p className={`caption ${styles.live}`} aria-live="off">
      <span className={failed ? styles.dotOff : styles.dot} aria-hidden="true" />
      {failed ? (
        <span>Monad Testnet'e şu an ulaşılamıyor</span>
      ) : (
        <span>
          Monad Testnet'te canlı, blok <span className="num">{block === undefined ? "…" : formatInt(block)}</span>
        </span>
      )}
    </p>
  );
}
