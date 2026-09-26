import Link from "next/link";
import { PageHead, Panel, AddressLink } from "@/components/app/ui";
import { REGISTRY_V2, GUARD_LAB, REPUTATION, TREASURY } from "@/lib/deployments";
import { MONAD_RPC, EXPLORER } from "@/lib/chain";
import styles from "./page.module.css";

const VIEM_SNIPPET = `import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Bu, ajanının TEK yapabildiği şey: bir öneri göndermek. Anahtar burada
// sadece işlemi imzalamak için var — parayı kasa gönderir, ajan değil.
const account = privateKeyToAccount(process.env.AGENT_KEY);
const client = createWalletClient({ account, transport: http("${MONAD_RPC}") });

const abi = ["function proposePayment(address to, uint256 amount) returns (uint8)"];
const decision = await client.writeContract({
  address: VAULT_ADDRESS,
  abi,
  functionName: "proposePayment",
  args: [providerAddress, parseEther("0.01")],
});
// dönen d: 0 onay, 1 beklet (10 dk), 2 red`;

const SOLIDITY_SNIPPET = `interface IGuardVault {
    function proposePayment(address payable to, uint256 amount) external returns (uint8);
}

contract MyAgent {
    IGuardVault constant VAULT = IGuardVault(0x...);

    function pay(address payable to, uint256 amount) external {
        // d: 0 onaylandı ve gönderildi, 1 bekletildi, 2 reddedildi
        uint8 d = VAULT.proposePayment(to, amount);
    }
}`;

export default function EntegrasyonPage() {
  return (
    <>
      <PageHead title="Entegrasyon">Ajanını 3 adımda bir kasaya bağla. Kasa senin, karar mekanizması zincirde.</PageHead>

      <div className={styles.stack}>
        <Panel title="1. Kendi kasanı oluştur">
          <p className="body muted">
            <Link href="/app/olustur">Kontrat oluştur</Link> sayfasından hangi ödeme türlerini yapacağını seç. Kasa
            deploy olur olmaz sahibi senin cüzdanın olur.
          </p>
        </Panel>

        <Panel title="2. Ajanın çağıracağı fonksiyon">
          <p className="body muted">
            Ajanın private key&apos;i sadece bu çağrıyı imzalamak için kullanılır — parayı asla tutmaz. Kasa
            çağrıyı aldıktan sonra kendi içindeki model karar verir; ajanın önerisi son söz değildir.
          </p>
          <div className={styles.tabs}>
            <span className="caption subtle">viem (TypeScript)</span>
          </div>
          <pre className={styles.code}>{VIEM_SNIPPET}</pre>
          <div className={styles.tabs}>
            <span className="caption subtle">Solidity&apos;den çağırmak istersen</span>
          </div>
          <pre className={styles.code}>{SOLIDITY_SNIPPET}</pre>
        </Panel>

        <Panel title="3. Kararı oku">
          <table className={styles.table}>
            <thead>
              <tr><th>Dönen değer</th><th>Anlamı</th></tr>
            </thead>
            <tbody>
              <tr><td><span className="mono">0</span></td><td>Onaylandı, MON alıcıya gitti.</td></tr>
              <tr><td><span className="mono">1</span></td><td>Bekletildi. 10 dakika sonra kasa sahibi veto etmediyse herkes <span className="mono">release(id)</span> çağırabilir.</td></tr>
              <tr><td><span className="mono">2</span></td><td>Reddedildi. Hiçbir şey gönderilmedi.</td></tr>
            </tbody>
          </table>
          <p className="body muted" style={{ marginTop: "var(--space-4)" }}>
            Model ne derse desin iki sert kural her zaman geçerli: tek işlemde kasanın <strong>%20&apos;sinden</strong>{" "}
            fazlası çıkamaz, tanınmayan adreslere günlük toplam <strong>%1</strong> bütçeyle sınırlıdır.
          </p>
        </Panel>

        <Panel title="Adresler">
          <ul className={styles.addrList}>
            <li><span className="caption subtle">Registry v2 (fabrika)</span><AddressLink address={REGISTRY_V2.address} full /></li>
            <li><span className="caption subtle">GuardLab (modelleri dene)</span><AddressLink address={GUARD_LAB} full /></li>
            <li><span className="caption subtle">Paylaşılan itibar kaynağı</span><AddressLink address={REPUTATION} full /></li>
            <li><span className="caption subtle">Hazine</span><AddressLink address={TREASURY} full /></li>
          </ul>
          <p className="caption subtle" style={{ marginTop: "var(--space-4)" }}>
            RPC: <span className="mono">{MONAD_RPC}</span> · Explorer:{" "}
            <a href={EXPLORER} target="_blank" rel="noreferrer" className="mono">{EXPLORER}</a> · Chain ID: <span className="mono">10143</span>
          </p>
        </Panel>
      </div>
    </>
  );
}
