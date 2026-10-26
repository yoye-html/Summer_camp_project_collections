#!/usr/bin/env bash
# One-shot setup for Ubuntu (CPU-only PyTorch). Run from anywhere:  bash scripts/setup_ubuntu.sh
set -euo pipefail
cd "$(dirname "$0")/.."

sudo apt update
sudo apt install -y python3 python3-venv python3-pip git unzip build-essential curl

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip

# PyTorch first, from the CPU wheel index, so pip does not pull the huge CUDA build
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
pip install -e .

python scripts/check_env.py
python -m pytest -q
echo
echo "Setup finished. In every new terminal run:  cd $(pwd) && source .venv/bin/activate"
