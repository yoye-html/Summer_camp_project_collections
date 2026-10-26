# Stage 7: M16 Production-Readiness & Serving Specification

This document fulfills the graded requirements for **Stage 7 (Packaging and Serving)** under Module 16 of the INSA AI Engineering Curriculum.

---

## 1. Automated Monitoring & Drift Specification

### 1.1 Reference Statistics Baseline
Reference distributions were computed over $N=300$ validation images drawn from [`data/manifests/manifest.csv`](../data/manifests/manifest.csv) and saved to [`reports/drift_reference.csv`](../reports/drift_reference.csv).

| Feature | Extraction Method | Clinical / Operational Meaning | Reference Median |
|---|---|---|---|
| **`blur`** | Variance of Laplacian on 1024px scaled grayscale | Focus sharpness / optical clarity | $\approx 2250$ |
| **`brightness`** | Grayscale mean intensity (0–255) | Illumination & exposure level | $\approx 110$ |
| **`pct`** | Percentage of infected red blood cells | Patient slide parasitaemia distribution | $\approx 40.9\%$ |
| **`recapture_rate`** | Fraction of requests rejected by quality gate | Optical failure rate | Benchmark: $< 5\%$ |

### 1.2 Quantitative Review Triggers (Exact Numbers)
Dagu rejects qualitative "vibes" and defines exact numerical alert thresholds using the **Population Stability Index (PSI)**:

$$\text{PSI} = \sum_{k=1}^B \left( P_k - Q_k \right) \ln\left(\frac{P_k}{Q_k}\right)$$

| Metric | Threshold Range | Status | Operational Action |
|---|---|---|---|
| **PSI (Blur / Brightness / % Infected)** | $\text{PSI} < 0.10$ | **Green (Normal)** | No action. Distribution matches baseline. |
| **PSI (Blur / Brightness / % Infected)** | $0.10 \le \text{PSI} \le 0.25$ | **Amber (Warning)** | Log warning. Operator reviews microscope lighting and reagent batches. |
| **PSI (Blur / Brightness / % Infected)** | **$\mathbf{PSI > 0.25}$** | **RED (Critical Alert)** | **Triggers mandatory review.** Stop inference pipeline; audit for camera change, new staining protocol, or retrain model. |
| **Recapture Rate** | **$\mathbf{> 20.0\%}$** | **RED (Critical Alert)** | **Triggers hardware review.** Alert operator to inspect optical mount, clean dirty eyepiece, or re-align illumination. |

---

## 2. Model Rollback & Regression Plan

### 2.1 Preserved Artifacts
The deployment maintains side-by-side versions in [`models/`](../models/):
- **Current Active Model:** [`models/dagu_int8.onnx`](../models/dagu_int8.onnx) (11.2 MB)
- **Previous Fallback Model:** [`models/dagu_int8_prev.onnx`](../models/dagu_int8_prev.onnx) (11.2 MB)
- **Unquantized FP32 Baseline:** [`models/dagu_fp32.onnx`](../models/dagu_fp32.onnx) (44.7 MB)
- **Active Calibrated Threshold:** [`models/threshold.json`](../models/threshold.json) (`0.2470`)
- **Fallback Calibrated Threshold:** [`models/threshold_prev.json`](../models/threshold_prev.json) (`0.2470`)

### 2.2 Rollback Triggers
Immediate rollback to `dagu_int8_prev.onnx` or `dagu_fp32.onnx` is triggered if:
1. **Accuracy Regression:** A newly deployed INT8 export exhibits $\Delta \text{AUC} > 0.01$ or $\Delta \text{Sensitivity} > 2.0\%$ compared to validation benchmarks.
2. **Container Crash / Latency Spike:** Inference execution time on CPU exceeds 50 ms/cell or encounters unhandled ONNX Runtime execution failures.
3. **Drift Failure:** PSI on positive predictions jumps $> 0.25$ immediately following a model swap.

### 2.3 Rollback Execution Procedure
```bash
# Step 1: Revert active model and threshold to previous verified files
cp models/dagu_int8_prev.onnx models/dagu_int8.onnx
cp models/threshold_prev.json models/threshold.json

# Step 2: Restart the serving service (zero-downtime container restart)
docker restart dagu-service

# Step 3: Verify operational status
curl http://localhost:8080/health
```

---

## 3. M16 Production-Readiness Gate Checklist

Every item required by Module 16 of the curriculum is audited below:

| # | Item | Status | Implementation Details / Justification if Skipped |
|---|---|:---:|---|
| **1** | **Authentication Required** | **TICKED** | Enforced via `X-API-Key` header with constant-time `hmac.compare_digest`. Service raises `RuntimeError` and refuses to boot if `DAGU_API_KEY` is not provided. |
| **2** | **Key Rotation** | *EXPLAINED* | **Intentionally simplified:** Automatic key rotation (e.g. AWS KMS / HashiCorp Vault) is omitted for this single-node research prototype. The service supports rotation without code modification by updating `DAGU_API_KEY` in the environment and restarting the container. |
| **3** | **Input Payload Validation** | **TICKED** | Uploads strictly limited to MIME types `image/png` and `image/jpeg`. Binary header verified via `PIL.Image.verify()`. Payloads over 5 MB rejected with `HTTP 413`. |
| **4** | **Dimension Guardrails** | **TICKED** | Images smaller than $64\times 64$ or with any dimension larger than $4000\text{ px}$ are rejected with `HTTP 400` to prevent decompression bomb memory exhaustion. |
| **5** | **Rate Limiting** | **TICKED** | Sliding-window memory rate limiter limits clients to 30 requests per minute per key, responding with `HTTP 429 Too Many Requests`. |
| **6** | **Information Disclosure Prevention** | **TICKED** | Global FastAPI exception handler catches all unhandled exceptions, logs the full stack trace internally with an 8-character hex error reference ID (`rid`), and returns a sanitized `{"detail": "internal error (ref <id>)"}` with `HTTP 500`. No Python internals or system paths are leaked. |
| **7** | **Privacy & Audit Logging** | **TICKED** | Events logged to `logs/predictions.jsonl`. Logs record timestamps, model version, blur, brightness, cell counts, and infection ratio. **Zero patient identifiers, IP addresses, or raw pixel uploads are retained.** |
| **8** | **Containerization** | **TICKED** | Dockerfile based on `python:3.11-slim`. Runs as a dedicated non-root user (`app`). Does not install PyTorch (uses ONNX Runtime CPU only). Total container footprint is **185 MB**. |
| **9** | **Quantization Cost Measurement** | **TICKED** | Static INT8 quantization executed and empirically measured: 75% disk compression (44.7 MB $\rightarrow$ 11.2 MB), 35% speedup (13.2 ms $\rightarrow$ 8.6 ms/cell), with negligible AUC cost ($-0.0001$). |
| **10** | **Monitoring & Drift Tracking** | **TICKED** | Input features (blur, brightness) and prediction ratios tracked via `monitor.py` against `drift_reference.csv` using Population Stability Index. |
| **11** | **Documented Rollback** | **TICKED** | Backup artifacts maintained with documented 3-step restoration procedure. |

