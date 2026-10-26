"""Stage 2/4: build the resized image cache (run after prepare_data.py). Usage: python scripts/cache_dataset.py"""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dagu.cache import build_cache
from dagu.config import load_config

ap = argparse.ArgumentParser(); ap.add_argument("--config", default="configs/config.yaml")
cfg = load_config(ap.parse_args().config)
print("wrote", build_cache(cfg))
