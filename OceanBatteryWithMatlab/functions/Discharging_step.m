function [H_loss_total_discharging, H_loss_minor_discharging, H_loss_major_discharging, ...
    H_loss_major_umbilical_discharging, H_loss_minor_umbilical_discharging, ...
    H_static_discharging, H_turbine, P_generator, V_wat_rigid_next, ...
    V_wat_bladder_next, Q_turbine_next] = Discharging_step(Q_turbine_i, V_wat_rigid_i, V_wat_bladder_i, ...
    OB_GUI_parameters, A_turbine, Interp_steps)
%DISCHARGING_STEP Single timestep for the discharging phase.

    OB_parameters; % Loads parameters from OB_GUI_parameters.

    if nargin < 5 || isempty(A_turbine)
        A_turbine = pi * (0.5 * D_turbine)^2;
    end
    if nargin < 6 || isempty(Interp_steps)
        Interp_steps = (1/Delta_t) + 1;
    end

    H_loss_major_discharging = Major_head_loss_discharging(Q_turbine_i, OB_GUI_parameters);
    H_loss_minor_discharging = Minor_head_loss_discharging(Q_turbine_i, OB_GUI_parameters);
    H_loss_major_umbilical_discharging = Major_head_loss_umbilical(Q_turbine_i, OB_GUI_parameters);
    H_loss_minor_umbilical_discharging = Minor_head_loss_umbilical(Q_turbine_i, OB_GUI_parameters);

    H_loss_total_discharging = H_loss_major_discharging + H_loss_minor_discharging + ...
        H_loss_major_umbilical_discharging + H_loss_minor_umbilical_discharging;

    H_static_discharging = Depth - Water_level_rigid_reservoir(V_wat_rigid_i, D_rigid, Capacity_rigid);
    if H_static_discharging < H_loss_total_discharging
        error('ERROR: Head loss is larger than the static head. The system will not work because of too much losses.');
    end

    H_turbine = H_static_discharging - H_loss_total_discharging;
    H_loss_turbine = H_turbine * N_turbine;
    H_final = H_turbine - H_loss_turbine;

    P_turbine = Q_turbine_i * H_turbine * Dens_wat * g * N_turbine;
    P_generator = P_turbine * N_generator;

    V_wat_rigid_next = V_wat_rigid_i + (Q_turbine_i * Delta_t);
    V_wat_bladder_next = V_wat_bladder_i - (Q_turbine_i * Delta_t);

    Q_turbine_no_interp = A_turbine * sqrt(2 * g * H_final);
    x = [0 1];
    y = [Q_turbine_i Q_turbine_no_interp];
    t_new = linspace(0, 1, Interp_steps);
    Q_turbine_interp = interp1(x, y, t_new);
    Q_turbine_next = Q_turbine_interp(2);
end
