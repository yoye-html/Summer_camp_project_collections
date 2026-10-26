"""Stage 2: build the patient-level manifest and print the EDA facts you must put in your data story."""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pandas as pd
from PIL import Image

from dagu.config import load_config, ensure_dir
from dagu.data import build_index, prepare

ap = argparse.ArgumentParser(); ap.add_argument("--config", default="configs/config.yaml")
cfg = load_config(ap.parse_args().config)
df = prepare(cfg)                                              # writes the manifest, asserts no leakage
ensure_dir(cfg["eval"]["report_dir"])

per_case = df.groupby("case").agg(images=("path", "size"), parasitized=("label", "mean"), split=("split", "first"))
per_case.to_csv(Path(cfg["eval"]["report_dir"]) / "eda_cases.csv")
print("\nCases:", len(per_case), "| images per case: min/median/max =",
      per_case.images.min(), per_case.images.median(), per_case.images.max())
mixed = per_case[(per_case.parasitized > 0) & (per_case.parasitized < 1)]
print("Groups containing BOTH classes (expected: infected patients also contribute uninfected cells):", len(mixed))
print("Largest group share of all images: %.1f%%" % (100 * per_case.images.max() / len(df)))

sizes = [Image.open(p).size for p in df.sample(min(500, len(df)), random_state=0)["path"]]
w, h = zip(*sizes)
print(f"Image width range {min(w)}-{max(w)}, height range {min(h)}-{max(h)} (sampled 500)")
dups = df["path"].map(lambda p: Path(p).name).duplicated().sum()
print("Duplicate filenames:", dups)
