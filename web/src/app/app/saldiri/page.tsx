import { PageHead, Panel } from "@/components/app/ui";
import { AttackConsole } from "@/components/attack/AttackConsole";
import styles from "./page.module.css";

export default function SaldiriPage() {
  return (
    <>
      <PageHead title="Saldırı dene">
        Sahte bir fatura ya da gizli talimat yaz. Gerçek Gemini ajanı okur ve bir öneri yapar; demo kasadaki model karar
        verir. İkisi de zincirde, gerçek.
      </PageHead>
      <div className={styles.layout}>
        <Panel title="Senaryo">
          <AttackConsole />
        </Panel>
      </div>
    </>
  );
}
