function [H_loss_minor_charging, H_loss_major_charging, H_loss_major_umbilical_charging, ...
    H_loss_minor_umbilical_charging, H_loss_total_charging, H_static_charging, ...
    H_pump, Q_pump_next, V_wat_rigid_next] = Charging_step(Q_pump_i, V_wat_rigid_i, OB_GUI_parameters, P_pump, Interp_steps)
%CHARGING_STEP Single timestep for the charging phase.

    OB_parameters; % Loads parameters from OB_GUI_parameters.

    if nargin < 4 || isempty(P_pump)
        P_mechanical_motor = P_electrical * N_motor; %[W]
        P_pump = P_mechanical_motor * N_pump; %[W]
    end
    if nargin < 5 || isempty(Interp_steps)
        Interp_steps = (1/Delta_t) + 1;
    end

    H_loss_minor_charging = Minor_head_loss_charging(Q_pump_i, OB_GUI_parameters);
    H_loss_major_charging = Major_head_loss_charging(Q_pump_i, OB_GUI_parameters);
    H_loss_major_umbilical_charging = Major_head_loss_umbilical(Q_pump_i, OB_GUI_parameters);
    H_loss_minor_umbilical_charging = Minor_head_loss_umbilical(Q_pump_i, OB_GUI_parameters);

    H_loss_total_charging = H_loss_major_charging + H_loss_minor_charging + ...
        H_loss_major_umbilical_charging + H_loss_minor_umbilical_charging;

    H_static_charging = Depth - Water_level_rigid_reservoir(V_wat_rigid_i, D_rigid, Capacity_rigid);
    H_pump = H_static_charging + H_loss_total_charging;

    Q_pump_no_interp = P_pump / (Dens_wat * g * H_pump);
    x = [0 1];
    y = [Q_pump_i Q_pump_no_interp];
    t_new = linspace(0, 1, Interp_steps);
    Q_pump_interp = interp1(x, y, t_new);
    Q_pump_next = Q_pump_interp(2);

    V_wat_rigid_next = V_wat_rigid_i - (Q_pump_i * Delta_t);
end
