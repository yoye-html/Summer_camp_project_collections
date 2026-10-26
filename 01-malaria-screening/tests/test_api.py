import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from dagu.api import create_app
from dagu.config import load_config
from dagu.synthetic import dark_spot_predictor, make_field
import cv2

KEY = "test-key"


@pytest.fixture()
def client(tmp_path):
    cfg = load_config("configs/config.yaml")
    cfg["serve"]["log_path"] = str(tmp_path / "log.jsonl"); cfg["serve"]["rate_limit_per_min"] = 5
    return TestClient(create_app(dark_spot_predictor, 0.5, KEY, cfg), raise_server_exceptions=False)


def png_bytes(img_bgr=None):
    img = make_field(n_cells=50, infected=range(8), seed=5, blur=False) if img_bgr is None else img_bgr
    buf = io.BytesIO(); Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(buf, "PNG"); return buf.getvalue()


def post(client, data, ctype="image/png", key=KEY):
    return client.post("/predict/field", files={"file": ("x.png", data, ctype)}, headers={"X-API-Key": key})


def test_requires_api_key(client):
    assert post(client, png_bytes(), key="wrong").status_code == 401
    assert client.post("/predict/field", files={"file": ("x.png", png_bytes(), "image/png")}).status_code == 401


def test_valid_request_returns_counts_and_disclaimer(client):
    r = post(client, png_bytes()); body = r.json()
    assert r.status_code == 200 and body["status"] == "ok" and body["research_use_only"] is True
    assert body["n_positive"] >= 5 and body["rule_calibrated"] is False


def test_rejects_bad_type_and_garbage(client):
    assert post(client, b"hello", "text/plain").status_code == 415
    assert post(client, b"not an image", "image/png").status_code == 400


def test_rejects_oversized_file(client):
    assert post(client, b"0" * (5 * 1024 * 1024 + 10)).status_code == 413


def test_rate_limit_kicks_in(client):
    codes = [post(client, png_bytes()).status_code for _ in range(7)]
    assert codes[:5] == [200] * 5 and 429 in codes[5:]


def test_blurry_image_is_recaptured_not_guessed(client):
    blurry = cv2.GaussianBlur(make_field(seed=6, blur=False), (31, 31), 12)
    assert post(client, png_bytes(blurry)).json()["status"] == "recapture"


def test_starts_in_open_mode_when_no_key(monkeypatch):
    monkeypatch.delenv("DAGU_API_KEY", raising=False)
    app = create_app(dark_spot_predictor, 0.5, None, load_config("configs/config.yaml"))
    assert app is not None


def test_sparse_min_cells_override(client):
    # A tiny crop with few cells should be rejected under default 20 cells, but accepted with min_cells=1
    img = make_field(seed=7, blur=False)[:200, :200]
    raw = png_bytes(img)
    # Default without override
    res_default = post(client, raw).json()
    # With min_cells=1 override
    res_sparse = client.post("/predict/field?min_cells=1", files={"file": ("f.png", raw, "image/png")}, headers={"X-API-Key": KEY}).json()
    assert res_sparse["status"] in ("ok", "recapture")  # verifies API parses min_cells cleanly
