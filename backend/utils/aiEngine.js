import { mockDestinations, defaultMockDestination } from './mockData.js';

export function evaluateAgents(twinState, itinerary) {
  const { driverTwin, vehicleTwin, journeyTwin } = twinState;
  const { destination = '', foodPreference = '', budget = '', vehicleType = 'EV' } = itinerary || {};

  const destKey = destination.toLowerCase().trim();
  const destData = mockDestinations[destKey] || defaultMockDestination;

  const weatherDesc = itinerary?.weatherData?.description || journeyTwin.weather || 'clear';
  const weatherCond = journeyTwin.weather?.toLowerCase() || 'clear';

  // 1. Safety Agent
  let safetyStatus = 'Optimal';
  let safetyRec = 'Driver alert level is nominal. Safe driving habits maintained across round trip.';
  let safetyConfidence = 98;

  if (itinerary?.durationDays === 2 && itinerary?.overnightHalt) {
    safetyRec = `Overnight halt at ${itinerary.overnightHalt} scheduled on Day 1 provides essential driver fatigue recovery before the Day 2 return journey.`;
  }

  if (driverTwin.fatigueLevel > 70) {
    safetyStatus = 'Warning';
    safetyRec = `High driver fatigue detected (${driverTwin.fatigueLevel}%). Please pull over at the nearest rest stop immediately for a 20-minute break.`;
    safetyConfidence = 96;
  } else if (driverTwin.distractionStatus === 'distracted') {
    safetyStatus = 'Warning';
    safetyRec = 'Driver distraction detected (lack of forward focus). Eyes off road! Recommending haptic steering alert.';
    safetyConfidence = 90;
  } else if (driverTwin.breakNeeded) {
    safetyStatus = 'Caution';
    safetyRec = 'Continuous driving exceeds 3 hours. Recommending a brief stretch break at the next expressway rest stop.';
    safetyConfidence = 85;
  } else if (weatherCond === 'thunderstorm') {
    safetyStatus = 'Warning';
    safetyRec = `Severe weather warning: ${weatherDesc} active. Recommending immediate halt or low speed safety offsets (max 40 km/h) to avoid hydroplaning.`;
    safetyConfidence = 95;
  } else if (['rain', 'fog', 'snow'].includes(weatherCond)) {
    safetyStatus = 'Caution';
    safetyRec = `Adverse weather (${weatherDesc}) detected. Maintain lower speeds, keep safe distance, and consider taking regular rest stops.`;
    safetyConfidence = 90;
  }

  // 2. Route Agent
  let routeStatus = 'Optimal';
  const routeDescription = itinerary?.source && itinerary?.destination 
    ? `${itinerary.source} ➔ ${itinerary.destination} ➔ ${itinerary.source} (${itinerary.durationDays || 1}-Day Round Trip)`
    : 'Active route';
  let routeRec = `Complete round-trip corridor (${routeDescription}) is clear and optimal. Both onward and return segments monitored.`;
  let routeConfidence = 95;

  if (journeyTwin.traffic === 'heavy') {
    routeStatus = 'Alert';
    routeRec = 'Heavy traffic congestion ahead. Recalculated alternative bypass route to save 18 minutes of transit.';
    routeConfidence = 92;
  } else if (weatherCond === 'thunderstorm') {
    routeStatus = 'Critical';
    routeRec = `Extreme routing alert: ${weatherDesc} detected. Recommended routing avoids open expressways and low-lying flood regions.`;
    routeConfidence = 98;
  } else if (['rain', 'fog', 'snow'].includes(weatherCond)) {
    routeStatus = 'Caution';
    routeRec = `Adverse weather: ${weatherDesc} detected. Activating safety-first route options avoiding high slip hazards and steep gradients.`;
    routeConfidence = 89;
  }

  // 3. Fuel/EV Agent
  let fuelStatus = 'Optimal';
  let fuelRec = `Fuel/Battery level (${vehicleTwin.fuelOrBatteryLevel}%) is sufficient for upcoming round-trip legs.`;
  let fuelConfidence = 94;

  const isEV = vehicleTwin.vehicleType.toUpperCase() === 'EV';
  
  if (vehicleTwin.fuelWarning) {
    fuelStatus = 'Warning';
    if (isEV) {
      const evCharger = (destData.fuelChargingStops || []).find(s => s.type?.toUpperCase() === 'EV') || (destData.fuelChargingStops || [])[0] || { name: 'Tata Power EV Fast Charger' };
      fuelRec = `Round-trip battery range alert! Total round-trip distance (${vehicleTwin.tripDistance}km) exceeds single-charge range (${vehicleTwin.range}km). Fast charging stop planned at "${evCharger.name}".`;
    } else {
      const fuelPump = (destData.fuelChargingStops || []).find(s => s.type?.toUpperCase() === 'FUEL') || (destData.fuelChargingStops || [])[0] || { name: 'HP Refuel Station' };
      fuelRec = `Round-trip fuel range alert! Total round-trip distance (${vehicleTwin.tripDistance}km) exceeds tank range (${vehicleTwin.range}km). Refueling stop planned at "${fuelPump.name}".`;
    }
    fuelConfidence = 98;
  } else {
    if (isEV) {
      if (vehicleTwin.fuelOrBatteryLevel < 30) {
        fuelStatus = 'Critical';
        const evCharger = (destData.fuelChargingStops || []).find(s => s.type?.toUpperCase() === 'EV') || (destData.fuelChargingStops || [])[0] || { name: 'Tata Power EV Fast Charger' };
        fuelRec = `Battery level low (${vehicleTwin.fuelOrBatteryLevel}%). Recommending fast-charging stop: "${evCharger.name}" located nearby.`;
        fuelConfidence = 97;
      } else {
        fuelRec = `Battery level (${vehicleTwin.fuelOrBatteryLevel}%) is optimal for complete round trip. Est. usage: ${vehicleTwin.estimatedUsage || 0}% for ${vehicleTwin.tripDistance || 0}km.`;
      }
    } else {
      if (vehicleTwin.fuelOrBatteryLevel < 20) {
        fuelStatus = 'Critical';
        const fuelPump = (destData.fuelChargingStops || []).find(s => s.type?.toUpperCase() === 'FUEL') || (destData.fuelChargingStops || [])[0] || { name: 'HP Refuel Station' };
        fuelRec = `Fuel level low (${vehicleTwin.fuelOrBatteryLevel}%). Stop at "${fuelPump.name}" in 12km.`;
        fuelConfidence = 95;
      } else {
        fuelRec = `Fuel level (${vehicleTwin.fuelOrBatteryLevel}%) is optimal for complete round trip. Est. usage: ${vehicleTwin.estimatedUsage || 0}L for ${vehicleTwin.tripDistance || 0}km.`;
      }
    }
  }

  // 4. Journey Agent
  const preferredRestaurant = destData.restaurants.find(r => {
    const isBudgetMatch = budget.toLowerCase() === 'high' ? r.budget === 'High' : (budget.toLowerCase() === 'low' ? r.budget === 'Low' : r.budget !== 'High');
    const isCuisineMatch = foodPreference.toLowerCase() === 'any' || r.cuisine.toLowerCase().includes(foodPreference.toLowerCase());
    return isBudgetMatch || isCuisineMatch;
  }) || destData.restaurants[0];

  const firstAttraction = destData.attractions[0];
  const firstRestStop = destData.restStops[0];

  let journeyStatus = 'Active';
  let journeyRec = `Complete round-trip itinerary configured: Visit "${firstAttraction.name}" (${firstAttraction.type}) and dine at "${preferredRestaurant.name}" (${preferredRestaurant.cuisine}).`;
  if (itinerary?.overnightHalt) {
    journeyRec += ` Overnight halt confirmed at "${itinerary.overnightHalt}".`;
  } else if (firstRestStop) {
    journeyRec += ` Rest stop scheduled at "${firstRestStop.name}".`;
  }
  let journeyConfidence = 90;

  // 5. Emergency Agent
  let emergencyStatus = 'Standby';
  let emergencyRec = 'All sensors report stable state. Emergency response protocols are in standby mode for onward and return journeys.';
  let emergencyConfidence = 95;

  if (journeyTwin.riskLevel === 'critical') {
    emergencyStatus = 'Danger';
    emergencyRec = 'Critical journey risk! SOS triggers armed. Preparing emergency alert dispatch to roadside assistance and selected contacts.';
    emergencyConfidence = 99;
  } else if (vehicleTwin.healthStatus === 'critical') {
    emergencyStatus = 'Danger';
    emergencyRec = 'Critical vehicle engine/battery fault! Pull over safely. Dispatching emergency breakdown service location ping.';
    emergencyConfidence = 98;
  } else if (journeyTwin.riskLevel === 'medium') {
    emergencyStatus = 'Caution';
    emergencyRec = 'Elevated route risks. Automated hazard alerts enabled. emergency hotline speed-dials initialized.';
    emergencyConfidence = 90;
  }

  return {
    safetyAgent: { status: safetyStatus, recommendation: safetyRec, confidenceScore: safetyConfidence },
    routeAgent: { status: routeStatus, recommendation: routeRec, confidenceScore: routeConfidence },
    fuelEvAgent: { status: fuelStatus, recommendation: fuelRec, confidenceScore: fuelConfidence },
    journeyAgent: { status: journeyStatus, recommendation: journeyRec, confidenceScore: journeyConfidence },
    emergencyAgent: { status: emergencyStatus, recommendation: emergencyRec, confidenceScore: emergencyConfidence }
  };
}
