# Datasets, Processing and Compute (Colab) Guide

Read after `PROJECT_PLAN.md`. Facts below were checked against NLM and other pages in October 2026; items marked **(verify)** I could not confirm from where I worked, so check them yourself before relying on them. Every dataset needs **mentor approval and a licence check before download** (guide M18 A, Appendix C).

## 1. Which dataset to select

| Role | Dataset | What it is | Use it for | Caveats |
|---|---|---|---|---|
| **Primary** | NLM thin-smear **single-cell images** (`cell_images.zip`) | 27,558 cropped red blood cells, 13,779 parasitized and 13,779 uninfected, from about 200 patients (150 P. falciparum + 50 healthy), Giemsa stain | Stages 2 to 4 and 6: baseline, transfer learning, evaluation, robustness | Cropped and cleaned, so easier than real use. One species, one hospital. Only about 200 patients, so patient-level intervals will be wide. No stage or density labels. |
| **Secondary (best fit for your goal)** | NLM thin-smear **whole-field images**, 193 patients (148 infected, 45 uninfected) | Full microscope-field photographs, about 5 per patient, JPEG 2988 x 5312, with annotations for infected/uninfected RBCs plus classes such as white blood cell, debris, platelet, stain precipitation, bacteria. NLM describes images from the Malaria Screener smartphone-on-microscope setup | Stage 5 (train or test the cell finder) and Stage 8 (field-level test closest to your phone use case), and for false-positive analysis on debris and platelets | **(verify)** download size and annotation file format before planning storage. Only about 5 fields per patient, so it cannot reproduce a 20-field slide protocol. |
| **External test** | BBBC041 (Broad Institute) | P. vivax thin-smear images with bounding boxes, heavily imbalanced (over 95% uninfected RBCs) | A different-species, different-stain test of the cell classifier, to measure how performance drops outside the training distribution | **(verify)** licence and terms on the BBBC page. Different species means low scores are expected, not a bug. |
| Not now | Thick-smear datasets | Different task and image scale | Future work | Do not mix with the thin-smear pipeline. |

**Which copy of the single-cell data?** Use the **NLM original** so you can cite provenance. The Kaggle and TensorFlow Datasets copies are the same data repackaged by third parties; they are convenient but you should still confirm the terms at NLM. IEEE DataPort hosts an "updated" version re-sorted into parasitized / uninfected / weird / bad segmentation / unsure folders, which may have cleaner labels; if you use it, say so in the data story and check its terms.

**Decision rule.**
1. Train and validate the cell classifier on the NLM single-cell set.
2. Use the NLM whole-field images to build and test the cell finder and the full field pipeline.
3. Use BBBC041 only as an external, out-of-distribution test.
4. Add your own phone-on-eyepiece images only with approval (Stage 8).

## 2. The patient-level split (this decides whether your numbers mean anything)

NLM documents that the patient ID is inside the filename, e.g. `C33P1thinF_IMG_..._cell_179.png` has patient `P1`, and provides CSV files that map patient IDs to cells. The uninfected CSV has 201 entries (151 + 50) because infected patients also contribute uninfected cells. So **one patient appears in both classes**, and a split by class folder or by random image leaks that patient into the test set.

A June 2026 preprint (not peer-reviewed) re-ran a benchmark with a slide-disjoint split and reported accuracy falling from 97.06% to 95.61% for its architecture, and argued that random per-cell splits distort model comparisons. Treat it as supporting evidence, not proof; the principle is standard (guide M09).

**What the repo does.** `data.assign_groups` links every file that shares a `C...` token or a `P...` token (union-find), so no patient can land in two splits whichever token is the true patient key. This can over-merge (safe, only reduces split precision) but cannot under-merge. `prepare_data.py` prints the largest group's share and warns above 15%.

**Earlier mistake, corrected.** My first version grouped by the `C` token only, which was a guess about the filenames. That could have split one patient across train and test. The current rule fixes it. Still, download NLM's two patient-mapping CSVs, open them, and check that each patient's cells fall in a single group (I could not open them from my environment, so I did not hard-code their format).

## 3. Processing pipeline (do in this order)

| # | Step | Command / action | Why |
|---|---|---|---|
| 0 | Approval | Mentor signs off topic and dataset; record licence and source URL | Guide M18 A |
| 1 | Download once | Get `cell_images.zip` from NLM; keep a copy on Drive | Avoid re-downloading every session |
| 2 | Unzip to local disk | In Colab: `/content/data` (never train from a mounted Drive path) | Drive reads of many small files are slow |
| 3 | Integrity checks | `python scripts/verify_dataset.py` | Unreadable files, tiny files, duplicates, same image in both classes (label conflict) |
| 4 | Index and split | `python scripts/prepare_data.py` | Patient-level manifest; asserts no overlap; writes EDA tables |
| 5 | EDA | Notebook: class balance per split, images per patient, size range, colour per patient | Look for shortcuts such as stain colour that identifies the slide |
| 6 | Cache | `python scripts/cache_dataset.py` | Decode and resize once to a uint8 array (about 1.4 GB at 128 px for 27,558 images); training reads memory |
| 7 | Augment | Flips, 90-degree rotation, colour jitter, blur (in `dataset.py`) | Imitates stain and camera variation |
| 8 | Freeze the record | The manifest hash and git commit are logged with every run | Reproducibility (guide M16) |

Notes on choices:
- **Image size 128.** NLM cell crops are roughly 110 to 150 px, so 128 keeps most detail. Test 96 only if you need speed, and compare AUC.
- **No test-set tuning.** The threshold is chosen on validation, the metrics reported on test.
- **Do not normalise per image statistics from the whole dataset.** Use the ImageNet mean and std (already done), so serving matches training.

## 4. Optimisation strategies (what was implemented, what each costs)

| Strategy | Where | Benefit | Cost or risk |
|---|---|---|---|
| Cache resized images in one uint8 array | `cache.py`, `scripts/cache_dataset.py` | Removes per-epoch decode and file I/O | Needs about 1.4 GB RAM or disk at 128 px; cache stores the manifest hash and refuses to load if stale |
| Train from local disk, not Drive | notebook cells 5 to 7 | Avoids slow small-file reads | Data is lost when the session ends; keep the zip on Drive |
| Mixed precision (AMP, fp16) | `train.py`, `train.amp` | Faster steps and lower GPU memory on a T4 | Small numeric differences; compare val AUC with `amp: false` once |
| `channels_last` + `cudnn.benchmark` | `train.py` | Faster convolutions on GPU | None for fixed input size |
| Pinned memory, persistent workers | `dataset.make_loader` | Keeps the GPU fed | Uses CPU RAM; set `num_workers` from `os.cpu_count()` |
| Freeze backbone first, then fine-tune | `train.py` | Cheap early epochs, stable fine-tuning | Two phases to explain |
| Checkpoint every epoch to Drive, `--resume` | `train.py` | A disconnect costs at most one epoch | Drive writes are slowish; fine for one file per epoch |
| Early stopping (patience) | `train.patience` | Stops when validation AUC stops improving | Patience too low can stop early |
| Debug subset (`debug_fraction`) | config, notebook cell 9 | Tests the whole pipeline in minutes before a long run | Debug metrics mean nothing |
| ONNX INT8 for serving | `export.py` | Smaller, CPU-friendly model, no torch in the container | Possible accuracy loss: measure it. Time it on the target phone, not the laptop |
| Lightweight backbone later | swap in `model.py` | MobileNetV3 may suit phones | Re-run the whole evaluation |

I have **not** measured speedups for any of these, because I could not run PyTorch where I built it. Do a small ablation on your first run and record it in the logbook:

| Setting | Epoch time (s) | Val AUC | GPU memory |
|---|---|---|---|
| no cache, fp32 | | | |
| cache, fp32 | | | |
| cache, AMP | | | |

## 5. Using Google Colab

Open `notebooks/colab_train.ipynb`, set the runtime to a GPU, and run the cells in order. The notebook keeps data and cache on the local disk and checkpoints and reports on Drive.

What to expect (sources, October 2026): the free tier typically gives a T4 but does not guarantee any GPU, session length or idle timeout; reports describe up to about 12 hours per session and disconnects after roughly 90 minutes idle, with paid tiers giving priority but still not guarantees. Plan for disconnects; the notebook is built for it.

Habits that help:
1. Do the quick pipeline check (cell 9) before the long run.
2. Keep the browser tab open during training; reconnect and rerun cells 1 to 7, then cell 10 with `--resume`.
3. Copy final artefacts (best.pt, ONNX, threshold.json, metrics.json, manifest.csv) off the session; the notebook already writes them to Drive.
4. If the free GPU is unavailable, **Kaggle Notebooks** is the closest free alternative: its documentation gives 12-hour sessions, and a secondary source reports about 30 GPU-hours per week (the quota is not in Kaggle's own docs, so check your account).
5. Anything that needs no GPU (tests, the API, field scanning, the baseline) can run on your laptop.

Colab is for development and training. Do not treat it as the place to deploy; serving is the Docker image from Stage 7.

## 6. Data governance reminders

- Public, de-identified datasets only, unless a mentor approves otherwise.
- No patient names, IDs, dates or locations in your logs, notebook outputs or screenshots.
- Do not upload private data to Colab or Drive folders shared beyond your team.
- Record dataset source, licence, download date and file hashes in the model card.

## Sources checked

- NLM Malaria datasheet: https://lhncbc.nlm.nih.gov/LHC-research/LHC-projects/image-processing/malaria-datasheet.html (dataset list, download links, annotation classes)
- NLM Malaria Screener downloads page: https://lhncbc.nlm.nih.gov/LHC-downloads/mobile-app.html (patient-ID encoding, mapping CSVs, 27,558 cells)
- Rajaraman et al., PeerJ 6:e4568 (2018), the paper cited by NLM for the single-cell set
- BBBC041: https://bbbc.broadinstitute.org/BBBC041
- Preprint on slide leakage: https://www.preprints.org/manuscript/202606.0677 (not peer-reviewed)
- Colab and Kaggle limits: community and review articles (Hivenet, gpuperhour.com, aimultiple.com); Google does not publish exact limits
