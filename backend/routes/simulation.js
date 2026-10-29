import express from 'express';
import mongoose from 'mongoose';
import DigitalTwin from '../models/DigitalTwin.js';
import Itinerary from '../models/Itinerary.js';
import AgentRecommendation from '../models/AgentRecommendation.js';
import DriverStatus from '../models/DriverStatus.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import { evaluateAgents } from '../utils/aiEngine.js';

const router = express.Router();

// Fallback in-memory simulation store when MongoDB is offline
const inMemorySimulationStore = {
  activeRuns: new Map(),
  driverStatuses: [],
  emergencyAlerts: []
};

// Helper to evaluate fatigue levels matching existing driver.js thresholds
function evaluateDriverFatigue(level) {
  const fatigueLevel = Number(level);
  let state = 'Safe';
  let breakNeeded = false;

  if (fatigueLevel < 40) {
    state = 'Safe';
  } else if (fatigueLevel >= 40 && fatigueLevel <= 70) {
    state = 'Drowsy';
  } else if (fatigueLevel > 70 && fatigueLevel <= 80) {
    state = 'Warning';
    breakNeeded = true;
  } else {
    state = 'Critical';
    breakNeeded = true;
  }

  return { driverState: state, breakNeeded };
}

// Helper to calculate composite risk score matching Dashboard.jsx calculation
function computeCompositeRisk({ driver, vehicle, environment, emergencySosActive }) {
  let score = 15; // base risk score
  const details = [];

  // Fuel/Battery level impact
  const fuelOrBat = Number(vehicle?.fuelOrBatteryLevel ?? 80);
  if (fuelOrBat < 25) {
    score += 40;
    details.push('Critical fuel/battery level');
  } else if (fuelOrBat < 50) {
    score += 15;
    details.push('Low fuel/battery warning');
  }

  // Weather impact
  const weather = (environment?.weather || 'clear').toLowerCase();
  if (['rain', 'snow'].includes(weather)) {
    score += 25;
    details.push('Adverse weather condition (Precipitation)');
  } else if (weather === 'fog') {
    score += 20;
    details.push('Low visibility (Fog Alert)');
  } else if (weather === 'thunderstorm') {
    score += 35;
    details.push('Severe thunderstorm & hydroplaning risk');
  }

  // Fatigue impact
  const fatigue = Number(driver?.fatigueLevel ?? 15);
  if (fatigue > 70) {
    score += 30;
    details.push('High driver fatigue detected');
  } else if (fatigue > 40) {
    score += 15;
    details.push('Mild driver fatigue detected');
  }

  // Traffic impact
  const traffic = (environment?.traffic || 'normal').toLowerCase();
  if (traffic === 'heavy') {
    score += 15;
    details.push('Heavy traffic congestion');
  }

  // Emergency SOS impact
  if (emergencySosActive) {
    score = 98;
    details.push('Active SOS Distress Beacon');
  }

  score = Math.min(score, 100);

  let level = 'Low';
  if (score > 70) {
    level = 'High';
  } else if (score > 40) {
    level = 'Medium';
  }

  return { score, level, details };
}

// POST /api/simulation/run - Execute scenario and propagate state
router.post('/run', async (req, res) => {
  try {
    const {
      scenarioKey = 'custom',
      scenarioName = 'Custom Scenario',
      tripId: reqTripId,
      userId = 'driver_001',
      driver = {},
      vehicle = {},
      environment = {},
      trip = {},
      emergencySosActive = false
    } = req.body;

    const tripId = reqTripId || 'SIM_TRIP_ACTIVE';
    const simulationId = 'SIM_' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // 1. Server-side validations
    const fatigue = Number(driver.fatigueLevel ?? 20);
    if (isNaN(fatigue) || fatigue < 0 || fatigue > 100) {
      return res.status(400).json({ success: false, error: 'Driver fatigue must be a number between 0 and 100' });
    }

    const fuelOrBat = Number(vehicle.fuelOrBatteryLevel ?? 80);
    if (isNaN(fuelOrBat) || fuelOrBat < 0 || fuelOrBat > 100) {
      return res.status(400).json({ success: false, error: 'Vehicle fuel/battery level must be a number between 0 and 100' });
    }

    const vehicleType = vehicle.vehicleType || 'EV';
    if (!['EV', 'Petrol', 'Diesel'].includes(vehicleType)) {
      return res.status(400).json({ success: false, error: 'Vehicle type must be "EV", "Petrol", or "Diesel"' });
    }

    const weather = (environment.weather || 'clear').toLowerCase();
    const validWeather = ['clear', 'rain', 'fog', 'snow', 'thunderstorm'];
    if (!validWeather.includes(weather)) {
      return res.status(400).json({ success: false, error: `Weather must be one of: ${validWeather.join(', ')}` });
    }

    const traffic = (environment.traffic || 'normal').toLowerCase();
    const validTraffic = ['normal', 'heavy', 'light'];
    if (!validTraffic.includes(traffic)) {
      return res.status(400).json({ success: false, error: `Traffic must be one of: ${validTraffic.join(', ')}` });
    }

    const processedSubsystems = [];

    // 2. Driver Telemetry & Fatigue Service
    const { driverState, breakNeeded: fatigueBreakNeeded } = evaluateDriverFatigue(fatigue);
    const continuousDrivingHours = Number(driver.continuousDrivingHours ?? 0);
    const isYawning = Boolean(driver.isYawning);
    const breakNeeded = fatigueBreakNeeded || continuousDrivingHours >= 2.5 || isYawning;

    const driverLogData = {
      userId,
      fatigueLevel: fatigue,
      eyeClosureStatus: driver.eyeClosureStatus || (fatigue > 75 ? 'Closed' : 'Open'),
      blinkCount: driver.blinkCount !== undefined ? Number(driver.blinkCount) : (fatigue > 70 ? 28 : 14),
      distractionStatus: driver.distractionStatus === 'distracted' ? 'Distracted' : 'Focused',
      driverState,
      breakNeeded,
      isSimulation: true,
      simulationId,
      timestamp: new Date()
    };

    let savedDriverStatus = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const newLog = new DriverStatus(driverLogData);
        savedDriverStatus = await newLog.save();
      } catch (err) {
        console.warn('MongoDB save warning for DriverStatus, using memory fallback:', err.message);
        savedDriverStatus = { _id: 'sim_ds_' + simulationId, ...driverLogData };
        inMemorySimulationStore.driverStatuses.push(savedDriverStatus);
      }
    } else {
      savedDriverStatus = { _id: 'sim_ds_' + simulationId, ...driverLogData };
      inMemorySimulationStore.driverStatuses.push(savedDriverStatus);
    }
    processedSubsystems.push('Driver Telemetry Service (POST /api/driver/fatigue)');

    // 3. Digital Twin Engine
    let twin = null;
    if (mongoose.connection.readyState === 1) {
      twin = await DigitalTwin.findOne({ tripId });
    }

    const defaultRange = vehicleType === 'EV' ? 350 : 600;
    const vehicleRange = Number(vehicle.range || defaultRange);
    const healthStatus = vehicle.healthStatus || 'good';
    const isFuelWarning = vehicleType === 'EV' ? fuelOrBat < 25 : fuelOrBat < 20;

    let computedRiskLevel = 'low';
    if (emergencySosActive || weather === 'thunderstorm' || healthStatus === 'critical') {
      computedRiskLevel = 'critical';
    } else if (['rain', 'fog', 'snow'].includes(weather) || traffic === 'heavy' || fatigue > 70 || isFuelWarning) {
      computedRiskLevel = 'medium';
    }

    const twinPayload = {
      tripId,
      driverTwin: {
        fatigueLevel: fatigue,
        distractionStatus: driver.distractionStatus === 'distracted' ? 'distracted' : 'focused',
        breakNeeded
      },
      vehicleTwin: {
        vehicleType,
        fuelOrBatteryLevel: fuelOrBat,
        range: vehicleRange,
        healthStatus,
        tripDistance: Number(trip.remainingDistance || 145),
        estimatedUsage: Number(trip.remainingDistance ? (trip.remainingDistance * 0.18).toFixed(1) : 25),
        fuelWarning: isFuelWarning
      },
      journeyTwin: {
        weather,
        traffic,
        riskLevel: computedRiskLevel,
        weatherRisk: weather === 'thunderstorm' ? 'critical' : (['rain', 'fog', 'snow'].includes(weather) ? 'medium' : 'low'),
        nextStop: breakNeeded ? 'Highway Rest Stop' : (isFuelWarning ? 'Fast Charging Station' : 'Destination')
      },
      isSimulation: true,
      simulationId,
      updatedAt: new Date()
    };

    if (twin) {
      twin.driverTwin = { ...twin.driverTwin.toObject(), ...twinPayload.driverTwin };
      twin.vehicleTwin = { ...twin.vehicleTwin.toObject(), ...twinPayload.vehicleTwin };
      twin.journeyTwin = { ...twin.journeyTwin.toObject(), ...twinPayload.journeyTwin };
      await twin.save();
    } else {
      try {
        twin = new DigitalTwin(twinPayload);
        await twin.save();
      } catch (err) {
        console.warn('Could not save DigitalTwin to MongoDB, using memory fallback:', err.message);
        twin = twinPayload;
      }
    }
    processedSubsystems.push('Digital Twin Studio Engine (/api/twin/update)');

    // 4. AI Agent Decision Engine
    let itinerary = null;
    if (mongoose.connection.readyState === 1) {
      itinerary = await Itinerary.findOne({ tripId });
    }
    if (!itinerary) {
      itinerary = {
        tripId,
        source: 'Bangalore',
        destination: 'Mysore',
        durationDays: 1,
        vehicleType
      };
    }

    const updatedAgents = evaluateAgents(twin, itinerary);
    if (mongoose.connection.readyState === 1) {
      try {
        await AgentRecommendation.findOneAndUpdate(
          { tripId },
          { tripId, agents: updatedAgents, isSimulation: true, simulationId },
          { new: true, upsert: true }
        );
      } catch (agentErr) {
        console.warn('Agent recommendation save fallback:', agentErr.message);
      }
    }
    processedSubsystems.push('AI Agent Grid Engine (evaluateAgents)');

    // 5. Vehicle Intelligence & Feasibility
    const distanceKm = Number(trip.remainingDistance || 145);
    const estimatedAvailableRange = (fuelOrBat / 100) * vehicleRange;
    const isTripPossible = estimatedAvailableRange >= distanceKm;
    const vehicleDiagnostics = {
      vehicleType,
      batteryOrFuelLevel: fuelOrBat,
      estimatedAvailableRange: Math.round(estimatedAvailableRange),
      distanceKm,
      isTripPossible,
      stopsRequired: isTripPossible ? 0 : Math.ceil((distanceKm - estimatedAvailableRange) / (vehicleRange * 0.8)),
      batteryHealthScore: vehicleType === 'EV' ? (fuelOrBat < 15 ? 78 : (healthStatus === 'critical' ? 62 : 94)) : null,
      healthStatus
    };
    processedSubsystems.push('Vehicle Intelligence & Diagnostics (Range / Energy Feasibility)');

    // 6. Emergency Safety Pathway (SIMULATED ONLY)
    let simulatedEmergencyAlert = null;
    const isEmergencyScenario = emergencySosActive || scenarioKey === 'emergency_sos_test' || healthStatus === 'critical' || fatigue > 80;

    if (isEmergencyScenario) {
      const emergencyData = {
        userId,
        driverName: `Driver [Simulation: ${userId}]`,
        emergencyContactName: 'DriveSentra Safety Desk',
        emergencyContactPhone: '+1-SIM-SAFE-911',
        emergencyContactEmail: 'simulated-safety@drivesentra.local',
        currentLocation: '12.9716, 77.5946 (Simulation Waypoint)',
        alertReason: `[SIMULATION ONLY] ${scenarioName}: Critical scenario triggered in controlled test sandbox.`,
        alertStatus: 'Simulated',
        isSimulation: true,
        simulationId,
        sentAt: new Date()
      };

      console.log(`\n=================== [SIMULATED EMERGENCY TRIGGER - NO REAL DISPATCH] ===================`);
      console.log(`[SIMULATION MODE] Simulation ID: ${simulationId}`);
      console.log(`[SIMULATION MODE] Reason: ${emergencyData.alertReason}`);
      console.log(`[SIMULATION MODE] Safeguard: All external SMS and Email notifications are strictly suppressed.`);
      console.log(`=========================================================================================\n`);

      if (mongoose.connection.readyState === 1) {
        try {
          const alertDoc = new EmergencyAlert(emergencyData);
          simulatedEmergencyAlert = await alertDoc.save();
        } catch (emErr) {
          simulatedEmergencyAlert = { _id: 'sim_ea_' + simulationId, ...emergencyData };
          inMemorySimulationStore.emergencyAlerts.push(simulatedEmergencyAlert);
        }
      } else {
        simulatedEmergencyAlert = { _id: 'sim_ea_' + simulationId, ...emergencyData };
        inMemorySimulationStore.emergencyAlerts.push(simulatedEmergencyAlert);
      }
      processedSubsystems.push('Emergency Alerts Service (Simulated Pathway - External Suppressed)');
    }

    // 7. Composite Risk Engine
    const riskAssessment = computeCompositeRisk({ driver, vehicle, environment, emergencySosActive });
    processedSubsystems.push('Composite Driver Risk Engine (calculateRisk)');

    // Record active simulation session in memory
    const simulationRecord = {
      simulationId,
      scenarioKey,
      scenarioName,
      status: 'active',
      startedAt: new Date(),
      tripId,
      userId,
      processedSubsystems,
      riskAssessment,
      driverStatus: savedDriverStatus,
      vehicleDiagnostics,
      simulatedEmergencyAlert
    };
    inMemorySimulationStore.activeRuns.set(simulationId, simulationRecord);

    return res.status(200).json({
      success: true,
      simulationId,
      scenarioKey,
      scenarioName,
      timestamp: new Date().toISOString(),
      isSimulation: true,
      processedSubsystems,
      data: {
        twin,
        agents: updatedAgents,
        driverStatus: savedDriverStatus,
        riskAssessment,
        vehicleDiagnostics,
        emergencyAlert: simulatedEmergencyAlert
      }
    });
  } catch (err) {
    console.error('Error in POST /api/simulation/run:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error executing simulation scenario' });
  }
});

// POST /api/simulation/reset - Reset simulation state back to nominal baseline
router.post('/reset', async (req, res) => {
  try {
    const { tripId = 'SIM_TRIP_ACTIVE', userId = 'driver_001', simulationId } = req.body;

    const nominalTwin = {
      tripId,
      driverTwin: { fatigueLevel: 15, distractionStatus: 'focused', breakNeeded: false },
      vehicleTwin: { vehicleType: 'EV', fuelOrBatteryLevel: 85, range: 350, healthStatus: 'good', tripDistance: 0, fuelWarning: false },
      journeyTwin: { weather: 'clear', traffic: 'normal', riskLevel: 'low', weatherRisk: 'low', nextStop: 'Highway Rest Area' },
      isSimulation: false,
      updatedAt: new Date()
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await DigitalTwin.findOneAndUpdate({ tripId }, nominalTwin, { upsert: true, new: true });
        // Clean up simulation-created driver and emergency records
        if (simulationId) {
          await DriverStatus.deleteMany({ simulationId, isSimulation: true });
          await EmergencyAlert.deleteMany({ simulationId, isSimulation: true });
        } else {
          await DriverStatus.deleteMany({ isSimulation: true, userId });
          await EmergencyAlert.deleteMany({ isSimulation: true, userId });
        }
      } catch (dbErr) {
        console.warn('Reset warning during DB cleanup:', dbErr.message);
      }
    }

    // Recalculate nominal agents
    const nominalAgents = evaluateAgents(nominalTwin, { tripId, source: 'Bangalore', destination: 'Mysore', durationDays: 1, vehicleType: 'EV' });
    if (mongoose.connection.readyState === 1) {
      try {
        await AgentRecommendation.findOneAndUpdate(
          { tripId },
          { tripId, agents: nominalAgents, isSimulation: false },
          { upsert: true, new: true }
        );
      } catch (recErr) {
        console.warn('Agent recommendation reset error:', recErr.message);
      }
    }

    // Clean in-memory simulation records
    if (simulationId) {
      inMemorySimulationStore.activeRuns.delete(simulationId);
    } else {
      inMemorySimulationStore.activeRuns.clear();
    }
    inMemorySimulationStore.driverStatuses = inMemorySimulationStore.driverStatuses.filter(s => s.userId !== userId);
    inMemorySimulationStore.emergencyAlerts = inMemorySimulationStore.emergencyAlerts.filter(a => a.userId !== userId);

    return res.status(200).json({
      success: true,
      message: 'Simulation scenario reset successfully. Nominal state restored across all subsystems.',
      data: {
        twin: nominalTwin,
        agents: nominalAgents,
        riskAssessment: {
          score: 15,
          level: 'Low',
          details: ['Nominal baseline state restored']
        }
      }
    });
  } catch (err) {
    console.error('Error in POST /api/simulation/reset:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error resetting simulation' });
  }
});

// GET /api/simulation/status - Retrieve current simulation status
router.get('/status', (req, res) => {
  try {
    const activeRuns = Array.from(inMemorySimulationStore.activeRuns.values());
    const latestRun = activeRuns.length > 0 ? activeRuns[activeRuns.length - 1] : null;

    return res.status(200).json({
      success: true,
      hasActiveSimulation: Boolean(latestRun),
      latestSimulation: latestRun
    });
  } catch (err) {
    console.error('Error in GET /api/simulation/status:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving simulation status' });
  }
});

export default router;
