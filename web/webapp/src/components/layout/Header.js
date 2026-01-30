import * as React from 'react';
import { Container, Grid, Box  } from '@mui/material';

import './Layout.css';
import "../../rug-huisstijl.css"
import logo from "../../images/logo--en.png"
import logo_only from "../../images/logo.gif"


export function Header() {
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
      <Container maxWidth="xl" className="slash-bg" style={{height: "100%", paddingLeft: "80px", color: "white", fontWeight: 900, paddingTop: "7px"}}>
        Ocean Battery
      </Container>
    </div>
  </>);
}