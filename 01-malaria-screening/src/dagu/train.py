"""Stage 4: two-phase transfer learning with experiment tracking (guide M13 + M16).

Colab-oriented optimisations: cached images, mixed precision (AMP), channels_last,
checkpoint every epoch (resume after a disconnect), early stopping, debug subset.
"""
import argparse, hashlib, json, random, subprocess
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import roc_auc_score

from .cache import load_cache
from .config import load_config, ensure_dir
from .dataset import make_loader
from .model import build_model, set_backbone_trainable

import os
try:
    os.environ.setdefault("MLFLOW_ALLOW_FILE_STORE", "true")
    import mlflow
except ImportError:  # tracking is optional, training still works
    mlflow = None


def set_seed(seed: int) -> None:
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return "unknown"


def file_sha256(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16]


def make_scaler(enabled: bool):
    try:
        return torch.amp.GradScaler("cuda", enabled=enabled)
    except (AttributeError, TypeError):            # older torch
        return torch.cuda.amp.GradScaler(enabled=enabled)


def run_epoch(model, loader, device, loss_fn, opt=None, scaler=None, amp=False):
    train = opt is not None
    model.train(train)
    total, ys, ps = 0.0, [], []
    with torch.set_grad_enabled(train):
        for x, y, _ in loader:
            x = x.to(device, non_blocking=True).contiguous(memory_format=torch.channels_last)
            y = y.to(device, non_blocking=True)
            with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=amp):
                logits = model(x)
                loss = loss_fn(logits, y)
            if train:
                opt.zero_grad(set_to_none=True)
                scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
            total += loss.item() * len(y)
            ys.append(y.cpu().numpy()); ps.append(torch.softmax(logits.float(), 1)[:, 1].detach().cpu().numpy())
    y, p = np.concatenate(ys), np.concatenate(ps)
    auc = roc_auc_score(y, p) if len(set(y)) > 1 else float("nan")
    return total / len(y), auc


def run(cfg: dict, resume: bool = False) -> dict:
    t, d = cfg["train"], cfg["data"]
    set_seed(d["seed"])
    device = "cuda" if torch.cuda.is_available() else "cpu"
    amp = device == "cuda" and t.get("amp", True)
    if device == "cuda":
        torch.backends.cudnn.benchmark = True
    print(f"device={device} amp={amp}")

    df = pd.read_csv(d["manifest"])
    cache = load_cache(cfg)
    print("image cache:", "in use" if cache is not None else "not found (reading files; slower)")
    train_df = df[df.split == "train"]
    if t.get("debug_fraction"):                      # tiny run to test the pipeline quickly
        train_df = train_df.sample(frac=t["debug_fraction"], random_state=d["seed"])
    tr = make_loader(train_df, d["img_size"], True, t["batch_size"], t["num_workers"], cache)
    va = make_loader(df[df.split == "val"], d["img_size"], False, t["batch_size"], t["num_workers"], cache)

    model = build_model(t["pretrained"]).to(device).to(memory_format=torch.channels_last)
    loss_fn = nn.CrossEntropyLoss()
    out_dir = ensure_dir(t["out_dir"])
    plan = [("head", t["lr_head"], False)] * t["epochs_head"] + [("finetune", t["lr_finetune"], True)] * t["epochs_finetune"]

    best, start, bad = {"auc": -1.0, "epoch": -1}, 0, 0
    state = None
    if resume and (out_dir / "last.pt").exists():
        state = torch.load(out_dir / "last.pt", map_location=device)
        model.load_state_dict(state["model"]); best = state["best"]; start = state["epoch"]; bad = state.get("bad", 0)
        print(f"resuming after epoch {start}")

    if mlflow:
        mlflow.set_tracking_uri(t.get("mlflow_uri", f"file:{out_dir}/mlruns"))
        mlflow.set_experiment(t["mlflow_experiment"])
        mlflow.start_run()
        mlflow.log_params({**{k: v for k, v in t.items() if k != "mlflow_uri"}, "img_size": d["img_size"],
                           "seed": d["seed"], "device": device, "git_commit": git_commit(),
                           "manifest_sha": file_sha256(d["manifest"]), "resumed_from": start})

    scaler, opt, prev_phase = make_scaler(amp), None, None
    for epoch in range(start + 1, len(plan) + 1):
        phase, lr, unfreeze = plan[epoch - 1]
        if phase != prev_phase:                      # new phase: new trainable set and optimiser
            set_backbone_trainable(model, unfreeze)
            opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=lr, weight_decay=t["weight_decay"])
            if state is not None and state.get("phase") == phase:
                opt.load_state_dict(state["opt"])
            prev_phase = phase
        tl, _ = run_epoch(model, tr, device, loss_fn, opt, scaler, amp)
        vl, va_auc = run_epoch(model, va, device, loss_fn, amp=amp)
        print(f"[{phase}] epoch {epoch}/{len(plan)}: train_loss={tl:.4f} val_loss={vl:.4f} val_auc={va_auc:.4f}")
        if mlflow:
            mlflow.log_metrics({"train_loss": tl, "val_loss": vl, "val_auc": va_auc}, step=epoch)
        if va_auc > best["auc"]:
            best, bad = {"auc": float(va_auc), "epoch": epoch}, 0
            torch.save(model.state_dict(), out_dir / "best.pt")
        else:
            bad += 1
        torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "epoch": epoch, "phase": phase,
                    "best": best, "bad": bad}, out_dir / "last.pt")      # survives a Colab disconnect
        if phase == "finetune" and bad >= t.get("patience", 3):
            print(f"early stopping: no val AUC gain for {bad} epochs"); break

    meta = {"best_val_auc": best["auc"], "best_epoch": best["epoch"], "img_size": d["img_size"],
            "git_commit": git_commit(), "manifest_sha": file_sha256(d["manifest"]), "amp": amp}
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2))
    if mlflow:
        mlflow.log_artifact(str(out_dir / "best.pt")); mlflow.log_artifact(str(out_dir / "meta.json"))
        mlflow.end_run()
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="configs/config.yaml")
    ap.add_argument("--resume", action="store_true", help="continue from out_dir/last.pt")
    a = ap.parse_args()
    print(run(load_config(a.config), a.resume))
