# OceanBattery K-Values API (FastAPI)

This API is a thin HTTP wrapper around the existing MATLAB worker
`OceanBatteryWithMatlab/functions/worker_kvalues_watch_jsonlines.m`.
It writes parameter files into a watched input directory and returns the
computed K-values when the MATLAB worker writes the output JSONL.

## How it works
- API writes `<uuid>.json` into `IN_DIR`.
- MATLAB worker watches `IN_DIR` for `*.json` and writes `<uuid>.jsonl` into `OUT_DIR`.
- API reads the JSONL, extracts the `k_values`, and returns them.

## Run the MATLAB worker
This must run separately and have access to the same `IN_DIR`/`OUT_DIR`.

Example (MATLAB):
```
worker_kvalues_watch_jsonlines('/data/in', '/data/out', 0.1)
```

Example (headless MATLAB):
```
matlab -batch "worker_kvalues_watch_jsonlines('/data/in','/data/out',0.1)"
```

## Run the API locally
```
python -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt

export OB_KVALUES_IN_DIR=/data/in
export OB_KVALUES_OUT_DIR=/data/out

uvicorn api.main:app --reload --port 8000
```

### Example request
```
curl -X POST http://localhost:8000/kvalues \
  -H "Content-Type: application/json" \
  -d @params.json
```

The body can be either:
- a raw parameters object, or
- `{"params": { ... }}`.

## Docker
Build the API container:
```
docker build -t oceanbattery-kvalues-api .
```

Run (mount the same directories used by the MATLAB worker):
```
docker run --rm -p 8000:8000 \
  -e OB_KVALUES_IN_DIR=/data/in \
  -e OB_KVALUES_OUT_DIR=/data/out \
  -v /data/in:/data/in \
  -v /data/out:/data/out \
  oceanbattery-kvalues-api
```

## Notes
- This Dockerfile only runs the FastAPI layer. MATLAB (or MATLAB Runtime)
  must run separately to execute `worker_kvalues_watch_jsonlines`.
