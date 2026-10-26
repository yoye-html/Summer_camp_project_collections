import numpy as np

from dagu.config import load_config
from dagu.fieldscan import aggregate_slide, scan_field, segment_cells
from dagu.quality import assess
from dagu.synthetic import dark_spot_predictor, make_field

CFG = load_config("configs/config.yaml")


def test_quality_accepts_sharp_and_rejects_blurry_and_dark():
    import cv2
    sharp = make_field(seed=1, blur=False)
    assert assess(sharp, CFG["quality"])["ok"]
    assert not assess(cv2.GaussianBlur(sharp, (31, 31), 12), CFG["quality"])["ok"]
    assert "too dark" in " ".join(assess((sharp * 0.2).astype(np.uint8), CFG["quality"])["reasons"])


def test_segmentation_finds_most_cells():
    img = make_field(n_cells=50, seed=2, blur=False)
    n = len(segment_cells(img, *CFG["field"]["cell_area_px"]))
    assert 35 <= n <= 60


def test_scan_counts_infected_cells_with_stub_predictor():
    img = make_field(n_cells=50, infected=range(0, 10), seed=3, blur=False)
    res = scan_field(img, dark_spot_predictor, 0.5, CFG)
    assert res["status"] == "ok"
    assert 6 <= res["n_positive"] <= 12


def test_empty_field_asks_for_recapture():
    res = scan_field(make_field(n_cells=3, seed=4, blur=False), dark_spot_predictor, 0.5, CFG)
    assert res["status"] == "recapture"


def test_slide_needs_enough_valid_fields():
    assert aggregate_slide([{"status": "recapture"}] * 5, CFG)["status"] == "insufficient_fields"
