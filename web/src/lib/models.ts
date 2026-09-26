import data from "@/data/models.json";

// models.json is exported from the contracts repo (extracted/guard/export_models.py):
// the exact integer weights compiled into every vault, the golden test
// vectors, and measured vault sizes from a real forge build.

export type Decision = 0 | 1 | 2;

export const DECISION_LABEL: Record<Decision, string> = { 0: "Onay", 1: "Beklet", 2: "Red" };
export const DECISION_PAST: Record<Decision, string> = { 0: "Onaylandı", 1: "Bekletildi", 2: "Reddedildi" };

export const FEATURE_KEYS = [
  "amountBps",
  "seenBefore",
  "priorCount",
  "hourlyOutBps",
  "sinceLast",
  "reputation",
  "amountVsAvg",
  "isContract",
] as const;

interface RawModel {
  id: number;
  key: string;
  entry: string;
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
  params: number;
  golden: { vectors: Record<string, number[]>; expect: Record<string, number> };
  vaultBytes: number;
}

interface ModelCopy {
  name: string;
  short: string;
  tagline: string;
  description: string;
  features: string[];
  attack: string;
  accuracy: number; // integer model on the held-out split, printed by train_multi.py / train.py
  scenarios: Record<string, string>;
}

const COPY: Record<string, ModelCopy> = {
  api_payment: {
    name: "API ve servis ödemesi",
    short: "API ödemesi",
    tagline: "x402 tarzı mikro ödemeler",
    description: "Ajanın API sağlayıcılarına, veri satıcılarına ve araç çağrılarına yaptığı küçük, tekrarlayan ödemeleri korur.",
    features: ["Tutar / kasa (bps)", "Alıcı daha önce ödeme aldı mı", "Alıcıya önceki ödeme sayısı", "Son 1 saatteki toplam çıkış (bps)", "Son ödemeden bu yana saniye", "Alıcının itibar puanı", "Tutar / ortalama ödeme (%)", "Alıcı bir kontrat mı"],
    attack: "Kasanın büyük kısmını tek seferde yeni bir adrese gönderme (Grok tarzı boşaltma).",
    accuracy: 0.998,
    scenarios: {
      normal_api: "Tanıdık sağlayıcıya olağan API ödemesi",
      grok_drain: "Kasanın %95'ini yeni bir adrese gönderme",
      salami: "Saniyeler içinde art arda küçük dilimler",
      new_vendor_small: "Yeni ama itibarlı satıcıya küçük ödeme",
      big_to_new: "Orta itibarlı yeni adrese büyük ödeme",
    },
  },
  nft_purchase: {
    name: "NFT ve dijital varlık alımı",
    short: "NFT alımı",
    tagline: "Koleksiyon ve taban fiyat riski",
    description: "Pazaryerlerinden yapılan alımları taban fiyattan sapma ve koleksiyonun güvenilirliğine göre değerlendirir.",
    features: ["Fiyat / kasa (bps)", "Koleksiyon tanıdık mı", "Bu koleksiyondan önceki alım", "Son 1 saatteki harcama (bps)", "Son alımdan bu yana saniye", "Koleksiyon itibarı", "Fiyat / taban fiyat (%)", "Satıcı bir kontrat mı"],
    attack: "Taze, doğrulanmamış bir koleksiyondan taban fiyatın çok üstünde alım (rug-pull).",
    accuracy: 1.0,
    scenarios: {
      known_collection_fair_price: "Tanıdık koleksiyondan makul fiyatlı alım",
      rugpull_fresh_collection: "Yeni koleksiyondan taban fiyatın 40 katına alım",
      flood_mint_scam: "Art arda sahte mint alımları",
      new_collection_small: "İtibarlı yeni koleksiyondan küçük alım",
      moderate_premium: "Taban fiyatın 3 katına orta tutarlı alım",
    },
  },
  defi_swap: {
    name: "DeFi takas",
    short: "DeFi takas",
    tagline: "Slippage ve token güveni",
    description: "DEX üzerindeki token takaslarını slippage oranı ve tokenin doğrulanmışlığına göre değerlendirir.",
    features: ["Takas tutarı / kasa (bps)", "Token çifti tanıdık mı", "Bu tokenla önceki takas", "Son 1 saatteki takas hacmi (bps)", "Son takastan bu yana saniye", "Token itibarı", "Slippage (%)", "Token yeni ve doğrulanmamış mı"],
    attack: "Doğrulanmamış yeni bir tokena yüksek slippage ile büyük takas (honeypot).",
    accuracy: 1.0,
    scenarios: {
      known_pair_small: "Tanıdık çiftte küçük takas",
      honeypot_new_token: "Yeni tokena çok yüksek slippage ile dev takas",
      salami_swap_drain: "Kısa aralıklarla art arda takaslar",
      new_token_small_amt: "Yeni tokena küçük tutarlı takas",
      moderate_slippage: "Orta slippage ile orta tutarlı takas",
    },
  },
  subscription: {
    name: "Abonelik ve tekrarlayan ödeme",
    short: "Abonelik",
    tagline: "Düzen sapması tespiti",
    description: "Düzenli faturalanan abonelikleri, ödeme geçmişinin düzenine ve ani fiyat sıçramalarına göre değerlendirir.",
    features: ["Tutar / kasa (bps)", "Satıcı tanıdık mı", "Bu satıcıya önceki ödeme", "Son 1 saatteki çıkış (bps)", "Son ödemeden bu yana saniye", "Satıcı itibarı", "Tutar / bu satıcıya ortalama (%)", "İlk kez faturalayan satıcı mı"],
    attack: "Ele geçirilmiş bir fatura sisteminin aniden çok daha yüksek tutar istemesi.",
    accuracy: 1.0,
    scenarios: {
      regular_biller: "Düzenli aboneliğin olağan faturası",
      compromised_biller_spike: "Tanıdık satıcının 30 kat yüksek faturası",
      subscription_bombing: "Yeni satıcılardan fatura yağmuru",
      new_biller_small: "Yeni satıcının küçük ilk faturası",
      moderate_new_biller: "Yeni satıcının orta tutarlı faturası",
    },
  },
  treasury_dao: {
    name: "DAO hazine harcaması",
    short: "DAO hazinesi",
    tagline: "Yönetişim tazeliği",
    description: "Yönetişim teklifiyle tetiklenen harcamaları, onayın tazeliği ve alıcının katkı geçmişine göre değerlendirir.",
    features: ["Tutar / kasa (bps)", "Alıcı daha önce fonlandı mı", "Alıcıya önceki hibe", "Son dönemdeki çıkış (bps)", "Teklif onayından bu yana saniye", "Katkı itibarı", "Tutar / ortalama hibe (%)", "Alıcı multisig veya kontrat mı"],
    attack: "Düşük katılımla geçmiş bir teklifle taze bir adrese hızlı ve büyük tahliye.",
    accuracy: 0.999,
    scenarios: {
      known_contributor_grant: "Tanıdık katkıcıya olağan hibe",
      flash_quorum_drain: "Anlık teklifle hazinenin %90'ını boşaltma",
      salami_grants: "Kısa aralıklarla art arda hibeler",
      new_contributor_small: "Yeni katkıcıya küçük hibe",
      moderate_new_grant: "Yeni adrese orta tutarlı hibe",
    },
  },
  social_tip: {
    name: "Sosyal bahşiş ve ödül",
    short: "Bahşiş",
    tagline: "Sybil ve mikro boşaltma",
    description: "İçerik üreticilerine ve kullanıcılara verilen küçük bahşişleri hızlı, tekrarlı boşaltma desenlerine karşı korur.",
    features: ["Bahşiş / kasa (bps)", "Alıcıya daha önce bahşiş verildi mi", "Alıcıya önceki bahşiş", "Son 1 saatteki bahşiş hacmi (bps)", "Son bahşişten bu yana saniye", "Sosyal itibar", "Bahşiş / ortalama (%)", "Alıcı bir kontrat mı"],
    attack: "Taze adreslere hızlı ve çok sayıda mikro bahşişle Sybil boşaltması.",
    accuracy: 0.999,
    scenarios: {
      regular_follower_tip: "Tanıdık takipçiye olağan bahşiş",
      disguised_big_tip: "Bahşiş kılığında kasanın %70'i",
      sybil_microtip_drain: "Yeni adreslere mikro bahşiş yağmuru",
      new_recipient_small: "Yeni alıcıya küçük bahşiş",
      contract_recipient_flag: "Kişi yerine kontrata bahşiş",
    },
  },
};

export interface GoldenCase {
  key: string;
  label: string;
  x: number[];
  expect: Decision;
}

export interface GuardModelInfo extends RawModel, ModelCopy {
  cases: GoldenCase[];
}

export const MODELS: GuardModelInfo[] = (data.models as unknown as RawModel[]).map((m) => {
  const copy = COPY[m.key];
  return {
    ...m,
    ...copy,
    cases: Object.entries(m.golden.vectors).map(([key, x]) => ({
      key,
      label: copy.scenarios[key] ?? key,
      x,
      expect: m.golden.expect[key] as Decision,
    })),
  };
});

export const ALL_SIX_VAULT_BYTES: number = data.allSixVaultBytes;

export const modelByKey = (key: string) => MODELS.find((m) => m.key === key);
export const modelById = (id: number) => MODELS.find((m) => m.id === id);

export function maskOf(keys: string[]): number {
  return keys.reduce((mask, k) => mask | (1 << (modelByKey(k)?.id ?? 0)), 0);
}

export function keysOfMask(mask: number): string[] {
  return MODELS.filter((m) => mask & (1 << m.id)).map((m) => m.key);
}

/** The same integer forward pass the contract runs (see GuardModel.sol). */
export function forward(m: RawModel, x: number[]) {
  const h = m.b1.map((b, j) => {
    const v = x.reduce((acc, xi, i) => acc + m.W1[i][j] * xi, b);
    return v < 0 ? 0 : v;
  });
  const o = m.b2.map((b, k) => h.reduce((acc, hj, j) => acc + hj * m.W2[j][k], b));
  let d: Decision = 0;
  if (o[1] > o[d]) d = 1;
  if (o[2] > o[d]) d = 2;
  return { h, o, d };
}
