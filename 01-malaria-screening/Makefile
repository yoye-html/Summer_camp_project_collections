# Shortcuts. Run inside the activated virtual environment:  make test
PY ?= python
CFG ?= configs/config.yaml

.PHONY: env test verify prepare cache baseline debug train resume evaluate export serve
env:      ; $(PY) scripts/check_env.py
test:     ; $(PY) -m pytest -q
verify:   ; $(PY) scripts/verify_dataset.py --config $(CFG)
prepare:  ; $(PY) scripts/prepare_data.py --config $(CFG)
cache:    ; $(PY) scripts/cache_dataset.py --config $(CFG)
baseline: ; $(PY) -c "from dagu import baseline, config; baseline.run(config.load_config('$(CFG)')['data']['manifest'])"
debug:    ; $(PY) scripts/smoke_test_torch.py
train:    ; $(PY) -m dagu.train --config $(CFG)
resume:   ; $(PY) -m dagu.train --config $(CFG) --resume
evaluate: ; $(PY) -m dagu.evaluate --config $(CFG)
export:   ; $(PY) -m dagu.export --config $(CFG)
serve:    ; uvicorn dagu.api:create_app --factory --host 127.0.0.1 --port 8000
