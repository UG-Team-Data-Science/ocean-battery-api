import React from "react";
import {
  Box,
} from "@mui/material";
import { PlotsPanel } from "./Plotspanel";
import { ParametersPanel } from "./ParametersPanel";


export function OceanBattery() {
  return (
    <Box
      sx={{
        p: 2,
        display: "grid",
        gridTemplateColumns: "440px 1fr",
        gap: 2,
        height: "calc(100vh - 86px)",
        overflow: "hidden",
      }}
    >
      <ParametersPanel/>
      <PlotsPanel/>
    </Box>
  );
}
