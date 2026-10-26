"""Stage 7: serving, built to the guide's production-readiness gate (M16):
authentication, input validation, rate limiting, no leaked errors, access logging,
and prediction/input statistics logged for drift monitoring. Research use only."""
import hmac, json, logging, os, time, uuid
from collections import defaultdict, deque
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

from .config import load_config
from .fieldscan import scan_field
from .quality import assess

log = logging.getLogger("dagu")
ALLOWED = {"image/png", "image/jpeg"}
DISCLAIMER = "Research prototype. Not a diagnostic device. Confirm with qualified microscopy."


def create_app(predictor=None, threshold: float = None, api_key: str = None, cfg: dict = None,
               model_version: str = "dev") -> FastAPI:
    cfg = cfg or load_config(os.getenv("DAGU_CONFIG", "configs/config.yaml"))
    s = cfg["serve"]
    api_key = api_key or os.getenv("DAGU_API_KEY")
    if not api_key:
        log.warning("DAGU_API_KEY is not set. Service running in MVP mode (authentication disabled).")
    if predictor is None:
        from .inference import OnnxPredictor
        predictor = OnnxPredictor(s["model_path"], cfg["data"]["img_size"])
        model_version = Path(s["model_path"]).name
    if threshold is None:
        threshold = json.loads(Path(s["threshold_path"]).read_text())["threshold"]

    app = FastAPI(title="Dagu malaria screening (research prototype)", docs_url="/docs")
    hits = defaultdict(deque)
    Path(s["log_path"]).parent.mkdir(parents=True, exist_ok=True)

    # Serve the Laveran frontend from static/
    static_dir = Path(__file__).resolve().parent.parent.parent / "static"
    if static_dir.is_dir():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    def require_key(x_api_key: str = Header(default="")):
        if api_key and not hmac.compare_digest(x_api_key.encode(), api_key.encode()):
            raise HTTPException(status_code=401, detail="invalid or missing API key")
        return x_api_key or "anon"

    def rate_limit(request: Request, key: str = Depends(require_key)):
        client_ip = request.client.host if request.client else "unknown"
        bucket_key = key if (api_key and key != "anon") else client_ip
        now, q = time.time(), hits[bucket_key]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= s["rate_limit_per_min"]:
            raise HTTPException(status_code=429, detail="too many requests")
        q.append(now)

    async def read_image(file: UploadFile) -> np.ndarray:
        if file.content_type not in ALLOWED:
            raise HTTPException(415, "only PNG or JPEG images are accepted")
        raw = await file.read(s["max_upload_mb"] * 1024 * 1024 + 1)
        if len(raw) > s["max_upload_mb"] * 1024 * 1024:
            raise HTTPException(413, "file too large")
        try:
            Image.open(BytesIO(raw)).verify()
            img = Image.open(BytesIO(raw)).convert("RGB")
        except Exception:
            raise HTTPException(400, "not a valid image")
        if max(img.size) > s["max_side_px"] or min(img.size) < 64:
            raise HTTPException(400, "image dimensions out of range")
        return cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)

    def log_event(event: dict) -> None:
        with open(s["log_path"], "a", encoding="utf-8") as f:       # no images, no identifiers
            f.write(json.dumps(event) + "\n")

    @app.exception_handler(Exception)
    async def hide_internals(request: Request, exc: Exception):
        rid = uuid.uuid4().hex[:8]
        log.exception("unhandled error id=%s", rid)                   # details stay in the server log
        return JSONResponse(status_code=500, content={"detail": f"internal error (ref {rid})"})

    @app.get("/")
    def root():
        # Serve frontend if available, otherwise return API info JSON
        idx = Path(__file__).resolve().parent.parent.parent / "static" / "index.html"
        if idx.is_file():
            return FileResponse(str(idx), media_type="text/html")
        return {"name": "Dagu malaria screening API", "status": "up", "docs": "/docs",
                "health": "/health", "disclaimer": DISCLAIMER}

    @app.get("/health")
    def health():
        return {"status": "up", "model": model_version}

    @app.post("/predict/field", dependencies=[Depends(rate_limit)])
    async def predict_field(file: UploadFile = File(...), min_cells: int = Query(default=None)):
        img = await read_image(file)
        run_cfg = cfg
        if min_cells is not None and min_cells >= 1:
            run_cfg = {**cfg, "field": {**cfg["field"], "min_cells": min_cells}}
        res = scan_field(img, predictor, threshold, run_cfg)
        q = res.get("quality") or assess(img, cfg["quality"])
        log_event({"ts": time.time(), "status": res["status"], "blur": q["blur_var"], "brightness": q["brightness"],
                   "n_cells": res.get("n_cells"), "pct": res.get("pct_infected_cells"), "model": model_version})
        body = {"status": res["status"], "reasons": res["reasons"], "n_cells": res.get("n_cells"),
                "model_version": model_version, "research_use_only": True, "notice": DISCLAIMER}
        if res["status"] == "ok":
            body.update(n_positive=res["n_positive"], pct_infected_cells=round(res["pct_infected_cells"], 2),
                        suspected_positive=res["n_positive"] >= cfg["field"]["slide_min_positive_cells"],
                        rule_calibrated=False)
            if res.get("n_cells", 0) < cfg["field"]["min_cells"]:
                body["sparse_warning"] = (
                    f"Sparse field analyzed ({res['n_cells']} cells < standard {cfg['field']['min_cells']}). "
                    "Statistical variance on parasitemia is high; single-cell artifacts can skew the rate."
                )
        return body

    return app
