import React from "react";

import './Layout.css';

import { Header } from "./Header";
import { Box } from '@mui/material';
import { OceanBatteryProvider } from "../../hooks/useOceanBattery";

export function Layout({children}) {
    return <>
        <OceanBatteryProvider>
            <Box className="no-print">
                <Header/>
                <div className="rug-content">
                    {children}
                </div>
            </Box>
        </OceanBatteryProvider>
    </>
}
