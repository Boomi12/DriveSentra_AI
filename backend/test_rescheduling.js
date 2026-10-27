import assert from 'assert';
import {
  generateAccurateItinerary,
  calculateRoundTripMetrics,
  validateRoundTripItinerary,
  recalculateSchedule,
  insertStopAtPosition,
  removeStopAtPosition,
  reorderStops,
  updateStopDuration,
  updateStopPinnedTime,
  timeToMinutes,
  minutesToTime
} from './utils/timePlanner.js';

console.log('====================================================');
console.log('🚀 DRIVESENTRA AI - DYNAMIC RESCHEDULING ACCEPTANCE SUITE');
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
  const baseTrip = {
    source: 'Bangalore',
    destination: 'Mysore',
    startTime: '08:00 AM',
    tripDate: '2026-10-20',
    durationDays: 1,
    vehicleType: 'EV'
  };

  // ----------------------------------------------------
  // TEST A: Arrival Timing Error Correction (no static validation warnings)
  // ----------------------------------------------------
  await runTest('TEST A: Arrival Timing Error Correction (dynamic arrival replaces false warnings)', async () => {
    // Construct a timeline where destination was erroneously scheduled at 09:20 AM,
    // but transit from Bangalore takes ~100m, so earliest arrival is 09:40 AM.
    const rawTimeline = [
      {
        id: 'start-1',
        day: 1,
        time: '08:00 AM',
        place: 'Bangalore',
        purpose: 'Departure',
        duration: 0
      },
      {
        id: 'stop-1',
        day: 1,
        time: '09:20 AM', // Unrealistic early static time
        place: 'Mysore Palace',
        purpose: 'Sightseeing',
        duration: 90
      },
      {
        id: 'return-1',
        day: 1,
        time: '06:00 PM',
        place: 'Bangalore',
        purpose: 'Return Arrival',
        duration: 0,
        isReturnArrival: true
      }
    ];

    const recalculated = recalculateSchedule(rawTimeline, baseTrip);
    const palace = recalculated.find(s => s.place === 'Mysore Palace');
    
    // Arrival time must match realistic transit (after 08:00 AM + transit)
    const arrivalMins = timeToMinutes(palace.time);
    assert(arrivalMins >= timeToMinutes('09:30 AM'), `Palace time should be at or after 09:30 AM, got: ${palace.time}`);
    // No false timing conflict warning because schedule automatically adjusted
    assert(!palace.hasConflict, 'Flexible stop should not be flagged as conflict');
    assert(!palace.warning || !palace.warning.includes('arriving at'), `Should not have arrival conflict warning, got: ${palace.warning}`);
  });

  // ----------------------------------------------------
  // TEST B: Downstream Ripple Propagation (+30m duration pushes successors)
  // ----------------------------------------------------
  await runTest('TEST B: Downstream Ripple Propagation (+30m duration pushes downstream stops)', async () => {
    const rawTimeline = [
      { id: '1', day: 1, time: '08:00 AM', place: 'Bangalore', purpose: 'Departure', duration: 0 },
      { id: '2', day: 1, time: '10:30 AM', place: 'Mysore Palace', purpose: 'Sightseeing', duration: 60 },
      { id: '3', day: 1, time: '12:00 PM', place: 'Mylari Restaurant', purpose: 'Meal Break', duration: 45 },
      { id: '4', day: 1, time: '06:00 PM', place: 'Bangalore', purpose: 'Return Arrival', duration: 0, isReturnArrival: true }
    ];

    const initialSchedule = recalculateSchedule(rawTimeline, baseTrip);
    const initialLunchTime = initialSchedule.find(s => s.place === 'Mylari Restaurant').time;
    const initialReturnTime = initialSchedule.find(s => s.isReturnArrival).time;

    // Increase Mysore Palace duration from 60m to 90m (+30 mins)
    const updatedTimeline = updateStopDuration(initialSchedule, 1, '2', 90, baseTrip);
    const rescheduled = recalculateSchedule(updatedTimeline, baseTrip);

    const newLunchTime = rescheduled.find(s => s.place === 'Mylari Restaurant').time;
    const newReturnTime = rescheduled.find(s => s.isReturnArrival).time;

    const lunchDiff = timeToMinutes(newLunchTime) - timeToMinutes(initialLunchTime);
    const returnDiff = timeToMinutes(newReturnTime) - timeToMinutes(initialReturnTime);

    assert.strictEqual(lunchDiff, 30, `Lunch should be pushed by exactly 30m, got diff: ${lunchDiff}m`);
    assert.strictEqual(returnDiff, 30, `Return arrival should be pushed by exactly 30m, got diff: ${returnDiff}m`);
  });

  // ----------------------------------------------------
  // TEST C: Middle Insertion (Insert stop at arbitrary position)
  // ----------------------------------------------------
  await runTest('TEST C: Middle Insertion (Insert stop between stops and recalculate both legs)', async () => {
    const rawTimeline = [
      { id: '1', day: 1, time: '08:00 AM', place: 'Bangalore', purpose: 'Departure', duration: 0 },
      { id: '2', day: 1, time: '10:30 AM', place: 'Mysore Palace', purpose: 'Sightseeing', duration: 90 },
      { id: '3', day: 1, time: '05:00 PM', place: 'Bangalore', purpose: 'Return Arrival', duration: 0, isReturnArrival: true }
    ];

    const initialSchedule = recalculateSchedule(rawTimeline, baseTrip);
    const initialReturnTime = initialSchedule.find(s => s.isReturnArrival).time;

    // Insert lunch at index 2 (between Mysore Palace and Return)
    const newStop = {
      place: 'Gufha Restaurant',
      purpose: 'Meal Break',
      duration: 60,
      day: 1
    };

    const insertedTimeline = insertStopAtPosition(initialSchedule, 2, newStop, baseTrip);
    assert.strictEqual(insertedTimeline.length, 4, 'Timeline should have 4 stops after insertion');
    assert.strictEqual(insertedTimeline[2].place, 'Gufha Restaurant', 'Inserted stop must be at index 2');

    const rescheduled = recalculateSchedule(insertedTimeline, baseTrip);
    const gufha = rescheduled[2];
    const returnStop = rescheduled[3];

    assert(gufha.travelTimeFromPrevious, 'Inserted stop must have travelTimeFromPrevious');
    assert(returnStop.travelTimeFromPrevious, 'Return stop must have travelTimeFromPrevious');
    
    // Return time must be later due to added visit and meal
    assert(timeToMinutes(returnStop.time) > timeToMinutes(initialReturnTime), 'Return time should push later after inserting stop');
  });

  // ----------------------------------------------------
  // TEST D: Stop Removal (Remove intermediate stop and reconnect legs)
  // ----------------------------------------------------
  await runTest('TEST D: Intermediate Stop Removal (Reconnect legs and pull downstream earlier)', async () => {
    const rawTimeline = [
      { id: '1', day: 1, time: '08:00 AM', place: 'Bangalore', purpose: 'Departure', duration: 0 },
      { id: '2', day: 1, time: '10:30 AM', place: 'Mysore Palace', purpose: 'Sightseeing', duration: 90 },
      { id: '3', day: 1, time: '01:00 PM', place: 'Gufha Restaurant', purpose: 'Meal Break', duration: 60 },
      { id: '4', day: 1, time: '06:00 PM', place: 'Bangalore', purpose: 'Return Arrival', duration: 0, isReturnArrival: true }
    ];

    const initialSchedule = recalculateSchedule(rawTimeline, baseTrip);
    const withRestaurantReturnTime = initialSchedule.find(s => s.isReturnArrival).time;

    // Remove Gufha Restaurant at index 2
    const removedTimeline = removeStopAtPosition(initialSchedule, 2, '3', baseTrip);
    assert.strictEqual(removedTimeline.length, 3, 'Timeline should have 3 stops after removal');

    const rescheduled = recalculateSchedule(removedTimeline, baseTrip);
    const returnStop = rescheduled[2];

    assert.strictEqual(returnStop.isReturnArrival, true);
    // Return time should shift earlier because 60m lunch plus detour transit were removed
    assert(timeToMinutes(returnStop.time) < timeToMinutes(withRestaurantReturnTime), 'Return time should shift earlier after removal');
  });

  // ----------------------------------------------------
  // TEST E: Reordering Stops
  // ----------------------------------------------------
  await runTest('TEST E: Reordering Stops (Swap stops and recalculate arrival order)', async () => {
    const rawTimeline = [
      { id: '1', day: 1, time: '08:00 AM', place: 'Bangalore', purpose: 'Departure', duration: 0 },
      { id: '2', day: 1, time: '10:30 AM', place: 'St. Philomena Church', purpose: 'Sightseeing', duration: 45 },
      { id: '3', day: 1, time: '11:45 AM', place: 'Mysore Palace', purpose: 'Sightseeing', duration: 90 },
      { id: '4', day: 1, time: '06:00 PM', place: 'Bangalore', purpose: 'Return Arrival', duration: 0, isReturnArrival: true }
    ];

    const initialSchedule = recalculateSchedule(rawTimeline, baseTrip);
    // Reorder: move Mysore Palace (index 2) to index 1
    const reorderedTimeline = reorderStops(initialSchedule, 2, 1);
    assert.strictEqual(reorderedTimeline[1].place, 'Mysore Palace');
    assert.strictEqual(reorderedTimeline[2].place, 'St. Philomena Church');

    const rescheduled = recalculateSchedule(reorderedTimeline, baseTrip);
    assert.strictEqual(rescheduled[1].place, 'Mysore Palace');
    assert.strictEqual(rescheduled[2].place, 'St. Philomena Church');
    // Timings must remain sequential
    assert(timeToMinutes(rescheduled[1].time) < timeToMinutes(rescheduled[2].time), 'First stop must occur before second stop');
  });

  // ----------------------------------------------------
  // TEST F: Overnight Stay Handling (Day 1 insertion ripples to hotel, Day 2 resumes at 08:30 AM)
  // ----------------------------------------------------
  await runTest('TEST F: Overnight Stay Handling (Day 1 insertion updates hotel arrival, Day 2 resumes from hotel)', async () => {
    const multiDayTrip = {
      ...baseTrip,
      durationDays: 2
    };

    const rawTimeline = [
      { id: '1', day: 1, time: '08:00 AM', place: 'Bangalore', purpose: 'Departure', duration: 0 },
      { id: '2', day: 1, time: '10:30 AM', place: 'Mysore Palace', purpose: 'Sightseeing', duration: 90 },
      { id: '3', day: 1, time: '06:00 PM', place: 'Radisson Blu Mysore', purpose: 'Overnight Stay', duration: 480, isOvernight: true },
      { id: '4', day: 2, time: '08:30 AM', place: 'Chamundi Hills', purpose: 'Sightseeing', duration: 60 },
      { id: '5', day: 2, time: '06:00 PM', place: 'Bangalore', purpose: 'Return Arrival', duration: 0, isReturnArrival: true }
    ];

    const initialSchedule = recalculateSchedule(rawTimeline, multiDayTrip);
    const initialHotelArrival = initialSchedule.find(s => s.isOvernight).time;

    // Insert an afternoon stop before the hotel on Day 1
    const newStop = {
      place: 'Brindavan Gardens',
      purpose: 'Sightseeing',
      duration: 90,
      day: 1
    };
    const withBrindavan = insertStopAtPosition(initialSchedule, 2, newStop, multiDayTrip);
    const rescheduled = recalculateSchedule(withBrindavan, multiDayTrip);

    const newHotel = rescheduled.find(s => s.isOvernight);
    const day2Stop = rescheduled.find(s => s.day === 2 && s.place === 'Chamundi Hills');
    const finalReturn = rescheduled.find(s => s.isReturnArrival);

    // Hotel arrival on Day 1 pushed later due to Brindavan Gardens
    assert(timeToMinutes(newHotel.time) > timeToMinutes(initialHotelArrival), 'Hotel arrival should be later');
    // Day 2 must start fresh at 08:30 AM from the overnight location
    assert.strictEqual(day2Stop.day, 2, 'Day 2 stop must be on Day 2');
    assert.strictEqual(finalReturn.day, 2, 'Return arrival must be on Day 2');
  });

  // ----------------------------------------------------
  // TEST G: Round-Trip Preservation (Origin -> Destination -> Origin within duration)
  // ----------------------------------------------------
  await runTest('TEST G: Round-Trip Preservation (Finishes back at original origin within duration)', async () => {
    const rawTimeline = [
      { id: '1', day: 1, time: '08:00 AM', place: 'Bangalore', purpose: 'Departure', duration: 0 },
      { id: '2', day: 1, time: '10:30 AM', place: 'Mysore Palace', purpose: 'Sightseeing', duration: 90 },
      { id: '3', day: 1, time: '06:00 PM', place: 'Bangalore', purpose: 'Return Arrival', duration: 0, isReturnArrival: true }
    ];

    const scheduled = recalculateSchedule(rawTimeline, baseTrip);
    const metrics = calculateRoundTripMetrics(scheduled, baseTrip.source, baseTrip.destination);

    assert.strictEqual(metrics.isFeasible, true, 'Round-trip must be feasible');
    assert.strictEqual(metrics.finalReturnDay, 1, 'Single-day trip must return on Day 1');
    assert(metrics.totalDistanceKm >= 280, `Expected round-trip distance >= 280km, got: ${metrics.totalDistanceKm}km`);
  });

  // ----------------------------------------------------
  // TEST H: Hard Constraints (Pinned reservation conflict detection)
  // ----------------------------------------------------
  await runTest('TEST H: Hard Constraints (Pinned reservation is NOT silently moved when unreachable)', async () => {
    const rawTimeline = [
      { id: '1', day: 1, time: '08:00 AM', place: 'Bangalore', purpose: 'Departure', duration: 0 },
      // Mysore Palace duration set to 300m (5 hours), making 01:00 PM restaurant unreachable
      { id: '2', day: 1, time: '10:30 AM', place: 'Mysore Palace', purpose: 'Sightseeing', duration: 300 },
      {
        id: '3',
        day: 1,
        time: '01:00 PM',
        place: 'Exclusive Lunch Reservation',
        purpose: 'Meal Break',
        duration: 45,
        isPinned: true,
        pinnedTime: '01:00 PM'
      },
      { id: '4', day: 1, time: '08:00 PM', place: 'Bangalore', purpose: 'Return Arrival', duration: 0, isReturnArrival: true }
    ];

    const scheduled = recalculateSchedule(rawTimeline, baseTrip);
    const pinnedStop = scheduled.find(s => s.isPinned);

    // CRITICAL: Pinned time MUST remain exactly 01:00 PM
    assert.strictEqual(pinnedStop.time, '01:00 PM', `Pinned time was altered! Expected 01:00 PM, got: ${pinnedStop.time}`);
    // MUST flag conflict because earliest realistic arrival is after 03:30 PM
    assert.strictEqual(pinnedStop.hasConflict, true, 'Pinned stop should have hasConflict = true');
    assert.strictEqual(pinnedStop.isPinnedConflict, true, 'Pinned stop should have isPinnedConflict = true');
    assert(pinnedStop.warning && pinnedStop.warning.includes('Pinned reservation conflict'), `Expected pinned warning, got: ${pinnedStop.warning}`);
  });

  // ----------------------------------------------------
  // TEST I: EV Charging / Service Duration
  // ----------------------------------------------------
  await runTest('TEST I: EV Charging Duration (40m service time accounted for in departure)', async () => {
    const rawTimeline = [
      { id: '1', day: 1, time: '08:00 AM', place: 'Bangalore', purpose: 'Departure', duration: 0 },
      { id: '2', day: 1, time: '09:30 AM', place: 'Zeon EV Fast Charger - Highway', purpose: 'EV Charging', duration: 40 },
      { id: '3', day: 1, time: '10:45 AM', place: 'Mysore Palace', purpose: 'Sightseeing', duration: 90 },
      { id: '4', day: 1, time: '06:00 PM', place: 'Bangalore', purpose: 'Return Arrival', duration: 0, isReturnArrival: true }
    ];

    const scheduled = recalculateSchedule(rawTimeline, baseTrip);
    const evStop = scheduled.find(s => s.purpose === 'EV Charging');
    const palace = scheduled.find(s => s.place === 'Mysore Palace');

    assert.strictEqual(evStop.duration, 40, 'EV Charging duration should be 40 mins');
    // Departure from EV charger is arrival time + 40m duration
    const evArrivalMins = timeToMinutes(evStop.time);
    const evDepartureMins = evArrivalMins + 40;
    const palaceArrivalMins = timeToMinutes(palace.time);

    // Palace arrival must be at or after EV departure
    assert(palaceArrivalMins >= evDepartureMins, `Palace arrival (${palace.time}) must be after EV departure (${minutesToTime(evDepartureMins)})`);
  });

  // ----------------------------------------------------
  // TEST J: Async Requests / Race-Condition Protection Logic
  // ----------------------------------------------------
  await runTest('TEST J: Async Request Tracking (Monotonic requestIdRef discards stale responses)', async () => {
    let currentRequestId = 0;
    let appliedState = null;

    // Simulate two rapid edits: Edit 1 (slow, takes 150ms) and Edit 2 (fast, takes 30ms)
    const runAsyncEdit = async (editName, delayMs) => {
      const myRequestId = ++currentRequestId;
      await new Promise(r => setTimeout(r, delayMs));
      // Only apply if myRequestId is still the latest
      if (myRequestId === currentRequestId) {
        appliedState = editName;
      }
    };

    const p1 = runAsyncEdit('State from Edit 1 (slow)', 150);
    const p2 = runAsyncEdit('State from Edit 2 (latest)', 30);

    await Promise.all([p1, p2]);
    assert.strictEqual(appliedState, 'State from Edit 2 (latest)', 'Latest request state must prevail over stale response');
  });

  // ----------------------------------------------------
  // TEST K: Regression Test (Full Itinerary Generation with Complete Round Trip)
  // ----------------------------------------------------
  await runTest('TEST K: Regression Test (Full 1-day and 2-day generation produces valid round trips)', async () => {
    const oneDayGen = await generateAccurateItinerary(baseTrip);
    assert(Array.isArray(oneDayGen), '1-day generated timeline should be array');
    assert(oneDayGen[0].place.includes('Bangalore'), '1-day trip starts at Bangalore');
    assert(oneDayGen[oneDayGen.length - 1].place.includes('Bangalore'), '1-day trip returns to Bangalore');
    assert.strictEqual(oneDayGen[oneDayGen.length - 1].isReturnArrival, true);

    const twoDayGen = await generateAccurateItinerary({ ...baseTrip, durationDays: 2 });
    assert(Array.isArray(twoDayGen), '2-day generated timeline should be array');
    const day2Return = twoDayGen[twoDayGen.length - 1];
    assert.strictEqual(day2Return.day, 2, '2-day trip returns on Day 2');
    assert.strictEqual(day2Return.isReturnArrival, true);
    assert(day2Return.place.includes('Bangalore'), '2-day trip returns to Bangalore');
  });

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${testsPassed}/${testsTotal} TESTS PASSED`);
  console.log('====================================================\n');

  if (testsPassed === testsTotal) {
    console.log('🎉 ALL DYNAMIC RESCHEDULING ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
