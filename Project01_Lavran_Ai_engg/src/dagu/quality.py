"""Stage 5: image-quality gate. Reject bad captures instead of guessing on them.
Thresholds in config.yaml are STARTING values: calibrate them on your own phone images."""
import cv2
import numpy as np


def assess(img_bgr: np.ndarray, q: dict) -> dict:
    h, w = img_bgr.shape[:2]
    scale = 1024.0 / max(h, w)                      # make blur comparable across resolutions
    small = cv2.resize(img_bgr, (int(w * scale), int(h * scale))) if scale < 1 else img_bgr
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness, contrast = float(gray.mean()), float(gray.std())
    reasons = []
    if blur < q["min_blur_var"]:
        reasons.append("image is blurry or out of focus")
    if brightness < q["min_brightness"]:
        reasons.append("image is too dark")
    if brightness > q["max_brightness"]:
        reasons.append("image is overexposed")
    if contrast < q["min_contrast"]:
        reasons.append("image has too little contrast")
    return {"ok": not reasons, "reasons": reasons,
            "blur_var": blur, "brightness": brightness, "contrast": contrast}
