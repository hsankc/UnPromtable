"use client";

import { useCallback, useEffect, useRef } from "react";
import styles from "./HeroLockup.module.css";

/**
 * The animated Unpromptable lockup, ported one-to-one from up-hero.html:
 * the chevron bumps into the wall, "n" and "romptable" unfold, the folded
 * letters settle into full ink, then the tagline rises. One class (`go`)
 * drives the whole sequence; clicking the lockup (or Enter/Space) replays it.
 */
export function HeroLockup({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  const play = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.remove(styles.go);
    void root.offsetWidth; // force reflow so the sequence restarts from zero
    requestAnimationFrame(() => root.classList.add(styles.go));
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) timer = setTimeout(play, 250);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [play]);

  return (
    <div ref={rootRef} className={`${styles.root} ${className ?? ""}`}>
      <h1
        className={styles.lockup}
        tabIndex={0}
        aria-label="Unpromptable"
        title="Tekrar oynat"
        onClick={play}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            play();
          }
        }}
      >
        <svg className={styles.mark} viewBox="16 0 66 100" aria-hidden="true">
          <polyline
            className={styles.chev}
            points="20,24 48,50 20,76"
            fill="none"
            strokeWidth="11"
            strokeLinejoin="miter"
            strokeMiterlimit="10"
          />
          <rect className={styles.wall} x="64" y="14" width="15" height="72" />
        </svg>
        <span className={styles.word} aria-hidden="true">
          <span>U</span>
          <span className={styles.fold}>
            <span>n</span>
          </span>
          <span>P</span>
          <span className={styles.fold}>
            <span>romptable</span>
          </span>
        </span>
      </h1>
      <p className={styles.tagline}>Talk it into anything. It still won’t pay.</p>
    </div>
  );
}
