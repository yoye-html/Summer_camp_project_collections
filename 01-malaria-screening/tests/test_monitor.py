import numpy as np
from dagu.monitor import psi


def test_psi_small_for_same_distribution_large_for_shift():
    rng = np.random.default_rng(0)
    a, b = rng.normal(100, 10, 2000), rng.normal(100, 10, 2000)
    assert psi(a, b) < 0.1
    assert psi(a, rng.normal(130, 10, 2000)) > 0.25


def test_drift_report_handles_missing_reference_column(tmp_path):
    import json
    import pandas as pd
    from dagu.monitor import drift_report
    rng = np.random.default_rng(1)
    pd.DataFrame({"blur": rng.normal(100, 10, 2000), "brightness": rng.normal(150, 5, 2000)}).to_csv(tmp_path / "ref.csv", index=False)
    rows = [{"status": "ok", "blur": float(b), "brightness": float(br), "pct": 5.0}
            for b, br in zip(rng.normal(100, 10, 2000), rng.normal(150, 5, 2000))]
    (tmp_path / "log.jsonl").write_text("\n".join(json.dumps(r) for r in rows))
    rep = drift_report(str(tmp_path / "ref.csv"), str(tmp_path / "log.jsonl"))
    assert rep["pct"] is None and rep["blur"] < 0.1 and rep["recapture_rate"] == 0.0
