import * as React from 'react';
import { Container, Grid, Box, Link, Button, Typography  } from '@mui/material';

import './Layout.css';
import "../../rug-huisstijl.css"
import logo from "../../images/logo--en.png"
import logo_only from "../../images/logo.gif"
import { useOceanBattery } from '../../hooks/useOceanBattery';

export function Header() {

  const {
    tab,
    selectTab,
    busy,
    computeKValues,
    startSimulationStream,
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
    <div key="second-top-bar" className="rug-bar white-red-bg">
      <Container maxWidth="xl" className="slash-bg"
      style={{height: "100%", paddingLeft: "80px", color: "white", fontWeight: 900, paddingTop: "7px", flexDirection: "row", display: "flex", justifyContent: "space-between"}}>
        <Box style={{flexGrow: 0, padding: 0, color: "white", paddingRight: "50px"}}>
          Ocean Battery
        </Box>
        <Box style={{flexGrow: 1, padding: 0}}>
          <Link key="overview" className={`${tab === 0 ? 'active ' : ""}`} onClick={() => selectTab(0)}>Overview</Link>
          <Link key="charging" className={`${tab === 1 ? 'active ' : ""}`} onClick={() => selectTab(1)}>Charging</Link>
          <Link key="charging" className={`${tab === 2 ? 'active ' : ""}`} onClick={() => selectTab(2)}>Discharging</Link>
        </Box>
        <Box style={{flexGrow: 0, padding: 0}}>
          <Button
            variant="contained" disabled={!!busy} onClick={computeKValues} size="small"
            style={{height: "30px", marginRight: "10px"}}>
            Compute K-values
          </Button>
          <Button variant="contained" disabled={!!busy} onClick={startSimulationStream}  size="small"
                  style={{height: "30px"}}>
            Start simulation
          </Button>
        </Box>
      </Container>
    </div>
  </>);
}