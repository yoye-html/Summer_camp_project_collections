"""PyTorch dataset and transforms (needs torch)."""
import numpy as np
import pandas as pd
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms as T

MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def get_transforms(size: int, train: bool):
    if train:
        return T.Compose([
            T.Resize((size, size)),
            T.RandomHorizontalFlip(), T.RandomVerticalFlip(),
            T.RandomRotation(90),
            # colour jitter imitates stain and camera variation (domain shift)
            T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.02),
            T.RandomApply([T.GaussianBlur(3, sigma=(0.1, 1.5))], p=0.3),
            T.ToTensor(), T.Normalize(MEAN, STD),
        ])
    return T.Compose([T.Resize((size, size)), T.ToTensor(), T.Normalize(MEAN, STD)])


class CellDataset(Dataset):
    def __init__(self, df: pd.DataFrame, tfm):
        self.df = df.reset_index(drop=True)
        self.tfm = tfm

    def __len__(self):
        return len(self.df)

    def __getitem__(self, i):
        row = self.df.iloc[i]
        img = Image.open(row["path"]).convert("RGB")
        return self.tfm(img), int(row["label"]), i


class CachedCellDataset(Dataset):
    """Reads pre-resized uint8 images from the cache array (rows located by the manifest 'row' column)."""
    def __init__(self, df: pd.DataFrame, arr, tfm):
        self.rows = df["row"].to_numpy()
        self.labels = df["label"].to_numpy()
        self.arr, self.tfm = arr, tfm

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        img = Image.fromarray(np.asarray(self.arr[self.rows[i]]))
        return self.tfm(img), int(self.labels[i]), i


def make_loader(df, size, train, batch_size, num_workers=0, cache=None):
    import torch
    tfm = get_transforms(size, train)
    ds = CachedCellDataset(df, cache, tfm) if cache is not None else CellDataset(df, tfm)
    return DataLoader(ds, batch_size=batch_size, shuffle=train, num_workers=num_workers,
                      pin_memory=torch.cuda.is_available(), persistent_workers=num_workers > 0)
