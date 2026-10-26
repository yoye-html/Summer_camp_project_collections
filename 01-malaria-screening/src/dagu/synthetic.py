"""Synthetic data for smoke tests and demos ONLY. Not a substitute for real microscopy images."""
import cv2
import numpy as np


def make_field(n_cells=60, infected=(), size=(600, 800), seed=0, blur=True) -> np.ndarray:
    """A pale pink field of dark-red cells; 'infected' cell indices get a dark purple dot."""
    rng = np.random.default_rng(seed)
    h, w = size
    img = np.full((h, w, 3), (225, 215, 235), np.uint8)             # BGR light pink background
    centres, tries = [], 0
    while len(centres) < n_cells and tries < 5000:
        tries += 1
        c = (int(rng.integers(40, w - 40)), int(rng.integers(40, h - 40)))
        if all((c[0] - o[0]) ** 2 + (c[1] - o[1]) ** 2 > 62 ** 2 for o in centres):
            centres.append(c)
    for i, c in enumerate(centres):
        cv2.circle(img, c, 28, (120, 100, 200), -1)
        cv2.circle(img, c, 10, (150, 130, 215), -1)                  # central pallor
        if i in set(infected):
            cv2.circle(img, (c[0] + 10, c[1] - 8), 6, (90, 20, 70), -1)
    img = cv2.add(img, rng.integers(0, 12, img.shape, dtype=np.uint8))
    return cv2.GaussianBlur(img, (3, 3), 0) if blur else img


def dark_spot_predictor(crops):
    """Stub classifier for tests: P(infected) high when a very dark spot exists in the crop."""
    return np.array([1.0 if cv2.cvtColor(c, cv2.COLOR_BGR2GRAY).min() < 70 else 0.02 for c in crops])
