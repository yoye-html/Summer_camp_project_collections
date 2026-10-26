"""Stage 5: from one phone photo of a microscope field to counted cells.

Pipeline: quality gate -> segment red blood cells (Otsu + watershed) -> classify each
crop -> aggregate. The predictor is injected (callable: list of BGR crops -> probabilities),
so this module needs neither torch nor onnx and is easy to test.
"""
import cv2
import numpy as np

from .quality import assess


def segment_cells(img_bgr: np.ndarray, min_area: int, max_area: int) -> list:
    """Classical baseline. Replace with a trained detector if this under-segments clumps."""
    g = cv2.GaussianBlur(img_bgr[:, :, 1], (5, 5), 0)      # green channel: stained cells are dark
    _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=2)
    dist = cv2.distanceTransform(bw, cv2.DIST_L2, 5)
    if dist.max() <= 0:
        return []
    _, fg = cv2.threshold(dist, 0.5 * dist.max(), 255, 0)
    fg = fg.astype(np.uint8)
    sure_bg = cv2.dilate(bw, np.ones((3, 3), np.uint8), iterations=3)
    unknown = cv2.subtract(sure_bg, fg)
    _, markers = cv2.connectedComponents(fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(img_bgr.copy(), markers)
    boxes = []
    for lab in range(2, int(markers.max()) + 1):
        mask = (markers == lab).astype(np.uint8)
        if min_area <= int(mask.sum()) <= max_area:
            boxes.append(cv2.boundingRect(mask))             # (x, y, w, h)
    return boxes


def crop(img: np.ndarray, box, pad: int = 6) -> np.ndarray:
    x, y, w, h = box
    H, W = img.shape[:2]
    return img[max(0, y - pad):min(H, y + h + pad), max(0, x - pad):min(W, x + w + pad)]


def scan_field(img_bgr: np.ndarray, predictor, threshold: float, cfg: dict) -> dict:
    q = assess(img_bgr, cfg["quality"])
    if not q["ok"]:
        return {"status": "recapture", "reasons": q["reasons"], "quality": q}
    lo, hi = cfg["field"]["cell_area_px"]
    boxes = segment_cells(img_bgr, lo, hi)
    if len(boxes) < cfg["field"]["min_cells"]:
        return {"status": "recapture", "quality": q, "n_cells": len(boxes),
                "reasons": [f"only {len(boxes)} cells found (need {cfg['field']['min_cells']}); refocus or move the field"]}
    probs = np.asarray(predictor([crop(img_bgr, b) for b in boxes]))
    positive = probs >= threshold
    return {"status": "ok", "reasons": [], "quality": q, "n_cells": len(boxes),
            "n_positive": int(positive.sum()), "pct_infected_cells": float(100 * positive.mean()),
            "boxes": [list(map(int, b)) for b in boxes], "probs": probs.tolist()}


def aggregate_slide(fields: list, cfg: dict) -> dict:
    """Combine many fields into one slide-level report. The decision rule is a PLACEHOLDER
    until it is tuned against expert microscopy on validation slides."""
    ok = [f for f in fields if f["status"] == "ok"]
    need = cfg["field"]["min_fields_per_slide"]
    cells = sum(f["n_cells"] for f in ok)
    pos = sum(f["n_positive"] for f in ok)
    if len(ok) < need:
        return {"status": "insufficient_fields", "valid_fields": len(ok), "needed": need}
    return {"status": "ok", "valid_fields": len(ok), "cells": cells, "infected_cells": pos,
            "pct_infected_cells": 100 * pos / max(cells, 1),
            "suspected_positive": pos >= cfg["field"]["slide_min_positive_cells"],
            "rule_calibrated": False}


def draw(img_bgr: np.ndarray, result: dict, threshold: float) -> np.ndarray:
    out = img_bgr.copy()
    for (x, y, w, h), p in zip(result.get("boxes", []), result.get("probs", [])):
        colour = (0, 0, 255) if p >= threshold else (0, 160, 0)
        cv2.rectangle(out, (x, y), (x + w, y + h), colour, 2)
    return out
