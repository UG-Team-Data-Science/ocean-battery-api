function [T_empty_charging, E_elec_in_kWh,H_loss_total_charging, ...
    H_loss_major_charging, H_loss_minor_charging, H_loss_major_umbilical_charging,...
    H_loss_minor_umbilical_charging, H_static_charging, H_pump, Q_pump, V_wat_rigid_charging,E_elec_in_J,i]=Charging(OB_GUI_parameters)
%% CHARGING MODEL
%   This model symulates the charging phase of the Ocean Battery.

%% Clearing previous data
% clear all;
% clc;

%% Setting parameters
OB_parameters; %Loads the script OB_parameters

%% Initial calcuations
P_mechanical_motor = P_electrical * N_motor; %[W] Mechanical output power motor
P_pump = P_mechanical_motor * N_pump; %[W] Power of the pump
Interp_steps = (1/Delta_t)+1; %Calculates the required amount of steps between two seconds based on Delta_t. Is used in interpolation.  

%% Model initialization
i = 1; %Initial value for i.
V_wat_rigid_charging(1) = V_wat_rigid_start; %[m^3] Sets the initial volume of water present in the rigid reservoir.
Q_pump(1) = 0.00067; %[m^3/second] Initial guess of the flow throug the pump.

%% Reality check
if  V_wat_rigid_end > V_wat_rigid_charging(1)
    error('ERROR: End volume of the rigid reservoir exceeds the starting volume. Impossible situation.');
end

%% While loop
while  V_wat_rigid_charging(i) > V_wat_rigid_end 
    [H_loss_minor_charging(i), H_loss_major_charging(i), H_loss_major_umbilical_charging(i), ...
        H_loss_minor_umbilical_charging(i), H_loss_total_charging(i), H_static_charging(i), ...
        H_pump(i), Q_pump(i+1), V_wat_rigid_charging(i+1)] = Charging_step( ...
        Q_pump(i), V_wat_rigid_charging(i), OB_GUI_parameters, P_pump, Interp_steps);

    % Move to the next iteration.    
    i = i+1;
end

%% Output variables
T_empty_charging = i*Delta_t; %[s] Time it takes to empty the rigid reservoir.
E_elec_in_J = T_empty_charging * P_electrical; %[J] Amount of electrical energy invested in the motor.
E_elec_in_Wh =  E_elec_in_J/3600; %[Wh] Amount of electrical energy invested in the motor.
E_elec_in_kWh = E_elec_in_J/(1000*3600); %[kWh] Amount of electrical energy invested in the motor.

%% Plots
x_for_plot = 1:i-1;

figure(1)
plot(Q_pump)
title('Flow through the pump(Charging)')
if Delta_t == 0.1
    xlabel('Time [ds]');
elseif Delta_t == 0.01
    xlabel('Time [cs]');
elseif Delta_t == 0.001
    xlabel('Time [ms]');
end
ylabel('Volumetric flowrate [m^3/s]')

figure(2)
plot(V_wat_rigid_charging)
title('Volume of fluid present in the rigid reservoir(Charging)')
if Delta_t == 0.1
    xlabel('Time [ds]');
elseif Delta_t == 0.01
    xlabel('Time [cs]');
elseif Delta_t == 0.001
    xlabel('Time [ms]');
end
ylabel('Volume [m^3]')

figure(3)
plot(x_for_plot, H_loss_total_charging, x_for_plot, H_loss_minor_charging, x_for_plot, H_loss_major_charging, x_for_plot, H_loss_major_umbilical_charging, x_for_plot, H_loss_minor_umbilical_charging)
title('Head loss (Charging)')
if Delta_t == 0.1
    xlabel('Time [ds]');
elseif Delta_t == 0.01
    xlabel('Time [cs]');
elseif Delta_t == 0.001
    xlabel('Time [ms]');
end
ylabel('Head loss [m]')
legend('Total head loss','Minor head loss','Major head loss','Major head loss umbilical','Minor head loss umbilical')

figure(4)
plot(x_for_plot, H_static_charging, x_for_plot, H_pump, x_for_plot, H_loss_total_charging)
title('Pump head (Charging)')
if Delta_t == 0.1
    xlabel('Time [ds]');
elseif Delta_t == 0.01
    xlabel('Time [cs]');
elseif Delta_t == 0.001
    xlabel('Time [ms]');
end
ylabel('Head [m]')
legend('Static head','Pump head','Total head loss')

end
