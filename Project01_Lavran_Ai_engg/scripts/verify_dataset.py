"""Stage 2: integrity checks BEFORE any splitting or training.
Finds unreadable images, tiny images, duplicate files, and the same image filed under both classes
(a label conflict). Usage: python scripts/verify_dataset.py [--config configs/config.yaml]"""
import argparse, hashlib, sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from PIL import Image

from dagu.config import load_config
from dagu.data import CLASSES

ap = argparse.ArgumentParser(); ap.add_argument("--config", default="configs/config.yaml"); ap.add_argument("--expected-per-class", type=int, default=13779)
a = ap.parse_args()
root = Path(load_config(a.config)["data"]["root"])

bad, tiny, by_hash, counts = [], [], defaultdict(list), {}
for cls in CLASSES:
    files = sorted((root / cls).glob("*.png"))
    counts[cls] = len(files)
    for p in files:
        try:
            with Image.open(p) as im:
                im.verify()
            with Image.open(p) as im:
                if min(im.size) < 32:
                    tiny.append(str(p))
        except Exception:
            bad.append(str(p)); continue
        by_hash[hashlib.md5(p.read_bytes()).hexdigest()].append((cls, p.name))

dups = {h: v for h, v in by_hash.items() if len(v) > 1}
conflicts = {h: v for h, v in dups.items() if len({c for c, _ in v}) > 1}
print("Counts per class:", counts, f"(NLM publishes {a.expected_per_class} per class; a different number means a different copy or a bad download)")
print("Unreadable files:", len(bad), "| tiny files:", len(tiny))
print("Duplicate image content:", len(dups), "groups | same image in BOTH classes:", len(conflicts))
for h, v in list(conflicts.items())[:5]:
    print("  conflict:", v)
if bad or conflicts:
    print("ACTION: remove or relabel these before training, and note it in the data story."); sys.exit(1)
print("Integrity checks passed.")
