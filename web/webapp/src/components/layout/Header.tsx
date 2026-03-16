import * as React from 'react';
import { Container, Grid, Box, Link, Button, Typography, CircularProgress } from '@mui/material';

import './Layout.css';
import "../../rug-huisstijl.css"
import logo from "../../images/logo--en.png"
import logo_only from "../../images/logo.gif"
import { useOceanBattery } from '../../hooks/useOceanBattery';
import {Home as HomeIcon} from "@mui/icons-material";
import {useLocation} from "react-router-dom";

import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

export function Header() {
  const location = useLocation();
  const {
    tab,
    selectTab,
    busy,
    computeKValues,
    startSimulationStream,
    stopSimulationStream,
  } = useOceanBattery();

  return (<>
    <div key="top-bar" className="bar-shadow hide-sm"><Container maxWidth="xl"><Grid container spacing={0}>
      <Grid size={8}>
        <img src={logo} alt="Rijksuniversiteit Groningen"/>
        {'founded in 1614 - top 100 university'}
      </Grid>
      <Grid size={4}>
      </Grid>
    </Grid></Container></div>
    <div key="second-top-bar" className="rug-bar">
      <Container maxWidth="xl" className="slash-bg"
                 style={{height: "100%", paddingLeft: "80px", color: "white", fontWeight: 900, flexDirection: "row",
                         display: "flex", justifyContent: "space-between", padding: 0, maxWidth: "100%"}}>
        <Box style={{flexGrow: 1, padding: 0, lineHeight: "50px", color: "white"}}>
          <Link href={"/"} key="home-link" className={ location.pathname === "/" ? "active " : "" }>
            <HomeIcon style={{marginTop: "5px", marginBottom: "-5px"}}/>
          </Link>
          <Link key="overview" className={`${tab === 0 ? 'active ' : ""}`} onClick={() => selectTab(0)}>Overview</Link>
          <Link key="charging" className={`${tab === 1 ? 'active ' : ""}`} onClick={() => selectTab(1)}>Charging</Link>
          <Link key="discharging" className={`${tab === 2 ? 'active ' : ""}`} onClick={() => selectTab(2)}>Discharging</Link>
          &nbsp;Ocean Battery
        </Box>
        <Box style={{flexGrow: 0, padding: 0, lineHeight: "50px", color: "white"}}>
          
          {busy === "simulate" && <CircularProgress size={18} color="inherit" />}
          <Link onClick={!busy ? computeKValues : undefined} key="kvalues-link" sx={{ pointerEvents: busy ? "none" : "auto", color: busy ? "text.disabled" : "primary.main", cursor: busy ? "default" : "pointer", }} title="Compute k-values">
            {'{}'}
          </Link>
          <Link onClick={busy === "simulate" ? stopSimulationStream : undefined} key="stop-link" sx={{ pointerEvents: busy ? "none" : "auto", color: busy ? "text.disabled" : "primary.main", cursor: busy ? "default" : "pointer", }} title="Stop simulation">
            <StopIcon style={{marginTop: "5px", marginBottom: "-7px"}}/>
          </Link>
          <Link onClick={!busy ? startSimulationStream : undefined} key="start-link" sx={{ pointerEvents: busy ? "none" : "auto", color: busy ? "text.disabled" : "primary.main", cursor: busy ? "default" : "pointer", }} title="Start simulation">
            <PlayArrowIcon style={{marginTop: "5px", marginBottom: "-7px"}}/>
          </Link>
          <Link href={"/privacy"} key="privacy-link" className={ location.pathname.startsWith("/privacy") ? "active " : "" }>Privacy</Link>
          <Link href={"/eula"} key="eula-link" className={ location.pathname.startsWith("/eula") ? "active " : "" }>EULA</Link>
        </Box>
      </Container>
    </div>
  </>);
}
