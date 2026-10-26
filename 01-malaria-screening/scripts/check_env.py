"""Reports whether this machine is ready: Python, RAM, disk, CPU flags, PyTorch, GPU. Usage: python scripts/check_env.py"""
import os, platform, shutil, sys


def meminfo_gb() -> float:
    try:
        for line in open("/proc/meminfo"):
            if line.startswith("MemTotal"):
                return int(line.split()[1]) / 1024 / 1024
    except OSError:
        pass
    return float("nan")


def cpu_flags() -> set:
    try:
        for line in open("/proc/cpuinfo"):
            if line.startswith("flags"):
                return set(line.split(":")[1].split())
    except OSError:
        pass
    return set()


print(f"Python      : {platform.python_version()} ({'OK' if sys.version_info >= (3, 10) else 'TOO OLD: need 3.10+'})")
print(f"CPU cores   : {os.cpu_count()}  | AVX2: {'yes' if 'avx2' in cpu_flags() else 'NO or unknown'}")
print(f"RAM         : {meminfo_gb():.1f} GB total")
free = shutil.disk_usage(".").free / 1e9
print(f"Disk free   : {free:.0f} GB here ({'OK' if free > 20 else 'LOW: need about 20 GB'})")
for mod in ["numpy", "pandas", "sklearn", "cv2", "PIL", "onnxruntime", "fastapi", "yaml"]:
    try:
        m = __import__(mod); print(f"{mod:12}: {getattr(m, '__version__', 'ok')}")
    except ImportError:
        print(f"{mod:12}: MISSING")
try:
    import torch
    print(f"torch       : {torch.__version__} | CUDA available: {torch.cuda.is_available()} | threads: {torch.get_num_threads()}")
    if not torch.cuda.is_available():
        print("              (no GPU is normal on this laptop: train on Colab, use this machine for everything else)")
except ImportError:
    print("torch       : MISSING (see docs/IMPLEMENTATION_GUIDE.md section 5)")
except Exception as e:   # a half-installed or wrong-architecture torch fails at import
    print(f"torch       : installed but NOT usable ({type(e).__name__}: {str(e)[:120]}). Reinstall the CPU wheel.")
