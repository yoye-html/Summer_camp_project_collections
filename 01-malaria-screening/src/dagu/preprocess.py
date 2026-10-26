"""Torch-free preprocessing shared by ONNX serving and field scanning.

Matches torchvision's Resize -> ToTensor -> Normalize on a PIL image, so the
PyTorch and ONNX paths see identical inputs.
"""
import numpy as np
import cv2
from PIL import Image

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def bgr_to_tensor_array(img_bgr: np.ndarray, size: int) -> np.ndarray:
    """One BGR uint8 image -> float32 array shaped (3, size, size), normalised."""
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb).resize((size, size), Image.BILINEAR)
    arr = np.asarray(pil, dtype=np.float32) / 255.0
    arr = (arr - MEAN) / STD
    return arr.transpose(2, 0, 1)


def batch_from_crops(crops_bgr: list, size: int) -> np.ndarray:
    return np.stack([bgr_to_tensor_array(c, size) for c in crops_bgr]).astype(np.float32)


def softmax_pos(logits: np.ndarray) -> np.ndarray:
    """Probability of class 1 (Parasitized) from raw logits shaped (N, 2)."""
    z = logits - logits.max(axis=1, keepdims=True)
    e = np.exp(z)
    return (e[:, 1] / e.sum(axis=1)).astype(np.float64)
