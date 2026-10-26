# Model Card: Dagu cell classifier (research prototype)

Fill every field with MEASURED values. Delete anything you cannot support.

## Purpose and intended use
Research and teaching prototype that classifies single stained red blood cells (thin smear) as infected or uninfected and counts cells in a microscope field. **Not a diagnostic device. Not for treatment decisions.**

## Out of scope
Diagnosis, parasite density, species or stage identification, detecting pfhrp2/3 gene deletions, use on thick smears or unseen staining protocols, any use with identifiable patient data.

## Data
- Source and licence: NLM Malaria thin-smear single-cell dataset (Lister Hill National Center for Biomedical Communications / NIH, public domain)
- Images / patients per split: train 20,510 / 139, val 3,597 / 31, test 3,451 / 30 (total: 27,558 images, 200 patient groups)
- Split method: by patient (NLM filename token matching `C...P...` union-find), leakage check passed: yes (0 patient overlap)
- Known issues: slight slide staining variation across patients; 0 corrupt files, 0 tiny files, 0 duplicates, 0 label conflicts

## Model
ResNet18, ImageNet-pretrained, final layer replaced (2 classes), two-phase fine-tuning (head 3 epochs, fine-tuning 8 epochs, early stopping at best epoch 8). Input 128x128.

## Performance (test set, threshold 0.2470 chosen on validation)
| Metric | Value | 95% CI (patients resampled) |
|---|---|---|
| Sensitivity | 97.43% | [94.73%, 98.71%] |
| Specificity | 96.29% | [95.31%, 97.18%] |
| AUC | 0.9952 | [0.9912, 0.9973] |
| Precision | 94.73% | — |
| F1 Score | 0.9606 | — |

Baseline (colour histograms + logistic regression) test AUC: 0.9129 (val: 0.9133)
True Positives: 1,367 | False Positives: 76 | True Negatives: 1,972 | False Negatives: 36

INT8 versus FP32: AUC change -0.0001 (0.9924 -> 0.9922), size 44.7 MB -> 11.2 MB (75% compression), speed 13.2 ms -> 8.6 ms/cell (35% speedup)

## Performance across groups
Per patient: 10 patients achieved 100% sensitivity. The worst-performing patient was C115 (sensitivity: 61.5%, n=78), followed by C50 (75.8%, n=100), reflecting faint stain or early ring stages. Specificity on healthy patients ranged from 91.4% (C6) to 100% (C232).

## Robustness
FGSM adversarial evasion sensitivity across perturbation levels (normalised pixel units):
- eps = 0.00: 93.88%
- eps = 0.01: 82.99%
- eps = 0.03: 68.71%
- eps = 0.10: 48.30%
Vulnerability to gradient-based perturbation confirms the need for input quality gates and clinician oversight.

## Known failure modes
- Faint staining or atypical Giemsa preparation (as observed in patient C115).
- Stain precipitate, platelets, or dust particles mistaken for parasite chromatin.
- Severe cell clumping where classical watershed segmentation under-segments touching cells.
- Blur and severe under/over-exposure (safely rejected by the quality gate).

## Risks and misuse
A false negative can delay care; a false positive can cause needless antimalarial administration. Output is strictly a screening aid and must be reviewed by a qualified microscopist. Never use for autonomous triage or treatment decisions.

## Monitoring and rollback
Drift metric: Population Stability Index (PSI) on blur, brightness, and infected-cell ratio against validation reference (`reports/drift_reference.csv`).
Review trigger: PSI > 0.25 on any metric or image recapture rate > 20%.
Rollback plan: Previous weights archived in `models/best.pt` and `models/dagu_fp32.onnx`.
