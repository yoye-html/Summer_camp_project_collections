import numpy as np
import pytest
from PIL import Image

from dagu.cache import build_cache, load_cache
from dagu.data import assign_groups, prepare, tokens


def test_tokens_follow_nlm_naming():
    assert tokens("C33P1thinF_IMG_20150619_114756a_cell_179.png") == ["C33", "P1"]
    assert tokens("C1_thinF_IMG_20150604_104722_cell_9.png") == ["C1"]


def test_shared_patient_or_slide_token_merges_groups():
    names = ["C33P1thinF_a.png", "C34P1thinF_b.png",   # same patient P1, different C
             "C40P9thinF_c.png", "C40P10thinF_d.png",  # same C40, different P
             "C7P5thinF_e.png"]                        # unrelated
    g = assign_groups(names)
    assert g[0] == g[1] and g[2] == g[3] and g[0] != g[2] and g[4] not in (g[0], g[2])


def make_cfg(tmp_path):
    for cls, tmpl in [("Parasitized", "C{c}P{c}ThinF_x_cell_{k}.png"), ("Uninfected", "C{c}_thinF_x_cell_{k}.png")]:
        (tmp_path / "imgs" / cls).mkdir(parents=True)
        for c in range(1, 13):
            for k in range(3):
                Image.fromarray(np.full((20, 24, 3), c * 10 + k, np.uint8)).save(tmp_path / "imgs" / cls / tmpl.format(c=c, k=k))
    return {"data": {"root": str(tmp_path / "imgs"), "manifest": str(tmp_path / "m.csv"), "img_size": 16,
                     "seed": 1, "val_frac": 0.2, "test_frac": 0.2, "cache_dir": str(tmp_path / "cache")}}


def test_cache_roundtrip_and_stale_detection(tmp_path):
    cfg = make_cfg(tmp_path)
    df = prepare(cfg)
    assert load_cache(cfg) is None
    build_cache(cfg)
    arr = load_cache(cfg)
    assert arr.shape == (len(df), 16, 16, 3) and arr.dtype == np.uint8
    row = int(df.loc[0, "row"]); assert arr[row].mean() > 0
    # change the manifest -> cache must refuse to load
    (tmp_path / "m.csv").write_text((tmp_path / "m.csv").read_text() + "\n")
    with pytest.raises(RuntimeError):
        load_cache(cfg)
