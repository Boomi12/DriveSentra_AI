import express from 'express';
import simulationRouter from './routes/simulation.js';
import driverRouter from './routes/driver.js';
import twinRouter from './routes/twin.js';
import agentsRouter from './routes/agents.js';
import emergencyRouter from './routes/emergency.js';

const app = express();
app.use(express.json());
app.use('/api/simulation', simulationRouter);
app.use('/api/driver', driverRouter);
app.use('/api/twin', twinRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/emergency', emergencyRouter);

const PORT = 5088;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runSimulationTests() {
  console.log('====================================================');
  console.log('🚀 DRIVESENTRA AI - SCENARIO SIMULATOR ACCEPTANCE SUITE');
  console.log('====================================================\n');

  const server = app.listen(PORT, async () => {
    try {
      // TEST 1: Normal Driving Scenario
      console.log('--- TEST 1: Normal Driving Scenario ---');
      const normalRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'normal_driving',
          scenarioName: 'Normal Driving',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_norm',
          driver: { fatigueLevel: 15, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 14, continuousDrivingHours: 0.5 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 85, speed: 75, range: 350, healthStatus: 'good' },
          environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
          trip: { remainingDistance: 120, estimatedTravelTime: 1.6 },
          emergencySosActive: false
        })
      });
      assert(normalRes.status === 200, 'Normal driving endpoint returned HTTP 200');
      const normalData = await normalRes.json();
      assert(normalData.success === true, 'Simulation run returned success: true');
      assert(normalData.data.driverStatus.driverState === 'Safe', 'Driver state is Safe');
      assert(normalData.data.riskAssessment.level === 'Low', 'Risk level is Low');
      assert(normalData.data.agents.safetyAgent.status === 'Optimal', 'Safety Agent reports Optimal');
      assert(normalData.data.emergencyAlert === null, 'Emergency alert is not triggered for normal driving');

      // TEST 2: Driver Fatigue Warning & Critical Paths
      console.log('\n--- TEST 2: Driver Fatigue Scenarios (Warning & Critical) ---');
      // 2A: Warning path (75% fatigue)
      const fatigueWarnRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'driver_fatigue_warn',
          scenarioName: 'Fatigue Warning',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_fatigue',
          driver: { fatigueLevel: 75, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 22, continuousDrivingHours: 2.0 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 70, speed: 65, range: 280, healthStatus: 'good' },
          environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' }
        })
      });
      const fatigueWarnData = await fatigueWarnRes.json();
      assert(fatigueWarnData.data.driverStatus.driverState === 'Warning', 'Driver state is Warning at 75% fatigue');
      assert(fatigueWarnData.data.driverStatus.breakNeeded === true, 'Break is mandated at 75% fatigue');
      assert(fatigueWarnData.data.agents.safetyAgent.status === 'Warning', 'Safety Agent reports Warning');

      // 2B: Critical path (85% fatigue)
      const fatigueCritRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'driver_fatigue_crit',
          scenarioName: 'Fatigue Critical',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_fatigue',
          driver: { fatigueLevel: 85, distractionStatus: 'focused', eyeClosureStatus: 'Closed', isYawning: true, blinkCount: 30, continuousDrivingHours: 3.5 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 60, speed: 50, range: 240, healthStatus: 'good' },
          environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' }
        })
      });
      const fatigueCritData = await fatigueCritRes.json();
      assert(fatigueCritData.data.driverStatus.driverState === 'Critical', 'Driver state is Critical at 85% fatigue');
      assert(fatigueCritData.data.riskAssessment.score >= 45, 'Composite risk score elevated on high fatigue (>=45)');
      assert(fatigueCritData.data.emergencyAlert !== null, 'Simulated emergency alert logged on critical fatigue');
      assert(fatigueCritData.data.emergencyAlert.alertStatus === 'Simulated', 'Emergency alert marked explicitly as Simulated');

      // TEST 3: Distracted Driving & Yawning
      console.log('\n--- TEST 3: Distraction & Yawning Telemetry ---');
      const distractRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'distracted_driving',
          scenarioName: 'Distracted Driving',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_distract',
          driver: { fatigueLevel: 30, distractionStatus: 'distracted', eyeClosureStatus: 'Open', isYawning: true, blinkCount: 18, continuousDrivingHours: 1.0 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 75, speed: 70, range: 300, healthStatus: 'good' },
          environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' }
        })
      });
      const distractData = await distractRes.json();
      assert(distractData.data.driverStatus.distractionStatus === 'Distracted', 'Driver distraction status recorded as Distracted');
      assert(distractData.data.agents.safetyAgent.recommendation.includes('distraction'), 'Safety Agent issued distraction alert recommendation');

      // TEST 4: Heavy Rain & Traffic Bypass
      console.log('\n--- TEST 4: Heavy Rain & Traffic Congestion ---');
      const rainRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'heavy_rain_traffic',
          scenarioName: 'Heavy Rain & Traffic',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_env',
          driver: { fatigueLevel: 25, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 14, continuousDrivingHours: 1.0 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 65, speed: 45, range: 260, healthStatus: 'good' },
          environment: { weather: 'rain', traffic: 'heavy', roadCondition: 'wet', visibility: 'moderate' }
        })
      });
      const rainData = await rainRes.json();
      assert(rainData.data.twin.journeyTwin.weather === 'rain', 'Journey twin recorded rain weather');
      assert(rainData.data.twin.journeyTwin.traffic === 'heavy', 'Journey twin recorded heavy traffic');
      assert(rainData.data.agents.routeAgent.status === 'Alert', 'Route Agent activated Alert state on heavy traffic');

      // TEST 5: Severe Thunderstorm Weather
      console.log('\n--- TEST 5: Severe Weather & Thunderstorm ---');
      const stormRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'severe_weather_thunderstorm',
          scenarioName: 'Severe Weather',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_storm',
          driver: { fatigueLevel: 40, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 16, continuousDrivingHours: 1.5 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 55, speed: 35, range: 220, healthStatus: 'good' },
          environment: { weather: 'thunderstorm', traffic: 'normal', roadCondition: 'flooded', visibility: 'poor' }
        })
      });
      const stormData = await stormRes.json();
      assert(stormData.data.twin.journeyTwin.riskLevel === 'critical', 'Adverse thunderstorm auto-escalates journey risk to critical');
      assert(stormData.data.agents.routeAgent.status === 'Critical', 'Route Agent reports Critical on thunderstorm');
      assert(stormData.data.agents.emergencyAgent.status === 'Danger', 'Emergency Agent escalated to Danger on critical journey risk');

      // TEST 6: Critical Low EV Battery (<15%) & Petrol Fuel (<12%)
      console.log('\n--- TEST 6: Critical Low Energy Feasibility ---');
      // 6A: EV Battery
      const evLowRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'low_ev_battery',
          scenarioName: 'Critical EV Battery',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_ev',
          driver: { fatigueLevel: 20, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 14, continuousDrivingHours: 0.8 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 14, speed: 55, range: 45, healthStatus: 'warning' },
          environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
          trip: { remainingDistance: 95 }
        })
      });
      const evLowData = await evLowRes.json();
      assert(evLowData.data.twin.vehicleTwin.fuelWarning === true, 'Vehicle twin triggered fuelWarning on battery < 25%');
      assert(evLowData.data.agents.fuelEvAgent.status === 'Critical' || evLowData.data.agents.fuelEvAgent.status === 'Warning', 'Fuel/EV Agent flagged battery deficit');
      assert(evLowData.data.vehicleDiagnostics.isTripPossible === false, 'Vehicle diagnostics flags trip as impossible without charging stops');

      // 6B: Petrol Fuel
      const petrolLowRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'low_fuel_petrol',
          scenarioName: 'Low Petrol Fuel',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_petrol',
          driver: { fatigueLevel: 20, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 14, continuousDrivingHours: 0.8 },
          vehicle: { vehicleType: 'Petrol', fuelOrBatteryLevel: 10, speed: 65, range: 50, healthStatus: 'warning' },
          environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' },
          trip: { remainingDistance: 120 }
        })
      });
      const petrolLowData = await petrolLowRes.json();
      assert(petrolLowData.data.twin.vehicleTwin.fuelWarning === true, 'Petrol fuel warning active below 20%');

      // TEST 7: Long Continuous Drive Rest Break Requirement
      console.log('\n--- TEST 7: Continuous Driving Rest-Break Requirement ---');
      const longDriveRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'long_continuous_drive',
          scenarioName: 'Continuous Driving',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_long',
          driver: { fatigueLevel: 55, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 18, continuousDrivingHours: 4.2 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 60, speed: 70, range: 240, healthStatus: 'good' },
          environment: { weather: 'clear', traffic: 'normal', roadCondition: 'dry', visibility: 'good' }
        })
      });
      const longDriveData = await longDriveRes.json();
      assert(longDriveData.data.driverStatus.breakNeeded === true, 'Continuous driving >= 2.5 hrs mandates rest break');
      assert(longDriveData.data.twin.journeyTwin.nextStop.includes('Rest'), 'Digital twin next stop routed to rest stop');

      // TEST 8: Vehicle Breakdown (Critical Health)
      console.log('\n--- TEST 8: Vehicle Breakdown (Critical Health) ---');
      const breakdownRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'vehicle_breakdown',
          scenarioName: 'Vehicle Breakdown',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_breakdown',
          driver: { fatigueLevel: 30, distractionStatus: 'focused', eyeClosureStatus: 'Open', isYawning: false, blinkCount: 14, continuousDrivingHours: 1.0 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 50, speed: 0, range: 0, healthStatus: 'critical' },
          environment: { weather: 'clear', traffic: 'light', roadCondition: 'dry', visibility: 'good' }
        })
      });
      const breakdownData = await breakdownRes.json();
      assert(breakdownData.data.twin.vehicleTwin.healthStatus === 'critical', 'Vehicle health recorded as critical');
      assert(breakdownData.data.agents.emergencyAgent.status === 'Danger', 'Emergency Agent triggered Danger protocol on vehicle fault');

      // TEST 9: Emergency SOS Safe Simulation Pathway
      console.log('\n--- TEST 9: Emergency SOS Safe Simulation Pathway ---');
      const sosRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioKey: 'emergency_sos_test',
          scenarioName: 'Emergency SOS Test',
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_sos',
          driver: { fatigueLevel: 88, distractionStatus: 'distracted', eyeClosureStatus: 'Closed', isYawning: true, blinkCount: 30, continuousDrivingHours: 4.0 },
          vehicle: { vehicleType: 'EV', fuelOrBatteryLevel: 20, speed: 0, range: 70, healthStatus: 'critical' },
          environment: { weather: 'fog', traffic: 'heavy', roadCondition: 'wet', visibility: 'poor' },
          emergencySosActive: true
        })
      });
      const sosData = await sosRes.json();
      assert(sosData.data.riskAssessment.score === 98, 'Active SOS distress beacon sets risk score to 98');
      assert(sosData.data.emergencyAlert !== null, 'Emergency alert record created');
      assert(sosData.data.emergencyAlert.isSimulation === true, 'Emergency alert explicitly flagged isSimulation: true');
      assert(sosData.data.emergencyAlert.alertStatus === 'Simulated', 'Alert status marked as Simulated (no real notifications sent)');

      // TEST 10: Server-side Validations on Invalid Inputs
      console.log('\n--- TEST 10: Input Validation & Edge Case Rejections ---');
      // Invalid fatigue (>100)
      const invalidFatigueRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver: { fatigueLevel: 150 }
        })
      });
      assert(invalidFatigueRes.status === 400, 'Rejects invalid fatigue > 100 with HTTP 400');

      // Invalid vehicle type
      const invalidVehicleRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle: { vehicleType: 'Rocket' }
        })
      });
      assert(invalidVehicleRes.status === 400, 'Rejects invalid vehicleType with HTTP 400');

      // Invalid weather
      const invalidWeatherRes = await fetch(`${BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: { weather: 'MeteorShower' }
        })
      });
      assert(invalidWeatherRes.status === 400, 'Rejects invalid weather with HTTP 400');

      // TEST 11: Reset Simulation & Clean Baseline
      console.log('\n--- TEST 11: Simulation Reset & Cleanup ---');
      const resetRes = await fetch(`${BASE_URL}/simulation/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: 'SIM_TEST_TRIP_01',
          userId: 'test_driver_sos'
        })
      });
      assert(resetRes.status === 200, 'Reset endpoint returned HTTP 200');
      const resetData = await resetRes.json();
      assert(resetData.success === true, 'Reset returned success: true');
      assert(resetData.data.twin.driverTwin.fatigueLevel === 15, 'Reset restored nominal fatigue to 15%');
      assert(resetData.data.twin.driverTwin.breakNeeded === false, 'Reset restored breakNeeded to false');
      assert(resetData.data.riskAssessment.score === 15, 'Reset restored nominal risk score to 15');
      assert(resetData.data.agents.safetyAgent.status === 'Optimal', 'Reset restored Safety Agent to Optimal');

      console.log('\n====================================================');
      console.log(`🏁 SIMULATION TEST SUITE: ${passedCount}/${totalCount} TESTS PASSED`);
      console.log('====================================================');
    } catch (err) {
      console.error('Test run failed with error:', err);
    } finally {
      server.close();
    }
  });
}

runSimulationTests();
