# Dagu: Learn-by-Building Path

You do not need to understand everything before you start. Each milestone below has the same four parts:

- **Learn:** only the concepts that milestone needs, and why.
- **Build:** what to write yourself. Try it before opening the matching file in the repo; the repo is your answer key, not your starting point.
- **Check:** a result that tells you it works. If you cannot get it, you are not done.
- **Stretch:** optional, for when it feels easy.

Time estimates are mine, for a few focused evenings per milestone. Work in your own Git repo, commit at the end of every milestone, and keep a logbook (a Markdown file) of what you tried and what surprised you. The logbook becomes your defence material.

Three rules for the whole project:
1. **Make it run small first.** Every step is tried on 50 images before 27,000.
2. **Never trust a number you have not tried to break.** Ask: could the model have seen this patient before?
3. **When it breaks, read the last line of the error, then the line number it points to.** Most fixes are there. The PyTorch parts of the repo were not run by me, so you will meet real errors; that is part of the learning.

---

## Your first 90 minutes (do this today)

1. Unzip `dagu-malaria.zip`. In a terminal inside the folder:
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install numpy pandas scikit-learn matplotlib pillow opencv-python-headless pyyaml pytest fastapi httpx python-multipart
   pytest
   ```
   You should see `19 passed`. You now have a working project skeleton.
2. Make a picture of a fake microscope field and look at it:
   ```python
   import sys; sys.path.insert(0, "src")
   import cv2
   from dagu.synthetic import make_field
   img = make_field(n_cells=50, infected=range(10), seed=1, blur=False)
   cv2.imwrite("field.png", img)
   ```
   Open `field.png`. Pink cells, ten with a dark purple dot. This is the world your code lives in, and the real data is the messier version of it.
3. Create your logbook with three questions you cannot answer yet. Come back to them at the end.
4. Ask your mentor to approve the topic and the dataset (Milestone 0 of the plan). Do this now, because it can take days.

---

## Milestone 1: Look at images as numbers (about 3 h)

**Learn:** an image is an array of shape (height, width, 3) of numbers 0 to 255. NumPy slicing. A histogram of pixel values. Why colour matters for stained cells.

**Build:** a script that loads 9 random cells (use the synthetic ones until the real data is approved) and shows them in a 3 by 3 grid with their labels. Then print for each: shape, min, max, mean of each colour channel.

```python
from PIL import Image
import numpy as np
a = np.asarray(Image.open("some_cell.png").convert("RGB"))
print(a.shape, a.dtype, a.min(), a.max(), a.mean(axis=(0, 1)))
```

**Check:** you can explain why the mean of the red channel differs between a stained cell and the background.
**Stretch:** plot the histogram of one channel for an infected and an uninfected cell.

---

## Milestone 2: The split that decides everything (about 4 h)

**Learn:** train, validation and test sets; **data leakage**; why cells from one patient look alike so a random split cheats; grouping. Read the INSA guide Module 9 on leakage, then `docs/DATASETS_AND_COLAB.md` section 2.

**Build:** with a small fake folder (or the real data once approved):
1. List all files into a table with columns `path`, `label`, `patient`.
2. Split it **by patient** with scikit-learn's `GroupShuffleSplit`.
3. Write a function that raises an error if any patient is in two splits.
4. Now deliberately split **randomly by image** and run your check. Watch it fail.

**Check:** your check passes on the patient split and fails on the random one. You have just reproduced the mistake behind many published accuracy numbers.
**Compare with:** `src/dagu/data.py` and `tests/test_data.py`.
**Stretch:** read how `assign_groups` merges ID tokens, and write one test of your own for it.

---

## Milestone 3: A baseline and the language of results (about 5 h)

**Learn:** a **baseline** is the simple model you must beat. The confusion matrix: true positive, false positive, true negative, false negative. **Sensitivity** = TP / (TP + FN), the share of infected cells you catch. **Specificity** = TN / (TN + FP). **AUC** is the quality across all thresholds. For malaria, missing an infection is the costly error, so sensitivity matters most; that is why the threshold is chosen to reach a target sensitivity.

**Build:**
1. On paper, take 10 predictions and compute sensitivity and specificity by hand.
2. Make colour-histogram features and train `LogisticRegression` on the training split only.
3. Report AUC on validation, and print the confusion matrix at threshold 0.5.

**Check:** your hand calculation matches `sklearn.metrics.confusion_matrix`, and your baseline AUC is clearly above 0.5.
**Compare with:** `src/dagu/baseline.py`.
**Stretch:** add the mean and standard deviation per channel as features; does AUC move?

---

## Milestone 4: Your first neural network (about 8 h)

**Learn:** tensors; `Dataset` and `DataLoader`; a model; a loss; an optimiser; the training loop (forward, loss, backward, step). Read INSA Modules 11 and 12.

**Build, in two steps.**

*Step A. A tiny CNN from scratch on 64-pixel images, 500 images only:*

```python
import torch, torch.nn as nn

class TinyCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Linear(32, 2))
    def forward(self, x):
        return self.net(x)

model = TinyCNN(); loss_fn = nn.CrossEntropyLoss()
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
for x, y in loader:               # x: (batch, 3, 64, 64), y: (batch,)
    opt.zero_grad()
    loss = loss_fn(model(x), y)
    loss.backward()
    opt.step()
```

**Debugging trick every practitioner uses:** first try to **overfit one batch of 16 images**. If the loss does not fall to near zero, something is wrong with your data, labels or loop, not with the idea.

*Step B. Transfer learning:* now read `src/dagu/model.py` and `train.py`. Run `scripts/smoke_test_torch.py`, then the Colab notebook with the 5% debug run. Understand the two phases: first train only the new last layer, then unfreeze and fine-tune gently.

**Check:** the loss curve goes down; validation AUC beats your baseline; you can explain in two sentences why we start from a pretrained network.
**Stretch:** change the learning rate by 10x and write down what happens.

---

## Milestone 5: Evaluate honestly and study your mistakes (about 6 h)

**Learn:** pick the threshold on **validation**, report on **test**, and never go back and tune on test. Confidence intervals: with about 200 patients, a single number hides a lot of uncertainty, so we resample **patients**, not images.

**Build:** run `python -m dagu.evaluate`, then open `reports/top_errors.png` and `reports/per_case_performance.csv`. For each of the 12 worst mistakes write one sentence: label noise, debris, stain, genuinely hard? Fill the performance table in `MODEL_CARD.md`.

**Check:** you can answer "how do you know these numbers are not leaked?" in 30 seconds.
**Stretch:** find the patient with the worst sensitivity. Look at their images. What is different?

---

## Milestone 6: From one cell to a whole field (about 10 h)

**Learn:** OpenCV basics; thresholding (Otsu); morphology; watershed to split touching cells; why a **quality gate** that refuses bad images is safer than guessing.

**Build:**
1. Run `tests/test_field.py` and read it; it shows what the field pipeline should do.
2. Change `make_field` to add blur, then darkness, and see the gate reject each image with a reason.
3. Replace the stand-in classifier (`dark_spot_predictor`) with your trained model through `TorchPredictor`.
4. When approved, run the pipeline on the NLM whole-field images. Real fields will break the segmentation; tune `cell_area_px`, and write down what fails. That is the most valuable page of your logbook.

**Check:** a field photo returns either a recapture reason or counts with an annotated image.
**Compare with:** `quality.py`, `fieldscan.py`.
**Stretch:** count how many cells the segmentation misses on 10 hand-checked fields.

---

## Milestone 7: Explain it, then attack it (about 6 h)

**Learn:** **Grad-CAM** shows where the network looked, not that it is right. **FGSM** nudges every pixel slightly to fool the model. Read INSA Module 17 and Lab 17.1.

**Build:** make Grad-CAM overlays for 10 correct and 10 wrong predictions. Run `robustness_report`. Try one defence (mix attacked images into training) and re-measure.

**Check:** you can say honestly whether the heatmaps land on parasites, and how much sensitivity drops under attack.
**Stretch:** try a plain Gaussian-noise corruption and compare it with FGSM.

---

## Milestone 8: Make it usable and defend it (about 12 h)

**Learn:** exporting a model; INT8 quantisation costs a little accuracy for size and speed; an API as the contract between model and users; drift. Read INSA Module 16.

**Build:** export to ONNX and compare FP32 against INT8; run the API and call it with `curl`; build the Docker image; run the drift monitor on two sets of images. Finish `MODEL_CARD.md`. Rehearse the demo, including a blurry photo being rejected.

**Check:** a classmate can clone your repo and reproduce your numbers from the README.
**Stretch:** write one new test for the API.

---

## What to leave out (on purpose)

Parasite density, stage classification, RDT reading, the national risk map, a mobile app. Each is its own project. A scoped project with honest numbers beats a large one with claims you cannot support.

## When you are stuck

1. Shrink the problem: 16 images, 1 epoch, CPU.
2. Print shapes at every step (`print(x.shape)`).
3. Check labels: are 0 and 1 what you think?
4. Overfit one batch.
5. Write down the exact error and what you tried, then ask your mentor or me.

## Questions to answer in your logbook by the end

- Why is a random split of cells wrong here?
- What does 95% sensitivity mean for a patient with infected cells in a slide?
- What happens when the microscope or stain changes?
- Why can this model not claim to detect gene deletions?
- What would you need to run a real clinical validation?
