"""Stage 2: index the images and split BY PATIENT, never by image.

Cells from the same patient look alike, so a random image-level split leaks
patient identity into the test set and inflates every metric (guide M09: leakage).
"""
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

from .config import ensure_dir

CLASSES = ["Uninfected", "Parasitized"]  # index 1 = positive class


_TOKEN = re.compile(r"^(C\d+)(?:(P\d+))?", re.IGNORECASE)


def tokens(filename: str) -> list:
    """'C33P1thinF_IMG_...' -> ['C33', 'P1'];  'C1_thinF_IMG_...' -> ['C1'].
    NLM documents that 'P1' is the patient id inside names like C33P1thinF_IMG_..._cell_179.png."""
    m = _TOKEN.match(filename)
    return [t.upper() for t in m.groups() if t] if m else [filename.split("_")[0]]


def assign_groups(names: list) -> list:
    """Group images that share ANY id token (union-find), so no patient can straddle two splits
    whichever token turns out to be the true patient key. Over-merging is safe; under-merging leaks."""
    parent = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for n in names:
        t = tokens(n)
        for x in t:
            parent.setdefault(x, x)
        for x in t[1:]:
            parent[find(x)] = find(t[0])
    return [find(tokens(n)[0]) for n in names]


def case_id(filename: str) -> str:
    """Kept for single-file lookups; real splitting uses assign_groups over all files."""
    return tokens(filename)[0]


def build_index(root: str) -> pd.DataFrame:
    rows = []
    for label, cls in enumerate(CLASSES):
        for p in sorted((Path(root) / cls).glob("*.png")):
            rows.append({"path": str(p), "label": label, "name": p.name})
    if not rows:
        raise FileNotFoundError(f"No PNG images found under {root}/(Parasitized|Uninfected)")
    df = pd.DataFrame(rows)
    df["case"] = assign_groups(df["name"].tolist())
    share = df["case"].value_counts(normalize=True).iloc[0]
    if share > 0.15:
        print(f"WARNING: one group holds {share:.0%} of all images. The id rule is over-merging; "
              "check filenames against NLM's patient-ID CSV files before trusting the split.")
    return df.drop(columns="name")


def split_by_case(df: pd.DataFrame, val_frac: float, test_frac: float, seed: int) -> pd.DataFrame:
    gss = GroupShuffleSplit(n_splits=1, test_size=test_frac, random_state=seed)
    trval_idx, test_idx = next(gss.split(df, groups=df["case"]))
    trval = df.iloc[trval_idx]
    rel_val = val_frac / (1.0 - test_frac)
    gss2 = GroupShuffleSplit(n_splits=1, test_size=rel_val, random_state=seed)
    tr_idx, va_idx = next(gss2.split(trval, groups=trval["case"]))
    out = df.copy()
    out["row"] = np.arange(len(df))      # stable row id, used to look images up in the cache
    out["split"] = ""
    out.loc[trval.index[tr_idx], "split"] = "train"
    out.loc[trval.index[va_idx], "split"] = "val"
    out.loc[df.index[test_idx], "split"] = "test"
    assert_no_leakage(out)
    return out


def assert_no_leakage(df: pd.DataFrame) -> None:
    sets = {s: set(df.loc[df["split"] == s, "case"]) for s in ["train", "val", "test"]}
    for a, b in [("train", "val"), ("train", "test"), ("val", "test")]:
        overlap = sets[a] & sets[b]
        assert not overlap, f"LEAKAGE: cases in both {a} and {b}: {sorted(overlap)[:5]}"
    assert (df["split"] != "").all(), "Some rows were not assigned to a split"


def summarise(df: pd.DataFrame) -> pd.DataFrame:
    g = df.groupby("split")
    return pd.DataFrame({
        "images": g.size(),
        "cases": g["case"].nunique(),
        "pct_parasitized": (g["label"].mean() * 100).round(1),
    })


def prepare(cfg: dict) -> pd.DataFrame:
    d = cfg["data"]
    df = build_index(d["root"])
    df = split_by_case(df, d["val_frac"], d["test_frac"], d["seed"])
    ensure_dir(Path(d["manifest"]).parent)
    df.to_csv(d["manifest"], index=False)
    print(summarise(df).to_string())
    return df
