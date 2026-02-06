import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

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

function useOceanBatteryState() {
  const [tab, setTab] = useState(0);
  const [params, setParams] = useState<Params>({});
  const [chargingSeries, setChargingSeries] = useState<SeriesPoint[]>([]);
  const [dischargingSeries, setDischargingSeries] = useState<SeriesPoint[]>([]);
  const [scalars, setScalars] = useState<Record<string, number>>({});
  const [kvalues, setKvalues] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const apiBase = "/api";
  const chargingBufferRef = useRef<SeriesPoint[]>([]);
  const dischargingBufferRef = useRef<SeriesPoint[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const phaseRef = useRef<"charging" | "discharging" | null>(null);
  const simulateAbortRef = useRef<AbortController | null>(null);

  const paramGroups = useMemo(() => {
    const used = new Set<string>();

    const buildEntries = (keys: string[]) => {
      const entries: Array<[string, number]> = [];
      for (const key of keys) {
        if (used.has(key)) continue;
        const value = params[key];
        if (typeof value !== "number") continue;
        entries.push([key, value]);
        used.add(key);
      }
      return entries;
    };

    const groups: Array<{
      title: string;
      entries?: Array<[string, number]>;
      subgroups?: Array<{ title: string; entries: Array<[string, number]> }>;
    }> = [];

    const addGroup = (title: string, keys: string[]) => {
      const entries = buildEntries(keys);
      if (entries.length > 0) groups.push({ title, entries });
    };

    const addGroupWithSubgroups = (title: string, subgroups: Array<{ title: string; keys: string[] }>) => {
      const built = subgroups
        .map((sub) => ({ title: sub.title, entries: buildEntries(sub.keys) }))
        .filter((sub) => sub.entries.length > 0);
      if (built.length > 0) groups.push({ title, subgroups: built });
    };

    addGroup("Size parameters", ["Lout", "Lin", "D_rigid"]);
    addGroup("Accuracy parameters", ["Delta_t"]);
    addGroup("Pump, turbine, motor and generator parameters", [
      "P_electrical",
      "N_motor",
      "N_pump",
      "N_turbine",
      "N_generator",
      "D_turbine",
    ]);
    addGroup("Pipeline parameters", [
      "L_pipeline_charging",
      "L_pipeline_discharging",
      "D_pipeline",
      "Roughness_pipeline",
    ]);
    addGroup("Bypass parameters", ["D_bypass", "L_bypass", "Roughness_bypass"]);
    addGroup("External parameters", [
      "Depth",
      "Dens_wat",
      "Visc_wat",
      "Dens_air",
      "Visc_air",
      "P_atm",
      "g",
    ]);
    addGroup("Umbilical cord parameters", [
      "L_U1",
      "L_U2",
      "L_U3",
      "L_U4",
      "p_1",
      "p_2",
      "p_3",
      "p_4",
      "D_umbilical",
      "Roughness_umbilical",
      "R_bend_umb",
      "D_bend_umb",
    ]);
    addGroup("Initial calculations", ["V_rigid", "V_rigid_out", "Capacity_rigid"]);
    addGroup("Test parameters", ["V_wat_rigid_start", "V_wat_rigid_end", "V_wat_bladder_end"]);
    addGroup("Other system parameters", ["t_open_ball_valve"]);

    addGroupWithSubgroups("K-values parameters (charging)", [
      {
        title: "90 degree bend",
        keys: [
          "Number_90deg_bends_charging",
          "R_bend_charging",
          "D_bend_charging",
          "D_bend_connection_charging",
        ],
      },
      {
        title: "Ball valve",
        keys: ["Number_ball_valves_charging", "Angle_ball_valve_charging", "D_ball_valve_charging"],
      },
      {
        title: "Union",
        keys: ["Number_unions_charging", "Union_type_charging", "D_union_charging"],
      },
      {
        title: "Pressure sensor",
        keys: ["Number_pressure_sensors_charging", "D_pressure_sensor_charging"],
      },
      {
        title: "Flow meter",
        keys: ["Number_flow_meters_charging", "Flow_meter_type_charging", "D_flow_meter_charging"],
      },
      {
        title: "Check valve",
        keys: ["Number_check_valves_charging", "D_check_valve_charging"],
      },
      {
        title: "90-degree elbow",
        keys: ["Number_90deg_elbows_charging", "D_elbow_90_charging"],
      },
      {
        title: "45-degree elbow",
        keys: ["Number_45deg_elbows_charging", "D_elbow_45_charging"],
      },
      {
        title: "Inlets",
        keys: [
          "Number_inlets_charging",
          "r_inlet_rounded_charging",
          "Inlet_type_charging",
          "D_inlet_charging",
        ],
      },
      {
        title: "Outlets",
        keys: ["Number_outlets_charging", "D_outlet_charging"],
      },
      {
        title: "Bypass",
        keys: [
          "Number_bypasses_charging",
          "Inlet_type_bypass_charging",
          "r_inlet_rounded_bypass_charging",
        ],
      },
    ]);

    addGroupWithSubgroups("K-values parameters (discharging)", [
      {
        title: "90 degree bend",
        keys: [
          "Number_90deg_bends_discharging",
          "R_bend_discharging",
          "D_bend_discharging",
          "D_bend_connection_discharging",
        ],
      },
      {
        title: "Ball valve",
        keys: ["Number_ball_valves_discharging", "Angle_ball_valve_discharging", "D_ball_valve_discharging"],
      },
      {
        title: "Union",
        keys: ["Number_unions_discharging", "Union_type_discharging", "D_union_discharging"],
      },
      {
        title: "Pressure sensor",
        keys: ["Number_pressure_sensors_discharging", "D_pressure_sensor_discharging"],
      },
      {
        title: "Flow meter",
        keys: ["Number_flow_meters_discharging", "Flow_meter_type_discharging", "D_flow_meter_discharging"],
      },
      {
        title: "Check valve",
        keys: ["Number_check_valves_discharging", "D_check_valve_discharging"],
      },
      {
        title: "90-degree elbow",
        keys: ["Number_90deg_elbows_discharging", "D_elbow_90_discharging"],
      },
      {
        title: "45-degree elbow",
        keys: ["Number_45deg_elbows_discharging", "D_elbow_45_discharging"],
      },
      {
        title: "Inlets",
        keys: [
          "Number_inlets_discharging",
          "r_inlet_rounded_discharging",
          "Inlet_type_discharging",
          "D_inlet_discharging",
        ],
      },
      {
        title: "Outlets",
        keys: ["Number_outlets_discharging", "D_outlet_discharging"],
      },
      {
        title: "Bypass",
        keys: [
          "Number_bypasses_discharging",
          "Inlet_type_bypass_discharging",
          "r_inlet_rounded_bypass_discharging",
        ],
      },
    ]);

    const remaining = Object.keys(params)
      .filter((key) => !used.has(key) && typeof params[key] === "number")
      .sort((a, b) => a.localeCompare(b))
      .map((key) => [key, params[key]] as [string, number]);
    if (remaining.length > 0) groups.push({ title: "Other parameters", entries: remaining });

    return groups;
  }, [params]);

  useEffect(() => {
    if (!selectedGroup && paramGroups.length > 0) {
      setSelectedGroup(paramGroups[0].title);
    }
  }, [selectedGroup, paramGroups]);

  const restoreDefaults = async () => {
    setBusy("defaults");
    try {
      const res = await fetch(`${apiBase}/defaults`);
      if (!res.ok) throw new Error(await res.text());
      const out = await res.json();
      setParams(out.params ?? {});
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    restoreDefaults();
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

  const computeKValues = async () => {
    setBusy("kvalues");
    try {
      const out = await postJSON<any>(`${apiBase}/kvalues`, { params });
      setKvalues(out.values);
    } finally {
      setBusy(null);
    }
  };

  const startSimulationStream = async () => {
    if (simulateAbortRef.current) {
      simulateAbortRef.current.abort();
      simulateAbortRef.current = null;
    }
    setBusy("simulate");
    setChargingSeries([]);
    setDischargingSeries([]);
    setScalars({});
    setErrors([]);
    chargingBufferRef.current = [];
    dischargingBufferRef.current = [];
    phaseRef.current = null;
    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    try {
      const controller = new AbortController();
      simulateAbortRef.current = controller;
      const res = await fetch(`${apiBase}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
        signal: controller.signal,
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
              phaseRef.current = "charging";
              continue;
            }
            if (ev?.type === "summary") {
              if (ev.phase === "discharging") {
                phaseRef.current = "discharging";
              } else if (ev.phase === "charging") {
                phaseRef.current = "charging";
              }
              setScalars((s) => ({
                ...s,
                ...(ev.phase === "charging"
                  ? { E_elec_in_kWh: ev.E_elec_in_kWh, T_empty_charging: ev.T_empty }
                  : { E_elec_out_kWh: ev.E_elec_out_kWh, N_roundtrip: ev.N_roundtrip, T_empty_discharging: ev.T_empty }),
              }));
              continue;
            }
            if (ev?.type === "error") {
              const message = typeof ev.message === "string" ? ev.message : "Simulation error.";
              setErrors((prev) => [...prev, message]);
              continue;
            }
            if (ev?.type === "timeseries") {
              const point: SeriesPoint = {};
              for (const [k, v] of Object.entries(ev)) {
                if (typeof v === "number") point[k] = v;
              }
              if (ev.phase === "charging") {
                phaseRef.current = "charging";
                chargingBufferRef.current.push(point);
              } else if (ev.phase === "discharging") {
                phaseRef.current = "discharging";
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
      if (simulateAbortRef.current) {
        simulateAbortRef.current = null;
      }
      setBusy(null);
    }
  };

  const stopSimulationStream = () => {
    if (simulateAbortRef.current) {
      simulateAbortRef.current.abort();
      simulateAbortRef.current = null;
    }
    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setBusy(null);
  };

  const selectTab = (value: number) => setTab(value);

  return {
    tab,
    selectTab,
    params,
    setParams,
    chargingSeries,
    dischargingSeries,
    scalars,
    kvalues,
    busy,
    errors,
    selectedGroup,
    setSelectedGroup,
    paramGroups,
    kvalueRows,
    chargingX,
    dischargingX,
    restoreDefaults,
    computeKValues,
    startSimulationStream,
    stopSimulationStream,
  };
}

type OceanBatteryContextValue = ReturnType<typeof useOceanBatteryState>;

const OceanBatteryContext = createContext<OceanBatteryContextValue | null>(null);

export function OceanBatteryProvider({ children }: { children: React.ReactNode }) {
  const value = useOceanBatteryState();
  return <OceanBatteryContext.Provider value={value}>{children}</OceanBatteryContext.Provider>;
}

export function useOceanBattery() {
  const ctx = useContext(OceanBatteryContext);
  if (!ctx) {
    throw new Error("useOceanBattery must be used within OceanBatteryProvider");
  }
  return ctx;
}
