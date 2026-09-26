# Unpromptable

**Talk it into anything. It still won't pay.**

Monad İstanbul V2 için geliştirildi. AI ajanlarının kendi başına ödeme yaptığı bir dünyada, ajanın ikna edilmesiyle paranın gitmesini engelleyen bir harcama katmanı: ajan hiçbir zaman özel anahtar tutmaz, sadece bir ödeme **önerebilir**; öneriyi onaylayıp onaylamayacağına, zincirde, eğitilmiş küçük bir model ve değiştirilemez matematiksel sınırlar karar verir.

![Ana sayfa](docs/screenshots/01-landing.png)

---

## Sorun

Otonom ödeme yapan AI ajanları (API'lere mikro ödeme, NFT alımı, DEX'te takas, abonelik ödemesi, DAO hazine harcaması, içerik üreticisine bahşiş) faturayı, web sayfasını, token açıklamasını okuyup ödemeye karar verir. Bu girdilerin hiçbiri güvenilir değildir: aralarına gizlenmiş tek bir cümle ajanı ikna edebilir. Ajanın cüzdanının anahtarı elindeyse, ikna olan ajan parayı gönderir. Bu hipotetik değil — otonom ajanların manipüle edilip cüzdanlarının boşaltıldığı gerçek olaylar zaten yaşandı.

## Çözüm

Ajan **hiçbir zaman** özel anahtar tutmaz. Yapabildiği tek şey, bir kasa (vault) kontratına `propose(alıcı, tutar)` çağrısı yapmak — bu çağrı tek başına hiçbir şey ödemez. Kasanın içinde, o ödeme türü için eğitilmiş küçük bir sinir ağı çalışır ve öneriyi onaylar, geciktirir ya da reddeder. Modelin kararı ne olursa olsun, iki sert matematiksel sınır her zaman geçerlidir ve hiçbir model çıktısıyla aşılamaz:

- **Tek işlemde kasanın en fazla %20'si** çıkabilir.
- **Tanınmayan bir adrese günde en fazla %1'i** gidebilir.

```
   Ajan (anahtarsız)                    Kasa Kontratı (zincirde)
   ──────────────────                   ─────────────────────────
   Faturayı/isteği okur      propose()  ┌─────────────────────────┐
   Bir tutar ve alıcı  ───────────────► │ features(alıcı, tutar)  │
   önerir (LLM karar verir)             │  → 8 davranışsal özellik│
                                         │                         │
                                         │ eğitilmiş model         │
                                         │  → onay / beklet / red  │
                                         │                         │
                                         │ sert limitler           │
                                         │  → %20 tek işlem tavanı │
                                         │  → %1 günlük bütçe      │
                                         └───────────┬─────────────┘
                                                      ▼
                                         Onaylandıysa: ödeme gider
                                         Bekletildiyse: 10 dk sonra
                                           serbest bırakılabilir
                                           (sahip veto edebilir)
                                         Reddedildiyse: hiçbir şey
                                           gönderilmez
```

Ajan ne kadar ikna edilmiş olursa olsun, parayı hareket ettiren kod bu değil — kasanın kendisidir.

## Kime hitap ediyor

Her akıllı kontrata değil, **parayı otonom hareket ettiren AI ajanı kuran herkese**: API'ye mikro ödeme yapan, NFT/dijital varlık alan, DEX'te takas yapan, abonelik faturası ödeyen, DAO hazinesinden harcama yapan ya da içerik üreticisine bahşiş dağıtan ajanlar. Sorun somut ve dar: ajan kandırılırsa (ya da hiç kandırılmasa bile sıradan bir fatura abartılı bir tutar isterse) parayı kim durduruyor?

---

## Neden Monad

Modeli zincirde çalıştırmanın tek yolu bu değil — asıl sebep, kararın **parayla aynı işlemde, atomik ve değiştirilemez** olması gerekliliği. Karar off-chain bir serviste çalışsaydı, o servis de manipüle edilebilir ya da bypass edilebilir olurdu; tam olarak çözülmeye çalışılan "tek zayıf nokta" sorununu geri getirirdi. Bunu her mikro ödemede (0,001 MON'luk bir API ödemesi dahil) ekonomik olarak yapabilmek için ucuz ve hızlı yürütme gerekir:

- **Paralel EVM yürütme** → yüksek verim, düşük gecikme.
- **Çok düşük gas maliyeti** → bir sinir ağı ileri geçişini (195 parametre) her ödemede çalıştırmak, ödemenin kendisinden pahalıya mal olmuyor.
- **128 KB kontrat boyutu sınırı** (Ethereum'da 24 KB). Altı kategori modelini birden barındıran bir kasa **38.344 byte** — Ethereum'da bu haliyle deploy edilemez, sadece Monad'da mümkün.

---

## Modeller — nasıl eğitildi

**Karar ağacı/orman değil.** Her kategori için 8 girdi → 16 gizli katman (ReLU) → 3 çıktı (onay/beklet/red) mimarisinde küçük bir **sinir ağı (MLP)**, `scikit-learn`'ün `MLPClassifier`'ı ile eğitildi. Karar ağaçlarının aksine, bir MLP'nin ileri geçişi sabit sayıda çarpma-toplama işlemidir — bu da onu tamsayı ağırlıklarla EVM'de ucuza ve deterministik şekilde çalıştırılabilir hale getiriyor (Solidity'de kayan nokta yok).

**Eğitim verisi:** Her kategori için kategoriye özgü, sentetik ama gerçekçi 3 dağılım — 6.000 "normal" örnek, 2.500 "gri bölge" (sınırda ama makul) örnek, 4.000 "saldırı" örneği (ani boşaltma, salam-dilimleme saldırısı, taze/doğrulanmamış alıcıya aşırı tutar). %80/%20 eğitim/test ayrımı, sabit rastgelelik tohumu — tamamen tekrarlanabilir.

**8 özellik** (her kategoride aynı şema, farklı anlam):
1. Tutar / kasa bakiyesi oranı (baz puan)
2. Alıcı daha önce ödeme aldı mı
3. Alıcıya önceki ödeme sayısı
4. Son 1 saatteki toplam çıkış oranı
5. Son ödemeden bu yana geçen süre
6. Alıcının itibar puanı (0-100) — bkz. [ERC-8004](#kullanılan-standartlar) aşağıda
7. Tutar / ortalama ödeme oranı
8. Alıcı bir kontrat mı

**Eğitim sonrası:** Ağırlıklar tamsayıya (ölçek 10.000) yuvarlanıp Solidity koduna gömülüyor. Bu tekrar bu oturumda doğrulandı: eğitim scripti yeniden çalıştırıldı, çıkan ağırlıklar zincirde deploy edilenlerle **bit bit aynı** çıktı.

| Kategori | Giriş fonksiyonu | Parametre | Doğruluk (tamsayı model, test seti) |
|---|---|---|---|
| API / servis ödemesi | `proposePayment` | 195 | %99,8 |
| NFT / dijital varlık alımı | `proposeNftPurchase` | 195 | %100 |
| DeFi takas | `proposeSwap` | 195 | %100 |
| Abonelik / tekrarlayan ödeme | `proposeSubscription` | 195 | %100 |
| DAO hazine harcaması | `proposeGrant` | 195 | %99,9 |
| Sosyal bahşiş / ödül | `proposeTip` | 195 | %99,9 |

Her model, sitede `/app/modeller/<kategori>` altında **canlı test edilebilir**: girdiğin 8 sayı gerçekten zincire gidip deploy edilmiş modelden (`GuardLab` kontratı) cevap alır — tarayıcıda simülasyon yok.

![Model detayı — zincirde canlı test](docs/screenshots/04-model-detail.png)

### Kullanılan standartlar

- **x402** — HTTP 402 tabanlı, ajanların API'lere mikro ödeme yapması için gelişmekte olan bir ödeme standardı. `api_payment` kategorisi tam olarak bu deseni modelliyor.
- **ERC-8004** — zincirdeki AI ajanları için gelişmekte olan bir itibar/kimlik standardı. Modellerin 6. özelliği ("itibar puanı") bu konsepte göre tasarlandı. Bugün bu puan basit, sahibinin elle güncellediği bir `MockReputation` kontratından geliyor — üretimde gerçek bir ERC-8004 kayıt defterine bağlanacak entegrasyon noktası, dürüstçe belirtelim: bu hackathon'un çözdüğü kısım değil.

---

## Site haritası

### Genel Bakış (`/app`)
Zincirden okunan kayıtlı kasa sayısı, hazineye giden toplam ücret, kullanıcının kendi kasaları, son kararlar ve son oluşturulan kasalar.

![Genel Bakış](docs/screenshots/03-app-overview.png)

### Modeller (`/app/modeller`)
6 modelin listesi ve her biri için: mimari, gerçek ölçülmüş bytecode boyutu, özellik tablosu, zincirde canlı deneme formu, ve **altın testler** (5 el yapımı senaryo, beklenen karar ile zincirdeki gerçek kararın karşılaştırması — hepsi eşleşiyor).

### Kontrat Oluştur (`/app/olustur`)
4 adımlı akış: modelleri seç → başlangıç fonunu belirle → incele (gerçek derlenmiş kontrat boyutu, 128 KB sınırına göre) → **tek imzayla** cüzdanından onayla. Tek işlem: registry fabrika kontratı kasayı deploy eder, ücreti hazineye gönderir, kasayı kaydeder — hepsi atomik.

![Kontrat oluştur](docs/screenshots/05-create-vault.png)

### N Protocol (`/app/getir`) — mevcut kontratını getir
Kendi Solidity kontratını yapıştır:
1. **Ücretsiz ön kontrol** — kontrat izole bir ortamda gerçekten derlenir, MON gönderen her satır statik olarak bulunur, ve bir yapay zeka modeli kontratın **tamamını** okuyup ne işe yaradığını özetler, gözden kaçabilecek riskleri (erişim kontrolü eksikliği, kontrolsüz dönüş değeri vb.) listeler.
2. **Koruma filtreleri (önizleme)** — aynı model, kontrata özel koruma önerileri çıkarır (tek işlem tavanı, minimum tutar, sadece onaylı adresler...), her biri fiyatlı. **Dürüstlük notu: bu filtreler henüz zincirde uygulanmıyor** — bugün gerçekten uygulanan tek limitler, kasa oluştururken seçilen tek-işlem tavanı ve günlük bütçe. Ödeme gerçek, filtre uygulaması yol haritası.
3. **Ödeme** — dönüşüm ücreti (+ seçilen filtreler) cüzdanla tek işlemde hazineye ödenir; sunucu bu ödemeyi zincirde görmeden hiçbir şey üretmez.
4. **Dönüşüm** — bulunan her ödeme satırı, ilgili kategori modeline yönlendiren bir çağrıyla mekanik olarak değiştirilir (model kod yazmaz, sadece kategori seçer), yamalı kontrat yeniden derlenir.

![N Protocol — ücretsiz ön kontrol](docs/screenshots/06-nprotocol-precheck.png)
![N Protocol — koruma filtreleri](docs/screenshots/07-nprotocol-filters.png)

### Kontratlar (`/app/kontratlar`)
Registry'den okunan her kasa: sahibi, seçtiği modeller, ödediği ücret. Detay sayfasında bakiye, sert limitler, canlı karar akışı, bekleyen (gecikmeli) ödemeler ve sahip için veto/serbest bırak/fonla işlemleri.

![Kontratlar](docs/screenshots/08-vault-explorer.png)

### Saldırı Dene (`/app/saldiri`)
Cüzdan gerektirmez. Sahte bir fatura ya da gizli talimat (prompt injection) yaz; **gerçek Gemini destekli ajan** okuyup bir öneri üretir, öneri gerçek bir röle (relay) üzerinden zincire gider, kasa karar verir. Hazır senaryolardan biri: sıradan görünen, şüphe uyandırmayan ama abartılı tutarlı bir "abonelik faturası" — ajan hiç şüphelenmeden öneriyi olduğu gibi iletir, kasa yine de %20 tavanı aştığı için reddeder. Yani ajanın "akıllı" olması bile yetmiyor; gerçek güvenlik kontratın kendisinde.

![Saldırı Dene](docs/screenshots/09-attack-playground.png)

### Hazine (`/app/hazine`)
Platformun aldığı her ücret, kalemine göre (kasa oluşturma, N Protocol dönüşümü, protokol payı) ve tek tek işlem listesiyle. Kimse elle toplamaz — her ücret aynı işlemde hazine adresine gider.

![Hazine](docs/screenshots/10-treasury.png)

### Entegrasyon (`/app/entegrasyon`)
Kendi ajanını 3 adımda bir kasaya bağlama rehberi (viem ve Solidity örnekleriyle), kararların anlamı, adresler.

### Sahne (`/sahne`, `/sahne/telefon`)
Salon projeksiyonu için tam ekran, koyu tema bir sunum ekranı ve izleyicilerin kendi telefonlarından saldırı denemesi yapabileceği bir form — sunum sırasında kullanılmak üzere.

![Sahne](docs/screenshots/11-stage.png)

Site 375px genişliğe kadar tamamen duyarlı:

<img src="docs/screenshots/12-mobile.png" width="360" alt="Mobil görünüm">

---

## Gelir modeli

Üç ücret kalemi, hepsi doğrudan hazine adresine (`0x3D25…E452`) gidiyor, hiçbiri elle toplanmıyor:

| Kalem | Ne zaman | Tutar |
|---|---|---|
| Kasa oluşturma | Kasa deploy edilirken, tek sefer | Seçilen model başına 0,001 MON |
| N Protocol dönüşümü | Mevcut kontratı dönüştürürken | En az 0,01 MON (+ seçilen filtreler) |
| Protokol payı | Kasadan yapılan her onaylı ödemede | Ödenen tutarın %0,1'i |

---

## Ne gerçek, ne değil

Proje boyunca ilke: **gerçek olmayan hiçbir şeyi gerçekmiş gibi göstermemek.**

**Gerçek ve zincirde doğrulanmış:**
- 6 kategori modelinin tamamı zincirde deploy edilmiş, eğitim ağırlıklarıyla bit bit eşleşiyor.
- Kasa oluşturma tarayıcının kullandığı birebir kod yoluyla test edildi: registry sayacı arttı, kasa bakiyesi istenen tutarla eşleşti — `VaultCreated` olayı ve `getCode` ile doğrulandı (Monad'ın kendi `receipt.status` alanı bazen yanıltıcı olduğu için ona güvenilmedi).
- N Protocol dönüşümü gerçek bir ödemeyle uçtan uca test edildi: 0,01 MON ödendi, zincirden doğrulandı, yapay zeka üç ödeme noktasını doğru sınıflandırdı, yamalı kod yeniden derlendi.
- Saldırı Dene'de gerçek bir Gemini çağrısı, gerçek bir röle, gerçek bir zincir kararı var.
- Hazine sayfasındaki her sayı, indekslenmiş zincir olaylarının toplamı.

**Henüz gerçek olmayan / yol haritası:**
- N Protocol'ün önerdiği koruma filtreleri (tek-işlem-tavanı ve günlük-bütçe dışındakiler) şu an sadece fiyatlı bir önizleme — zincirde uygulanmıyor.
- İtibar puanı kaynağı bugün basit bir demo kontratı, gerçek bir ERC-8004 kayıt defteri değil.

---

## Dağıtılmış kontratlar (Monad Testnet, chain id 10143)

| Kontrat | Adres |
|---|---|
| Registry (kasa fabrikası) | `0xc7bF53E580E19384d80DFCEc4dAAf6d4fEBF6409` |
| GuardLab (canlı model testi) | `0x017818c3B30e538de2418FCE459cA2B0E625e083` |
| Demo kasa | `0x0820015450fc95395EE4B8A927569211652C951B` |
| Paylaşılan itibar kaynağı | `0xFfc80c21C218b67B6d18282a52b68dfA0e2681C8` |
| Hazine | `0x3D254CE41d2462A1292aAD726A39E6845fcDe452` |

Explorer: https://testnet.monadexplorer.com · Faucet: https://faucet.monad.xyz/

---

## Teknoloji

- **Zincir:** Monad Testnet (EVM uyumlu), Foundry (Solidity 0.8.37, `via_ir`), viem
- **Önyüz:** Next.js (App Router), TypeScript, kendi tasarım sistemi (token tabanlı, framework'süz CSS)
- **Cüzdan:** MetaMask / EIP-6963, özel Monad Testnet ağ tanımı
- **Ajan / LLM:** Google Gemini (ajan kararları ve Saldırı Dene demosu), Anthropic Claude (N Protocol'ün kontrat-anlama ve filtre önerisi adımı) — ikisi de gerçek API çağrıları, mock değil
- **Model eğitimi:** Python, scikit-learn (`MLPClassifier`), NumPy
- **Backend servisler:** Node.js/TypeScript — zincir indeksleyici, kasa derleyici, N Protocol boru hattı, ajan röle sunucusu

## Yerel çalıştırma

```bash
cd services && npm run relay   # 8787 — ajanın WebSocket köprüsü
cd services && npm run api     # 8790 — indeksleyici + derleyici + N Protocol
cd web && npm run dev          # 3000 — site
```

`agent/.env` (git'e dahil değil) içinde bir Gemini anahtarı, isteğe bağlı bir Claude anahtarı, RPC ayarları ve birkaç tek-kullanımlık cüzdan anahtarı gerekir — bkz. `agent/.env.example`. Foundry (`forge`) kurulu ve `services/lib/env.ts`'deki yoldan erişilebilir olmalı.

## Depo yapısı

| Yol | İçerik |
|---|---|
| `web/` | Ürün — Next.js sitesi |
| `services/` | Backend: zincir indeksleyici, kasa derleyici, N Protocol boru hattı, ajan röle sunucusu |
| `agent/` | Anahtarsız ajan: Gemini destekli karar adımı + röle havuzu üzerinden `propose()` gönderimi |
| `extracted/guard/` | Solidity kontratları ve 6 kategori modelinin eğitim kodu (Foundry projesi) |
