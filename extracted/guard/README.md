# Anahtarsız Ajan — fizibilite prototipi

Bir AI ajanının hazinesi. LLM'in anahtarı yok, sadece `propose(to, amount)` çağırabilir.
Paranın tek çıkış kapısı: işlemin içinde çalışan 8→16→3 sinir ağı (195 parametre, tamsayı ağırlık).

## Dosyalar
- `train.py` — sentetik ajan-ödeme verisi üretir, MLP eğitir, tamsayıya çevirir (`weights.json`)
- `src/GuardModel.sol` — `weights.json`'dan üretilmiş zincir-içi model (onayla / beklet / reddet)
- `src/KeylessVault.sol` — hazine: özellikleri zincirden hesaplar, modeli çalıştırır, sert sınırları uygular
- `test/` — normal ödeme, Grok tarzı boşaltma, salam saldırısı, gas ölçümü, Python↔Solidity eşleşmesi
- `attack_sim.py` / `attack_sim_fixed.py` — ağırlıkları bilen saldırganın simülasyonu (düzeltme öncesi/sonrası)

## Çalıştırma
```sh
pip install numpy scikit-learn && python3 train.py
forge install foundry-rs/forge-std   # veya lib/forge-std klonla
forge test --network monad -vv       # Foundry v1.8+ gerekli
python3 attack_sim.py && python3 attack_sim_fixed.py
```
Doğrulandı: Foundry 1.8.3 (solc 0.8.37 otomatik indirilir), Python 3.12 + numpy/scikit-learn
ile tüm adımlar temiz makinede baştan çalıştırıldı — 5/5 test geçti, gas ve saldırı sonuçları
aşağıdaki tabloyla birebir eşleşti, `train.py` bit-bit aynı `weights.json`'ı üretti (rng=7 ile
tam deterministik).

## Sonuçlar (Monad yürütme kurallarıyla, Foundry 1.8.3)
| Durum | Karar | Gas (propose, toplam) |
|---|---|---|
| Bilinen API sağlayıcısına küçük ödeme | onay | ~146k |
| Hazinenin %95'i yeni adrese (Grok tarzı) | red | ~131k |
| %15 yeni adrese (%20 sert limitin altında) | red | ~131k |
| Hızlı küçük dilimler yeni adrese | ilk dilimde red | — |

Sadece model: ~33–44k gas. Python ve Solidity 5 test vektörünün hepsinde aynı kararı veriyor.

## Kırmızı takım bulgusu
İlk versiyonda ağırlıkları bilen saldırgan, küçük onaylı ödemelerle kendi "geçmişini" inşa edip
1 saatte hazinenin ~%35–45'ini, 24 saatte tamamını çekebiliyordu (dairesel güven).
Düzeltme: (1) kasanın kendi onayları bir alıcıyı "tanıdık" yapmaz, güven dışarıdan gelir
(sahip listesi veya ERC-8004 itibarı); (2) tanınmayan alıcılara günlük toplam %1 bütçe.
Sonrası: sabit periyot başına en fazla %1 (doğrulandı: 1 saatlik saldırı penceresinde tam %1.0
çalınabiliyor). Not: `dayCap` gerçek kayan 24s pencere değil, "son sıfırlamadan bu yana"
sayacı — saldırı tam periyot sınırını ortalarsa (biri sıfırlamadan hemen önce, biri hemen
sonra) teorik olarak ~%2'ye kadar çıkabilir (24 saatlik simülasyonda gözlemlendi: %2.01).
Sıkı bir garanti için gerçek kayan pencereye geçmek gerekir — bu prototipte yapılmadı.

## Uyarılar
- Veri sentetik; %100 doğruluk anlamsız. Gerçek ajan geçmişi + saldırı seti gerekir.
- ERC-8004 itibarı burada mock. Gerçek kullanımda sadece güvenilen/ödeme yapmış değerlendiricilerin puanı sayılmalı (Sybil riski).
- Denetlenmemiş deneme kodudur.
