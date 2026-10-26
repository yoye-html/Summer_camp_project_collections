"""Stage 7: export to ONNX, quantise to INT8, and MEASURE the cost in accuracy and speed.
Latency on your laptop is not latency on a phone: time it on the target device too."""
import argparse, time
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from .config import load_config
from .model import build_model


def export_onnx(ckpt: str, out: str, size: int) -> str:
    model = build_model(pretrained=False)
    model.load_state_dict(torch.load(ckpt, map_location="cpu")); model.eval()
    dummy = torch.randn(1, 3, size, size)
    kwargs = dict(input_names=["input"], output_names=["logits"], opset_version=17,
                  dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}})
    try:
        torch.onnx.export(model, dummy, out, dynamo=False, **kwargs)   # newer torch
    except TypeError:
        torch.onnx.export(model, dummy, out, **kwargs)
    return out


def quantise_int8(fp32: str, int8: str, calib_crops: list, size: int) -> str:
    from onnxruntime.quantization import (CalibrationDataReader, QuantFormat, QuantType, quantize_static)
    from .preprocess import bgr_to_tensor_array

    class Reader(CalibrationDataReader):
        def __init__(self):
            self.it = iter([{"input": bgr_to_tensor_array(c, size)[None]} for c in calib_crops])
        def get_next(self):
            return next(self.it, None)

    quantize_static(fp32, int8, Reader(), quant_format=QuantFormat.QDQ,
                    weight_type=QuantType.QInt8, activation_type=QuantType.QUInt8)
    return int8


def compare(manifest: str, fp32: str, int8: str, size: int, n: int = 500) -> dict:
    """Same test images through both models: report AUC and sensitivity at 0.5, plus ms per cell."""
    import cv2
    from sklearn.metrics import roc_auc_score
    from .inference import OnnxPredictor
    df = pd.read_csv(manifest); df = df[df.split == "test"].sample(min(n, (df.split == "test").sum()), random_state=0)
    crops = [cv2.imread(p) for p in df["path"]]; y = df["label"].to_numpy()
    out = {}
    for name, path in [("fp32", fp32), ("int8", int8)]:
        pred = OnnxPredictor(path, size)
        t0 = time.perf_counter(); p = pred(crops); ms = 1000 * (time.perf_counter() - t0) / len(crops)
        out[name] = {"auc": float(roc_auc_score(y, p)), "sensitivity@0.5": float(((p >= .5) & (y == 1)).sum() / (y == 1).sum()),
                     "ms_per_cell_this_machine": ms, "size_mb": Path(path).stat().st_size / 1e6}
    return out


if __name__ == "__main__":
    import cv2
    ap = argparse.ArgumentParser(); ap.add_argument("--config", default="configs/config.yaml"); a = ap.parse_args()
    cfg = load_config(a.config); d = cfg["data"]; out = Path(cfg["train"]["out_dir"])
    export_onnx(str(out / "best.pt"), str(out / "dagu_fp32.onnx"), d["img_size"])
    df = pd.read_csv(d["manifest"]); calib = [cv2.imread(p) for p in df[df.split == "train"].sample(200, random_state=0)["path"]]
    quantise_int8(str(out / "dagu_fp32.onnx"), str(out / "dagu_int8.onnx"), calib, d["img_size"])
    print(compare(d["manifest"], str(out / "dagu_fp32.onnx"), str(out / "dagu_int8.onnx"), d["img_size"]))
