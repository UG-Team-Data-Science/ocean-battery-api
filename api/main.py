import asyncio
import json
import math
import os
import logging
import subprocess
import threading
import time
import uuid
import hashlib
import shutil
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse


IN_DIR = os.environ.get("OB_IN_DIR", os.environ.get("OB_KVALUES_IN_DIR", "/data/in"))
OUT_DIR = os.environ.get("OB_OUT_DIR", os.environ.get("OB_KVALUES_OUT_DIR", IN_DIR))
POLL_INTERVAL = float(os.environ.get("OB_POLL_INTERVAL", "0.1"))
TIMEOUT_SECONDS = float(os.environ.get("OB_TIMEOUT_SECONDS", "600"))


APP_BIN_DIR = os.environ.get("APP_BIN_DIR", "/opt/oceanbattery")
WORKER_BIN = os.environ.get("OB_WORKER_BIN", os.path.join(APP_BIN_DIR, "run_worker_folder_watch_requests.sh"))
MCRROOT = os.environ.get("MCRROOT", "/opt/matlabruntime/R2025b")

WORKER_COUNT = int(os.environ.get("OB_WORKER_COUNT", "2"))
WORKER_POLL_SECONDS = os.environ.get("OB_WORKER_POLL_SECONDS", "1")
CACHE_DIR = os.environ.get("OB_CACHE_DIR", "/data/cache")
CACHE_IDLE_TIMEOUT = float(os.environ.get("OB_CACHE_IDLE_TIMEOUT", "10"))
ALIVE_DIR = os.environ.get("OB_ALIVE_DIR", IN_DIR)
ALIVE_HEARTBEAT_SECONDS = float(os.environ.get("OB_ALIVE_HEARTBEAT_SECONDS", "1.0"))
WORKER_LOG_PATH = os.environ.get("OB_WORKER_LOG_PATH", "/data/worker_manager.log")
WORKER_LOG_EVERY_SECONDS = float(os.environ.get("OB_WORKER_LOG_EVERY_SECONDS", "30"))
WORKER_STDOUT_DIR = os.environ.get("OB_WORKER_STDOUT_DIR", "/logs")


app = FastAPI(title="OceanBattery API", version="1.0.0")

_inflight_lock = threading.Lock()
_inflight: Dict[str, Dict[str, str]] = {}


class WorkerManager:
    def __init__(self) -> None:
        self._procs: List[subprocess.Popen] = []
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._monitor: Optional[threading.Thread] = None
        self._logger = _build_worker_logger()
        self._last_log_ts = 0.0
        self._cpu_samples: Dict[int, Tuple[float, float]] = {}
        self._log_files: Dict[int, Tuple[Any, Any]] = {}

    def start(self) -> None:
        self._stop.clear()
        self._ensure_workers()
        self._monitor = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor.start()

    def stop(self) -> None:
        self._stop.set()
        if self._monitor:
            self._monitor.join(timeout=2)
        with self._lock:
            for proc in self._procs:
                proc.terminate()
            self._procs = []
            self._close_log_files()

    def _monitor_loop(self) -> None:
        while not self._stop.is_set():
            self._ensure_workers()
            self._maybe_log_status()
            time.sleep(2)

    def _ensure_workers(self) -> None:
        with self._lock:
            live = []
            for proc in self._procs:
                if proc.poll() is None:
                    live.append(proc)
                else:
                    self._close_log_files(pid=proc.pid)
            self._procs = live
            while len(self._procs) < WORKER_COUNT:
                self._procs.append(self._spawn_worker())

    def _spawn_worker(self) -> subprocess.Popen:
        cmd = [WORKER_BIN, MCRROOT, IN_DIR, str(WORKER_POLL_SECONDS)]
        stdout_file, stderr_file, stdout_path, stderr_path = _open_worker_logs()
        proc = subprocess.Popen(cmd, stdout=stdout_file, stderr=stderr_file)
        _finalize_worker_logs(proc.pid, stdout_path, stderr_path)
        self._log_files[proc.pid] = (stdout_file, stderr_file)
        return proc

    def _maybe_log_status(self) -> None:
        if not self._logger or WORKER_LOG_EVERY_SECONDS <= 0:
            return
        now = time.time()
        if now - self._last_log_ts < WORKER_LOG_EVERY_SECONDS:
            return
        with self._lock:
            procs = [p for p in self._procs if p.poll() is None]
        inflight_count = _inflight_count()
        lines = [f"workers={len(procs)} inflight={inflight_count}"]
        for proc in procs:
            pid = proc.pid
            stats = _read_proc_stats(pid)
            if not stats:
                lines.append(f"pid={pid} status=unknown")
                continue
            rss_kb = stats.get("rss_kb")
            vms_kb = stats.get("vms_kb")
            ticks = stats.get("cpu_ticks")
            cpu_pct = _calc_cpu_pct(pid, ticks, now, self._cpu_samples)
            parts = [f"pid={pid}"]
            if cpu_pct is not None:
                parts.append(f"cpu_pct={cpu_pct:.1f}")
            if rss_kb is not None:
                parts.append(f"rss_kb={rss_kb}")
            if vms_kb is not None:
                parts.append(f"vms_kb={vms_kb}")
            lines.append(" ".join(parts))
        self._logger.info(" | ".join(lines))
        self._last_log_ts = now

    def _close_log_files(self, pid: Optional[int] = None) -> None:
        if pid is None:
            items = list(self._log_files.items())
        else:
            items = [(pid, self._log_files.get(pid))] if pid in self._log_files else []
        for pid, files in items:
            if not files:
                continue
            stdout_file, stderr_file = files
            try:
                stdout_file.close()
            except OSError:
                pass
            if stderr_file is not stdout_file:
                try:
                    stderr_file.close()
                except OSError:
                    pass
            self._log_files.pop(pid, None)


def _build_worker_logger() -> Optional[logging.Logger]:
    if WORKER_LOG_EVERY_SECONDS <= 0:
        return None
    logger = logging.getLogger("worker_manager")
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    log_dir = os.path.dirname(WORKER_LOG_PATH)
    try:
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
        handler = logging.FileHandler(WORKER_LOG_PATH)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
        logger.propagate = False
        return logger
    except OSError:
        return None


def _open_worker_logs() -> Tuple[Any, Any, str, str]:
    os.makedirs(WORKER_STDOUT_DIR, exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    suffix = uuid.uuid4().hex[:8]
    stdout_path = os.path.join(WORKER_STDOUT_DIR, f"worker-{ts}-{suffix}.stdout")
    stderr_path = os.path.join(WORKER_STDOUT_DIR, f"worker-{ts}-{suffix}.stderr")
    try:
        stdout_fh = open(stdout_path, "a", encoding="utf-8")
        stderr_fh = open(stderr_path, "a", encoding="utf-8")
    except OSError:
        return (subprocess.DEVNULL, subprocess.DEVNULL, "", "")
    return (stdout_fh, stderr_fh, stdout_path, stderr_path)


def _finalize_worker_logs(pid: int, stdout_path: str, stderr_path: str) -> None:
    if not stdout_path or not stderr_path:
        return
    try:
        final_stdout = os.path.join(WORKER_STDOUT_DIR, f"worker-{pid}.stdout")
        final_stderr = os.path.join(WORKER_STDOUT_DIR, f"worker-{pid}.stderr")
        os.replace(stdout_path, final_stdout)
        os.replace(stderr_path, final_stderr)
    except OSError:
        pass


_workers = WorkerManager()


@app.on_event("startup")
def _startup() -> None:
    os.makedirs(IN_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)
    _workers.start()


@app.on_event("shutdown")
def _shutdown() -> None:
    _workers.stop()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/defaults")
def defaults() -> Dict[str, Any]:
    return {"type": "defaults", "params": _default_params()}


@app.post("/kvalues")
async def kvalues(request: Request) -> Dict[str, Any]:
    params = await _extract_params(request)
    cache_key = _hash_params("k_values", params)
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    base = str(uuid.uuid4())
    in_path, out_path = _request_paths(base)
    _write_json_atomic(in_path, {"type": "k_values", "params": params})

    result = _wait_for_json(out_path, timeout=TIMEOUT_SECONDS)
    if result is None:
        raise HTTPException(status_code=504, detail="Timed out waiting for K-values output.")

    _write_json_atomic(cache_path, result)
    _safe_unlink(out_path)
    return result


@app.post("/simulate")
async def simulate(request: Request, stream: bool = True) -> Any:
    params = await _extract_params(request)
    cache_key = _hash_params("charging", params)
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.jsonl")
    if os.path.exists(cache_path):
        if _cache_has_end(cache_path):
            return StreamingResponse(_stream_jsonl_file(cache_path), media_type="text/event-stream")
        if _cache_recent(cache_path, CACHE_IDLE_TIMEOUT):
            return StreamingResponse(
                _stream_jsonl_follow_internal(
                    cache_path,
                    idle_timeout=CACHE_IDLE_TIMEOUT,
                    startup_timeout=TIMEOUT_SECONDS,
                    on_end=None,
                    disconnect_check=request.is_disconnected,
                ),
                media_type="text/event-stream",
            )
        _safe_unlink(cache_path)

    inflight = _get_inflight(cache_key)
    if inflight:
        return StreamingResponse(
            _stream_jsonl_follow_internal(
                inflight["out_path"],
                idle_timeout=CACHE_IDLE_TIMEOUT,
                startup_timeout=TIMEOUT_SECONDS,
                on_end=None,
                heartbeat_path=inflight.get("alive_path"),
                heartbeat_interval=ALIVE_HEARTBEAT_SECONDS,
                disconnect_check=request.is_disconnected,
            ),
            media_type="text/event-stream",
        )

    base = str(uuid.uuid4())
    in_path, out_path = _request_paths(base)
    alive_path = _alive_path(base)
    _touch_file(alive_path)
    _write_json_atomic(in_path, {"type": "charging", "params": params})
    _set_inflight(cache_key, {"out_path": out_path, "alive_path": alive_path})

    if not stream:
        lines = _wait_for_jsonl_complete(out_path, timeout=TIMEOUT_SECONDS)
        if lines is None:
            raise HTTPException(status_code=504, detail="Timed out waiting for charging output.")
        if not _jsonl_has_nondet_error(lines):
            _write_jsonl(cache_path, lines)
        _safe_unlink(out_path)
        _clear_inflight(cache_key)
        return {"events": lines}

    # Live stream from active output, and cache once completed.
    return StreamingResponse(
        _stream_jsonl_follow_internal(
            out_path,
            idle_timeout=CACHE_IDLE_TIMEOUT,
            startup_timeout=TIMEOUT_SECONDS,
            on_end=lambda: _finalize_cache(cache_key, out_path, cache_path),
            heartbeat_path=alive_path,
            heartbeat_interval=ALIVE_HEARTBEAT_SECONDS,
            disconnect_check=request.is_disconnected,
        ),
        media_type="text/event-stream",
    )


async def _extract_params(request: Request) -> Dict[str, Any]:
    body = await request.json()
    params = body.get("params", body)
    if not isinstance(params, dict):
        raise HTTPException(status_code=400, detail="Request body must be a JSON object.")
    return params


def _request_paths(base: str) -> Tuple[str, str]:
    in_path = os.path.join(IN_DIR, f"{base}.in.json")
    out_path = os.path.join(OUT_DIR, f"{base}.out.json")
    return in_path, out_path


def _alive_path(base: str) -> str:
    return os.path.join(ALIVE_DIR, f"{base}.alive")


def _write_json_atomic(path: str, obj: Dict[str, Any]) -> None:
    tmp_path = f"{path}.tmp-{uuid.uuid4()}"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(obj, f)
    os.replace(tmp_path, path)


def _touch_file(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    now = time.time()
    try:
        os.utime(path, (now, now))
    except FileNotFoundError:
        with open(path, "a", encoding="utf-8"):
            pass
        os.utime(path, (now, now))


def _wait_for_json(path: str, timeout: float) -> Optional[Dict[str, Any]]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        time.sleep(POLL_INTERVAL)
    return None


def _wait_for_jsonl(path: str, timeout: float) -> Optional[List[Dict[str, Any]]]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if os.path.exists(path):
            return _read_jsonl(path)
        time.sleep(POLL_INTERVAL)
    return None


def _read_jsonl(path: str) -> List[Dict[str, Any]]:
    lines: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            lines.append(json.loads(raw))
    return lines


async def _stream_jsonl(path: str):
    deadline = time.time() + TIMEOUT_SECONDS
    while not os.path.exists(path):
        if time.time() > deadline:
            yield "data: " + json.dumps({"type": "error", "message": "Timed out waiting for output"}) + "\n\n"
            yield "data: [DONE]\n\n"
            return
        await asyncio.sleep(POLL_INTERVAL)

    with open(path, "r", encoding="utf-8") as f:
        while True:
            line = f.readline()
            if line:
                line = line.strip()
                if line:
                    try:
                        payload = json.loads(line)
                    except json.JSONDecodeError:
                        payload = {"type": "error", "message": "Invalid JSONL output"}
                    yield "data: " + json.dumps(payload) + "\n\n"
                    if isinstance(payload, dict) and payload.get("type") == "end":
                        yield "data: [DONE]\n\n"
                        break
            else:
                if time.time() > deadline:
                    yield "data: " + json.dumps({"type": "error", "message": "Timed out waiting for output"}) + "\n\n"
                    yield "data: [DONE]\n\n"
                    break
                await asyncio.sleep(POLL_INTERVAL)

    _safe_unlink(path)


def _safe_unlink(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def _inflight_count() -> int:
    with _inflight_lock:
        return len(_inflight)


def _read_proc_stats(pid: int) -> Optional[Dict[str, Optional[int]]]:
    try:
        with open(f"/proc/{pid}/stat", "r", encoding="utf-8") as f:
            data = f.read()
        rparen = data.rfind(")")
        if rparen == -1:
            return None
        after = data[rparen + 2 :].split()
        utime = int(after[11])
        stime = int(after[12])
        cpu_ticks = utime + stime
    except (FileNotFoundError, PermissionError, IndexError, ValueError):
        return None

    rss_kb = None
    vms_kb = None
    try:
        with open(f"/proc/{pid}/status", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    rss_kb = int(line.split()[1])
                elif line.startswith("VmSize:"):
                    vms_kb = int(line.split()[1])
    except (FileNotFoundError, PermissionError, ValueError, IndexError):
        pass

    return {"cpu_ticks": cpu_ticks, "rss_kb": rss_kb, "vms_kb": vms_kb}


def _calc_cpu_pct(
    pid: int,
    cpu_ticks: Optional[int],
    now: float,
    samples: Dict[int, Tuple[float, float]],
) -> Optional[float]:
    if cpu_ticks is None:
        return None
    last = samples.get(pid)
    samples[pid] = (float(cpu_ticks), now)
    if not last:
        return None
    last_ticks, last_ts = last
    delta_ticks = cpu_ticks - last_ticks
    delta_time = now - last_ts
    if delta_time <= 0:
        return None
    clk_tck = os.sysconf(os.sysconf_names["SC_CLK_TCK"])
    return (delta_ticks / clk_tck) / delta_time * 100.0


def _hash_params(kind: str, params: Dict[str, Any]) -> str:
    payload = {"type": kind, "params": params}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _wait_for_jsonl_complete(path: str, timeout: float) -> Optional[List[Dict[str, Any]]]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if os.path.exists(path):
            lines = _read_jsonl(path)
            if lines and isinstance(lines[-1], dict) and lines[-1].get("type") == "end":
                return lines
        time.sleep(POLL_INTERVAL)
    return None


def _write_jsonl(path: str, lines: List[Dict[str, Any]]) -> None:
    tmp_path = f"{path}.tmp-{uuid.uuid4()}"
    with open(tmp_path, "w", encoding="utf-8") as f:
        for line in lines:
            f.write(json.dumps(line) + "\n")
    os.replace(tmp_path, path)


async def _stream_jsonl_file(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = {"type": "error", "message": "Invalid JSONL output"}
            yield "data: " + json.dumps(payload) + "\n\n"
        yield "data: [DONE]\n\n"


def _cache_has_end(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            if size == 0:
                return False
            f.seek(max(0, size - 65536), os.SEEK_SET)
            tail = f.read().decode("utf-8", errors="ignore")
        lines = [ln for ln in tail.splitlines() if ln.strip()]
        for ln in reversed(lines):
            try:
                obj = json.loads(ln)
            except json.JSONDecodeError:
                continue
            return isinstance(obj, dict) and obj.get("type") == "end"
    except OSError:
        return False
    return False


def _cache_has_nondet_error(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            if size == 0:
                return False
            f.seek(max(0, size - 65536), os.SEEK_SET)
            tail = f.read().decode("utf-8", errors="ignore")
        lines = [ln for ln in tail.splitlines() if ln.strip()]
        for ln in lines:
            try:
                obj = json.loads(ln)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and obj.get("type") == "error":
                if not obj.get("deterministic", False):
                    return True
    except OSError:
        return False
    return False


def _jsonl_has_nondet_error(lines: List[Dict[str, Any]]) -> bool:
    for entry in lines:
        if isinstance(entry, dict) and entry.get("type") == "error":
            if not entry.get("deterministic", False):
                return True
    return False


def _cache_recent(path: str, window_seconds: float) -> bool:
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return False
    return (time.time() - mtime) <= window_seconds


async def _stream_jsonl_follow(path: str, idle_timeout: float):
    async for chunk in _stream_jsonl_follow_internal(
        path, idle_timeout=idle_timeout, startup_timeout=TIMEOUT_SECONDS, on_end=None
    ):
        yield chunk


async def _stream_jsonl_follow_internal(
    path: str,
    idle_timeout: float,
    startup_timeout: float,
    on_end: Optional[Callable[[], None]],
    heartbeat_path: Optional[str] = None,
    heartbeat_interval: float = 1.0,
    disconnect_check: Optional[Callable[[], Awaitable[bool]]] = None,
):
    last_activity = time.time()
    deadline = time.time() + startup_timeout
    last_heartbeat = 0.0
    while not os.path.exists(path):
        if disconnect_check and await disconnect_check():
            return
        if heartbeat_path and time.time() - last_heartbeat >= heartbeat_interval:
            _touch_file(heartbeat_path)
            last_heartbeat = time.time()
        if time.time() > deadline:
            yield "data: " + json.dumps({"type": "error", "message": "Timed out waiting for output"}) + "\n\n"
            yield "data: [DONE]\n\n"
            if on_end:
                on_end()
            return
        await asyncio.sleep(0.2)

    ended = False
    try:
        with open(path, "r", encoding="utf-8") as f:
            while True:
                if disconnect_check and await disconnect_check():
                    return
                if heartbeat_path and time.time() - last_heartbeat >= heartbeat_interval:
                    _touch_file(heartbeat_path)
                    last_heartbeat = time.time()
                line = f.readline()
                if line:
                    last_activity = time.time()
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                    except json.JSONDecodeError:
                        payload = {"type": "error", "message": "Invalid JSONL output"}
                    yield "data: " + json.dumps(payload) + "\n\n"
                    if isinstance(payload, dict) and payload.get("type") == "end":
                        yield "data: [DONE]\n\n"
                        ended = True
                        break
                else:
                    if time.time() - last_activity > idle_timeout:
                        yield "data: " + json.dumps({"type": "error", "message": "Idle timeout waiting for output"}) + "\n\n"
                        yield "data: [DONE]\n\n"
                        break
                    await asyncio.sleep(0.2)
    finally:
        if on_end:
            on_end()
        if not ended:
            # avoid holding stale inflight state forever
            pass


def _finalize_cache(cache_key: str, out_path: str, cache_path: str) -> None:
    if _cache_has_end(out_path) and not _cache_has_nondet_error(out_path):
        _copy_atomic(out_path, cache_path)
    _clear_inflight(cache_key)


def _copy_atomic(src: str, dest: str) -> None:
    tmp_path = f"{dest}.tmp-{uuid.uuid4()}"
    shutil.copyfile(src, tmp_path)
    os.replace(tmp_path, dest)


def _set_inflight(key: str, info: Dict[str, str]) -> None:
    with _inflight_lock:
        _inflight[key] = info


def _get_inflight(key: str) -> Optional[Dict[str, str]]:
    with _inflight_lock:
        return _inflight.get(key)


def _clear_inflight(key: str) -> None:
    with _inflight_lock:
        _inflight.pop(key, None)


def _default_params() -> Dict[str, Any]:
    # Based on the commented defaults in OB_parameters.m and K_values_*_parameters.m.
    Lout = 7.774
    Lin = 2.591
    D_rigid = 0.315
    r_rigid = 0.5 * D_rigid
    A_rigid = math.pi * r_rigid * r_rigid
    V_rigid = A_rigid * Lin
    V_rigid_out = A_rigid * Lout
    Capacity_rigid = V_rigid + V_rigid_out

    params: Dict[str, Any] = {
        "Lout": Lout,
        "Lin": Lin,
        "D_rigid": D_rigid,
        "Delta_t": 0.1,
        "P_electrical": 78.78,
        "N_motor": 1.0,
        "N_pump": 0.4181,
        "N_turbine": 0.2,
        "N_generator": 1.0,
        "D_turbine": 0.034,
        "L_pipeline_charging": 3.77,
        "L_pipeline_discharging": 4.318,
        "D_pipeline": 0.034,
        "Roughness_pipeline": 0.0015e-3,
        "D_bypass": 0.05,
        "L_bypass": 0.579,
        "Roughness_bypass": 0.0015e-3,
        "Depth": 5.0,
        "Dens_wat": 999.15,
        "Visc_wat": 0.001,
        "Dens_air": 1.2,
        "Visc_air": 1.865e-5,
        "P_atm": 101325,
        "g": 9.81,
        "L_U1": 10.0,
        "L_U2": 0.6,
        "L_U3": 0.4,
        "L_U4": 0.4,
        "p_1": 1.0,
        "p_2": 0.5,
        "p_3": 0.375,
        "p_4": 0.125,
        "D_umbilical": 0.025,
        "Roughness_umbilical": 0.0015e-3,
        "R_bend_umb": 0.03,
        "D_bend_umb": 0.02,
        "V_rigid": V_rigid,
        "V_rigid_out": V_rigid_out,
        "Capacity_rigid": Capacity_rigid,
        "V_wat_rigid_start": Capacity_rigid,
        "V_wat_rigid_end": 0.0,
        "V_wat_bladder_end": 0.0,
        "t_open_ball_valve": 12.0,
        # K-values inputs (charging)
        "Number_90deg_bends_charging": 8,
        "R_bend_charging": 0.048,
        "D_bend_charging": 0.034,
        "D_bend_connection_charging": 0.038,
        "Number_ball_valves_charging": 0,
        "Angle_ball_valve_charging": 0,
        "D_ball_valve_charging": 0.034,
        "Number_unions_charging": 2,
        "Union_type_charging": 1,
        "D_union_charging": 0.034,
        "Number_pressure_sensors_charging": 3,
        "D_pressure_sensor_charging": 0.034,
        "Number_flow_meters_charging": 1,
        "Flow_meter_type_charging": 4,
        "D_flow_meter_charging": 0.034,
        "Number_check_valves_charging": 1,
        "D_check_valve_charging": 0.034,
        "Number_90deg_elbows_charging": 0,
        "D_elbow_90_charging": 0.034,
        "Number_45deg_elbows_charging": 3,
        "D_elbow_45_charging": 0.034,
        "Number_inlets_charging": 1,
        "r_inlet_rounded_charging": 0.0001,
        "Inlet_type_charging": 3,
        "D_inlet_charging": 0.034,
        "Number_outlets_charging": 1,
        "D_outlet_charging": 0.034,
        "Number_bypasses_charging": 1,
        "Inlet_type_bypass_charging": 3,
        "r_inlet_rounded_bypass_charging": 0.0001,
        # K-values inputs (discharging)
        "Number_90deg_bends_discharging": 12,
        "R_bend_discharging": 0.048,
        "D_bend_connection_discharging": 0.038,
        "Number_ball_valves_discharging": 1,
        "Angle_ball_valve_discharging": 0,
        "D_ball_valve_discharging": 0.034,
        "Number_unions_discharging": 2,
        "Union_type_discharging": 1,
        "D_union_discharging": 0.034,
        "Number_pressure_sensors_discharging": 3,
        "D_pressure_sensor_discharging": 0.034,
        "Number_flow_meters_discharging": 1,
        "Flow_meter_type_discharging": 4,
        "D_flow_meter_discharging": 0.034,
        "Number_check_valves_discharging": 0,
        "D_check_valve_discharging": 0.034,
        "Number_90deg_elbows_discharging": 2,
        "D_elbow_90_discharging": 0.034,
        "Number_45deg_elbows_discharging": 0,
        "D_elbow_45_discharging": 0.034,
        "Number_inlets_discharging": 1,
        "r_inlet_rounded_discharging": 0.0001,
        "Inlet_type_discharging": 3,
        "D_inlet_discharging": 0.034,
        "Number_outlets_discharging": 1,
        "D_outlet_discharging": 0.034,
        "Number_bypasses_discharging": 1,
        "Inlet_type_bypass_discharging": 3,
        "r_inlet_rounded_bypass_discharging": 0.0001,
    }

    return params
