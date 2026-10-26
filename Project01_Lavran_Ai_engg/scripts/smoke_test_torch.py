"""Runs the WHOLE torch path on tiny synthetic cells in a couple of minutes (no real data needed):
prepare -> train (no pretrained weights, so no download) -> evaluate -> export.
If this passes on your machine, your environment is ready for the real dataset.
NOTE: written without access to PyTorch in the authoring environment; if it fails, read the traceback and tell your mentor / me."""
import copy, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import cv2, numpy as np

from dagu import data, evaluate, train
from dagu.config import load_config

rng = np.random.default_rng(0)
tmp = Path(tempfile.mkdtemp())
for cls, tmpl, dot in [("Parasitized", "C{c}P{c}ThinF_IMG_x_cell_{k}.png", True), ("Uninfected", "C{c}_thinF_IMG_x_cell_{k}.png", False)]:
    (tmp / "cell_images" / cls).mkdir(parents=True)
    for c in range(1, 25):
        for k in range(6):
            im = np.full((64, 64, 3), (225, 215, 235), np.uint8)
            cv2.circle(im, (32, 32), 24, (120, 100, 200), -1)
            if dot:
                cv2.circle(im, (int(rng.integers(24, 40)), int(rng.integers(24, 40))), 5, (90, 20, 70), -1)
            cv2.imwrite(str(tmp / "cell_images" / cls / tmpl.format(c=c, k=k)), im)

cfg = copy.deepcopy(load_config())
cfg["data"].update(root=str(tmp / "cell_images"), manifest=str(tmp / "manifest.csv"), img_size=64)
cfg["train"].update(pretrained=False, epochs_head=1, epochs_finetune=2, batch_size=32, num_workers=0, out_dir=str(tmp / "models"))
cfg["eval"].update(report_dir=str(tmp / "reports"), bootstrap=50)
data.prepare(cfg); print(train.run(cfg)); evaluate.run(cfg)
print("SMOKE TEST PASSED. Artifacts in", tmp)
