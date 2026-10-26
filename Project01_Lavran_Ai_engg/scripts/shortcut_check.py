"""EDA: is the baseline reading the PARASITE or the SLIDE?

A colour-histogram model scoring AUC 0.91 is suspiciously good. Infected patients' slides may simply be stained
differently from healthy patients' slides. This compares the mean P(infected) for three groups of TEST cells:
  A uninfected cells from healthy patients      (should score low)
  B uninfected cells from INFECTED patients     (same slide as infected cells; should also score low)
  C parasitized cells                           (should score high)
If B scores much closer to C than A does, colour is partly identifying the patient/slide, not the parasite.
Usage: python scripts/shortcut_check.py [--config configs/config.yaml] [--n-train 6000]"""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from dagu.baseline import colour_features
from dagu.config import load_config

ap = argparse.ArgumentParser(); ap.add_argument("--config", default="configs/config.yaml"); ap.add_argument("--n-train", type=int, default=6000)
a = ap.parse_args()
df = pd.read_csv(load_config(a.config)["data"]["manifest"])

sick = set(df.loc[df.label == 1, "case"])
df["group"] = np.where(df.label == 1, "C parasitized",
              np.where(df.case.isin(sick), "B uninfected, infected patient's slide", "A uninfected, healthy patient"))

train = df[df.split == "train"]; train = train.sample(min(a.n_train, len(train)), random_state=0)
test = df[df.split == "test"].copy()
feats = lambda d: np.stack([colour_features(p) for p in d["path"]])
pipe = Pipeline([("s", StandardScaler()), ("c", LogisticRegression(max_iter=1000))]).fit(feats(train), train["label"])
test["p"] = pipe.predict_proba(feats(test))[:, 1]

print(test.groupby("group")["p"].agg(n="size", mean_p="mean", share_flagged=lambda s: (s >= 0.5).mean()).round(3).to_string())

def auc(g1, g2):
    s = test[test.group.isin([g1, g2])]
    return roc_auc_score(s["label"], s["p"]) if s["label"].nunique() == 2 else float("nan")

C, B, A = "C parasitized", "B uninfected, infected patient's slide", "A uninfected, healthy patient"
print(f"\nAUC parasitized vs healthy-patient cells      : {auc(C, A):.3f}")
print(f"AUC parasitized vs SAME-slide uninfected cells : {auc(C, B):.3f}   <- the honest one")
print("A big gap between those two AUCs means the baseline partly reads slide/stain, not the parasite.")