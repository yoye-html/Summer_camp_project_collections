"""Stage 4: transfer learning recipe from guide Module 13 (ResNet backbone)."""
import torch.nn as nn
from torchvision import models


def build_model(pretrained: bool = True, num_classes: int = 2) -> nn.Module:
    weights = models.ResNet18_Weights.DEFAULT if pretrained else None
    m = models.resnet18(weights=weights)
    m.fc = nn.Linear(m.fc.in_features, num_classes)   # step 2: replace the final layer
    return m


def set_backbone_trainable(model: nn.Module, trainable: bool) -> None:
    """Step 3 freezes the pretrained layers; step 4 unfreezes them."""
    for name, p in model.named_parameters():
        if not name.startswith("fc."):
            p.requires_grad = trainable
