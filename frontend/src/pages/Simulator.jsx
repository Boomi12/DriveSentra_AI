import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  RotateCcw, 
  Pause, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  CloudRain, 
  BatteryCharging, 
  Fuel, 
  Coffee, 
  Wrench, 
  Radio, 
  Sliders, 
  ExternalLink, 
  Activity, 
  BrainCircuit, 
  Eye, 
  Gauge, 
  LayoutDashboard,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { runSimulation, resetSimulation, getSimulationStatus } from '../services/api';

const SCENARIO_PRESETS = [
  {
    key: 'normal_driving',
    name: 'Normal Driving',
    icon: ShieldCheck,
    badgeColor: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    description: 'Nominal driver attention, optimal vehicle energy, clear weather, and balanced highway corridor.',
    expectedOutcome: 'Safety Agent: Optimal. Driver state: Safe. Risk score: Low (~15%). Nominal Digital Twin.',
    values: {
      driver: { fatigueLevel: 15, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 14, continuousDrivingHours: 0.5 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 85, speed: 75, range: 350, healthStatus: 'good' },
      environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 120, estimatedTravelTime: 1.6 },
      emergencySosActive: false
    }
  },
  {
    key: 'driver_fatigue',
    name: 'Driver Fatigue Alert',
    icon: Eye,
    badgeColor: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    description: 'High fatigue metrics, elevated eye blink frequency, and delayed reaction hazards.',
    expectedOutcome: 'Driver state: Critical (>80%). Safety Agent: Warning (Mandatory 20-min rest stop). Risk score: High.',
    values: {
      driver: { fatigueLevel: 82, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: true, blinkCount: 29, continuousDrivingHours: 3.2 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 65, speed: 60, range: 260, healthStatus: 'good' },
      environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 140, estimatedTravelTime: 2.1 },
      emergencySosActive: false
    }
  },
  {
    key: 'distracted_driving',
    name: 'Distracted Driving',
    icon: AlertTriangle,
    badgeColor: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    description: 'Off-road gaze offset, persistent yaw rotation away from the driving corridor.',
    expectedOutcome: 'Driver Monitoring: Distracted. Safety Agent: Haptic steering alert recommendation.',
    values: {
      driver: { fatigueLevel: 30, distractionStatus: 'distracted', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 16, continuousDrivingHours: 1.0 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 72, speed: 70, range: 290, healthStatus: 'good' },
      environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 90, estimatedTravelTime: 1.2 },
      emergencySosActive: false
    }
  },
  {
    key: 'yawn_eye_closure',
    name: 'Yawning & Eye Closure',
    icon: Coffee,
    badgeColor: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
    description: 'Mouth aspect ratio (MAR > 0.52) yawning detection combined with slow eyelid recovery.',
    expectedOutcome: 'Fatigue escalates to Warning (75%). Break recommendation: Rest stop within 15 km.',
    values: {
      driver: { fatigueLevel: 75, distractionStatus: 'focused', eyeClosureStatus: 'Closed', isYawning: true, blinkCount: 25, continuousDrivingHours: 2.7 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 60, speed: 55, range: 240, healthStatus: 'good' },
      environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 110, estimatedTravelTime: 1.8 },
      emergencySosActive: false
    }
  },
  {
    key: 'heavy_rain_traffic',
    name: 'Heavy Rain & Traffic',
    icon: CloudRain,
    badgeColor: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
    description: 'Precipitation, slick asphalt, and stop-and-go congestion causing delays.',
    expectedOutcome: 'Route Agent: Alternative bypass calculated (+18m saved). Safety Agent: Reduced speed advisory.',
    values: {
      driver: { fatigueLevel: 35, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 15, continuousDrivingHours: 1.5 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 58, speed: 45, range: 230, healthStatus: 'good' },
      environment: { weather: 'rain', traffic: 'heavy', roadCondition: 'wet', visibility: 'moderate' },
      trip: { remainingDistance: 85, estimatedTravelTime: 2.2 },
      emergencySosActive: false
    }
  },
  {
    key: 'severe_weather_thunderstorm',
    name: 'Severe Weather / Poor Visibility',
    icon: ShieldAlert,
    badgeColor: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    description: 'Severe thunderstorm, dense fog, and hydroplaning hazards along the expressway.',
    expectedOutcome: 'Digital Twin: Critical journey risk. Route Agent: Avoid expressway & floodplains.',
    values: {
      driver: { fatigueLevel: 45, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 18, continuousDrivingHours: 1.8 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 50, speed: 38, range: 200, healthStatus: 'good' },
      environment: { weather: 'thunderstorm', traffic: 'heavy', roadCondition: 'flooded', visibility: 'poor' },
      trip: { remainingDistance: 95, estimatedTravelTime: 2.6 },
      emergencySosActive: false
    }
  },
  {
    key: 'congestion_roadblock',
    name: 'Congestion & Road Block',
    icon: AlertTriangle,
    badgeColor: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    description: 'Severe standstill highway bottleneck adding unexpected trip latency.',
    expectedOutcome: 'Route Agent: Alert state. Ripple recalculation on downstream arrival waypoints.',
    values: {
      driver: { fatigueLevel: 32, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 14, continuousDrivingHours: 2.0 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 68, speed: 20, range: 270, healthStatus: 'good' },
      environment: { weather: 'clear', traffic: 'heavy', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 60, estimatedTravelTime: 2.0 },
      emergencySosActive: false
    }
  },
  {
    key: 'low_ev_battery',
    name: 'Critical Low EV Battery',
    icon: BatteryCharging,
    badgeColor: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    description: 'EV state of charge below 15% with insufficient range to reach final destination.',
    expectedOutcome: 'Fuel/EV Agent: Critical fast-charging stop planned. Vehicle Intelligence: Stops required.',
    values: {
      driver: { fatigueLevel: 25, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 15, continuousDrivingHours: 1.2 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 14, speed: 60, range: 48, healthStatus: 'warning' },
      environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 115, estimatedTravelTime: 1.7 },
      emergencySosActive: false
    }
  },
  {
    key: 'low_fuel_petrol',
    name: 'Low Petrol/Diesel Fuel',
    icon: Fuel,
    badgeColor: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    description: 'Combustion fuel reserve alert below 12% with refuel stop required along corridor.',
    expectedOutcome: 'Fuel Agent: Low fuel alert. Refuel stop recommended within 12 km.',
    values: {
      driver: { fatigueLevel: 22, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 13, continuousDrivingHours: 1.1 },
      vehicle: { vehicleType: 'Petrol', fuelOrBatteryLevel: 12, speed: 68, range: 60, healthStatus: 'warning' },
      environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 130, estimatedTravelTime: 1.9 },
      emergencySosActive: false
    }
  },
  {
    key: 'long_continuous_drive',
    name: 'Continuous Driving Mandate',
    icon: Coffee,
    badgeColor: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
    description: 'Non-stop driving exceeding 4 hours without intermediate rest halts.',
    expectedOutcome: 'Safety Agent: Caution. Trip Planner rest-break logic triggers mandated stop.',
    values: {
      driver: { fatigueLevel: 68, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 22, continuousDrivingHours: 4.5 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 55, speed: 75, range: 220, healthStatus: 'good' },
      environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 150, estimatedTravelTime: 2.2 },
      emergencySosActive: false
    }
  },
  {
    key: 'vehicle_breakdown',
    name: 'Vehicle Breakdown',
    icon: Wrench,
    badgeColor: 'text-red-500 border-red-500/20 bg-red-500/10',
    description: 'Critical engine or high-voltage battery failure; vehicle immobilized on shoulder.',
    expectedOutcome: 'Emergency Agent: Danger protocol. Digital Twin health: Critical. Roadside dispatch ping.',
    values: {
      driver: { fatigueLevel: 30, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 15, continuousDrivingHours: 1.0 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 45, speed: 0, range: 0, healthStatus: 'critical' },
      environment: { weather: 'clear', traffic: 'light', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 70, estimatedTravelTime: 0 },
      emergencySosActive: false
    }
  },
  {
    key: 'emergency_sos_test',
    name: 'Emergency SOS Test',
    icon: Radio,
    badgeColor: 'text-rose-500 border-rose-500/20 bg-rose-500/10',
    description: 'Driver initiates SOS distress beacon in safe sandbox mode with simulated notifications.',
    expectedOutcome: 'Dashboard: Risk Score 98 (Active Beacon). Safe simulation emergency log created.',
    values: {
      driver: { fatigueLevel: 85, distractionStatus: 'distracted', eyeClosureStatus: 'Closed', isYawning: true, blinkCount: 30, continuousDrivingHours: 3.5 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 25, speed: 0, range: 80, healthStatus: 'critical' },
      environment: { weather: 'fog', traffic: 'heavy', roadCondition: 'wet', visibility: 'poor' },
      trip: { remainingDistance: 50, estimatedTravelTime: 0.8 },
      emergencySosActive: true
    }
  },
  {
    key: 'custom',
    name: 'Custom Sandbox Scenario',
    icon: Sliders,
    badgeColor: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    description: 'Adjust all driver, vehicle, weather, and traffic variables freely for edge-case validation.',
    expectedOutcome: 'Subsystems dynamically react based on actual mathematical rule thresholds.',
    values: {
      driver: { fatigueLevel: 45, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 18, continuousDrivingHours: 2.0 },
      vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 70, speed: 65, range: 280, healthStatus: 'good' },
      environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
      trip: { remainingDistance: 100, estimatedTravelTime: 1.5 },
      emergencySosActive: false
    }
  }
];

const Simulator = () => {
  const [selectedScenarioKey, setSelectedScenarioKey] = useState('normal_driving');
  const [scenarioForm, setScenarioForm] = useState(SCENARIO_PRESETS[0].values);

  // Execution states
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'paused' | 'completed' | 'error'
  const [executionSummary, setExecutionSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Active user / trip scoping
  const userId = localStorage.getItem('gd_userId') || 'driver_001';
  const tripId = localStorage.getItem('gd_tripId') || 'SIM_TRIP_ACTIVE';

  const selectedPreset = useMemo(() => {
    return SCENARIO_PRESETS.find(s => s.key === selectedScenarioKey) || SCENARIO_PRESETS[0];
  }, [selectedScenarioKey]);

  // Handle Preset Selection
  const handleSelectPreset = (key) => {
    setSelectedScenarioKey(key);
    const preset = SCENARIO_PRESETS.find(s => s.key === key);
    if (preset) {
      setScenarioForm(JSON.parse(JSON.stringify(preset.values)));
    }
    setErrorMsg(null);
  };

  // Check existing simulation status on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      getSimulationStatus()
        .then(res => {
          if (res.success && res.latestSimulation) {
            setExecutionSummary({
              simulationId: res.latestSimulation.simulationId,
              scenarioName: res.latestSimulation.scenarioName,
              timestamp: new Date(res.latestSimulation.startedAt).toLocaleTimeString(),
              processedSubsystems: res.latestSimulation.processedSubsystems || [],
              riskAssessment: res.latestSimulation.riskAssessment,
              driverStatus: res.latestSimulation.driverStatus,
              vehicleDiagnostics: res.latestSimulation.vehicleDiagnostics
            });
            setStatus('completed');
          }
        })
        .catch(() => {
          // Ignore status fetch errors on mount
        });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Form input update helpers
  const handleDriverChange = (field, val) => {
    setScenarioForm(prev => ({
      ...prev,
      driver: { ...prev.driver, [field]: val }
    }));
  };

  const handleVehicleChange = (field, val) => {
    setScenarioForm(prev => ({
      ...prev,
      vehicle: { ...prev.vehicle, [field]: val }
    }));
  };

  const handleEnvironmentChange = (field, val) => {
    setScenarioForm(prev => ({
      ...prev,
      environment: { ...prev.environment, [field]: val }
    }));
  };

  const handleTripChange = (field, val) => {
    setScenarioForm(prev => ({
      ...prev,
      trip: { ...prev.trip, [field]: val }
    }));
  };

  // Broadcast state changes across tabs
  const broadcastSimulationEvent = useCallback((type, payload) => {
    try {
      // 1. Cross-tab BroadcastChannel
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('drivesentra_sim_channel');
        bc.postMessage({ type, payload });
        bc.close();
      }
      // 2. Local storage event trigger
      localStorage.setItem('gd_sim_event', JSON.stringify({ type, timestamp: Date.now() }));
      // 3. Local window event
      window.dispatchEvent(new CustomEvent('twin-updated', { detail: payload }));
    } catch (e) {
      console.warn('Simulation broadcast fallback error:', e);
    }
  }, []);

  // Run Scenario
  const handleRunScenario = async () => {
    setStatus('running');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        scenarioKey: selectedScenarioKey,
        scenarioName: selectedPreset.name,
        tripId,
        userId,
        driver: scenarioForm.driver,
        vehicle: scenarioForm.vehicle,
        environment: scenarioForm.environment,
        trip: scenarioForm.trip,
        emergencySosActive: scenarioForm.emergencySosActive
      };

      const res = await runSimulation(payload);

      if (res.success) {
        setStatus('completed');
        setExecutionSummary({
          simulationId: res.simulationId,
          scenarioName: res.scenarioName,
          timestamp: new Date(res.timestamp).toLocaleTimeString(),
          processedSubsystems: res.processedSubsystems,
          riskAssessment: res.data.riskAssessment,
          driverStatus: res.data.driverStatus,
          vehicleDiagnostics: res.data.vehicleDiagnostics,
          emergencyAlert: res.data.emergencyAlert
        });

        // Save active simulation metadata
        localStorage.setItem('gd_simulation_active', JSON.stringify({
          simulationId: res.simulationId,
          scenarioName: res.scenarioName,
          isSimulation: true,
          timestamp: res.timestamp
        }));

        // Broadcast to Dashboard, Digital Twin, and Agent Panel
        broadcastSimulationEvent('simulation-run', {
          simulationId: res.simulationId,
          scenarioName: res.scenarioName,
          twin: res.data.twin
        });

        setSuccessMsg(`Scenario "${res.scenarioName}" executed successfully. Subsystem state synchronized.`);
      } else {
        setStatus('error');
        setErrorMsg(res.error || 'Failed to execute simulation scenario.');
      }
    } catch (err) {
      console.error('Simulation execution error:', err);
      setStatus('error');
      setErrorMsg(err.error || err.message || 'Error communicating with simulation backend service.');
    }
  };

  // Reset Scenario
  const handleReset = async () => {
    setStatus('running');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await resetSimulation({
        tripId,
        userId,
        simulationId: executionSummary?.simulationId
      });

      if (res.success) {
        setStatus('idle');
        setExecutionSummary(null);
        localStorage.removeItem('gd_simulation_active');

        // Broadcast reset to all pages
        broadcastSimulationEvent('simulation-reset', { isSimulation: false });

        setSuccessMsg('Simulation reset complete. Baseline nominal states restored.');
      } else {
        setStatus('error');
        setErrorMsg(res.error || 'Failed to reset simulation state.');
      }
    } catch (err) {
      console.error('Reset error:', err);
      setStatus('error');
      setErrorMsg(err.error || err.message || 'Error resetting simulation.');
    }
  };

  // Pause / Resume Toggle
  const handleTogglePause = () => {
    if (status === 'paused') {
      setStatus('completed');
      setSuccessMsg('Simulation state resumed.');
    } else if (status === 'completed') {
      setStatus('paused');
      setSuccessMsg('Simulation state paused on current telemetry snapshot.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-purple-500/20">
              <Sliders className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Scenario Simulator</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic scenario testing layer for DriveSentra AI. Tests and drives telemetry across all existing subsystems.
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-full border border-slate-800 bg-slate-900/60 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status:</span>
            <span className={`text-xs font-black uppercase flex items-center gap-1.5 ${
              status === 'completed' ? 'text-emerald-400' :
              status === 'running' ? 'text-purple-400 animate-pulse' :
              status === 'paused' ? 'text-amber-400' :
              status === 'error' ? 'text-rose-400' : 'text-slate-500'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                status === 'completed' ? 'bg-emerald-400' :
                status === 'running' ? 'bg-purple-400 animate-ping' :
                status === 'paused' ? 'bg-amber-400' :
                status === 'error' ? 'bg-rose-400' : 'bg-slate-600'
              }`}></span>
              {status}
            </span>
          </div>

          <button
            onClick={handleReset}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Reset to nominal state and clear simulation records"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            Reset Baseline
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs animate-shake">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs animate-fade-in">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Section: Scenario Catalog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
            1. Select Simulation Scenario
          </h2>
          <span className="text-[11px] text-purple-400 font-mono">
            {SCENARIO_PRESETS.length} scenarios available
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {SCENARIO_PRESETS.map((scenario) => {
            const Icon = scenario.icon;
            const isSelected = selectedScenarioKey === scenario.key;

            return (
              <button
                key={scenario.key}
                onClick={() => handleSelectPreset(scenario.key)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[96px] ${
                  isSelected
                    ? 'bg-purple-600/15 border-purple-500/50 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30'
                    : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-1.5 rounded-lg border ${scenario.badgeColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {isSelected && (
                    <span className="text-[9px] font-black uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white mt-2 truncate">{scenario.name}</h4>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{scenario.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle Section: Configuration Grid & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Variables Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-purple-400" />
                  2. Scenario Parameter Configuration
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tune relevant variables. All inputs are bounded to valid mathematical ranges.
                </p>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${selectedPreset.badgeColor}`}>
                {selectedPreset.name}
              </span>
            </div>

            {/* A. Driver Variables */}
            <div className="space-y-3">
              <h4 className="text-[11px] uppercase font-bold text-purple-300 tracking-wider flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Driver Biometrics & State
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="text-slate-400 font-medium">Fatigue Level</label>
                    <span className="font-mono font-bold text-purple-300">{scenarioForm.driver.fatigueLevel}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scenarioForm.driver.fatigueLevel}
                    onChange={(e) => handleDriverChange('fatigueLevel', Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-0.5 font-mono">
                    <span>0% (Safe)</span>
                    <span>70% (Warn)</span>
                    <span>100%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">Focus Assessment</label>
                  <select
                    value={scenarioForm.driver.distractionStatus}
                    onChange={(e) => handleDriverChange('distractionStatus', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="focused">Focused (Forward Road)</option>
                    <option value="distracted">Distracted (Off-road gaze)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">Eyelid State</label>
                  <select
                    value={scenarioForm.driver.eyeClosureStatus}
                    onChange={(e) => handleDriverChange('eyeClosureStatus', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="Open">Open (EAR &ge; 0.22)</option>
                    <option value="Closed">Closed (EAR &lt; 0.22)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">Yawning Status</label>
                  <select
                    value={scenarioForm.driver.isYawning ? 'yes' : 'no'}
                    onChange={(e) => handleDriverChange('isYawning', e.target.value === 'yes')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="no">Normal (MAR &le; 0.52)</option>
                    <option value="yes">Yawning Active (MAR &gt; 0.52)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="text-slate-400 font-medium">Blink Rate</label>
                    <span className="font-mono font-bold text-slate-300">{scenarioForm.driver.blinkCount} /min</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={scenarioForm.driver.blinkCount}
                    onChange={(e) => handleDriverChange('blinkCount', Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="text-slate-400 font-medium">Drive Duration</label>
                    <span className="font-mono font-bold text-slate-300">{scenarioForm.driver.continuousDrivingHours} hrs</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="0.5"
                    value={scenarioForm.driver.continuousDrivingHours}
                    onChange={(e) => handleDriverChange('continuousDrivingHours', Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* B. Vehicle Variables */}
            <div className="space-y-3">
              <h4 className="text-[11px] uppercase font-bold text-purple-300 tracking-wider flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" />
                Vehicle Telemetry & Diagnostics
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">Powertrain Type</label>
                  <select
                    value={scenarioForm.vehicle.vehicleType}
                    onChange={(e) => handleVehicleChange('vehicleType', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="EV">Electric Vehicle (EV)</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="text-slate-400 font-medium">
                      {scenarioForm.vehicle.vehicleType === 'EV' ? 'Battery SoC' : 'Fuel Level'}
                    </label>
                    <span className="font-mono font-bold text-purple-300">{scenarioForm.vehicle.fuelOrBatteryLevel}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={scenarioForm.vehicle.fuelOrBatteryLevel}
                    onChange={(e) => handleVehicleChange('fuelOrBatteryLevel', Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-0.5 font-mono">
                    <span>Critical (&lt;15%)</span>
                    <span>100%</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="text-slate-400 font-medium">Speed</label>
                    <span className="font-mono font-bold text-slate-300">{scenarioForm.vehicle.speed} km/h</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="140"
                    value={scenarioForm.vehicle.speed}
                    onChange={(e) => handleVehicleChange('speed', Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">Vehicle Health Status</label>
                  <select
                    value={scenarioForm.vehicle.healthStatus}
                    onChange={(e) => handleVehicleChange('healthStatus', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="good">Good (All Systems Nominal)</option>
                    <option value="warning">Warning (Service Advisory)</option>
                    <option value="critical">Critical (Immobilization Fault)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="text-slate-400 font-medium">Full Tank / Battery Range</label>
                    <span className="font-mono font-bold text-slate-300">{scenarioForm.vehicle.range} km</span>
                  </div>
                  <input
                    type="number"
                    min="50"
                    max="900"
                    value={scenarioForm.vehicle.range}
                    onChange={(e) => handleVehicleChange('range', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">SOS Distress Trigger</label>
                  <button
                    type="button"
                    onClick={() => setScenarioForm(prev => ({ ...prev, emergencySosActive: !prev.emergencySosActive }))}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                      scenarioForm.emergencySosActive
                        ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/20 animate-pulse'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Radio className="h-3.5 w-3.5" />
                    {scenarioForm.emergencySosActive ? 'Emergency Beacon ARMED' : 'Emergency Beacon Standby'}
                  </button>
                </div>
              </div>
            </div>

            {/* C. Environmental & Trip Variables */}
            <div className="space-y-3">
              <h4 className="text-[11px] uppercase font-bold text-purple-300 tracking-wider flex items-center gap-1.5">
                <CloudRain className="h-3.5 w-3.5" />
                Environment & Route Conditions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">Weather</label>
                  <select
                    value={scenarioForm.environment.weather}
                    onChange={(e) => handleEnvironmentChange('weather', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="clear">Clear Skies</option>
                    <option value="rain">Heavy Rain</option>
                    <option value="fog">Dense Fog</option>
                    <option value="snow">Snow / Ice</option>
                    <option value="thunderstorm">Thunderstorm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">Traffic Density</label>
                  <select
                    value={scenarioForm.environment.traffic}
                    onChange={(e) => handleEnvironmentChange('traffic', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="light">Light (Free Flow)</option>
                    <option value="normal">Normal</option>
                    <option value="heavy">Heavy (Congested)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">Road Condition</label>
                  <select
                    value={scenarioForm.environment.roadCondition}
                    onChange={(e) => handleEnvironmentChange('roadCondition', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="dry">Dry</option>
                    <option value="wet">Wet & Slippery</option>
                    <option value="flooded">Flooded Lowlands</option>
                    <option value="rough">Rough / Potholes</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="text-slate-400 font-medium">Distance Left</label>
                    <span className="font-mono font-bold text-slate-300">{scenarioForm.trip.remainingDistance} km</span>
                  </div>
                  <input
                    type="number"
                    min="10"
                    max="800"
                    value={scenarioForm.trip.remainingDistance}
                    onChange={(e) => handleTripChange('remainingDistance', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Run Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-500">
                Target User: <strong className="text-slate-300 font-mono">{userId}</strong> &bull; Trip ID:{' '}
                <strong className="text-purple-300 font-mono">{tripId}</strong>
              </div>

              <div className="flex items-center gap-2.5">
                {status === 'completed' || status === 'paused' ? (
                  <button
                    onClick={handleTogglePause}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {status === 'paused' ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5 text-amber-400" />}
                    {status === 'paused' ? 'Resume State' : 'Pause State'}
                  </button>
                ) : null}

                <button
                  onClick={handleRunScenario}
                  disabled={status === 'running'}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {status === 'running' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Executing Scenario...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white" />
                      Run Scenario Telemetry
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Scenario Objective & Subsystem Execution Summary */}
        <div className="space-y-6">
          {/* Objective Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-purple-400" />
              Scenario Scope
            </h4>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Scenario Description</span>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedPreset.description}</p>
            </div>
            <div className="p-3 bg-purple-950/20 rounded-xl border border-purple-500/20 space-y-1">
              <span className="text-[10px] uppercase font-bold text-purple-400 block">Expected System Reaction</span>
              <p className="text-xs text-purple-200/90 leading-relaxed">{selectedPreset.expectedOutcome}</p>
            </div>
          </div>

          {/* Execution Summary Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Execution Summary
              </h4>
              {executionSummary && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {executionSummary.simulationId}
                </span>
              )}
            </div>

            {executionSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Risk Score</span>
                    <span className={`text-base font-black font-mono ${
                      executionSummary.riskAssessment?.level === 'High' ? 'text-red-400' :
                      executionSummary.riskAssessment?.level === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {executionSummary.riskAssessment?.score ?? 15}/100 ({executionSummary.riskAssessment?.level ?? 'Low'})
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Driver State</span>
                    <span className="text-base font-black text-white capitalize">
                      {executionSummary.driverStatus?.driverState ?? 'Safe'}
                    </span>
                  </div>
                </div>

                {/* Subsystems Processed */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                    Verified Subsystems Processed
                  </span>
                  <div className="space-y-1">
                    {executionSummary.processedSubsystems?.map((sub, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950/40 px-2.5 py-1 rounded-lg border border-slate-800/80">
                        <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{sub}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Emergency Safeguard indicator */}
                {executionSummary.emergencyAlert && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-300 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>Emergency event simulated. External dispatch suppressed for safety.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                <Activity className="h-8 w-8 mx-auto mb-2 text-slate-700 animate-pulse" />
                No simulation run executed yet. Choose a scenario and click Run.
              </div>
            )}
          </div>

          {/* Quick Navigation: Inspect Results */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Inspect Live Changes Across DriveSentra AI
            </h4>
            <p className="text-[11px] text-slate-500">
              Navigate to existing views to observe how simulated telemetry impacts real application state:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                to="/dashboard"
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all group"
              >
                <span className="flex items-center gap-1.5">
                  <LayoutDashboard className="h-3.5 w-3.5 text-purple-400" />
                  Dashboard
                </span>
                <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-purple-400" />
              </Link>

              <Link
                to="/digital-twin"
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all group"
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  Digital Twin
                </span>
                <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-emerald-400" />
              </Link>

              <Link
                to="/agents"
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all group"
              >
                <span className="flex items-center gap-1.5">
                  <BrainCircuit className="h-3.5 w-3.5 text-blue-400" />
                  AI Agent Grid
                </span>
                <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-blue-400" />
              </Link>

              <Link
                to="/driver-monitoring"
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all group"
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-amber-400" />
                  Driver Monitor
                </span>
                <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-amber-400" />
              </Link>

              <Link
                to="/driver-logs"
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all group"
              >
                <span className="flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5 text-orange-400" />
                  Driver Logs
                </span>
                <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-orange-400" />
              </Link>

              <Link
                to="/vehicle-intelligence"
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all group"
              >
                <span className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-teal-400" />
                  Vehicle Intel
                </span>
                <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-teal-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Simulator;
