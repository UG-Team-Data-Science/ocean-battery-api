# OceanBattery


![Ocean Battery](https://user-images.githubusercontent.com/51987477/226371109-9ea1ea89-ec14-4eae-9943-e5d8cce790d8.png "Ocean Battery")


## Authors of the documentation
- Andreas T. Asiikkis
- Antonis I. Vakis

## Code Developed by
- Jimme Bromlewe (Ocean Battery source code)
- Robbert Nienhuis (Ocean Battery source code)
- Lars Hof (OceanBattery application development)


<div align="right">

Engineering and Technology Institute Groningen (ENTEG)  
Faculty of Science and Engineering (FSE)  
University of Groningen (RUG)  
Groningen, The Netherlands  
February, 2023

</div>





## 1. Introduction
<p align="justify">The Ocean Battery (OB) technology [1] is a form of a pumped hydro storage system that uses underwater flexible bladders to store water and generate electricity when needed. The system works by pumping water from a rigid reservoir into the flexible bladder on the seabed, where it is stored as potential energy in the form of water under high pressure due to the hydrostatic pressure. When energy is needed, the water is released from the bladders back into the rigid reservoirs, driving hydro turbines that generate electricity. This technology has the potential to provide scalable and eco-friendly utility scale energy storage from renewable sources such as wind turbines, floating solar farms and wave energy converters in the ocean.

The application OceanBattery is aimed at providing the user with an overview of the technical specifications of the small-scale Ocean Battery technology and its functioning. By providing inputs in the application, such as information of the hydraulic system, the user can estimate the energy saved and generated, along with the system's efficiency. The OB mathematical model used in this application has been presented in [2].</p>


## 2. Installation
<p align="justify">There are two available options to run the OceanBattery application. The first option (recommended) is to have MATLAB installed (provided a license is available) and the second option is to use the standalone version of the application which requires downloading the MATLAB runtime software which does not require any license. The first option permits access to the application's source code, allowing the user to modify it, whereas the second option does not provide this capability.</p>

### 2.1 Requirements
The following programs/files are required, which can be downloaded from this [Link](https://github.com/AndreasAsiikkis/OceanBattery):

#### 2.1.1 With MATLAB license
- MATLAB R2022b or later
- A folder called "OceanBatteryWithMatlab" that contains the following:
  - The file OceanBattery.mlapp
  - A folder called "functions" containing all the following .m files:
    - Charging.m
    - Copy_of_OB_parameters.m
    - Discharging.m
    - Discharging_test_setup.m
    - independant_k_values.m
    - K_values_charging_parameters.m
    - K_values_discharging_parameters.m
    - K_values_independent.m
    - K_values_independent_test_setup.m
    - K_values_test_setup_parameters.m
    - Major_head_loss_charging.m
    - Major_head_loss_discharging.m
    - Major_head_loss_test_setup.m
    - Major_head_loss_umbilical.m
    - Minor_head_loss_charging.m
    - Minor_head_loss_discharging.m
    - Minor_head_loss_test_setup.m
    - Minor_head_loss_umbilical.m
    - Moody.m
    - OB_parameters.m
    - Turbine_unit_loss.m
    - Water_level_rigid_reservoir.m
  - A folder called "efficiency" containing all the following .m files:
    - Analytical_Discharging.m
    - bf.m
    - fzero_2.m
    - P1_Losses_prototype.m
    - P2_Major_HL.m
    - P3_Minor_HL1.m
    - P4_Minor_HL2.m
    - P5_Minor_HL3.m
    - P6_FF.m
    - P9_VRIGID_Full.m
    - P9_VRIGID_Proto.m
    - Data_raw.xlsx
  - A folder called "images", containing all the following images:
    - inlet.png
    - turbine.png
    - contraction.png
    - discharging.png
    - pump.png
    - system.png
    - 45_degree_elbow.png
    - legend.png
    - enlargement.png
    - ball_valve.png
    - flow_sensor.png
    - tee_junctions.png
    - check_valve.png
    - union.png
    - elbow.png
    - bend.png
    - charging.png
    - pressure_sensor.png


#### 2.1.2. Without MATLAB license, 1st option
- OceanBattery.exe (24 MB) which can be found in the folder StandaloneWithMatlabRuntime after unzipping all the files in this directory. Requires installation by double-clicking the OceanBattery.exe and following the steps.

#### 2.1.3. Without MATLAB license, 2nd option
- MATLAB Runtime Version 9.13 (3.8 GB). Can be downloaded from the following link https://www.mathworks.com/products/compiler/mcr/index.html.
- OceanBattery.exe (21 MB)



## 3.	User guide
### 3.1.	Starting the application
#### 3.1.1.	With MATLAB license
1. Open MATLAB
2. Navigate to the directory where the file OceanBattery.mlapp is located.
3. Select the folders "functions" and "images", right-click and click "Add to Path → Selected Folders and Subfolders".
4. Open the OceanBattery.mlapp. The "App Designer" application will open in a new window.
5. In the Designer tab click Run. The application starts running.
#### 3.1.2.	Without MATLAB License
1. Run the OceanBattery.exe
### 3.2.	Running the application
- There are three tabs: Overview, Charging, and Discharging.
  - In the Overview tab:
    - The schematic of the system is shown.
    - The default values of the model (i.e., main parameters, charging parameters and discharging parameters) can be found and modified by the user. Using the dropdown menu, the group of parameters can be selected.
    - The K-values of the hydraulic system can be computed by clicking "Compute K-Values".
    - There are four charts and three numerical values of results which can be found in the other two tabs as well.
![image](https://user-images.githubusercontent.com/51987477/226378061-d4a6ab31-02bf-4162-a46a-e283b5ab7a17.png)

  - In the Charging and Discharging tabs:
    - There is a detailed graphical description of the current charging and discharging system respectively.
    - A detailed description of the sub-parts of each system can be found at the left whereas the component described can be selected from the dropdown menu "Sub-part".
![image](https://user-images.githubusercontent.com/51987477/226378284-1738d786-5180-4388-9d63-5d8a85cf4910.png)

- To run the simulation, click "Start Simulation".
- The results can be observed after the simulation is finished, which takes a while depending on the computer’s performance.

## 4.	Parameters
| Parameter                 | Explanation                                                                        |
|---------------------------|------------------------------------------------------------------------------------|
| **Main Parameters**                                                                                           |
| P_electrical              | Electrical input power to the pump [W].                                           |
| N_pump                    | Efficiency of the pump [-]. Values between 0-1.                                   |
| N_turbine                 | Efficiency of the turbine [-]. Values between 0-1.                                |
| Depth                     | Depth at which the ocean battery is located [m].                                  |
| Lout                      | Total length of the outer segment of the rigid reservoir [m].                     |
| Lin                       | Total length of the inner segment of the rigid reservoir [m].                     |
| D_rigid                   | Inner diameter of the rigid reservoir [m].                                        |
| L_pipeline_discharging    | Total length of the pipeline during the discharging phase [m].                    |
| D_pipeline                | Diameter of the pipeline [m].                                                     |
| L_pipeline_charging       | Total length of the pipeline during the charging phase [m].                       |
| **Charging/Discharging Parameters**                                                                           |
| These parameters are explained in the GUI at the charging/discharging tabs at the top left.                   |

## 5.	Glossary
<p align="justify">
  
###### Head Loss

The total head loss equals the sum of all minor and major head losses. The minor head loss has the largest impact on the total head loss, followed by the major head loss. The head losses in the umbilical cord have a minimal impact.

###### Pump Head

The pump head is the sum of the total head loss and the static head. The static head contributes most to the pump head.

###### Rigid Reservoir

A non-deformed reservoir at atmospheric pressure filled with water when the battery is discharged.

###### Flexible Bladder

A deformable reservoir with a hydrostatic pressure acting on it which is filled with water when the battery is charged.

###### Turbine Head

The turbine head equals the static head minus the total head loss. The increasing total head loss results in a decreasing turbine head.

###### Charging

The bladder is empty and the rigid reservoir is filled. During the charging phase, water is pumped from the rigid reservoir into the flexible bladder against the hydrostatic pressure. The final state of the charging phase is when the rigid reservoir is empty and the bladder is filled.

###### Discharging

When energy is required, a valve is opened and the pressure difference between the flexible bladder and the rigid reservoir forces the water out of the bladder into the rigid reservoir. The water flows through a turbine, which generates electricity. The final state of the discharging phase is when the bladder is empty and the rigid reservoir is filled.

###### Umbilical Cord

During the operation of the Ocean Battery, water flows in and out of the rigid reservoir. As a result of this water movement, air flows in and out of the rigid reservoir as well. This air is supplied and drained through the umbilical cord (blue cord in the Ocean Battery figure of the overview tab). The umbilical cord is a hollow tube that runs from the Ocean Battery to the water surface.

###### K-Values

The K-values are the minor loss coefficients of hydraulic parts which represent the head that will be lost when a fluid passes through them.

###### Bypass

The bypass is a pipe that connects the inner and outer parts of the rigid reservoir.</p>

## 6.	Contact Information
Prof. dr. A.I. (Antonis) Vakis  
University of Groningen, FSE-ENTEG-CMME  
Room 5113.0042, Nijenborg 4, Groningen, the Netherlands  
[https://sites.google.com/view/avakis](https://sites.google.com/view/avakis)

## 7.	References

[1] 	"OCEAN BATTERY," Ocean Grazer B.V., 2023. [Online]. Available: https://oceangrazer.com/.

[2] 	J. Bromlewe, "Optimization of the flow and efficiency model for the Ocean Battery," University of Groningen, BSc Integration Project, Groningen, 2021.




