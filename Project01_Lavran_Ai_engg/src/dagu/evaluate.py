"""Stage 4/6: honest evaluation. Threshold from VALIDATION, numbers from TEST,
confidence intervals that resample PATIENTS (not images), plus error analysis."""
import argparse, json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image
from sklearn.metrics import confusion_matrix, roc_auc_score, roc_curve


def pick_threshold(y, p, target_sens: float = 0.95) -> float:
    """Lowest false-positive rate that still reaches the target sensitivity."""
    _, tpr, thr = roc_curve(y, p)
    i = int(np.where(tpr >= target_sens)[0][0])
    t = float(thr[i])
    return 1.0 if np.isinf(t) else t


def metrics_at(y, p, thr: float) -> dict:
    pred = (p >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    sens = tp / (tp + fn) if (tp + fn) else float("nan")
    spec = tn / (tn + fp) if (tn + fp) else float("nan")
    prec = tp / (tp + fp) if (tp + fp) else float("nan")
    f1 = 2 * prec * sens / (prec + sens) if (prec + sens) else float("nan")
    auc = roc_auc_score(y, p) if len(set(y)) > 1 else float("nan")
    return {"sensitivity": sens, "specificity": spec, "precision": prec, "f1": f1, "auc": auc,
            "tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)}


def cluster_bootstrap(y, p, groups, thr, n=1000, seed=0) -> dict:
    """95% CI by resampling whole patients: images of one patient are not independent."""
    rng = np.random.default_rng(seed)
    by_group = {g: np.where(groups == g)[0] for g in np.unique(groups)}
    keys = list(by_group)
    draws = {k: [] for k in ["sensitivity", "specificity", "auc"]}
    for _ in range(n):
        idx = np.concatenate([by_group[k] for k in rng.choice(keys, size=len(keys), replace=True)])
        m = metrics_at(y[idx], p[idx], thr)
        for k in draws:
            draws[k].append(m[k])
    return {k: [float(np.nanpercentile(v, 2.5)), float(np.nanpercentile(v, 97.5))] for k, v in draws.items()}


def by_group(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """Performance per group (guide M17: fairness = look beyond the aggregate)."""
    rows = []
    for g, sub in df.groupby(col):
        pos, neg = sub[sub.label == 1], sub[sub.label == 0]
        rows.append({col: g, "n": len(sub),
                     "sensitivity": (pos.pred == 1).mean() if len(pos) else np.nan,
                     "specificity": (neg.pred == 0).mean() if len(neg) else np.nan})
    return pd.DataFrame(rows).sort_values("n", ascending=False)


def plot_confusion(m: dict, path: Path) -> None:
    cm = np.array([[m["tn"], m["fp"]], [m["fn"], m["tp"]]])
    fig, ax = plt.subplots(figsize=(3.6, 3.4))
    ax.imshow(cm, cmap="Blues")
    ax.set_xticks([0, 1], ["Uninfected", "Parasitized"]); ax.set_yticks([0, 1], ["Uninfected", "Parasitized"])
    ax.set_xlabel("Predicted"); ax.set_ylabel("True")
    for (i, j), v in np.ndenumerate(cm):
        ax.text(j, i, str(v), ha="center", va="center")
    fig.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)


def plot_errors(df: pd.DataFrame, path: Path, k: int = 12) -> None:
    """The most confident mistakes: look at them (guide Lab 13.1, step 4)."""
    wrong = df[df.pred != df.label].copy()
    wrong["conf"] = np.where(wrong.label == 1, 1 - wrong.prob, wrong.prob)
    wrong = wrong.sort_values("conf", ascending=False).head(k)
    if wrong.empty:
        return
    cols = 4; rows = int(np.ceil(len(wrong) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 2.2, rows * 2.4), squeeze=False)
    for ax in axes.ravel():
        ax.axis("off")
    for ax, (_, r) in zip(axes.ravel(), wrong.iterrows()):
        ax.imshow(Image.open(r.path).convert("RGB"))
        ax.set_title(f"true={int(r.label)} p={r.prob:.2f}\n{r.case}", fontsize=7)
    fig.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)


def collect(model, loader, device):
    import torch
    model.eval(); ys, ps, idx = [], [], []
    with torch.no_grad():
        for x, y, i in loader:
            ps.append(torch.softmax(model(x.to(device)), 1)[:, 1].cpu().numpy())
            ys.append(y.numpy()); idx.append(i.numpy())
    return np.concatenate(ys), np.concatenate(ps), np.concatenate(idx)


def run(cfg: dict, ckpt: str = None) -> dict:
    import torch
    from .cache import load_cache
    from .dataset import make_loader
    from .model import build_model
    d, e, t = cfg["data"], cfg["eval"], cfg["train"]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    ckpt = ckpt or str(Path(t["out_dir"]) / "best.pt")
    model = build_model(pretrained=False)
    model.load_state_dict(torch.load(ckpt, map_location=device)); model.to(device)

    df = pd.read_csv(d["manifest"]); cache = load_cache(cfg)
    val, test = df[df.split == "val"].reset_index(drop=True), df[df.split == "test"].reset_index(drop=True)
    lv = make_loader(val, d["img_size"], False, t["batch_size"], t["num_workers"], cache)
    lt = make_loader(test, d["img_size"], False, t["batch_size"], t["num_workers"], cache)

    yv, pv, _ = collect(model, lv, device)
    thr = pick_threshold(yv, pv, e["target_sensitivity"])           # chosen on VALIDATION only
    yt, pt, it = collect(model, lt, device)
    m = metrics_at(yt, pt, thr)
    ci = cluster_bootstrap(yt, pt, test.loc[it, "case"].to_numpy(), thr, e["bootstrap"], d["seed"])

    out = ensure(Path(e["report_dir"]))
    pred_df = test.loc[it].copy(); pred_df["prob"] = pt; pred_df["pred"] = (pt >= thr).astype(int)
    pred_df.to_csv(out / "test_predictions.csv", index=False)
    by_group(pred_df, "case").to_csv(out / "per_case_performance.csv", index=False)
    plot_confusion(m, out / "confusion_matrix.png"); plot_errors(pred_df, out / "top_errors.png")
    (Path(t["out_dir"]) / "threshold.json").write_text(json.dumps({"threshold": thr, "target_sensitivity": e["target_sensitivity"]}))
    report = {"threshold": thr, "test": m, "ci95_by_patient": ci, "n_test_images": int(len(yt)),
              "n_test_patients": int(test["case"].nunique())}
    (out / "metrics.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return report


def ensure(p: Path) -> Path:
    p.mkdir(parents=True, exist_ok=True); return p


if __name__ == "__main__":
    from .config import load_config
    ap = argparse.ArgumentParser(); ap.add_argument("--config", default="configs/config.yaml"); ap.add_argument("--ckpt")
    a = ap.parse_args(); run(load_config(a.config), a.ckpt)
