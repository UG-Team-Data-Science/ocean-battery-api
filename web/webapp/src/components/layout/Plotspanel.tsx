import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import SouthWestIcon from "@mui/icons-material/SouthWest";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import LoopIcon from "@mui/icons-material/Loop";
import { useOceanBattery } from "../../hooks/useOceanBattery";

export function PlotsPanel() {
    const {
      tab,
      scalars,
      chargingSeries,
      dischargingSeries,
      kvalueRows,
      chargingX,
      dischargingX,
      errors,
    } = useOceanBattery();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%"}}>
      {(scalars.E_elec_in_kWh !== undefined || scalars.E_elec_out_kWh !== undefined) && (
        <Box
          sx={{
            mt: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "nowrap",
            overflowX: "auto",
            pb: 0.5,
          }}
        >
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, color: "info.main" }}>
            <SouthWestIcon fontSize="small" />
            <Typography variant="body2">
              In: {scalars.E_elec_in_kWh?.toFixed(4)} kWh
            </Typography>
          </Box>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, color: "success.main" }}>
            <NorthEastIcon fontSize="small" />
            <Typography variant="body2">
              Out: {scalars.E_elec_out_kWh?.toFixed(4)} kWh
            </Typography>
          </Box>
          {scalars.N_roundtrip !== undefined && (
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, color: "warning.main" }}>
              <LoopIcon fontSize="small" />
              <Typography variant="body2">
                Round: {scalars.N_roundtrip?.toFixed(4)}
              </Typography>
            </Box>
          )}
        </Box>
      )}
      {tab === 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Typography variant="h6">K-values table (charging vs discharging).</Typography>
          {errors.length > 0 && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {errors.map((message, idx) => (
                <div key={`${idx}-${message}`}>{message}</div>
              ))}
            </Alert>
          )}
          <Box sx={{ overflow: "auto", pr: 1, mt: 2 }}>
            {kvalueRows.length > 0 ? (
              <TableContainer component={Paper}>
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
            ) : null}
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Typography variant="h6">Charging</Typography>
          {chargingSeries.length > 0 ? (
            <Box
              sx={{
                mt: 2,
                display: "grid",
                gap: 2,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                overflow: "auto",
                pr: 1,
                flex: 1,
                minHeight: 0,
              }}
            >
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
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Typography variant="h6">Discharging</Typography>
          {dischargingSeries.length > 0 ? (
            <Box
              sx={{
                mt: 2,
                display: "grid",
                gap: 2,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                overflow: "auto",
                pr: 1,
                flex: 1,
                minHeight: 0,
              }}
            >
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
    </Box>
  );
}
