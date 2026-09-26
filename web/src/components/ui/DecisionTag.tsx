import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { DECISION_PAST, type Decision } from "@/lib/models";
import styles from "./DecisionTag.module.css";

const ICONS = { 0: CheckCircle2, 1: Clock3, 2: XCircle } as const;
const TONE = { 0: styles.ok, 1: styles.warn, 2: styles.danger } as const;

/** Decision state always shown as icon + word, never colour alone. */
export function DecisionTag({ decision, label }: { decision: Decision; label?: string }) {
  const Icon = ICONS[decision];
  return (
    <span className={`${styles.tag} ${TONE[decision]}`}>
      <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
      {label ?? DECISION_PAST[decision]}
    </span>
  );
}
