"""Second smoke test: the pieces the first one does not reach.
Grad-CAM, the FGSM attack, ONNX export, INT8 quantisation, and train/serve parity
(the PyTorch pipeline and the numpy/ONNX serving pipeline must give the same probabilities).
Runs on tiny synthetic cells, CPU, no downloads. Usage: python scripts/smoke_test_extras.py"""
import copy, sys, tempfile, traceback
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import cv2
import numpy as np
import pandas as pd
import torch

from dagu import data, train
from dagu.config import load_config

rng = np.random.default_rng(0)
tmp = Path(tempfile.mkdtemp())
for cls, tmpl, dot, offset in [("Parasitized", "C{c}P{c}ThinF_IMG_x_cell_{k}.png", True, 0),
                               ("Uninfected", "C{c}_thinF_IMG_x_cell_{k}.png", False, 0),
                               ("Uninfected", "C{c}_thinF_IMG_x_cell_{k}.png", False, 100)]:   # healthy-only patients
    (tmp / "cell_images" / cls).mkdir(parents=True, exist_ok=True)
    for c in range(1 + offset, 25 + offset):
        for k in range(6):
            im = np.full((64, 64, 3), (225, 215, 235), np.uint8)
            cv2.circle(im, (32, 32), 24, (120, 100, 200), -1)
            if dot:
                cv2.circle(im, (int(rng.integers(24, 40)), int(rng.integers(24, 40))), 5, (90, 20, 70), -1)
            cv2.imwrite(str(tmp / "cell_images" / cls / tmpl.format(c=c, k=k)), im)

cfg = copy.deepcopy(load_config())
cfg["data"].update(root=str(tmp / "cell_images"), manifest=str(tmp / "manifest.csv"), img_size=64, cache_dir=str(tmp / "cache"))
cfg["train"].update(pretrained=False, epochs_head=1, epochs_finetune=1, batch_size=32, num_workers=0, out_dir=str(tmp / "models"))
data.prepare(cfg); train.run(cfg)

size, out = cfg["data"]["img_size"], Path(cfg["train"]["out_dir"])
ckpt, fp32, int8 = str(out / "best.pt"), str(out / "f.onnx"), str(out / "i.onnx")
df = pd.read_csv(cfg["data"]["manifest"])


def load_model():
    from dagu.model import build_model
    m = build_model(pretrained=False); m.load_state_dict(torch.load(ckpt, map_location="cpu")); return m.eval()


def t_gradcam():
    from dagu.gradcam import GradCAM, overlay
    m = load_model(); cam = GradCAM(m, m.layer4)(torch.randn(4, 3, size, size))
    assert tuple(cam.shape) == (4, size, size), cam.shape
    assert float(cam.min()) >= 0 and float(cam.max()) <= 1 + 1e-6
    img = cv2.cvtColor(cv2.resize(cv2.imread(df.path.iloc[0]), (size, size)), cv2.COLOR_BGR2RGB)
    assert overlay(img, cam[0].numpy()).shape == (size, size, 3)
    return f"cam shape {tuple(cam.shape)}, range {float(cam.min()):.2f}-{float(cam.max()):.2f}"


def t_fgsm():
    from dagu.dataset import make_loader
    from dagu.robustness import robustness_report
    loader = make_loader(df[df.split == "val"], size, False, 16, 0, None)
    rep = robustness_report(load_model(), loader, "cpu", eps_list=(0.0, 0.05))
    assert set(rep) == {0.0, 0.05} and all(0 <= v <= 1 for v in rep.values())
    return f"sensitivity by eps: {rep}"


def t_export():
    from dagu import export
    export.export_onnx(ckpt, fp32, size)
    crops = [cv2.imread(p) for p in df[df.split == "train"].path.iloc[:30].tolist()]
    export.quantise_int8(fp32, int8, crops, size)
    r = export.compare(cfg["data"]["manifest"], fp32, int8, size, n=40)
    return "fp32 auc %.3f / int8 auc %.3f, size %.1f -> %.1f MB" % (r["fp32"]["auc"], r["int8"]["auc"], r["fp32"]["size_mb"], r["int8"]["size_mb"])


def t_parity():
    from PIL import Image
    from dagu.dataset import get_transforms
    from dagu.inference import OnnxPredictor, TorchPredictor
    paths = df.path.iloc[:20].tolist(); m = load_model(); tfm = get_transforms(size, False)
    with torch.no_grad():
        a = torch.softmax(m(torch.stack([tfm(Image.open(p).convert("RGB")) for p in paths])), 1)[:, 1].numpy()
    crops = [cv2.imread(p) for p in paths]
    b = TorchPredictor(ckpt, size)(crops)
    d1 = float(np.abs(a - b).max())
    assert d1 < 1e-3, f"TRAIN/SERVE SKEW: torchvision pipeline vs numpy pipeline differ by {d1:.5f}"
    d2 = float(np.abs(b - OnnxPredictor(fp32, size)(crops)).max())
    assert d2 < 1e-3, f"torch vs ONNX differ by {d2:.5f}"
    return f"max |diff|: train-vs-serve preprocessing {d1:.2e}, torch-vs-onnx {d2:.2e}"


results = {}
for name, fn in [("Grad-CAM", t_gradcam), ("FGSM attack test", t_fgsm), ("ONNX export + INT8", t_export), ("Train/serve parity", t_parity)]:
    try:
        results[name] = ("PASS", fn())
    except Exception as e:
        results[name] = ("FAIL", f"{type(e).__name__}: {e}\n" + "".join(traceback.format_exc().splitlines(True)[-6:]))
print("\n==== EXTRAS SMOKE TEST ====")
for k, (status, msg) in results.items():
    print(f"[{status}] {k}: {msg}")
sys.exit(0 if all(s == "PASS" for s, _ in results.values()) else 1)