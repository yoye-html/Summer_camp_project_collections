"""Stage 5: Grad-CAM for ResNet. Shows WHERE the model looked, not that it is right:
always check heatmaps by eye on correct AND wrong cases (guide M13 section C)."""
import cv2
import numpy as np
import torch
import torch.nn.functional as F


class GradCAM:
    def __init__(self, model, layer):
        self.model, self.acts, self.grads = model, None, None
        layer.register_forward_hook(self._save)

    def _save(self, module, inp, out):
        self.acts = out.detach()
        out.register_hook(lambda g: setattr(self, "grads", g.detach()))

    def __call__(self, x: torch.Tensor, target: int = None) -> torch.Tensor:
        self.model.eval()
        out = self.model(x)
        t = out.argmax(1) if target is None else torch.full((x.size(0),), target, device=x.device)
        self.model.zero_grad()
        out.gather(1, t[:, None]).sum().backward()
        w = self.grads.mean((2, 3), keepdim=True)
        cam = F.relu((w * self.acts).sum(1, keepdim=True))
        cam = F.interpolate(cam, size=x.shape[2:], mode="bilinear", align_corners=False)[:, 0]
        cam = cam - cam.amin((1, 2), keepdim=True)
        return cam / (cam.amax((1, 2), keepdim=True) + 1e-8)


def overlay(img_rgb: np.ndarray, cam: np.ndarray, alpha: float = 0.4) -> np.ndarray:
    cam = cv2.resize(cam, (img_rgb.shape[1], img_rgb.shape[0]))
    heat = cv2.cvtColor(cv2.applyColorMap((cam * 255).astype(np.uint8), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    return cv2.addWeighted(img_rgb, 1 - alpha, heat, alpha, 0)
# usage: cam = GradCAM(model, model.layer4)(x)[0].cpu().numpy()
