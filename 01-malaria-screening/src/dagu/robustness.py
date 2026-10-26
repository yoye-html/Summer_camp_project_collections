"""Stage 6: attack, defend, document (guide Lab 17.1). FGSM evasion test on the cell classifier."""
import numpy as np
import torch
import torch.nn.functional as F


def fgsm(model, x, y, eps: float):
    x = x.clone().requires_grad_(True)
    F.cross_entropy(model(x), y).backward()
    return (x + eps * x.grad.sign()).detach()


def robustness_report(model, loader, device, eps_list=(0.0, 0.01, 0.03, 0.1)) -> dict:
    """eps is in normalised-pixel units. Reports sensitivity (recall of Parasitized) per eps."""
    model.eval(); res = {}
    for eps in eps_list:
        tp = fn = 0
        for x, y, _ in loader:
            x, y = x.to(device), y.to(device)
            xa = fgsm(model, x, y, eps) if eps > 0 else x
            with torch.no_grad():
                pred = model(xa).argmax(1)
            pos = y == 1
            tp += int(((pred == 1) & pos).sum()); fn += int(((pred == 0) & pos).sum())
        res[eps] = tp / max(tp + fn, 1)
    return res
# Defence to try and measure: adversarial training (mix fgsm(x) into each training batch),
# then re-run robustness_report and record the change in the model card.
