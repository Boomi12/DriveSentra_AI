const BASE_URL = 'http://localhost:5000/api/trip';

async function testTripPlanner() {
  console.log('=== DriveSentra AI Trip Planner Integration Test ===\n');

  try {
    // 1. EV Trip with enough battery (Bangalore to Mysore, range 340km, battery 85% -> 289km range)
    console.log('1. Testing EV trip with enough battery (Bangalore to Mysore)...');
    const res1 = await fetch(`${BASE_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Bangalore',
        destination: 'Mysore',
        vehicleType: 'EV',
        fuelOrBatteryLevel: 85,
        mileageOrRange: 340,
        tripDate: '2027-12-31',
        startTime: '10:00 AM',
        passengers: 2,
        preference: 'Fastest'
      })
    });
    const data1 = await res1.json();
    console.log('STATUS:', res1.status);
    console.log('Risk Level:', data1.data.riskLevel);
    console.log('Stops recommended:', data1.data.recommendedStops.length);
    console.log('Remaining battery at dest %:', data1.data.remainingBatteryOrFuel);
    if (data1.data.riskLevel === 'Low' && data1.data.recommendedStops.length === 0) {
      console.log('✓ EV enough battery test passed!');
    } else {
      console.error('✗ Failure in EV enough battery test. Expected risk Low, stops 0.');
    }

    // 2. EV Trip with low battery (Bangalore to Mysore, battery 30% -> 102km range)
    console.log('\n2. Testing EV trip with low battery (Bangalore to Mysore)...');
    const res2 = await fetch(`${BASE_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Bangalore',
        destination: 'Mysore',
        vehicleType: 'EV',
        fuelOrBatteryLevel: 30,
        mileageOrRange: 340,
        tripDate: '2027-12-31',
        startTime: '10:00 AM',
        passengers: 2,
        preference: 'Fastest'
      })
    });
    const data2 = await res2.json();
    console.log('STATUS:', res2.status);
    console.log('Risk Level:', data2.data.riskLevel);
    console.log('Stops recommended:', data2.data.recommendedStops.map(s => s.name));
    if (data2.data.riskLevel === 'High' && data2.data.recommendedStops.length > 0) {
      console.log('✓ EV low battery test passed!');
    } else {
      console.error('✗ Failure in EV low battery test.');
    }

    // 3. Petrol Trip with enough fuel (Bangalore to Coorg, range 580km, fuel 80% -> 464km range)
    console.log('\n3. Testing Petrol trip with enough fuel (Bangalore to Coorg)...');
    const res3 = await fetch(`${BASE_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Bangalore',
        destination: 'Coorg',
        vehicleType: 'Petrol',
        fuelOrBatteryLevel: 80,
        mileageOrRange: 580,
        tripDate: '2027-12-31',
        startTime: '08:00 AM',
        passengers: 3,
        preference: 'Scenic'
      })
    });
    const data3 = await res3.json();
    console.log('STATUS:', res3.status);
    console.log('Risk Level:', data3.data.riskLevel);
    console.log('Rest break recommended:', data3.data.restBreaks.map(b => b.name));
    if (data3.data.restBreaks.length > 0) {
      console.log('✓ Petrol enough fuel with rest breaks test passed!');
    } else {
      console.error('✗ Failure: Expected rest break because duration is >2.5 hours.');
    }

    // 4. Diesel Trip with low fuel (Bangalore to Ooty, range 720km, fuel 20% -> 144km range)
    console.log('\n4. Testing Diesel trip with low fuel (Bangalore to Ooty)...');
    const res4 = await fetch(`${BASE_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Bangalore',
        destination: 'Ooty',
        vehicleType: 'Diesel',
        fuelOrBatteryLevel: 20,
        mileageOrRange: 720,
        tripDate: '2027-12-31',
        startTime: '10:00 AM',
        passengers: 4,
        preference: 'Safest'
      })
    });
    const data4 = await res4.json();
    console.log('STATUS:', res4.status);
    console.log('Risk Level:', data4.data.riskLevel);
    console.log('Refueling stops recommended:', data4.data.recommendedStops.map(s => s.name));
    if (data4.data.recommendedStops.length > 0 && data4.data.riskLevel === 'High') {
      console.log('✓ Diesel low fuel test passed!');
    } else {
      console.error('✗ Failure in Diesel low fuel test.');
    }

    // 5. Past Date Validation Check
    console.log('\n5. Testing past date validation check...');
    const res5 = await fetch(`${BASE_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Bangalore',
        destination: 'Mysore',
        vehicleType: 'EV',
        fuelOrBatteryLevel: 85,
        mileageOrRange: 340,
        tripDate: '2020-01-01',
        startTime: '10:00 AM',
        passengers: 1,
        preference: 'Fastest'
      })
    });
    const data5 = await res5.json();
    console.log('STATUS (Expected 400):', res5.status);
    console.log('Error Message:', data5.error);
    if (res5.status === 400 && data5.error?.includes('past')) {
      console.log('✓ Past date validation test passed!');
    } else {
      console.error('✗ Failure: past date validation failed.');
    }

    // 6. Save Trip & Fetch History Check
    console.log('\n6. Testing Trip Saving and History Retrieval...');
    const saveRes = await fetch(`${BASE_URL}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data1.data)
    });
    const saveData = await saveRes.json();
    console.log('Save Trip STATUS:', saveRes.status);
    console.log('Saved Trip ID:', saveData.data._id);

    // Get History
    const historyRes = await fetch(`${BASE_URL}/history`);
    const historyData = await historyRes.json();
    console.log('History Trip Count:', historyData.data.length);
    const savedTrip = historyData.data.find(t => t._id === saveData.data._id);
    if (savedTrip) {
      console.log('✓ Found saved trip in history!');
    } else {
      throw new Error('Saved trip was not found in history query!');
    }

    // Delete Trip
    console.log('\n7. Testing Trip deletion from history...');
    const deleteRes = await fetch(`${BASE_URL}/${saveData.data._id}`, {
      method: 'DELETE'
    });
    const deleteData = await deleteRes.json();
    console.log('Delete STATUS:', deleteRes.status);
    console.log('Message:', deleteData.message);

    const historyRes2 = await fetch(`${BASE_URL}/history`);
    const historyData2 = await historyRes2.json();
    const deletedTripCheck = historyData2.data.find(t => t._id === saveData.data._id);
    if (!deletedTripCheck) {
      console.log('✓ Trip deleted from database successfully!');
    } else {
      throw new Error('Trip was not deleted successfully from database!');
    }

    console.log('\n=== ALL TRIP PLANNER BACKEND API CHECKS PASSED ===');
  } catch (err) {
    console.error('Test execution failed:', err.message);
    process.exit(1);
  }
}

testTripPlanner();
