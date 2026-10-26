import numpy as np
import pandas as pd
import pytest
from PIL import Image

from dagu.data import assert_no_leakage, build_index, case_id, split_by_case


def make_tree(tmp_path, n_cases=20, per_case=6):
    for cls, tmpl in [("Parasitized", "C{c}P{c}ThinF_IMG_2015_cell_{k}.png"), ("Uninfected", "C{c}_thinF_IMG_2015_cell_{k}.png")]:
        (tmp_path / cls).mkdir()
        for c in range(1, n_cases + 1):
            for k in range(per_case):
                Image.fromarray(np.zeros((8, 8, 3), np.uint8)).save(tmp_path / cls / tmpl.format(c=c, k=k))
    return tmp_path


def test_case_id_rule():
    assert case_id("C100P61ThinF_IMG_20150918_144104_cell_162.png") == "C100"
    assert case_id("C1_thinF_IMG_20150604_104722_cell_9.png") == "C1"


def test_split_has_no_patient_overlap(tmp_path):
    df = split_by_case(build_index(str(make_tree(tmp_path))), 0.2, 0.2, seed=1)
    assert_no_leakage(df)
    assert set(df.split) == {"train", "val", "test"}


def test_leakage_check_catches_overlap():
    bad = pd.DataFrame({"case": ["C1", "C1"], "split": ["train", "test"], "label": [0, 1], "path": ["a", "b"]})
    with pytest.raises(AssertionError):
        assert_no_leakage(bad)
