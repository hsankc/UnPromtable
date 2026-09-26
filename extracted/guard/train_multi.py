import numpy as np, json, os

# Shared 8-input -> 16-hidden -> 3-output architecture across every category
# (keeps the Solidity generator and the vault's dispatch code uniform), but
# each category gets its own feature semantics, its own synthetic normal /
# gray / attack generators, and its own trained weights. Same discipline as
# the original guard/train.py: fixed seeds, deterministic, golden vectors
# checked against the quantized (integer) model before anything is trusted.

Q = 10000

def quantize_and_save(name, Xn, Xg, Xa, golden, rng_seed=0):
    from sklearn.neural_network import MLPClassifier
    X = np.array(Xn + Xg + Xa, dtype=float)
    y = np.array([0] * len(Xn) + [1] * len(Xg) + [2] * len(Xa))
    X[:, 4] = np.minimum(X[:, 4], 3600)
    X[:, 6] = np.minimum(X[:, 6], 5000)
    scale = np.array([10000, 1, 50, 10000, 3600, 100, 5000, 1], dtype=float)
    Xs = X / scale
    rng = np.random.default_rng(rng_seed)
    idx = rng.permutation(len(X))
    split = int(len(X) * 0.8)
    tr, te = idx[:split], idx[split:]
    clf = MLPClassifier(hidden_layer_sizes=(16,), activation="relu", max_iter=2000, random_state=0).fit(Xs[tr], y[tr])
    float_acc = clf.score(Xs[te], y[te])

    W1 = np.round(clf.coefs_[0] / scale[:, None] * Q).astype(int)
    b1 = np.round(clf.intercepts_[0] * Q).astype(int)
    W2 = np.round(clf.coefs_[1] * Q).astype(int)
    b2 = np.round(clf.intercepts_[1] * Q * Q).astype(int)

    def qpred(x):
        h = np.maximum(0, x.astype(np.int64) @ W1 + b1)
        return np.argmax(h @ W2 + b2, axis=1)

    Xi = np.round(X).astype(int)
    int_acc = (qpred(Xi[te]) == y[te]).mean()

    os.makedirs("categories", exist_ok=True)
    with open(f"categories/weights_{name}.json", "w") as f:
        json.dump({"W1": W1.tolist(), "b1": b1.tolist(), "W2": W2.tolist(), "b2": b2.tolist()}, f)

    golden_pred = {k: int(qpred(np.array([v]))[0]) for k, v in golden.items()}
    with open(f"categories/golden_{name}.json", "w") as f:
        json.dump({"vectors": golden, "expect": golden_pred}, f, indent=2)

    print(f"[{name:14s}] float_acc={float_acc:.3f} int_acc={int_acc:.3f} params={W1.size+b1.size+W2.size+b2.size} golden={golden_pred}")


# ---------------------------------------------------------------------------
# 2. nft_purchase — buying NFTs on a marketplace
#    f0 price/treasury bps, f1 collection known, f2 prior buys from collection,
#    f3 hourly spend bps, f4 sec since last buy, f5 collection reputation,
#    f6 price/floor-price ratio x100, f7 seller is contract
def nft_data():
    rng = np.random.default_rng(11)
    def normal(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.8
            price = rng.uniform(5, 150)
            X.append([price, known, rng.integers(1, 20) if known else 0, price + rng.uniform(0, 300),
                      rng.uniform(5, 3600), rng.uniform(60, 100) if rng.random() < 0.8 else rng.uniform(0, 60),
                      rng.uniform(90, 130), rng.random() < 0.3])
        return X
    def gray(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.3
            price = rng.uniform(200, 800)
            X.append([price, known, rng.integers(0, 3) if known else 0, price + rng.uniform(0, 500),
                      rng.uniform(5, 3600), rng.uniform(30, 80), rng.uniform(150, 400), rng.random() < 0.4])
        return X
    def attack(n):
        X = []
        for _ in range(n):
            kind = rng.integers(0, 2)
            if kind == 0:  # wildly above floor, fresh unverified collection
                price = rng.uniform(1500, 9000)
                X.append([price, 0, 0, price, rng.uniform(1, 600), rng.uniform(0, 20), rng.uniform(1000, 5000), rng.random() < 0.7])
            else:  # rapid-fire mint-scam draining
                price = rng.uniform(100, 500)
                X.append([price, rng.random() < 0.3, rng.integers(0, 2), rng.uniform(1500, 6000), rng.uniform(1, 20), rng.uniform(0, 30), rng.uniform(200, 900), 0])
        return X
    golden = {
        "known_collection_fair_price": [40, 1, 8, 120, 600, 85, 105, 0],
        "rugpull_fresh_collection": [8000, 0, 0, 8000, 60, 0, 4000, 1],
        "flood_mint_scam": [300, 0, 1, 4000, 5, 10, 500, 0],
        "new_collection_small": [60, 0, 0, 90, 1200, 70, 110, 0],
        "moderate_premium": [500, 0, 0, 700, 1800, 40, 300, 1],
    }
    return normal(6000), gray(2500), attack(4000), golden


# ---------------------------------------------------------------------------
# 3. defi_swap — DEX token swaps
#    f0 amount/treasury bps, f1 pair known, f2 prior swaps this token,
#    f3 hourly swap vol bps, f4 sec since last swap, f5 token reputation,
#    f6 slippage% x100, f7 token is brand-new (unverified) flag
def swap_data():
    rng = np.random.default_rng(22)
    def normal(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.85
            amt = rng.uniform(1, 80)
            X.append([amt, known, rng.integers(1, 40) if known else 0, amt + rng.uniform(0, 200),
                      rng.uniform(5, 3600), rng.uniform(70, 100) if rng.random() < 0.85 else rng.uniform(0, 70),
                      rng.uniform(10, 100), rng.random() < 0.1])
        return X
    def gray(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.3
            amt = rng.uniform(100, 700)
            X.append([amt, known, rng.integers(0, 4) if known else 0, amt + rng.uniform(0, 500),
                      rng.uniform(5, 3600), rng.uniform(25, 85), rng.uniform(200, 900), rng.random() < 0.4])
        return X
    def attack(n):
        X = []
        for _ in range(n):
            kind = rng.integers(0, 2)
            if kind == 0:  # honeypot: brand new token, huge slippage
                amt = rng.uniform(800, 9500)
                X.append([amt, 0, 0, amt, rng.uniform(1, 900), 0, rng.uniform(2000, 5000), 1])
            else:  # rapid drain via repeated swaps
                amt = rng.uniform(50, 300)
                X.append([amt, rng.random() < 0.4, rng.integers(0, 3), rng.uniform(1500, 6000), rng.uniform(1, 20), rng.uniform(0, 30), rng.uniform(300, 1200), rng.random() < 0.5])
        return X
    golden = {
        "known_pair_small": [20, 1, 15, 90, 600, 90, 30, 0],
        "honeypot_new_token": [9000, 0, 0, 9000, 120, 0, 4500, 1],
        "salami_swap_drain": [150, 0, 1, 4200, 8, 5, 600, 0],
        "new_token_small_amt": [30, 0, 0, 60, 1200, 60, 80, 1],
        "moderate_slippage": [600, 0, 0, 900, 1800, 45, 600, 0],
    }
    return normal(6000), gray(2500), attack(4000), golden


# ---------------------------------------------------------------------------
# 4. subscription — recurring biller payments
#    f0 amount/treasury bps, f1 biller known, f2 prior charges (regularity),
#    f3 hourly outflow bps, f4 sec since last charge, f5 biller reputation,
#    f6 amount vs historical avg x100, f7 first-ever charge to this biller
def subscription_data():
    rng = np.random.default_rng(33)
    def normal(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.9
            amt = rng.uniform(2, 40)
            X.append([amt, known, rng.integers(3, 50) if known else 0, amt + rng.uniform(0, 150),
                      rng.uniform(60, 3600), rng.uniform(70, 100), rng.uniform(90, 110), rng.random() < 0.1])
        return X
    def gray(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.5
            amt = rng.uniform(80, 400)
            X.append([amt, known, rng.integers(0, 3) if known else 0, amt + rng.uniform(0, 300),
                      rng.uniform(5, 3600), rng.uniform(30, 80), rng.uniform(140, 400), rng.random() < 0.5])
        return X
    def attack(n):
        X = []
        for _ in range(n):
            kind = rng.integers(0, 2)
            if kind == 0:  # established biller suddenly charges way more (compromised)
                amt = rng.uniform(1000, 8000)
                X.append([amt, 1, rng.integers(5, 30), amt, rng.uniform(60, 3600), rng.uniform(60, 100), rng.uniform(1500, 5000), 0])
            else:  # subscription-bombing: many brand-new billers, rapid
                amt = rng.uniform(50, 300)
                X.append([amt, 0, 0, amt + rng.uniform(1000, 4000), rng.uniform(1, 30), rng.uniform(0, 30), rng.uniform(100, 900), 1])
        return X
    golden = {
        "regular_biller": [10, 1, 20, 60, 2592, 90, 100, 0],
        "compromised_biller_spike": [5000, 1, 12, 5000, 300, 85, 3000, 0],
        "subscription_bombing": [120, 0, 0, 3500, 5, 10, 400, 1],
        "new_biller_small": [15, 0, 0, 30, 1800, 65, 110, 1],
        "moderate_new_biller": [300, 0, 0, 450, 900, 40, 250, 1],
    }
    return normal(6000), gray(2500), attack(4000), golden


# ---------------------------------------------------------------------------
# 5. treasury_dao — governance-triggered treasury disbursement
#    f0 amount/treasury bps, f1 recipient funded before, f2 prior grants,
#    f3 weekly outflow bps, f4 sec since proposal approved, f5 approval-support pct,
#    f6 amount vs avg grant x100, f7 recipient is multisig/contract
def dao_data():
    rng = np.random.default_rng(44)
    def normal(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.6
            amt = rng.uniform(20, 400)
            X.append([amt, known, rng.integers(1, 10) if known else 0, amt + rng.uniform(0, 600),
                      rng.uniform(60, 3600), rng.uniform(65, 100), rng.uniform(80, 130), rng.random() < 0.7])
        return X
    def gray(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.3
            amt = rng.uniform(500, 1800)
            X.append([amt, known, rng.integers(0, 2) if known else 0, amt + rng.uniform(0, 900),
                      rng.uniform(5, 3600), rng.uniform(35, 70), rng.uniform(150, 400), rng.random() < 0.6])
        return X
    def attack(n):
        X = []
        for _ in range(n):
            kind = rng.integers(0, 2)
            if kind == 0:  # low-quorum flash proposal, huge amount, fresh address
                amt = rng.uniform(2000, 9500)
                X.append([amt, 0, 0, amt, rng.uniform(1, 300), rng.uniform(0, 25), rng.uniform(2000, 5000), rng.random() < 0.3])
            else:  # rapid sequence of "small" grants draining treasury
                amt = rng.uniform(200, 900)
                X.append([amt, rng.random() < 0.3, rng.integers(0, 2), rng.uniform(2500, 7000), rng.uniform(1, 60), rng.uniform(20, 50), rng.uniform(300, 1200), rng.random() < 0.5])
        return X
    golden = {
        "known_contributor_grant": [80, 1, 4, 200, 1800, 90, 100, 1],
        "flash_quorum_drain": [9000, 0, 0, 9000, 30, 5, 4500, 0],
        "salami_grants": [500, 0, 0, 5000, 10, 30, 600, 1],
        "new_contributor_small": [50, 0, 0, 90, 2400, 60, 110, 0],
        "moderate_new_grant": [1000, 0, 0, 1400, 1200, 40, 350, 1],
    }
    return normal(6000), gray(2500), attack(4000), golden


# ---------------------------------------------------------------------------
# 6. social_tip — small tips/rewards to individuals
#    f0 tip/treasury bps, f1 recipient tipped before, f2 prior tip count,
#    f3 hourly tip vol bps, f4 sec since last tip, f5 recipient social score,
#    f6 tip vs avg tip x100, f7 recipient is a contract (should be a person)
def tip_data():
    rng = np.random.default_rng(55)
    def normal(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.7
            amt = rng.uniform(0.5, 15)
            X.append([amt, known, rng.integers(1, 50) if known else 0, amt + rng.uniform(0, 60),
                      rng.uniform(2, 3600), rng.uniform(60, 100), rng.uniform(70, 130), rng.random() < 0.05])
        return X
    def gray(n):
        X = []
        for _ in range(n):
            known = rng.random() < 0.3
            amt = rng.uniform(40, 200)
            X.append([amt, known, rng.integers(0, 3) if known else 0, amt + rng.uniform(0, 150),
                      rng.uniform(1, 3600), rng.uniform(20, 70), rng.uniform(150, 500), rng.random() < 0.3])
        return X
    def attack(n):
        X = []
        for _ in range(n):
            kind = rng.integers(0, 2)
            if kind == 0:  # one huge "tip" disguised as small category
                amt = rng.uniform(500, 9000)
                X.append([amt, 0, 0, amt, rng.uniform(1, 300), rng.uniform(0, 20), rng.uniform(2000, 5000), rng.random() < 0.4])
            else:  # sybil death-by-thousand-cuts: rapid micro-tips, fresh addrs
                amt = rng.uniform(5, 40)
                X.append([amt, 0, 0, amt * rng.integers(20, 200), rng.uniform(0.2, 5), rng.uniform(0, 15), rng.uniform(80, 300), rng.random() < 0.1])
        return X
    golden = {
        "regular_follower_tip": [3, 1, 10, 15, 600, 85, 100, 0],
        "disguised_big_tip": [7000, 0, 0, 7000, 60, 0, 4000, 0],
        "sybil_microtip_drain": [20, 0, 0, 3000, 1, 5, 150, 0],
        "new_recipient_small": [5, 0, 0, 8, 900, 55, 110, 0],
        "contract_recipient_flag": [10, 0, 0, 15, 1200, 40, 120, 1],
    }
    return normal(6000), gray(2500), attack(4000), golden


if __name__ == "__main__":
    for name, gen in [("nft_purchase", nft_data), ("defi_swap", swap_data),
                       ("subscription", subscription_data), ("treasury_dao", dao_data),
                       ("social_tip", tip_data)]:
        Xn, Xg, Xa, golden = gen()
        quantize_and_save(name, Xn, Xg, Xa, golden)
