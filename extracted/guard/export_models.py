"""Exports the six trained guard models for the web app.

Writes web/src/data/models.json with, per category: the integer weights the
contract actually uses, the golden test vectors with their expected
decisions, and the measured runtime bytecode size of a vault that contains
only that model (plus the size of the vault with all six). Sizes come from a
real `forge build` of each generated vault, not from estimates.

    python export_models.py            # weights + goldens + sizes
    python export_models.py --no-size  # skip the (slow) builds
"""
import json, os, subprocess, sys
from generate_vault import CATEGORIES, generate

FORGE = os.environ.get("FORGE_BIN", r"C:\Users\hasan\.foundry\bin\forge.exe")
OUT = os.path.join("..", "..", "web", "src", "data", "models.json")


def weights_for(key):
    """Returns (weights, golden) with golden as {"vectors": {...}, "expect": {...}}."""
    if key == "api_payment":
        # The original model's golden file predates the category format; its
        # expected decisions are the ones asserted in test/ModelGas.t.sol.
        vectors = json.load(open("golden.json"))
        expect = dict(zip(vectors.keys(), [0, 2, 2, 0, 1]))
        return json.load(open("weights.json")), {"vectors": vectors, "expect": expect}
    return json.load(open(f"categories/weights_{key}.json")), json.load(open(f"categories/golden_{key}.json"))


def runtime_size(keys, name):
    path = f"src/generated/{name}.sol"
    with open(path, "w") as f:
        f.write(generate(keys, name))
    try:
        subprocess.run([FORGE, "build", "--skip", "test", "--skip", "script"], check=True, capture_output=True)
        art = json.load(open(f"out/{name}.sol/{name}.json"))
        return (len(art["deployedBytecode"]["object"]) - 2) // 2
    finally:
        os.remove(path)


def main():
    measure = "--no-size" not in sys.argv
    models = []
    for cid, key, suf, fn in CATEGORIES:
        w, g = weights_for(key)
        entry = {
            "id": cid,
            "key": key,
            "entry": fn,
            "W1": w["W1"], "b1": w["b1"], "W2": w["W2"], "b2": w["b2"],
            "params": sum(len(r) for r in w["W1"]) + len(w["b1"]) + sum(len(r) for r in w["W2"]) + len(w["b2"]),
            "golden": g,
        }
        if measure:
            entry["vaultBytes"] = runtime_size([key], f"Measure{suf}")
            print(key, entry["vaultBytes"], "bytes", flush=True)
        models.append(entry)
    data = {"models": models}
    if measure:
        data["allSixVaultBytes"] = runtime_size([c[1] for c in CATEGORIES], "MeasureAll")
        print("all six", data["allSixVaultBytes"], "bytes")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
