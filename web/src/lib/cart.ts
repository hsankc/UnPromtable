"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "up.cart";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(keys: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    // private browsing / storage blocked: cart just won't persist
  }
  window.dispatchEvent(new CustomEvent("up:cart"));
}

/** Selected model keys for "Kontrat oluştur", kept in localStorage so the choice survives navigation. */
export function useModelCart() {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    setKeys(read());
    const onChange = () => setKeys(read());
    window.addEventListener("up:cart", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("up:cart", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = useCallback((key: string) => {
    const cur = read();
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    write(next);
  }, []);

  const set = useCallback((next: string[]) => write(next), []);
  const clear = useCallback(() => write([]), []);

  return { keys, toggle, set, clear, has: (key: string) => keys.includes(key) };
}
