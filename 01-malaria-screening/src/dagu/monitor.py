"""Stage 7: drift monitoring (guide M16 section C). Population Stability Index on input statistics."""
import argparse, json

import numpy as np
import pandas as pd


def psi(ref: np.ndarray, cur: np.ndarray, bins: int = 10) -> float:
    """<0.1 stable, 0.1-0.25 watch closely, >0.25 investigate / retrain (rules of thumb)."""
    ref, cur = np.asarray(ref, float), np.asarray(cur, float)
    edges = np.quantile(ref, np.linspace(0, 1, bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf
    edges = np.unique(edges)
    r = np.histogram(ref, edges)[0] / len(ref) + 1e-6
    c = np.histogram(cur, edges)[0] / len(cur) + 1e-6
    return float(np.sum((c - r) * np.log(c / r)))


def drift_report(ref_csv: str, log_jsonl: str, cols=("blur", "brightness", "pct")) -> dict:
    ref = pd.read_csv(ref_csv)
    cur = pd.read_json(log_jsonl, lines=True)
    out = {}
    for c in cols:
        if c not in ref or c not in cur:           # e.g. the reference has no prediction column yet
            out[c] = None
            continue
        a, b = ref[c].dropna(), cur[c].dropna()
        out[c] = psi(a, b) if len(a) > 20 and len(b) > 20 else None
    out["recapture_rate"] = float((cur["status"] == "recapture").mean()) if "status" in cur else None
    return out


def make_reference(manifest: str, qcfg: dict, out_csv: str, n: int = 300) -> None:
    """Reference input statistics from validation images (blur, brightness, pct)."""
    import cv2
    from .quality import assess
    full_df = pd.read_csv(manifest)
    val_df = full_df[full_df.split == "val"]
    case_pct_map = (val_df.groupby("case")["label"].mean() * 100).to_dict()
    sampled = val_df.sample(min(n, len(val_df)), random_state=0)
    rows = []
    for _, r in sampled.iterrows():
        a = assess(cv2.imread(r["path"]), {**qcfg, "min_blur_var": 0})
        rows.append({"blur": a["blur_var"], "brightness": a["brightness"],
                     "pct": float(case_pct_map.get(r["case"], 50.0))})
    pd.DataFrame(rows).to_csv(out_csv, index=False)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--ref", required=True); ap.add_argument("--log", required=True)
    a = ap.parse_args(); print(json.dumps(drift_report(a.ref, a.log), indent=2))
