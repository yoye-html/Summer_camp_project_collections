"""Optimisation: decode and resize every image ONCE into one uint8 array.

Each training epoch then reads from memory instead of decoding ~27k PNG files
(slow on Colab, and very slow if the files sit on a mounted Google Drive).
The cache stores the manifest hash, so a stale cache can never be used silently.
"""
import hashlib, json
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

from .config import ensure_dir


def manifest_sha(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16]


def cache_paths(cfg: dict):
    d = cfg["data"]
    base = Path(d.get("cache_dir", "data/cache"))
    return base / f"cells_{d['img_size']}.npy", base / f"cells_{d['img_size']}.json"


def build_cache(cfg: dict) -> Path:
    d = cfg["data"]
    df = pd.read_csv(d["manifest"]).sort_values("row")
    npy, meta = cache_paths(cfg)
    ensure_dir(npy.parent)
    size = d["img_size"]
    arr = np.lib.format.open_memmap(npy, mode="w+", dtype=np.uint8, shape=(len(df), size, size, 3))
    for i, p in enumerate(df["path"]):
        arr[i] = np.asarray(Image.open(p).convert("RGB").resize((size, size), Image.BILINEAR))
    arr.flush()
    meta.write_text(json.dumps({"manifest_sha": manifest_sha(d["manifest"]), "size": size, "n": len(df)}))
    return npy


def load_cache(cfg: dict):
    """Return the memory-mapped array, or None if no cache exists. Raises if it is stale."""
    npy, meta = cache_paths(cfg)
    if not (npy.exists() and meta.exists()):
        return None
    info = json.loads(meta.read_text())
    if info["manifest_sha"] != manifest_sha(cfg["data"]["manifest"]):
        raise RuntimeError("Image cache does not match the current manifest. Re-run scripts/cache_dataset.py")
    return np.load(npy, mmap_mode="r")
