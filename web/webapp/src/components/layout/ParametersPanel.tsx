import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useOceanBattery } from "../../hooks/useOceanBattery";


export type ParamGroup = {
  title: string;
  entries?: Array<[string, number]>;
  subgroups?: Array<{ title: string; entries: Array<[string, number]> }>;
};

export function ParametersPanel() {
  const {
    setParams,
    busy,
    selectedGroup,
    setSelectedGroup,
    paramGroups,
    restoreDefaults,
  } = useOceanBattery();

  const activeGroup = paramGroups.find((group) => group.title === selectedGroup) ?? paramGroups[0];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%"}}>
      <FormControl size="small" sx={{ mb: 1 }}>
        <InputLabel id="param-group-label">Parameter group</InputLabel>
        <Select
          labelId="param-group-label"
          label="Parameter group"
          value={selectedGroup ?? ""}
          onChange={(e) => setSelectedGroup(String(e.target.value))}
        >
          {paramGroups.map((group) => (
            <MenuItem key={group.title} value={group.title}>
              {group.title}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 1 }}>
        {activeGroup?.entries && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1,
            }}
          >
            {activeGroup.entries.map(([k, v]) => (
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
        )}
        {activeGroup?.subgroups?.map((subgroup) => (
          <Box key={subgroup.title} sx={{ mt: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.75 }}>
              {subgroup.title}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 1,
              }}
            >
              {subgroup.entries.map(([k, v]) => (
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
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: "auto" }}>
        <Button variant="text" disabled={!!busy} onClick={restoreDefaults}>
          Reset to defaults
        </Button>
      </Box>
    </Box>
  );
}
