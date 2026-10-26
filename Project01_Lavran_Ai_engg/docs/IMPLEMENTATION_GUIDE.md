# Implementation Guide: building Dagu on an HP ProBook 650 G1 (Ubuntu, 12 GB RAM, 1 TB)

This is the hands-on companion to `PROJECT_PLAN.md`. Every command is meant to be pasted into a terminal. Anything marked **(check)** depends on your exact machine, so run the command shown and read the output instead of trusting my assumption.

## 1. What this laptop can and cannot do

I have not seen your machine, so confirm the hardware assumptions in section 2. The ProBook 650 G1 is an older business laptop, normally with an Intel 4th-generation Core CPU and integrated graphics (some models add a small AMD GPU). **Neither can run PyTorch's NVIDIA GPU code**, so plan for CPU only.

| Task | Where | Why |
|---|---|---|
| Tests, EDA, split, cache, baseline, field scanning, API, Docker, drift monitor | **This laptop** | CPU is enough |
| Training the ResNet18 (many epochs over about 27k images) | **Google Colab GPU** | A CPU this old will be very slow; measure with the 5% debug run before deciding |
| Evaluation on val and test, ONNX export, INT8 | This laptop (inference only) | Inference on a few thousand 128-pixel images is manageable on CPU |

RAM: 12 GB is comfortable. The image cache at 128 px is about 1.4 GB. Disk: 1 TB is far more than needed (plan 20 to 50 GB for Python packages, data, caches and Docker).

## 2. Check your machine first

```bash
lsb_release -a              # Ubuntu version
python3 --version           # need 3.10 or newer
lscpu | grep -E "Model name|^CPU\(s\)|Flags" | cut -c1-120
grep -c avx2 /proc/cpuinfo  # 0 means no AVX2: tell me, the standard PyTorch wheels may not run
free -h                     # RAM
df -h ~                     # free disk
lspci | grep -i -E "nvidia|vga"   # no NVIDIA line = no CUDA, as expected
```

If `python3 --version` shows older than 3.10 (common on Ubuntu 20.04 and earlier), upgrade Ubuntu or install a newer Python (for example with `pyenv`) before continuing. Check the PyTorch install selector for the versions it currently supports.

## 3. Install system tools

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git unzip build-essential curl
```

Docker is only needed at Stage 7; install it later (section 10).

## 4. Where to put the files I made

You have `dagu-malaria.zip`. It contains the whole project. The loose copies of the guides and notebook are identical to the ones inside it.

```bash
mkdir -p ~/projects
unzip ~/Downloads/dagu-malaria.zip -d ~/projects
cd ~/projects/dagu-malaria
```

Result:

```
dagu-malaria/
├── configs/config.yaml        # ALL settings live here
├── src/dagu/                  # the library
│   ├── data.py  cache.py  dataset.py  model.py  train.py  evaluate.py   # training side
│   ├── quality.py  fieldscan.py  gradcam.py  robustness.py              # field pipeline and hardening
│   ├── inference.py  export.py  api.py  monitor.py                      # serving side
│   └── preprocess.py  synthetic.py  baseline.py  config.py
├── scripts/                   # entry points you run
├── tests/                     # 19 tests
├── notebooks/colab_train.ipynb
├── docs/                      # PROJECT_PLAN, DATASETS_AND_COLAB, this guide, learn path
├── models/                    # trained weights go here (git-ignored)
├── data/                      # you create this: dataset, manifests, cache (git-ignored)
├── Dockerfile  Makefile  pyproject.toml  requirements*.txt  MODEL_CARD.md  README.md
```

What each file is for, in the order you will touch them:

| File | Purpose | You edit it? |
|---|---|---|
| `configs/config.yaml` | Paths, image size, epochs, thresholds, API limits | Yes, rarely |
| `scripts/check_env.py` | Is this machine ready? | No |
| `scripts/verify_dataset.py` | Integrity checks on the images | No |
| `scripts/prepare_data.py` | Patient-level split and EDA facts | No |
| `scripts/cache_dataset.py` | Build the resized-image cache | No |
| `src/dagu/train.py` | Training (run on Colab) | Later, when experimenting |
| `src/dagu/evaluate.py` | Honest metrics and error analysis | Sometimes |
| `src/dagu/fieldscan.py`, `quality.py` | The field pipeline | **Yes: tune on real images** |
| `src/dagu/export.py`, `api.py`, `Dockerfile` | Packaging and serving | Rarely |
| `MODEL_CARD.md` | Fill with your measured numbers | **Yes** |

## 5. Python environment

**Fast path** (does everything in this section):

```bash
bash scripts/setup_ubuntu.sh
```

**Manual path** (same thing, so you see each step):

```bash
cd ~/projects/dagu-malaria
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip

# 1) PyTorch CPU wheel FIRST. A plain "pip install torch" can pull a multi-gigabyte CUDA build you cannot use.
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# 2) everything else
pip install -r requirements.txt

# 3) make "import dagu" and "python -m dagu.train" work from anywhere in the project
pip install -e .
```

In every new terminal: `cd ~/projects/dagu-malaria && source .venv/bin/activate`.

### Requirements

| Package | Used for |
|---|---|
| torch, torchvision | model, training, Grad-CAM (CPU build locally) |
| numpy, pandas, scikit-learn | data handling, split, metrics, baseline |
| pillow, opencv-python-headless | image loading and the field pipeline |
| matplotlib | confusion matrix and error grids |
| pyyaml | config |
| mlflow | experiment tracking (optional; training works without it) |
| onnx, onnxruntime | export, INT8, serving |
| fastapi, uvicorn, python-multipart | the API |
| pytest, httpx | tests |

Versions are not pinned because I could not test them against your machine. After everything works, freeze them so others can reproduce your environment:

```bash
pip freeze > requirements.lock.txt
git add requirements.lock.txt
```

### Verify

```bash
python scripts/check_env.py     # Python, RAM, disk, AVX2, packages, torch
python -m pytest -q             # expect: 19 passed
python scripts/smoke_test_torch.py   # full training path on synthetic cells, CPU, a few minutes
```

The last command is the first time the PyTorch code in this repo runs for real, because I could not run it myself. If it fails, copy the last 15 lines of the error to me. Common causes are in section 13.

## 6. Git

```bash
git init
git add .
git commit -m "Initial Dagu starter"
# create an empty repo on GitHub, then:
git remote add origin git@github.com:<you>/dagu-malaria.git
git push -u origin main      # your default branch may be "master"; check with: git branch
```

`.gitignore` already excludes data, weights, caches, logs and `.venv`. Never commit the dataset, API keys or patient-like data.

## 7. Get and prepare the data (after mentor approval and a licence check)

```bash
mkdir -p data && cd data
wget -O cell_images.zip https://data.lhncbc.nlm.nih.gov/public/Malaria/cell_images.zip
unzip -q cell_images.zip
find . -maxdepth 3 -type d -name Parasitized     # shows where the class folders ended up
cd ..
```

The class folders must be at `data/cell_images/Parasitized` and `data/cell_images/Uninfected`. If the unzip nested them differently, either move them or change `data.root` in `configs/config.yaml` to the folder that contains both. Then:

```bash
make verify      # integrity: unreadable, duplicate, or same-image-in-both-classes
make prepare     # patient-level split -> data/manifests/manifest.csv, EDA tables in reports/
make cache       # resized image cache -> data/cache/cells_128.npy (about 1.4 GB)
make baseline    # logistic regression on colour histograms: the number the CNN must beat
```

(`make` just runs the Python commands listed in `Makefile`; you can run those directly if you prefer.)

Read the output of `make prepare`: images and patients per split, class balance, and the **largest group share**. If it warns that one group holds over 15% of the images, stop and inspect the filenames before training. Also download NLM's patient-to-cell CSV files and check that each patient's cells are in one group (see `DATASETS_AND_COLAB.md` section 2).

## 8. Train on Colab, then bring the results home

1. In Google Drive create `My Drive/dagu/` and upload `dagu-malaria.zip` (and `cell_images.zip` if you have it).
2. Open `notebooks/colab_train.ipynb` in Colab, set **Runtime > Change runtime type > T4 GPU**, and run the cells in order. Cell 5 has an `APPROVED` flag so the download is blocked until you confirm mentor sign-off.
3. When training and evaluation finish, the results are in `My Drive/dagu/runs/run1/`. Download these:
   - `best.pt`, `meta.json`, `threshold.json`
   - `manifest.csv` (the split Colab used)
   - the `reports/` folder
4. Put the three model files in your project's `models/` folder.
5. **Check both machines used the same split:**
   ```bash
   python scripts/compare_splits.py ~/Downloads/manifest.csv data/manifests/manifest.csv
   ```
   You want `Identical splits.` The split is deterministic (fixed seed, sorted files), so a difference means the two copies of the dataset differ. Do not compare results across machines if it fails.

If you cannot use Colab, you can train locally: set `train.debug_fraction: 0.05` in the config, run `make train`, and read the epoch time it prints. Extrapolate before committing to a full run. On a CPU you may want `img_size: 96` and a smaller `batch_size`; verify that AUC does not drop.

## 9. Evaluate, export and scan on the laptop

```bash
make evaluate    # val -> threshold, test -> metrics. Writes reports/metrics.json, confusion_matrix.png, top_errors.png
make export      # models/dagu_fp32.onnx and dagu_int8.onnx, with an accuracy and size comparison
python scripts/scan_field.py path/to/field.jpg --onnx models/dagu_int8.onnx --out annotated.png
```

`make export` prints AUC and sensitivity for FP32 and INT8. Record the difference in the model card. Its millisecond figure is this laptop's speed, not a phone's.

## 10. Serve the API and build the container

```bash
export DAGU_API_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
make serve        # http://127.0.0.1:8000/docs
```

In a second terminal (with the same `DAGU_API_KEY` exported):

```bash
curl -H "X-API-Key: $DAGU_API_KEY" -F "file=@field.jpg;type=image/jpeg" http://127.0.0.1:8000/predict/field
```

The service refuses to start without a key, rejects wrong file types and oversized uploads, rate-limits requests, and logs statistics (never images) to `logs/predictions.jsonl`.

Docker (install once):

```bash
sudo apt install -y docker.io
sudo usermod -aG docker $USER      # then log out and back in
docker build -t dagu .             # needs models/dagu_int8.onnx and models/threshold.json to exist
docker run --rm -e DAGU_API_KEY -p 8000:8000 dagu
```

Drift check after some requests have been logged:

```bash
python - <<'EOF'
from dagu import monitor, config
cfg = config.load_config()
monitor.make_reference(cfg["data"]["manifest"], cfg["quality"], "reports/reference_stats.csv")
print(monitor.drift_report("reports/reference_stats.csv", "logs/predictions.jsonl"))
EOF
```

## 11. Daily workflow

```bash
cd ~/projects/dagu-malaria && source .venv/bin/activate
git pull          # if working with teammates
make test         # always before you commit
# ... work ...
git add -A && git commit -m "what you changed and why"
```

Keep a logbook (`docs/LOGBOOK.md`): date, what you ran, the numbers, what surprised you.

## 12. Tuning for this machine

| Setting | Suggestion |
|---|---|
| CPU threads | `export OMP_NUM_THREADS=$(nproc)` before long CPU jobs |
| `train.num_workers` | start at 2; if the cache is in use, 0 or 2 is fine on a CPU |
| `train.batch_size` | 32 on CPU if memory is tight; 64 on Colab |
| `data.img_size` | 128 default; 96 is a speed experiment, not a default |
| Cache | keep it on the internal disk; delete `data/cache/` if you change `img_size` and rebuild |
| Memory | do not open the dataset in a notebook cell that loads all images as full-resolution arrays at once |

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `No module named dagu` | package not installed | `pip install -e .` inside the venv |
| `No module named torch`, or torch "installed but NOT usable" | wrong or broken wheel | `pip uninstall torch torchvision` then reinstall from the CPU index (section 5) |
| `Illegal instruction` when importing torch | CPU lacks AVX2 | tell me your `lscpu` flags; run torch work on Colab only |
| `DAGU_API_KEY is not set` | by design | export a key (section 10) |
| `Image cache does not match the current manifest` | manifest changed after caching | `make cache` again |
| `FileNotFoundError: No PNG images found under ...` | wrong `data.root` | point it to the folder that contains `Parasitized` and `Uninfected` |
| `LEAKAGE: cases in both train and test` | split bug or modified code | do not proceed; read `data.py` and `tests/test_data.py` |
| `CUDA` errors locally | no NVIDIA GPU | expected; the code falls back to CPU unless something forced CUDA |
| Training very slow | CPU only | use Colab; check the log says `image cache: in use` |
| `permission denied` on docker | not in docker group | `sudo usermod -aG docker $USER`, then log out and in |

## 14. Order of work, in one list

1. Sections 2 to 6: environment working, tests green, smoke test passing.
2. Mentor approval, then section 7: data verified, split, cached, baseline recorded.
3. Section 8: train on Colab, bring back the model, confirm identical splits.
4. Section 9: honest evaluation, error analysis, export.
5. Field pipeline: tune `quality` and `field` settings on real whole-field images (NLM whole-field set, then your own phone images with approval).
6. Hardening: robustness test, per-group performance, model card.
7. Section 10: API, Docker, drift monitor.
8. Rehearse the demo and fill `MODEL_CARD.md` with only measured numbers.
