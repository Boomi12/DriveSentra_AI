import assert from 'assert';
import {
  generateAccurateItinerary,
  calculateRoundTripMetrics,
  validateRoundTripItinerary,
  getRouteEstimatedDistanceKm
} from './utils/timePlanner.js';

console.log('====================================================');
console.log('🚀 DRIVESENTRA AI - ROUND TRIP VERIFICATION TEST SUITE');
console.log('====================================================\n');

let testsPassed = 0;
let testsTotal = 0;

async function runTest(name, fn) {
  testsTotal++;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
}

async function runSuite() {
  // ----------------------------------------------------
  // TEST A: One-day round trip (Bangalore -> Mysore -> Bangalore)
  // ----------------------------------------------------
  await runTest('TEST A: One-day round trip (Bangalore -> Mysore -> Bangalore)', async () => {
    const input = {
      source: 'Bangalore',
      destination: 'Mysore',
      durationDays: 1,
      tripMode: 'Round Trip',
      startTime: '08:00 AM',
      tripDate: '2026-10-20',
      vehicleType: 'EV',
      fuelOrBatteryLevel: 95,
      mileageOrRange: 350
    };

    const timeline = await generateAccurateItinerary(input);
    assert(Array.isArray(timeline), 'Timeline should be an array');
    assert(timeline.length >= 3, 'Timeline should have start, destination stops, and return arrival');

    const firstStop = timeline[0];
    const lastStop = timeline[timeline.length - 1];

    // 1. Starts at source
    assert(firstStop.place.includes('Bangalore'), `Trip should start at Bangalore, got: ${firstStop.place}`);
    assert.strictEqual(firstStop.purpose, 'Departure');
    assert.strictEqual(firstStop.day, 1, 'First stop should be on Day 1');

    // 2. Returns to exact departure location
    assert(lastStop.place.includes('Bangalore'), `Trip should end back at Bangalore, got: ${lastStop.place}`);
    assert.strictEqual(lastStop.purpose, 'Return Arrival');
    assert.strictEqual(lastStop.day, 1, 'One-day trip must return on Day 1');
    assert.strictEqual(lastStop.isReturnArrival, true);

    // 3. Round-trip metrics
    const metrics = calculateRoundTripMetrics(timeline, input.source, input.destination);
    assert(metrics.isFeasible, 'Trip should be marked feasible');
    assert(metrics.totalDistanceKm >= 280, `Expected round trip distance >= 280km, got ${metrics.totalDistanceKm}km`);
    assert(metrics.outwardDistanceKm > 100, `Expected outward distance > 100km, got ${metrics.outwardDistanceKm}km`);
    assert(metrics.returnDistanceKm > 100, `Expected return distance > 100km, got ${metrics.returnDistanceKm}km`);
    assert.strictEqual(metrics.finalReturnDay, 1, 'Final return day must be Day 1');

    // 4. Validate round trip itinerary
    const valResult = validateRoundTripItinerary(timeline, input);
    assert(valResult.valid, `Itinerary validation failed: ${valResult.errors.join('; ')}`);
  });

  // ----------------------------------------------------
  // TEST B: Two-day round trip with Day 1 overnight halt and Day 2 return
  // ----------------------------------------------------
  await runTest('TEST B: Two-day round trip (Bangalore -> Mysore -> Bangalore)', async () => {
    const input = {
      source: 'Bangalore',
      destination: 'Mysore',
      durationDays: 2,
      tripMode: 'Round Trip',
      startTime: '08:00 AM',
      tripDate: '2026-10-20',
      vehicleType: 'EV',
      fuelOrBatteryLevel: 90,
      mileageOrRange: 350
    };

    const timeline = await generateAccurateItinerary(input);
    assert(Array.isArray(timeline), 'Timeline should be an array');

    const firstStop = timeline[0];
    const lastStop = timeline[timeline.length - 1];

    // 1. Starts at departure location
    assert(firstStop.place.includes('Bangalore'), 'Trip should start at Bangalore');
    assert.strictEqual(firstStop.day, 1, 'First stop must be Day 1');

    // 2. Contains explicit overnight stay on Day 1
    const overnightStop = timeline.find(item => item.day === 1 && (item.purpose === 'Overnight Stay' || item.isOvernight));
    assert(overnightStop, 'Day 1 must contain an explicit overnight stay');
    assert(overnightStop.place.includes('Hotel') || overnightStop.place.includes('Resort') || overnightStop.purpose === 'Overnight Stay');

    // 3. Day 2 activities and final return to departure origin on Day 2
    const day2Stops = timeline.filter(item => item.day === 2);
    assert(day2Stops.length >= 2, 'Day 2 must contain checkout/activities and return journey');

    assert(lastStop.place.includes('Bangalore'), `Final stop must be Bangalore, got: ${lastStop.place}`);
    assert.strictEqual(lastStop.purpose, 'Return Arrival');
    assert.strictEqual(lastStop.day, 2, 'Two-day trip must return on Day 2');

    // 4. Validate round trip itinerary
    const valResult = validateRoundTripItinerary(timeline, input);
    assert(valResult.valid, `Itinerary validation failed: ${valResult.errors.join('; ')}`);
  });

  // ----------------------------------------------------
  // TEST C: Infeasible Trip (Bangalore to Ooty in 1 day)
  // ----------------------------------------------------
  await runTest('TEST C: Infeasible Trip constraint detection (Bangalore -> Ooty in 1 Day)', async () => {
    const input = {
      source: 'Bangalore',
      destination: 'Ooty',
      durationDays: 1,
      tripMode: 'Round Trip',
      startTime: '08:00 AM',
      tripDate: '2026-10-20',
      vehicleType: 'Petrol',
      fuelOrBatteryLevel: 100,
      mileageOrRange: 500
    };

    const result = await generateAccurateItinerary(input);
    assert.strictEqual(result.isFeasible, false, '1-day round trip to Ooty (~550km, >12h driving) must be infeasible');
    assert(result.reason && result.reason.length > 0, 'Must provide clear constraint explanation');
    assert(Array.isArray(result.alternatives) && result.alternatives.length > 0, 'Must offer actionable alternatives');
    assert(result.alternatives.some(alt => alt.toLowerCase().includes('2 day') || alt.toLowerCase().includes('closer')), 'Alternatives must suggest 2 days or closer destination');
  });

  // ----------------------------------------------------
  // TEST D: Different Overnight Location (Day 1 halt != Destination)
  // ----------------------------------------------------
  await runTest('TEST D: Different overnight location (Overnight halt at Srirangapatna)', async () => {
    const input = {
      source: 'Bangalore',
      destination: 'Mysore',
      overnightHalt: 'Srirangapatna Heritage River Resort',
      durationDays: 2,
      tripMode: 'Round Trip',
      startTime: '08:00 AM',
      tripDate: '2026-10-20',
      vehicleType: 'EV',
      fuelOrBatteryLevel: 90,
      mileageOrRange: 350
    };

    const timeline = await generateAccurateItinerary(input);
    assert(Array.isArray(timeline), 'Timeline should be an array');

    // Day 1 overnight halt should be at Srirangapatna
    const day1Overnight = timeline.find(item => item.day === 1 && (item.purpose === 'Overnight Stay' || item.isOvernight));
    assert(day1Overnight, 'Must have overnight halt on Day 1');
    assert(day1Overnight.place.includes('Srirangapatna'), `Overnight halt should be Srirangapatna, got: ${day1Overnight.place}`);

    // Day 2 should resume and return to Bangalore
    const lastStop = timeline[timeline.length - 1];
    assert(lastStop.place.includes('Bangalore'), 'Final stop must be Bangalore');
    assert.strictEqual(lastStop.day, 2, 'Must return on Day 2');

    const valResult = validateRoundTripItinerary(timeline, input);
    assert(valResult.valid, `Validation failed: ${valResult.errors.join('; ')}`);
  });

  // ----------------------------------------------------
  // TEST E: Vehicle-aware planning (EV fast charging stops when battery depleted)
  // ----------------------------------------------------
  await runTest('TEST E: Vehicle-aware EV planning (Charging stops inserted along route)', async () => {
    const input = {
      source: 'Bangalore',
      destination: 'Mysore',
      durationDays: 1,
      tripMode: 'Round Trip',
      startTime: '07:30 AM',
      tripDate: '2026-10-20',
      vehicleType: 'EV',
      fuelOrBatteryLevel: 30, // Low initial charge (30% of 250km = 75km range, trip is 290km)
      mileageOrRange: 250
    };

    const timeline = await generateAccurateItinerary(input);
    assert(Array.isArray(timeline), 'Timeline should be an array');

    // Check that EV charging stop is included
    const chargingStops = timeline.filter(item => 
      item.purpose === 'EV Fast Charging' || 
      item.purpose === 'Refuel / Charge' || 
      (item.place && item.place.toLowerCase().includes('charger')) ||
      (item.place && item.place.toLowerCase().includes('charging'))
    );

    assert(chargingStops.length >= 1, 'Timeline must include at least one EV charging stop for low range EV');
    assert(chargingStops[0].duration >= 30, 'EV Fast charging duration should be at least 30 minutes');

    // Must still return to Bangalore on Day 1
    const lastStop = timeline[timeline.length - 1];
    assert(lastStop.place.includes('Bangalore'), 'Must return to Bangalore');
    assert.strictEqual(lastStop.day, 1, 'Must return on Day 1');
  });

  // ----------------------------------------------------
  // TEST F: Regression & bidirectional distance calculation check
  // ----------------------------------------------------
  await runTest('TEST F: Regression & Bidirectional Distance Calculation', async () => {
    const dForward = getRouteEstimatedDistanceKm('Bangalore', 'Mysore');
    const dReverse = getRouteEstimatedDistanceKm('Mysore', 'Bangalore');

    assert.strictEqual(dForward, 145, 'Bangalore to Mysore road corridor distance should be 145 km');
    assert.strictEqual(dReverse, 145, 'Mysore to Bangalore road corridor distance should be 145 km (bidirectional)');

    const dOoty = getRouteEstimatedDistanceKm('Bangalore', 'Ooty');
    assert.strictEqual(dOoty, 275, 'Bangalore to Ooty road corridor distance should be 275 km');
  });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${testsPassed} / ${testsTotal} tests passed`);
  console.log('====================================================');

  if (testsPassed === testsTotal) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSuite();
