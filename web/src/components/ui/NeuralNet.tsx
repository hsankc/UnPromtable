"use client";

import { useMemo } from "react";
import { forward, type GuardModelInfo, type Decision, DECISION_LABEL } from "@/lib/models";
import styles from "./NeuralNet.module.css";

const W = 560;
const H = 420;
const X_IN = 90;
const X_HID = 300;
const X_OUT = 470;

const ys = (n: number, top = 30, bottom = H - 30) => Array.from({ length: n }, (_, i) => top + ((bottom - top) * i) / (n - 1));

/**
 * The model's real 8→16→3 network, drawn from the integer weights the vault
 * runs. For the given input it runs the same forward pass as the contract:
 * hidden units that fire (ReLU > 0) light up, and signal pulses travel only
 * along edges into the winning output.
 */
export function NeuralNet({ model, x, animate = true }: { model: GuardModelInfo; x: number[]; animate?: boolean }) {
  const { h, d } = useMemo(() => forward(model, x), [model, x]);
  const inY = ys(8);
  const hidY = ys(16, 14, H - 14);
  const outY = ys(3, 110, H - 110);

  // Normalise edge strength per layer so every model reads at the same contrast.
  const maxW1 = Math.max(...model.W1.flat().map(Math.abs));
  const maxW2 = Math.max(...model.W2.flat().map(Math.abs));

  const firing = h.map((v) => v > 0);
  // Contribution of each firing hidden unit to the winning logit.
  const contrib = h.map((v, j) => v * model.W2[j][d]);
  const maxContrib = Math.max(1, ...contrib.map((c) => Math.abs(c)));
  // For each input, the firing hidden unit it pushes up the most (or -1).
  const strongestInto = x.map((xi, i) => {
    let best = -1;
    let bestVal = 0;
    model.W1[i].forEach((w, j) => {
      const v = w * xi;
      if (firing[j] && v > bestVal) {
        bestVal = v;
        best = j;
      }
    });
    return best;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.net} role="img" aria-label={`Model kararı: ${DECISION_LABEL[d as Decision]}`}>
      <g>
        {model.W1.map((row, i) =>
          row.map((w, j) => {
            const a = Math.abs(w) / maxW1;
            if (a < 0.04) return null;
            return (
              <line
                key={`a${i}-${j}`}
                x1={X_IN} y1={inY[i]} x2={X_HID} y2={hidY[j]}
                className={w >= 0 ? styles.pos : styles.neg}
                strokeOpacity={firing[j] ? 0.15 + a * 0.6 : 0.05 + a * 0.12}
                strokeWidth={0.6 + a * 1.4}
              />
            );
          }),
        )}
        {model.W2.map((row, j) =>
          row.map((w, k) => {
            const a = Math.abs(w) / maxW2;
            const live = firing[j] && k === d;
            return (
              <line
                key={`b${j}-${k}`}
                x1={X_HID} y1={hidY[j]} x2={X_OUT} y2={outY[k]}
                className={w >= 0 ? styles.pos : styles.neg}
                strokeOpacity={live ? 0.35 + (Math.abs(contrib[j]) / maxContrib) * 0.6 : 0.06 + a * 0.1}
                strokeWidth={live ? 1.2 + a * 1.6 : 0.6 + a}
              />
            );
          }),
        )}
      </g>

      {animate && (
        <g className={styles.pulses}>
          {hidY.map((y, j) =>
            firing[j] && contrib[j] > 0 ? (
              <circle key={`p${j}`} r="3.2" className={styles.pulse}>
                <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${(j % 5) * 0.22}s`} path={`M${X_HID},${y} L${X_OUT},${outY[d]}`} />
              </circle>
            ) : null,
          )}
          {inY.map((y, i) => {
            const j = strongestInto[i];
            if (j < 0) return null;
            return (
              <circle key={`q${i}`} r="2.6" className={styles.pulseIn}>
                <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${i * 0.15}s`} path={`M${X_IN},${y} L${X_HID},${hidY[j]}`} />
              </circle>
            );
          })}
        </g>
      )}

      {inY.map((y, i) => (
        <g key={`in${i}`}>
          <circle cx={X_IN} cy={y} r="8" className={styles.node} />
          <text x={X_IN - 16} y={y + 4} textAnchor="end" className={styles.inLabel}>
            {x[i].toLocaleString("tr-TR")}
          </text>
        </g>
      ))}
      {hidY.map((y, j) => (
        <circle key={`h${j}`} cx={X_HID} cy={y} r="7" className={firing[j] ? styles.nodeOn : styles.node} />
      ))}
      {outY.map((y, k) => (
        <g key={`o${k}`}>
          <circle cx={X_OUT} cy={y} r="13" className={k === d ? styles[`out${k}` as "out0"] : styles.node} />
          <text x={X_OUT + 24} y={y + 5} className={k === d ? styles.outLabelOn : styles.outLabel}>
            {DECISION_LABEL[k as Decision]}
          </text>
        </g>
      ))}
    </svg>
  );
}
