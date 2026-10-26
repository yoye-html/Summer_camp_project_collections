# VS Code workflow and offloading the heavy work

## 1. Short answers

**Do the steps change for VS Code?** The commands do not. VS Code is an editor on top of the same virtual environment, the same `make` commands and the same scripts. What changes is *how you drive them*: pick the interpreter once, run tests and debug from buttons, and run tasks from the command palette. The repo now ships `.vscode/` settings that do this for you.

**Must the hard part run on your laptop?** No. The heavy steps (training, full evaluation, caching, export) can all run in the cloud. Your laptop then only needs to edit code, run the light tests, tune the field pipeline on a few images, and serve the finished ONNX model, which is light CPU work.

## 2. Setting up VS Code (Ubuntu)

```bash
sudo snap install code --classic      # or download the .deb from the VS Code website
cd ~/projects/dagu-malaria
code .
```

Then:

1. Install the recommended extensions when VS Code offers them (Python, Debugpy, Jupyter, YAML, Docker). They are listed in `.vscode/extensions.json`.
2. `Ctrl+Shift+P` > **Python: Select Interpreter** > choose `./.venv/bin/python`. (`settings.json` already points there; select it once if VS Code asks.)
3. Open a terminal (`` Ctrl+` ``). The venv should activate automatically; the prompt shows `(.venv)`.
4. Open the **Testing** panel (beaker icon). Pytest is pre-configured; you should see the 20 tests and be able to run or debug each.
5. **Run and Debug** (`Ctrl+Shift+D`): pick *Prepare data*, *Smoke test (torch)*, *Train*, *Evaluate* or *API (uvicorn, local only)* and press F5. Set breakpoints in `src/dagu/*.py`. The API configuration uses a throwaway local key, which is not a secret; never reuse it anywhere real.
6. **Terminal > Run Task…** lists *Check environment*, *Run tests*, *Verify dataset*, *Prepare split*, *Build image cache*, *Evaluate*, *Export ONNX*.

If imports show as unresolved, you are on the wrong interpreter (step 2) or have not run `pip install -e .`.

## 3. What runs where

| Job | Laptop (CPU) | Colab (GPU) | Notes |
|---|---|---|---|
| Edit code, git, tests, debugging | Yes | | VS Code |
| Dataset verify, split, cache, baseline | Yes (fine) | Also fine | Cache is about 1.4 GB |
| **Training** | Slow | **Yes** | Do the 5% debug run first |
| Evaluation (val and test) | Possible | **Yes** (notebook does it) | Inference only |
| ONNX export and INT8 | Possible | **Yes** (notebook does it) | Download the ONNX files |
| Tune the quality gate and segmentation | **Yes** | | Needs your eyes on real images |
| Serve the API, Docker, drift monitor | **Yes** | | Final model is light on CPU |
| Whole-field image experiments (very large JPEGs) | Possible | Better | Check the real file size first |

So you can finish the whole project with the laptop doing only the human-in-the-loop and serving parts.

## 4. Recommended workflow: Git as the bridge

This keeps your editor local and the compute remote, and avoids re-uploading zips.

```
VS Code (laptop)  --git push-->  GitHub  --git clone/pull-->  Colab runtime (GPU)
        ^                                                              |
        |                                                              v
        +-------- download best.pt, threshold.json, metrics ---- Google Drive / download
```

1. Put the project on GitHub (`docs/IMPLEMENTATION_GUIDE.md` section 6). Use a **private** repo while it contains course work.
2. In `notebooks/colab_train.ipynb`, set `REPO_URL` in cell 3 to your repo. Each time you change code: commit and push in VS Code, then rerun cell 3 in Colab.
3. A private repo needs credentials in Colab. Use a fine-grained, read-only token, paste it only into your own session, and never save it into the notebook or commit it.
4. Train, evaluate and export in Colab. The last cell zips the small results (`best.pt`, `threshold.json`, `meta.json`, `manifest.csv`, `reports/`) for download. Large datasets and caches stay on the runtime.
5. Back on the laptop, put the results in `models/` and run `python scripts/compare_splits.py` against the Colab manifest.

## 5. Running notebooks from VS Code on a Colab runtime

Google publishes an official **Colab** extension for VS Code (released November 2025, also on Open VSX). It lets a local `.ipynb` run on a Colab-hosted runtime, GPUs included, so you stay in VS Code.

To use it:
1. Install the extension named **Colab** from the publisher **Google** (verified badge). Avoid similarly named third-party extensions such as "colab-connect" or "vscode-colab", which use unofficial APIs and can break.
2. Open `notebooks/colab_train.ipynb`.
3. **Select Kernel > Colab**, then **New Colab Server** (pick a GPU if one is offered) or **Auto Connect** to reuse your last runtime.
4. Run `!nvidia-smi` in the first cell to confirm a GPU.

Limits you should know:
- **The remote runtime cannot see files on your laptop.** A GitHub issue on the extension reports exactly this. So the notebook must get the repo (via `REPO_URL`) and the dataset (via download or Drive) onto the runtime itself. The notebook is written that way.
- **Drive mounting may not work in this mode.** I could not test it. Cell 2 falls back to temporary storage if the mount fails; in that case run the last cell and download your results before the session ends, because the runtime's disk disappears afterwards.
- **GPU availability is not guaranteed** on the free tier, and peak hours can leave you with CPU only.
- I have not run this notebook in the VS Code extension. Try cells 1 to 4 first and fix problems before starting a long job.

If the extension gives trouble, the **browser Colab** route (open the same notebook at colab.research.google.com) is the safer default.

## 6. Other places to run the heavy part

| Option | Good for | Caveats |
|---|---|---|
| Browser Colab | Default; works with the notebook as written | Session limits, disconnects |
| Colab inside VS Code | Editing and running in one window | Section 5 limits |
| Kaggle Notebooks | Free GPU fallback; 12-hour sessions, and a secondary source reports about 30 GPU-hours per week | The notebook needs path changes; the quota is not in Kaggle's own docs, so check your account. I can adapt the notebook if you want it |
| A rented GPU VM with VS Code **Remote - SSH** | Long jobs, no session cap; the repo runs unchanged | Costs money; you manage the machine; do not put private data on it without approval |
| Your laptop | Everything light | CPU only |

## 7. Rules that hold wherever you compute

- Dataset approval and the licence check come first, in every location.
- Keep patient-like or private data off shared drives and cloud notebooks.
- Never commit or paste API keys, tokens or the Docker API key.
- Record in the logbook *where* each result was produced (Colab T4, laptop CPU) and the manifest hash. Results from different machines are comparable only if `compare_splits.py` says the splits are identical.

## 8. A sensible first week

1. VS Code set up, interpreter selected, 20 tests green in the Testing panel.
2. Repo on GitHub.
3. Colab notebook cells 1 to 4 run, GPU confirmed (browser first, then optionally the VS Code extension).
4. Mentor approval requested.
5. After approval: cells 5 to 9 (data, split, cache, 5% debug run). Stop and fix anything that fails before a long training run.
