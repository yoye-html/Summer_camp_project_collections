"""Predictors with one interface: callable(list of BGR crops) -> np.ndarray of P(Parasitized)."""
import numpy as np

from .preprocess import batch_from_crops, softmax_pos


class OnnxPredictor:
    """Serving path: needs only onnxruntime (no torch), so the container stays small."""
    def __init__(self, model_path: str, img_size: int):
        import onnxruntime as ort
        self.sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        self.input_name = self.sess.get_inputs()[0].name
        self.size = img_size

    def __call__(self, crops: list) -> np.ndarray:
        if not crops:
            return np.zeros(0)
        logits = self.sess.run(None, {self.input_name: batch_from_crops(crops, self.size)})[0]
        return softmax_pos(logits)


class TorchPredictor:
    def __init__(self, ckpt: str, img_size: int, device: str = "cpu"):
        import torch
        from .model import build_model
        self.torch, self.size, self.device = torch, img_size, device
        self.model = build_model(pretrained=False)
        self.model.load_state_dict(torch.load(ckpt, map_location=device))
        self.model.to(device).eval()

    def __call__(self, crops: list) -> np.ndarray:
        if not crops:
            return np.zeros(0)
        x = self.torch.from_numpy(batch_from_crops(crops, self.size)).to(self.device)
        with self.torch.no_grad():
            return softmax_pos(self.model(x).cpu().numpy())
