import * as React from "react";
import "./rug-huisstijl.css"

import { MemoryRouter, Route, Routes} from "react-router-dom";

import { OceanBattery } from "./components/layout/OceanBattery";
import { Layout } from './components/layout/Layout';


function App() {
  return (
    <MemoryRouter> <Routes>
        <Route path="" element={<Layout title={"My Magic Model"}><OceanBattery/></Layout>}/>,
    </Routes></MemoryRouter>
  );
}

export default App;
