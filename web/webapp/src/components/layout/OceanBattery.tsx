import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Button, Card, CardContent, Divider, Tab, Tabs, TextField, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";

type Params = Record<string, number>;

type SeriesPoint = Record<string, number>;

async function postJSON<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function OceanBattery() {
  const [tab, setTab] = useState(0);
  const [params, setParams] = useState<Params>({});

  const [chargingSeries, setChargingSeries] = useState<SeriesPoint[]>([]);
  const [dischargingSeries, setDischargingSeries] = useState<SeriesPoint[]>([]);
  const [scalars, setScalars] = useState<Record<string, number>>({});
  const [kvalues, setKvalues] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const apiBase = "/api";
  const chargingBufferRef = useRef<SeriesPoint[]>([]);
  const dischargingBufferRef = useRef<SeriesPoint[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const paramEntries = useMemo(
    () => Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
    [params]
  );

  const loadDefaults = async () => {
    const res = await fetch(`${apiBase}/defaults`);
    if (!res.ok) throw new Error(await res.text());
    const out = await res.json();
    setParams(out.params ?? {});
  };

  useEffect(() => {
    loadDefaults();
  }, []);

  const kvalueRows = useMemo(() => {
    if (!kvalues || typeof kvalues !== "object") return [];
    const rows: Record<string, { name: string; charging?: number; discharging?: number }> = {};
    for (const [key, value] of Object.entries(kvalues)) {
      if (typeof value !== "number") continue;
      const m = key.match(/^(.*)_(charging|discharging)$/);
      if (!m) continue;
      const base = m[1];
      const phase = m[2];
      if (!rows[base]) rows[base] = { name: base };
      rows[base][phase as "charging" | "discharging"] = value;
    }
    return Object.values(rows).sort((a, b) => a.name.localeCompare(b.name));
  }, [kvalues]);

  const chargingX = useMemo(() => chargingSeries.map((p) => p.t ?? 0), [chargingSeries]);
  const dischargingX = useMemo(() => dischargingSeries.map((p) => p.t ?? 0), [dischargingSeries]);

  const startSimulationStream = async () => {
    setBusy("simulate");
    setChargingSeries([]);
    setDischargingSeries([]);
    setScalars({});
    chargingBufferRef.current = [];
    dischargingBufferRef.current = [];
    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    try {
      const res = await fetch(`${apiBase}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (!res.body) throw new Error("No response body for stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      flushTimerRef.current = window.setInterval(() => {
        if (chargingBufferRef.current.length > 0) {
          const batch = chargingBufferRef.current;
          chargingBufferRef.current = [];
          setChargingSeries((arr) => [...arr, ...batch]);
        }
        if (dischargingBufferRef.current.length > 0) {
          const batch = dischargingBufferRef.current;
          dischargingBufferRef.current = [];
          setDischargingSeries((arr) => [...arr, ...batch]);
        }
      }, 250);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let ev: any;
            try {
              ev = JSON.parse(payload);
            } catch {
              continue;
            }
            if (ev?.type === "start") {
              setChargingSeries([]);
              setDischargingSeries([]);
              continue;
            }
            if (ev?.type === "summary") {
              setScalars((s) => ({
                ...s,
                ...(ev.phase === "charging"
                  ? { E_elec_in_kWh: ev.E_elec_in_kWh, T_empty_charging: ev.T_empty }
                  : { E_elec_out_kWh: ev.E_elec_out_kWh, N_roundtrip: ev.N_roundtrip, T_empty_discharging: ev.T_empty }),
              }));
              continue;
            }
            if (ev?.type === "timeseries") {
              const point: SeriesPoint = {};
              for (const [k, v] of Object.entries(ev)) {
                if (typeof v === "number") point[k] = v;
              }
              if (ev.phase === "charging") {
                chargingBufferRef.current.push(point);
              } else if (ev.phase === "discharging") {
                dischargingBufferRef.current.push(point);
              }
            }
          }
        }
      }
    } finally {
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (chargingBufferRef.current.length > 0) {
        const batch = chargingBufferRef.current;
        chargingBufferRef.current = [];
        setChargingSeries((arr) => [...arr, ...batch]);
      }
      if (dischargingBufferRef.current.length > 0) {
        const batch = dischargingBufferRef.current;
        dischargingBufferRef.current = [];
        setDischargingSeries((arr) => [...arr, ...batch]);
      }
      setBusy(null);
    }
  };

  return (
    <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "440px 1fr", gap: 2 }}>
      <Card sx={{ borderRadius: 3, minWidth: 420 }}>
        <CardContent>
          <Typography variant="h6">Parameters</Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
            Edit values, then compute K-values or run simulation.
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1,
              maxHeight: "70vh",
              overflow: "auto",
              pr: 1,
            }}
          >
            {paramEntries.map(([k, v]) => (
              <TextField
                key={k}
                label={k}
                type="number"
                size="small"
                value={v}
                onChange={(e) => setParams((p) => ({ ...p, [k]: Number(e.target.value) }))}
              />
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="text"
              disabled={!!busy}
              onClick={async () => {
                setBusy("defaults");
                try {
                  await loadDefaults();
                } finally {
                  setBusy(null);
                }
              }}
            >
              Reset to defaults
            </Button>

            <Button
              variant="outlined"
              disabled={!!busy}
              onClick={async () => {
                setBusy("kvalues");
                try {
                  const out = await postJSON<any>(`${apiBase}/kvalues`, { params });
                  setKvalues(out.values);
                } finally {
                  setBusy(null);
                }
              }}
            >
              Compute K-values
            </Button>

            <Button
              variant="contained"
              disabled={!!busy}
              onClick={startSimulationStream}
            >
              Start simulation
            </Button>
          </Box>

          {(scalars.E_elec_in_kWh !== undefined || scalars.E_elec_out_kWh !== undefined) && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Outputs</Typography>
              <Typography variant="body2">Energy in (kWh): {scalars.E_elec_in_kWh?.toFixed(4)}</Typography>
              <Typography variant="body2">Energy out (kWh): {scalars.E_elec_out_kWh?.toFixed(4)}</Typography>
              <Typography variant="body2">Roundtrip: {scalars.N_roundtrip?.toFixed(4)}</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Overview" />
            <Tab label="Charging" />
            <Tab label="Discharging" />
          </Tabs>

          <Divider sx={{ my: 2 }} />

          {tab === 0 && (
            <Box>
              <Typography variant="h6">Overview</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                K-values table (charging vs discharging).
              </Typography>
              {kvalueRows.length > 0 ? (
                <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 360 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Parameter</TableCell>
                        <TableCell align="right">Charging</TableCell>
                        <TableCell align="right">Discharging</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {kvalueRows.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell align="right">
                            {row.charging !== undefined ? row.charging.toFixed(6) : "—"}
                          </TableCell>
                          <TableCell align="right">
                            {row.discharging !== undefined ? row.discharging.toFixed(6) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  No K-values computed yet.
                </Typography>
              )}
            </Box>
          )}

          {tab === 1 && (
            <Box>
              <Typography variant="h6">Charging</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Live charts for charging phase.
              </Typography>
              {chargingSeries.length > 0 ? (
                <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Flow through the pump (Charging)
                    </Typography>
                    <LineChart
                      height={240}
                      xAxis={[{ data: chargingX, label: "t (s)" }]}
                      series={[
                        { data: chargingSeries.map((p) => p.Q ?? 0), label: "Q", showMark: false },
                      ]}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Volume of fluid present in the rigid reservoir (Charging)
                    </Typography>
                    <LineChart
                      height={240}
                      xAxis={[{ data: chargingX, label: "t (s)" }]}
                      series={[
                        { data: chargingSeries.map((p) => p.V_rigid ?? 0), label: "V_rigid", showMark: false },
                      ]}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Head loss (Charging)
                    </Typography>
                    <LineChart
                      height={260}
                      xAxis={[{ data: chargingX, label: "t (s)" }]}
                      series={[
                        { data: chargingSeries.map((p) => p.H_loss_total ?? 0), label: "H_loss_total", showMark: false },
                        { data: chargingSeries.map((p) => p.H_loss_minor ?? 0), label: "H_loss_minor", showMark: false },
                        { data: chargingSeries.map((p) => p.H_loss_major ?? 0), label: "H_loss_major", showMark: false },
                        { data: chargingSeries.map((p) => p.H_loss_major_umbilical ?? 0), label: "H_loss_major_umbilical", showMark: false },
                        { data: chargingSeries.map((p) => p.H_loss_minor_umbilical ?? 0), label: "H_loss_minor_umbilical", showMark: false },
                      ]}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Pump head (Charging)
                    </Typography>
                    <LineChart
                      height={240}
                      xAxis={[{ data: chargingX, label: "t (s)" }]}
                      series={[
                        { data: chargingSeries.map((p) => p.H_static ?? 0), label: "H_static", showMark: false },
                        { data: chargingSeries.map((p) => p.H_pump ?? 0), label: "H_pump", showMark: false },
                        { data: chargingSeries.map((p) => p.H_loss_total ?? 0), label: "H_loss_total", showMark: false },
                      ]}
                    />
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Run a simulation first.
                </Typography>
              )}
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <Typography variant="h6">Discharging</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Live charts for discharging phase.
              </Typography>
              {dischargingSeries.length > 0 ? (
                <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Flow through the turbine (Discharging)
                    </Typography>
                    <LineChart
                      height={240}
                      xAxis={[{ data: dischargingX, label: "t (s)" }]}
                      series={[
                        { data: dischargingSeries.map((p) => p.Q ?? 0), label: "Q", showMark: false },
                      ]}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Water in bladder and rigid reservoir (Discharging)
                    </Typography>
                    <LineChart
                      height={240}
                      xAxis={[{ data: dischargingX, label: "t (s)" }]}
                      series={[
                        { data: dischargingSeries.map((p) => p.V_rigid ?? 0), label: "V_rigid", showMark: false },
                        { data: dischargingSeries.map((p) => p.V_bladder ?? 0), label: "V_bladder", showMark: false },
                      ]}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Head loss (Discharging)
                    </Typography>
                    <LineChart
                      height={260}
                      xAxis={[{ data: dischargingX, label: "t (s)" }]}
                      series={[
                        { data: dischargingSeries.map((p) => p.H_loss_total ?? 0), label: "H_loss_total", showMark: false },
                        { data: dischargingSeries.map((p) => p.H_loss_minor ?? 0), label: "H_loss_minor", showMark: false },
                        { data: dischargingSeries.map((p) => p.H_loss_major ?? 0), label: "H_loss_major", showMark: false },
                        { data: dischargingSeries.map((p) => p.H_loss_major_umbilical ?? 0), label: "H_loss_major_umbilical", showMark: false },
                        { data: dischargingSeries.map((p) => p.H_loss_minor_umbilical ?? 0), label: "H_loss_minor_umbilical", showMark: false },
                      ]}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Turbine head (Discharging)
                    </Typography>
                    <LineChart
                      height={240}
                      xAxis={[{ data: dischargingX, label: "t (s)" }]}
                      series={[
                        { data: dischargingSeries.map((p) => p.H_static ?? 0), label: "H_static", showMark: false },
                        { data: dischargingSeries.map((p) => p.H_loss_total ?? 0), label: "H_loss_total", showMark: false },
                        { data: dischargingSeries.map((p) => p.H_turbine ?? 0), label: "H_turbine", showMark: false },
                      ]}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Power of the generator (Discharging)
                    </Typography>
                    <LineChart
                      height={220}
                      xAxis={[{ data: dischargingX, label: "t (s)" }]}
                      series={[
                        { data: dischargingSeries.map((p) => p.P_generator ?? 0), label: "P_generator", showMark: false },
                      ]}
                    />
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Run a simulation first.
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
