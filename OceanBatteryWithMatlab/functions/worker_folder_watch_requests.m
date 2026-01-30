function worker_folder_watch_requests(in_dir, poll_seconds)
%WORKER_FOLDER_WATCH_REQUESTS Watch a folder for *.in.json requests and write *.out.json results.
%   Request file format:
%     - filename: <base>.in.json
%     - contents: either { "type": "charging"|"k_values", "params": {...} }
%       or a bare params object (treated as "charging" by default).
%
%   Output:
%     - k_values: <base>.out.json as a single JSON object.
%     - charging: <base>.out.json as JSON lines (streamed) with time series.
%
%   This worker is safe to run in multiple processes: it claims inputs by
%   atomically renaming the *.in.json to *.processing.<id>.json.

    if nargin < 1 || isempty(in_dir)
        error('in_dir is required.');
    end
    if nargin < 2 || isempty(poll_seconds)
        poll_seconds = 0.5;
    else
        if ischar(poll_seconds) || isstring(poll_seconds)
            poll_seconds = str2double(poll_seconds);
        end
        if isnan(poll_seconds)
            error('poll_seconds must be numeric or a numeric string.');
        end
        poll_seconds = floor(poll_seconds);
    end

    if ~exist(in_dir, 'dir')
        error('Input directory does not exist: %s', in_dir);
    end

    worker_id = make_worker_id();

    while true
        files = dir(fullfile(in_dir, '*.in.json'));
        for k = 1:numel(files)
            in_path = fullfile(files(k).folder, files(k).name);
            [claimed_path, out_path] = try_claim(in_path, worker_id);
            if isempty(claimed_path)
                continue;
            end

            try
                req = jsondecode(fileread(claimed_path));
                [req_type, params] = parse_request(req);

                switch req_type
                    case "k_values"
                        K_Values = independant_k_values(params);
                        result = struct( ...
                            'type','k_values', ...
                            'status','ok', ...
                            'values',K_Values);
                        write_json(out_path, result);

                    case "charging"
                        stream_charging(out_path, params);

                    otherwise
                        error('Unknown request type: %s', req_type);
                end
            catch err
                write_json(out_path, struct( ...
                    'type','error', ...
                    'message',err.message, ...
                    'stack',stack_to_cell(err.stack)));
            end

            % Remove claimed input once processed.
            if exist(claimed_path, 'file') == 2
                delete(claimed_path);
            end
        end
        pause(poll_seconds);
    end
end

function [claimed_path, out_path] = try_claim(in_path, worker_id)
    claimed_path = '';
    out_path = '';

    [folder, name, ext] = fileparts(in_path); % name includes ".in"
    if ~endsWith(name, '.in')
        return;
    end

    claim_name = sprintf('%s.processing.%s%s', name, worker_id, ext);
    claimed_path_try = fullfile(folder, claim_name);

    try
        ok = movefile(in_path, claimed_path_try);
    catch
        ok = false;
    end
    if ~ok
        return;
    end

    base = erase(name, '.in');
    out_path = fullfile(folder, [base '.out.json']);
    claimed_path = claimed_path_try;
end

function [req_type, params] = parse_request(req)
    req_type = "";
    params = req;

    if isfield(req, 'params')
        params = req.params;
    end

    if isfield(req, 'request')
        req_type = string(req.request);
    elseif isfield(req, 'request_type')
        req_type = string(req.request_type);
    elseif isfield(req, 'type')
        req_type = string(req.type);
    end

    if req_type == ""
        req_type = "charging";
    end

    req_type = lower(req_type);
    if req_type == "kvalues"
        req_type = "k_values";
    end
end

function stream_charging(out_path, OB_GUI_parameters)
    dt = NaN;
    if isfield(OB_GUI_parameters, 'Delta_t')
        dt = OB_GUI_parameters.Delta_t;
    end

    write_line(out_path, struct('type','start','request','charging','dt',dt), 'w');

    %% Charging loop (streaming)
    OB_parameters;
    P_mechanical_motor = P_electrical * N_motor;
    P_pump = P_mechanical_motor * N_pump;
    Interp_steps = (1/Delta_t) + 1;

    i = 1;
    V_wat_rigid_charging(1) = V_wat_rigid_start;
    Q_pump(1) = 0.00067;

    if V_wat_rigid_end > V_wat_rigid_charging(1)
        error('ERROR: End volume of the rigid reservoir exceeds the starting volume. Impossible situation.');
    end

    while V_wat_rigid_charging(i) > V_wat_rigid_end
        [H_loss_minor_charging, H_loss_major_charging, H_loss_major_umbilical_charging, ...
            H_loss_minor_umbilical_charging, H_loss_total_charging, H_static_charging, ...
            H_pump, Q_pump(i+1), V_wat_rigid_charging(i+1)] = Charging_step( ...
            Q_pump(i), V_wat_rigid_charging(i), OB_GUI_parameters, P_pump, Interp_steps);

        t = (i-1) * dt;
        write_line(out_path, struct( ...
            'type','timeseries', ...
            'phase','charging', ...
            't',t, ...
            'H_loss_total', H_loss_total_charging, ...
            'H_loss_major', H_loss_major_charging, ...
            'H_loss_minor', H_loss_minor_charging, ...
            'H_loss_major_umbilical', H_loss_major_umbilical_charging, ...
            'H_loss_minor_umbilical', H_loss_minor_umbilical_charging, ...
            'H_static',H_static_charging, ...
            'H_pump',H_pump, ...
            'Q',Q_pump(i), ...
            'V_rigid',V_wat_rigid_charging(i) ...
        ));

        i = i+1;
    end

    T_empty_charging = i * Delta_t;
    E_elec_in_J = T_empty_charging * P_electrical;
    E_elec_in_kWh = E_elec_in_J / (1000 * 3600);

    write_line(out_path, struct( ...
        'type','summary','phase','charging', ...
        'T_empty',T_empty_charging, ...
        'E_elec_in_kWh',E_elec_in_kWh,'i',i ...
    ));

    %% Discharging loop (streaming)
    OB_parameters;
    A_turbine = pi * (0.5*D_turbine)^2;
    Interp_steps = (1/Delta_t) + 1;
    startup_steps = (1/Delta_t) * t_open_ball_valve;

    i = 1;
    V_wat_bladder(1) = V_wat_rigid_charging(1) - V_wat_rigid_charging(end) + ...
        (Capacity_rigid - V_wat_rigid_charging(1));
    Q_turbine_a(1) = 2.6e-3;

    if V_wat_rigid_charging(end) < 0
        V_wat_rigid_discharging(1) = 0;
    else
        V_wat_rigid_discharging(1) = V_wat_rigid_charging(end);
    end

    if V_wat_bladder(1) < V_wat_bladder_end
        error('ERROR: End volume of the bladder exceeds the starting volume of the bladder during the discharge phase. Impossible situation.');
    end

    for i = 1:startup_steps
        [~, ~, ~, ~, ~, ~, ~, ~, V_wat_rigid_discharging(i+1), ~, Q_turbine_a(i+1)] = ...
            Discharging_step(Q_turbine_a(i), V_wat_rigid_discharging(i), V_wat_bladder(1), ...
            OB_GUI_parameters, A_turbine, Interp_steps);
    end

    Q_turbine = linspace(0, Q_turbine_a(startup_steps), startup_steps);
    E_elec_out_J = 0;

    for i = 1:startup_steps
        [H_loss_total_discharging, H_loss_minor_discharging, H_loss_major_discharging, ...
            H_loss_major_umbilical_discharging, H_loss_minor_umbilical_discharging, ...
            H_static_discharging, H_turbine, P_generator, ...
            V_wat_rigid_discharging(i+1), V_wat_bladder(i+1), ~] = Discharging_step( ...
            Q_turbine(i), V_wat_rigid_discharging(i), V_wat_bladder(i), ...
            OB_GUI_parameters, A_turbine, Interp_steps);

        t = (i-1) * dt;
        write_line(out_path, struct( ...
            'type','timeseries', ...
            'phase','discharging', ...
            't',t, ...
            'H_loss_total',H_loss_total_discharging, ...
            'H_loss_major',H_loss_major_discharging, ...
            'H_loss_minor',H_loss_minor_discharging, ...
            'H_loss_major_umbilical',H_loss_major_umbilical_discharging, ...
            'H_loss_minor_umbilical',H_loss_minor_umbilical_discharging, ...
            'H_static',H_static_discharging, ...
            'H_turbine',H_turbine, ...
            'Q',Q_turbine(i), ...
            'V_rigid',V_wat_rigid_discharging(i), ...
            'V_bladder',V_wat_bladder(i), ...
            'P_generator',P_generator));

        E_elec_out_J = E_elec_out_J + (P_generator * Delta_t);
    end

    while V_wat_bladder(i) > V_wat_bladder_end
        [H_loss_total_discharging, H_loss_minor_discharging, H_loss_major_discharging, ...
            H_loss_major_umbilical_discharging, H_loss_minor_umbilical_discharging, ...
            H_static_discharging, H_turbine, P_generator, ...
            V_wat_rigid_discharging(i+1), V_wat_bladder(i+1), Q_turbine(i+1)] = Discharging_step( ...
            Q_turbine(i), V_wat_rigid_discharging(i), V_wat_bladder(i), ...
            OB_GUI_parameters, A_turbine, Interp_steps);

        t = (i-1) * dt;
        write_line(out_path, struct( ...
            'type','timeseries', ...
            'phase','discharging', ...
            't',t, ...
            'H_loss_total',H_loss_total_discharging, ...
            'H_loss_major',H_loss_major_discharging, ...
            'H_loss_minor',H_loss_minor_discharging, ...
            'H_loss_major_umbilical',H_loss_major_umbilical_discharging, ...
            'H_loss_minor_umbilical',H_loss_minor_umbilical_discharging, ...
            'H_static',H_static_discharging, ...
            'H_turbine',H_turbine, ...
            'Q',Q_turbine(i), ...
            'V_rigid',V_wat_rigid_discharging(i), ...
            'V_bladder',V_wat_bladder(i), ...
            'P_generator',P_generator));

        E_elec_out_J = E_elec_out_J + (P_generator * Delta_t);
        i = i+1;
    end

    T_empty_discharging = i * Delta_t;
    E_elec_out_kWh = (E_elec_out_J/3600) / 1000;
    N_roundtrip = NaN;

    write_line(out_path, struct('type','summary','phase','discharging', ...
        'T_empty',T_empty_discharging, ...
        'E_elec_out_kWh',E_elec_out_kWh, ...
        'N_roundtrip',N_roundtrip, ...
        'i',i));

    write_line(out_path, struct('type','end'));
end

function n = min_len(cell_arrays)
    n = inf;
    for c = 1:numel(cell_arrays)
        n = min(n, numel(cell_arrays{c}));
    end
    if isinf(n)
        n = 0;
    end
end

function v = safe_idx(arr, idx)
    if idx <= numel(arr)
        v = arr(idx);
    else
        v = NaN;
    end
end

function write_line(path, s, mode)
    if nargin < 3
        mode = 'a';
    end
    fid = fopen(path, mode);
    if fid == -1
        error('Failed to open output file: %s', path);
    end
    fprintf(fid, '%s\n', jsonencode(s));
    fclose(fid);
end

function write_json(path, obj)
    fid = fopen(path, 'w');
    if fid == -1
        error('Failed to open output file: %s', path);
    end
    fprintf(fid, '%s\n', jsonencode(obj));
    fclose(fid);
end

function id = make_worker_id()
    try
        pid = feature('getpid');
        id = sprintf('pid%d', pid);
    catch
        id = sprintf('rand%d', randi(1e9));
    end
end

function c = stack_to_cell(st)
    c = cell(numel(st),1);
    for k = 1:numel(st)
        c{k} = sprintf('%s:%d', st(k).file, st(k).line);
    end
end
