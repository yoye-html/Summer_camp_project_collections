"""Check that two manifests (e.g. built on Colab and on your laptop) assign every image to the same split.
File paths differ between machines, so images are matched by filename.
Usage: python scripts/compare_splits.py colab_manifest.csv data/manifests/manifest.csv"""
import sys
import pandas as pd

if len(sys.argv) != 3:
    sys.exit(__doc__)
a, b = (pd.read_csv(p) for p in sys.argv[1:])
for d in (a, b):
    d["name"] = d["label"].astype(str) + "/" + d["path"].str.split("/").str[-1]
ma, mb = a.set_index("name")["split"], b.set_index("name")["split"]
only_a, only_b = set(ma.index) - set(mb.index), set(mb.index) - set(ma.index)
common = sorted(set(ma.index) & set(mb.index))
diff = [n for n in common if ma[n] != mb[n]]
print(f"images: {len(ma)} vs {len(mb)} | only in first: {len(only_a)} | only in second: {len(only_b)} | different split: {len(diff)}")
if only_a or only_b or diff:
    print("MISMATCH: the two machines do not hold the same data or split. Do not compare results across them.")
    sys.exit(1)
print("Identical splits.")
