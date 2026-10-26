"""Stage 3: the simple baseline (guide M06-M08). The CNN must beat this to justify itself."""
import numpy as np
import pandas as pd
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score


def colour_features(path: str, size: int = 64, bins: int = 16) -> np.ndarray:
    a = np.asarray(Image.open(path).convert("RGB").resize((size, size)), dtype=np.float32)
    feats = []
    for c in range(3):
        h, _ = np.histogram(a[..., c], bins=bins, range=(0, 255), density=True)
        feats.extend(h)
        feats.extend([a[..., c].mean(), a[..., c].std()])
    return np.array(feats, dtype=np.float32)


def run(manifest: str) -> dict:
    df = pd.read_csv(manifest)
    X = {s: np.stack([colour_features(p) for p in df.loc[df.split == s, "path"]]) for s in ["train", "val", "test"]}
    y = {s: df.loc[df.split == s, "label"].to_numpy() for s in X}
    pipe = Pipeline([("scale", StandardScaler()), ("clf", LogisticRegression(max_iter=1000))])
    pipe.fit(X["train"], y["train"])
    out = {s: float(roc_auc_score(y[s], pipe.predict_proba(X[s])[:, 1])) for s in ["val", "test"]}
    print("Baseline (colour histograms + logistic regression) AUC:", out)
    return out
