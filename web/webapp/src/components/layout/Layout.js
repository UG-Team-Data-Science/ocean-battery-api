import React, { useState } from "react";

import './Layout.css';

import { Header } from "./Header";
import { Box } from '@mui/material';

export function Layout({children}) {
    return <>
        <Box className="no-print">
            <Header/>
            <div className="rug-content">
                {children}
            </div>
        </Box>
    </>
}