"""Demo: scan one phone photo of a microscope field and save an annotated image.
Usage: python scripts/scan_field.py field.jpg --onnx models/dagu_int8.onnx"""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import cv2

from dagu.config import load_config
from dagu.fieldscan import draw, scan_field
from dagu.inference import OnnxPredictor

ap = argparse.ArgumentParser()
ap.add_argument("image"); ap.add_argument("--onnx", default="models/dagu_int8.onnx")
ap.add_argument("--out", default="annotated.png")
a = ap.parse_args()
cfg = load_config()
thr = json.loads(Path(cfg["serve"]["threshold_path"]).read_text())["threshold"]
img = cv2.imread(a.image)
if img is None:
    print(f"Error: image not found or unreadable: '{a.image}'. Please pass an existing image file (e.g. test_field.jpg).")
    sys.exit(1)
res = scan_field(img, OnnxPredictor(a.onnx, cfg["data"]["img_size"]), thr, cfg)
print({k: v for k, v in res.items() if k not in ("boxes", "probs", "quality")})
if res["status"] == "ok":
    cv2.imwrite(a.out, draw(img, res, thr)); print("saved", a.out)
