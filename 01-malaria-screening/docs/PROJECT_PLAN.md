# Malaria Microscopy Screening: Amended Capstone Plan

Aligned to the INSA Summer Camp 5th Batch AI Engineering Student Guide (PyTorch, scikit-learn, MLflow, FastAPI, Docker, model cards, security as a graded gate).
Working title: **Dagu** (change freely). Module references (M01 to M18) point to the guide.

## 1. What changed from the original description, and why

| Original | Amended | Reason |
|---|---|---|
| TensorFlow/Keras, EfficientNetB0, TFLite, Kotlin app | **PyTorch ResNet18**, ONNX Runtime INT8, **FastAPI** service | The guide teaches PyTorch (M12, M13) and FastAPI + Docker (M16). Your mentors can only support that stack. |
| 97.4% sensitivity, 96.7% specificity, AUC 0.990 | **Removed.** Replaced by numbers you measure, with confidence intervals that resample patients | The guide requires honest evaluation and leakage-aware splits (M09, rubric). Unmeasured numbers are claims, not results. |
| "Immune to the gene-deletion crisis" | "Does not depend on the HRP2 protein; can still fail on poor images or unfamiliar samples" | The CNN does not detect a deletion; it looks for visible parasites. |
| "Treat / Refer / Monitor" advice, severity tiers | **positive suspected / negative suspected / recapture**, labelled research use only | A student model must not make treatment decisions. Output is a screening aid; a clinician decides. |
| RDT strip reader, parasite density, stage classification, deletion risk map | **Out of the capstone**; listed as future work | Each needs data and expert labels you do not have. "A smaller project done properly beats a grand one" (M18). |
| No governance | Data rights, mentor sign-off, model card, security checklist, fairness-by-group, drift monitoring | These are graded gates in the guide (M16, M17, M18). |

**Scope risk to raise at the proposal checkpoint:** the guide's example capstone themes are security analytics, document understanding, anomaly detection and grounded assistants. Medical image classification is not listed. It fits the "image collections" skills (Appendix C), but ask your mentor to approve it explicitly, and confirm the dataset is on the vetted list (Appendix C says never download data from untrusted sources onto camp machines).

## 2. One-paragraph problem statement (for the Proposal checkpoint)

*Rapid tests that rely on the HRP2 protein miss some malaria infections in places where parasites have lost that gene. We will build a research prototype that classifies red blood cells from stained thin-smear images as infected or uninfected, scans a whole microscope field photographed with a phone, rejects poor-quality images, and reports counts with an explanation heatmap. Success means: sensitivity of at least 95% on held-out patients with the 95% interval reported, a measured gap between public-data images and phone-captured images, a model card, and a reproducible repository. It is not a diagnostic device.*

## 3. Architecture

```
 phone photo of microscope field
            |
   [ quality gate ]  blur / brightness / contrast  --> "recapture" (never guess)
            |
   [ cell segmentation ]  Otsu + watershed  --> crops
            |
   [ ResNet18 classifier ]  (PyTorch -> ONNX INT8)  --> P(infected) per cell
            |
   [ aggregate ]  cells, infected cells, % infected  (placeholder slide rule)
            |
   [ FastAPI ]  API key, validation, rate limit, JSONL log  --> JSON + annotated image
            |
   [ monitor ]  PSI drift on blur / brightness / % infected
```

Training side: `manifest.csv` (patient-level split) -> `train.py` (MLflow) -> `evaluate.py` (threshold from validation, metrics on test) -> `export.py` (ONNX, INT8).

## 4. Stages

Suggested mapping: Stages 0 to 4 can serve as the **mid-camp project** (full ML workflow); Stages 5 to 9 complete the **capstone**. Confirm with your mentor. Hour figures are my estimates for a team of 3 to 4, not guide figures.

---

### Stage 0: Proposal and governance (guide phase: Proposal; M18 A) ~3 h

**Steps**
1. Write the problem statement above in your own words, one page.
2. Ask the mentor to approve the topic, the dataset and the research-only framing.
3. Record the dataset licence and confirm it contains no personal data.
4. Agree the success metrics and what you will NOT claim.

**Tools:** Markdown, Git. **Skills:** problem framing (M06), data rights (M18 A).
**Code:** none. **Done when:** scope signed off as feasible and safe.

---

### Stage 1: Environment and repository (M01, Appendix A) ~3 h

**Steps**
1. `python3 -m venv .venv && source .venv/bin/activate`
2. `pip install -r requirements.txt` (install PyTorch from the official selector for your machine if the plain install fails; fall back to CPU if CUDA errors).
3. `git init`, commit, add the remote.
4. `python scripts/smoke_test_torch.py` (about two minutes, synthetic cells, no downloads).
5. `pytest` (torch-free tests).
6. After everything works, run `pip freeze > requirements.lock.txt` and commit it, so a stranger can rebuild your environment.

**Architecture:** one repo, `src/dagu` package, `configs/config.yaml` as the only place for settings.
**Tools:** Linux shell, Git, venv, pip, pytest. **Skills:** M01, M02.
**Code:** `requirements.txt`, `pytest.ini`, `scripts/smoke_test_torch.py`.
**Done when:** the smoke test prints `SMOKE TEST PASSED` and `pytest` is green.

---

### Stage 2: Data, EDA and the patient-level split (phase: Data and EDA; M04, M05, M09) ~8 h

Dataset choice and download details: `docs/DATASETS_AND_COLAB.md` (primary = NLM single-cell set; whole-field NLM images for Stages 5 and 8).

**Steps**
1. Get mentor approval and record the licence, then put the data in `data/cell_images/{Parasitized,Uninfected}` (git-ignored). On Colab, copy it to the local disk, not a Drive path.
2. `python scripts/verify_dataset.py`: unreadable files, tiny files, duplicates, and the same image filed under both classes.
3. `python scripts/prepare_data.py`: builds `data/manifests/manifest.csv` and **splits by patient**. NLM encodes the patient in the filename (`C33P1thinF_...` is patient `P1`); the code links any files sharing a `C` or `P` token so one patient cannot land in two splits. It warns if one group swallows more than 15% of the images.
4. Download NLM's two patient-to-cell mapping CSVs, open them, and confirm each patient's cells fall in one group.
5. EDA in a notebook: class balance per split, images per patient, image size range, a grid of example cells, mean colour per patient (look for stain shortcuts).
6. `python scripts/cache_dataset.py`: decode and resize once into a uint8 array so training reads memory.

**Architecture:** `images -> integrity check -> index (path, label, group) -> GroupShuffleSplit -> manifest.csv (+row id) -> uint8 cache (hash-locked to the manifest)`.
**Tools:** pandas, NumPy, scikit-learn `GroupShuffleSplit`, Pillow, matplotlib, Jupyter.
**Skills:** wrangling (M04), EDA (M05), leakage and stratification (M09).
**Code:** `src/dagu/data.py`, `cache.py`, `scripts/verify_dataset.py`, `prepare_data.py`, `cache_dataset.py`, `tests/test_data.py`, `tests/test_cache_groups.py`
**Done when:** the split has no patient overlap, integrity checks pass or the exceptions are documented, and the data story is presented.

---

### Stage 3: Baseline (phase: Baseline; M06 to M08) ~4 h

**Steps**
1. Run the baseline: colour histograms + logistic regression (`dagu.baseline.run`).
2. Record validation and test AUC. This is the number the CNN must beat.
3. Run the pipeline end to end once (data -> model -> metric) before improving anything.

**Architecture:** `image -> 51 colour features -> StandardScaler -> LogisticRegression`.
**Tools:** scikit-learn Pipeline. **Skills:** the ML workflow (M06), classification (M08).
**Code:** `src/dagu/baseline.py`
```python
from dagu import baseline
baseline.run("data/manifests/manifest.csv")
```
**Done when:** the full pipeline runs and the baseline score is logged.

---

### Stage 4: Transfer-learning model and honest evaluation (phase: Iteration; M09, M12, M13) ~12 h

**Steps** (the guide's transfer-learning recipe, M13)
1. Start from a pretrained ResNet18, replace the final layer (2 classes).
2. Phase 1: freeze the backbone, train the new layer (`epochs_head`, lr 1e-3).
3. Phase 2: unfreeze, fine-tune with a much smaller learning rate (1e-4), augmentation on throughout.
4. Pick the best epoch by **validation** AUC.
5. `python -m dagu.evaluate`: chooses the decision threshold on **validation** (sensitivity target 0.95), then reports on **test**: sensitivity, specificity, precision, F1, AUC, **95% intervals that resample patients**, confusion matrix, per-patient table, and the most confident mistakes.
6. Look at the mistakes (Lab 13.1, step 4). Write down a hypothesis for each: label noise? stain artefact? debris?
7. Compare against the Stage 3 baseline in a table.

**Architecture:** `ResNet18 (ImageNet weights) -> fc(512 -> 2)`; AdamW; cross-entropy; augmentation = flips, rotation, colour jitter, blur.
**Compute:** train on a GPU (Colab T4 via `notebooks/colab_train.ipynb`). Built in: cached images, mixed precision, `channels_last`, checkpoint every epoch with `--resume`, early stopping, and a `debug_fraction` quick run. Record an ablation (cache and AMP on/off) in your logbook; I have not measured the speedups.
**Tools:** PyTorch, torchvision, scikit-learn metrics, MLflow, matplotlib.
**Skills:** neural networks and PyTorch loops (M11, M12), CNNs and transfer learning (M13), precision/recall and thresholds (M09).
**Code:** `src/dagu/dataset.py`, `model.py`, `train.py`, `evaluate.py`
```bash
python -m dagu.train               # logs params, metrics and the model to MLflow
python -m dagu.train --resume      # continue after a Colab disconnect
python -m dagu.evaluate   # writes reports/metrics.json, confusion_matrix.png, top_errors.png
```
**Done when:** you have honest test metrics with intervals, a baseline comparison and an error analysis.
**Never** tune the threshold or pick epochs on the test set.

---

### Stage 5: From one cell to a whole field (phase: Iteration; M13) ~12 h

**Steps**
1. **Quality gate** (`quality.assess`): blur (variance of the Laplacian), brightness, contrast. Calibrate the thresholds on your own phone images; record the pass rate.
2. **Segment** red blood cells (`fieldscan.segment_cells`): green channel, Otsu threshold, distance transform, watershed to split touching cells, area filter. Tune `field.cell_area_px` for your magnification and camera.
3. **Classify** each crop and **aggregate**: cells, infected cells, percent infected per field (`scan_field`); combine fields into a slide report (`aggregate_slide`). The slide decision rule is a **placeholder** until tuned on validation slides.
4. **Grad-CAM** on correct and wrong predictions. Check by eye whether the heat lands on parasites or on borders and stain blobs. Document failures.
5. If clumped cells are badly under-segmented, note it as a limitation (or, with time, train a detector).

**Architecture:** see section 3. The predictor is injected, so the scanner is tested without any model.
**Tools:** OpenCV, NumPy, PyTorch (Grad-CAM). **Skills:** CV (M13), error analysis (M09).
**Code:** `src/dagu/quality.py`, `fieldscan.py`, `gradcam.py`, `inference.py`, `synthetic.py`, `tests/test_field.py`
```python
from dagu.fieldscan import scan_field, draw
from dagu.inference import TorchPredictor
pred = TorchPredictor("models/best.pt", 128)
res = scan_field(img_bgr, pred, threshold, cfg)   # status: ok | recapture
```
**Done when:** a field photo gives either a recapture reason or counts with an annotated image, and the synthetic tests pass.

---

### Stage 6: Hardening: attack, defend, document (phase: Hardening; M17) ~10 h

**Steps**
1. **Evasion test:** `robustness.robustness_report` runs FGSM at several strengths and reports how sensitivity falls. Try one defence (adversarial training), re-measure, and record the change (Lab 17.1).
2. **Privacy:** the pipeline stores no patient identifiers and the API logs no images. Use only the public, de-identified dataset. Collect only what the task needs.
3. **Performance across groups:** report the per-patient table, then by device and stain batch once you have phone data. Report any gap honestly.
4. **Poisoning and provenance:** record the dataset source, licence and file hashes; the manifest hash is already logged with every training run.
5. **Model card:** fill in `MODEL_CARD.md` (purpose, data, metrics with intervals, limits, misuse risks).

**Tools:** PyTorch autograd (FGSM), pandas, Markdown. **Skills:** M17.
**Code:** `src/dagu/robustness.py`, `evaluate.by_group`, `MODEL_CARD.md`
**Done when:** attack result, one defence measurement, group table and a one-page model card are committed.

---

### Stage 7: Packaging and serving (phase: Hardening/Demonstration; M16) ~12 h

**Steps**
1. **Track:** every run logs params, metrics, model, git commit and data-manifest hash (already in `train.py`).
2. **Export and quantise:** `python -m dagu.export` writes FP32 and INT8 ONNX and prints AUC, sensitivity, size and speed for both. **Report the accuracy cost of INT8; do not assume there is none.** Latency here is your laptop's. Measure on the target phone before quoting a figure.
3. **Serve:** FastAPI app with the guide's production-readiness gate: API key required (service refuses to start without one), file-type/size/dimension validation, rate limiting, generic error messages, access log.
4. **Containerise:** build and run the Docker image; confirm it runs identically.
5. **Monitor:** build reference stats from validation images, then compute PSI on logged blur, brightness and percent-infected. Write down what PSI value triggers a review.
6. **Rollback plan:** keep the previous ONNX file and threshold; document how to swap back.

**Architecture:** `best.pt -> ONNX FP32 -> ONNX INT8 -> OnnxPredictor -> FastAPI -> Docker`.
**Tools:** MLflow, ONNX, onnxruntime, FastAPI, uvicorn, Docker, pytest. **Skills:** M16.
**Code:** `src/dagu/export.py`, `api.py`, `monitor.py`, `Dockerfile`, `tests/test_api.py`, `tests/test_monitor.py`
```bash
python -m dagu.export
export DAGU_API_KEY="$(python -c 'import secrets;print(secrets.token_urlsafe(32))')"
docker build -t dagu . && docker run -e DAGU_API_KEY -p 8000:8000 dagu
curl -H "X-API-Key: $DAGU_API_KEY" -F "file=@field.jpg;type=image/jpeg" localhost:8000/predict/field
```
**Done when:** every item of the production-readiness checklist (M16) is ticked, or the unticked ones are written down with a reason.

---

### Stage 8: Phone-on-eyepiece data and field validation (start early, run in parallel) ~15 h + waiting time

This is the stage that decides whether the system works outside the public dataset. Start the permissions in week one.

**Steps**
1. **Approval first:** slides and any human-derived data need mentor approval and, in practice, institutional permission from the lab or facility. De-identify at source; record no names, IDs or dates of birth.
2. **Adapter:** use a universal phone-eyepiece adapter or a 3D-printed clip with a fixed stop. Test 10 re-mounts of the same slide and measure the image shift.
3. **Capture protocol:** lock focus, exposure and white balance; fixed number of fields per slide (20 or more); write the protocol down.
4. **Labels:** an expert (microscopist) labels a small set of slides, even a few dozen. Without this you cannot claim anything about field performance.
5. **Evaluate and adapt:** run the public-data model on the phone images and report the drop (domain shift). Fine-tune on training slides, test on **slides the model has never seen**.
6. **Tune** the quality thresholds and the slide decision rule on validation slides only.

**Tools:** the same stack, plus a capture checklist. **Skills:** data governance (M17, M18 A), evaluation (M09).
**Code:** reuse `evaluate.by_group` with a `device` column; add your images to the manifest with `case` = slide/patient ID.
**Done when:** you can state, with intervals, how accuracy differs between public images and your phone images. If you cannot obtain slides in time, say so plainly in the defence: the claim then stays "works on a public dataset", nothing more.

---

### Stage 9: Demonstration and defence (phase: Demonstration; M18 C) ~8 h

**Steps**
1. Script the click-by-click demo: field photo -> quality verdict -> annotated image -> counts -> heatmap -> metrics slide.
2. Record a backup video. Rehearse the failure (a blurry photo being rejected is a *good* demo).
3. Prepare answers to: *Does it detect the gene deletion? How do you know the numbers are not leaked? What happens on a new microscope? Why should anyone trust a heatmap? What are you not claiming?*
4. Check the repo from scratch: clone, follow the README, get the same results.

**Done when:** a stranger can clone and run it, the demo does not depend on luck, and the model card is complete.

## 5. Rubric self-check (from the guide)

| Dimension | What earns "strong" here |
|---|---|
| Problem framing | Scoped to cell/field screening, research-only, success metric stated |
| Data and EDA | Patient-level split, leakage test, shortcut check |
| Modelling | Baseline vs transfer learning, tuned two-phase training |
| Evaluation | Sensitivity/specificity with patient-level intervals, error analysis, failure cases |
| Security and privacy | Evasion test and a defence, authenticated validated API, no identifiers, model card |
| Communication | Honest limits slide, rehearsed demo |

## 6. Known limitations to state openly

- The public dataset is cropped single cells; real use needs whole-field images, hence Stages 5 and 8.
- Segmentation is classical and will struggle with heavy clumping and uneven stain.
- Grad-CAM shows attention, not correctness.
- The slide decision rule is uncalibrated until tuned on expert-labelled slides.
- Nothing here detects pfhrp2/3 deletions or measures parasite density.
- Not a diagnostic device; no clinical validation.

## 7. What was and was not tested while writing this repo

- **Tested (19 passing tests):** patient grouping (including merging on shared `C` or `P` tokens), the leakage check, the image cache and its stale-cache refusal, the dataset verifier (including a planted label conflict), the quality gate, segmentation and field counting on synthetic fields, the full API (authentication, validation, size limit, rate limit, recapture), and PSI drift.
- **Not run:** everything that needs PyTorch (`dataset`, `model`, `train` with AMP, resume and early stopping, `evaluate`, `gradcam`, `robustness`, `export`, MLflow logging), the Colab notebook itself, and Docker. PyTorch could not be installed where I built this. The notebook's cells parse and the code compiles, but expect small fixes on first run: do the 5% debug run (notebook cell 9) before any long job.
- Synthetic images are far easier than real microscopy; the segmentation result on them says nothing about real slides.
- I could not open NLM's patient-mapping CSVs, so the grouping rule rests on NLM's documented filename convention plus a deliberately conservative merge. Check it against those files.
