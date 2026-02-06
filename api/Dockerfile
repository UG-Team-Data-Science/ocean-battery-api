FROM containers.mathworks.com/matlab-runtime:r2025b
ENV AGREE_TO_MATLAB_RUNTIME_LICENSE=yes

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip tini ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

ENV VENV_PATH=/opt/venv
RUN python3 -m venv ${VENV_PATH}
ENV PATH="${VENV_PATH}/bin:${PATH}"

COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt

COPY main.py /srv/main.py
ENV APP_BIN_DIR=/opt/oceanbattery

ARG OB_WORKER_TAG=0.1.0
RUN mkdir -p /opt/oceanbattery \
 && curl -L -o /tmp/worker.tgz https://github.com/UG-Team-Data-Science/OceanBattery/releases/download/v${OB_WORKER_TAG}/OceanBatteryAPIWorker_dist_v${OB_WORKER_TAG}.tgz \
 && tar -xzf /tmp/worker.tgz -C /opt/oceanbattery \
 && if [ -d /opt/oceanbattery/dist ]; then mv /opt/oceanbattery/dist/* /opt/oceanbattery/ && rmdir /opt/oceanbattery/dist; fi \
 && rm -f /tmp/worker.tgz

ENV OB_IN_DIR=/data/in
ENV OB_OUT_DIR=/data/in
ENV OB_POLL_INTERVAL=0.1
ENV OB_TIMEOUT_SECONDS=600
ENV OB_WORKER_COUNT=2
ENV OB_WORKER_POLL_SECONDS=1
ENV OB_CACHE_DIR=/data/cache
ENV OB_CACHE_IDLE_TIMEOUT=10
ENV OB_ALIVE_DIR=/data/in
ENV OB_ALIVE_HEARTBEAT_SECONDS=1.0
ENV OB_WORKER_LOG_PATH=/data/worker_manager.log
ENV OB_WORKER_LOG_EVERY_SECONDS=30
ENV OB_WORKER_STDOUT_DIR=/logs

RUN mkdir -p /data/in

EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD uvicorn main:app --host 0.0.0.0 --port 8000;
