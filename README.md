# OceanBattery API (FastAPI)

This API is a thin HTTP wrapper around the existing [MATLAB worker](https://github.com/UG-Team-Data-Science/OceanBattery/)
`OceanBatteryWithMatlab/functions/worker_kvalues_watch_jsonlines.m`.
It writes parameter files into a watched input directory and returns the
computed K-values when the MATLAB worker writes the output JSONL.

## How it works
- API writes `<uuid>.json` into `IN_DIR`.
- MATLAB worker watches `IN_DIR` for `*.json` and writes `<uuid>.jsonl` into `OUT_DIR`.
- API reads the JSONL, extracts the `k_values`, and returns them.

## Docker
Build the container and website:
```
docker compose build
```

Run (mount the same directories used by the MATLAB worker):

```
docker compose up -d
```