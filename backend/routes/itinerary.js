import express from 'express';
import Itinerary from '../models/Itinerary.js';
import DigitalTwin from '../models/DigitalTwin.js';
import AgentRecommendation from '../models/AgentRecommendation.js';
import { evaluateAgents } from '../utils/aiEngine.js';
import Vehicle from '../models/Vehicle.js';
import { 
  generateAccurateItinerary, 
  validateTimeline, 
  validateWaypointEdit, 
  timeToMinutes,
  isPastDate,
  isPastTimeToday,
  autoRepairTimeline,
  rescheduleTimeline,
  recalculateSchedule,
  insertStopAtPosition,
  removeStopAtPosition,
  reorderStops,
  updateStopDuration,
  updateStopPinnedTime,
  calculateRoundTripMetrics,
  validateRoundTripItinerary
} from '../utils/timePlanner.js';
import { getPlaceDetails } from '../utils/googleMaps.js';
import { getWeatherData } from '../utils/weather.js';

const router = express.Router();

// Helper to sync itinerary changes to digital twin & agents
async function syncItineraryTwin(tripId, itinerary) {
  let twinState = await DigitalTwin.findOne({ tripId });
  if (!twinState) return null;

  const timeline = itinerary.timeline;
  
  // Find the next stop (first stop that isn't the source)
  const nextStop = timeline.length > 1 ? timeline[1].place : 'None';
  twinState.journeyTwin.nextStop = nextStop;

  // Run timing validations
  const validation = validateTimeline(timeline, {
    source: itinerary.source,
    destination: itinerary.destination,
    startTime: itinerary.startTime || "09:00 AM"
  });

  // Risk updates: if validation warnings or driving warning is present
  const hasWarnings = validation.overallWarning || timeline.some(item => item.warning);
  // Update round trip metrics and vehicle twin
  const metrics = calculateRoundTripMetrics(timeline, itinerary.source, itinerary.destination, itinerary.sourceCoords, itinerary.destinationCoords);
  itinerary.roundTripMetrics = metrics;

  if (twinState.vehicleTwin) {
    twinState.vehicleTwin.tripDistance = metrics.totalDistanceKm || 150;
    const isEV = twinState.vehicleTwin.vehicleType?.toUpperCase() === 'EV';
    if (isEV) {
      const fullRange = twinState.vehicleTwin.range > 150 ? twinState.vehicleTwin.range : 340;
      twinState.vehicleTwin.estimatedUsage = Math.round((metrics.totalDistanceKm / fullRange) * 100);
    } else {
      twinState.vehicleTwin.estimatedUsage = Math.round(metrics.totalDistanceKm / 15);
    }
  }

  await twinState.save();

  // Recompute agent recommendations
  const agentRecommendations = evaluateAgents(twinState, itinerary);

  await AgentRecommendation.findOneAndUpdate(
    { tripId },
    {
      tripId,
      agents: agentRecommendations
    },
    { new: true, upsert: true }
  );

  return { twinState, agentRecommendations };
}

// POST /api/itinerary/generate
router.post('/generate', async (req, res) => {
  try {
    const {
      source,
      destination,
      tripDate,
      startTime,
      tripType,
      foodPreference,
      budget,
      vehicleType,
      fuelOrBatteryLevel,
      mileageOrRange,
      tripId,
      userId,
      durationDays = 1,
      tripStyle = 'Balanced',
      interests = [],
      sourcePlaceId,
      destinationPlaceId,
      tripMode = 'Round Trip',
      needStay = false,
      overnightHalt
    } = req.body;

    if (!source || !destination || !tripId) {
      return res.status(400).json({ error: 'Missing source, destination, or tripId' });
    }

    const tDate = tripDate || new Date().toLocaleDateString('en-CA');
    const tStartTime = startTime || '09:00 AM';
    const fuelVal = fuelOrBatteryLevel !== undefined ? Number(fuelOrBatteryLevel) : 85;
    const rangeVal = mileageOrRange !== undefined ? Number(mileageOrRange) : (vehicleType?.toUpperCase() === 'EV' ? 340 : 580);

    // Enforce past date check strictly
    if (isPastDate(tDate)) {
      return res.status(400).json({
        valid: false,
        reason: "PAST_DATE",
        message: "Invalid date: Trip date cannot be in the past."
      });
    }

    // Enforce past time check strictly
    if (isPastTimeToday(tDate, tStartTime)) {
      return res.status(400).json({
        valid: false,
        reason: "PAST_TIME",
        message: "Invalid time: Start time cannot be earlier than the current time."
      });
    }

    // 1. Resolve source and destination place details asynchronously using Google Maps
    let sourceDetails = null;
    let destDetails = null;

    if (sourcePlaceId) {
      sourceDetails = await getPlaceDetails(sourcePlaceId);
    }
    if (destinationPlaceId) {
      destDetails = await getPlaceDetails(destinationPlaceId);
    }

    const getCityCoordinates = (cityName, fallbackLat, fallbackLng) => {
      const lower = (cityName || '').toLowerCase();
      if (lower.includes('mysore') || lower.includes('mysuru')) return { lat: 12.2958, lng: 76.6394 };
      if (lower.includes('bangalore') || lower.includes('bengaluru')) return { lat: 12.9716, lng: 77.5946 };
      if (lower.includes('ooty') || lower.includes('udhagamandalam')) return { lat: 11.4102, lng: 76.6950 };
      if (lower.includes('coorg') || lower.includes('madikeri')) return { lat: 12.4244, lng: 75.7382 };
      if (lower.includes('chikkamagaluru') || lower.includes('chikmagalur')) return { lat: 13.3161, lng: 75.7720 };
      if (lower.includes('chennai')) return { lat: 13.0827, lng: 80.2707 };
      if (lower.includes('delhi')) return { lat: 28.6139, lng: 77.2090 };
      if (lower.includes('agra')) return { lat: 27.1767, lng: 78.0081 };
      return { lat: fallbackLat, lng: fallbackLng };
    };

    const srcCoords = sourceDetails ? { lat: sourceDetails.lat, lng: sourceDetails.lng } : getCityCoordinates(source, 12.9716, 77.5946);
    const dstCoords = destDetails ? { lat: destDetails.lat, lng: destDetails.lng } : getCityCoordinates(destination, 12.2958, 76.6394);
    const srcAddress = sourceDetails?.address || source;
    const dstAddress = destDetails?.address || destination;

    // 2. Fetch destination weather from OpenWeather
    const weatherInfo = await getWeatherData(dstCoords.lat, dstCoords.lng, destination);

    // 3. Generate accurate timeline using scheduling engine
    let resolvedVehicleType = vehicleType;
    let resolvedFuelOrBatteryLevel = fuelVal;
    let resolvedMileageOrRange = rangeVal;
    let resolvedMileage = 15;

    if (userId) {
      const dbVehicle = await Vehicle.findOne({ userId });
      if (dbVehicle) {
        resolvedVehicleType = dbVehicle.type;
        resolvedFuelOrBatteryLevel = dbVehicle.type === 'EV' ? dbVehicle.batteryPercentage : dbVehicle.fuelPercentage;
        resolvedMileageOrRange = dbVehicle.range;
        resolvedMileage = dbVehicle.mileage || 15;
      }
    }

    const rawTimeline = await generateAccurateItinerary({
      source,
      destination,
      tripDate: tDate,
      startTime: tStartTime,
      tripType,
      foodPreference,
      budget,
      vehicleType: resolvedVehicleType,
      fuelOrBatteryLevel: resolvedFuelOrBatteryLevel,
      mileageOrRange: resolvedMileageOrRange,
      mileage: resolvedMileage,
      durationDays: Number(durationDays),
      tripStyle,
      interests,
      sourceCoords: srcCoords,
      destinationCoords: dstCoords,
      sourcePlaceId,
      destinationPlaceId,
      sourceAddress: srcAddress,
      destinationAddress: dstAddress,
      tripMode,
      needStay,
      overnightHalt
    });

    // 4. Handle Infeasible Trip constraints
    if (rawTimeline.isFeasible === false) {
      const infeasibleItinerary = await Itinerary.findOneAndUpdate(
        { tripId },
        {
          tripId,
          userId,
          source,
          destination,
          tripType,
          foodPreference,
          budget,
          vehicleType: resolvedVehicleType,
          tripDate: tDate,
          startTime: tStartTime,
          durationDays: Number(durationDays),
          tripStyle,
          interests,
          sourcePlaceId,
          destinationPlaceId,
          sourceCoords: srcCoords,
          destinationCoords: dstCoords,
          sourceAddress: srcAddress,
          destinationAddress: dstAddress,
          isFeasible: false,
          infeasibilityDetails: {
            reason: rawTimeline.reason,
            alternatives: rawTimeline.alternatives
          },
          timeline: [],
          infeasible: rawTimeline.infeasible || [],
          tripMode: tripMode || 'Round Trip',
          isActive: false
        },
        { new: true, upsert: true }
      );

      return res.status(200).json({
        success: true,
        data: infeasibleItinerary
      });
    }

    // 5. Run validation check to populate warnings/status
    const tripDetails = {
      source,
      destination,
      startTime: tStartTime,
      sourceCoords: srcCoords,
      destinationCoords: dstCoords,
      sourcePlaceId,
      destinationPlaceId,
      sourceAddress: srcAddress,
      destinationAddress: dstAddress,
      durationDays: Number(durationDays)
    };

    let validation = validateTimeline(rawTimeline, tripDetails);
    let timelineToSave = validation.timeline;

    // Auto-repair during generation if there are closure warnings
    if (!validation.success) {
      const repair = autoRepairTimeline(rawTimeline, tripDetails);
      if (repair.success) {
        timelineToSave = repair.timeline;
      }
    }

    // Calculate complete round-trip metrics
    const roundTripMetrics = calculateRoundTripMetrics(timelineToSave, source, destination, srcCoords, dstCoords);

    // 6. Deactivate other active trips if userId is provided
    if (userId) {
      await Itinerary.updateMany({ userId, tripId: { $ne: tripId } }, { isActive: false });
    }

    // 7. Save Itinerary to Database
    const itinerary = await Itinerary.findOneAndUpdate(
      { tripId },
      {
        tripId,
        userId,
        source,
        destination,
        tripType,
        foodPreference,
        budget,
        vehicleType: resolvedVehicleType,
        tripDate: tDate,
        startTime: tStartTime,
        fuelOrBatteryLevel: resolvedFuelOrBatteryLevel,
        mileageOrRange: resolvedMileageOrRange,
        durationDays: Number(durationDays),
        tripStyle,
        interests,
        sourcePlaceId,
        destinationPlaceId,
        sourceCoords: srcCoords,
        destinationCoords: dstCoords,
        sourceAddress: srcAddress,
        destinationAddress: dstAddress,
        weatherData: {
          temperature: weatherInfo.temperature,
          condition: weatherInfo.condition,
          windSpeed: weatherInfo.windSpeed,
          description: weatherInfo.description
        },
        isActive: true,
        isFeasible: true,
        infeasibilityDetails: null,
        roundTripMetrics,
        overnightHalt: roundTripMetrics.overnightHalt || overnightHalt || null,
        timeline: timelineToSave,
        tripMode: tripMode || 'Round Trip',
        needStay: needStay === true || needStay === 'Yes',
        infeasible: rawTimeline.infeasible || []
      },
      { new: true, upsert: true }
    );

    // 8. Initialize/Update Digital Twin with complete round-trip metrics
    let twinState = await DigitalTwin.findOne({ tripId });
    
    // Determine riskLevel by weather
    let twinRisk = 'low';
    if (weatherInfo.condition === 'thunderstorm') {
      twinRisk = 'critical';
    } else if (['rain', 'fog', 'snow'].includes(weatherInfo.condition)) {
      twinRisk = 'medium';
    }

    const tripDistanceVal = roundTripMetrics.totalDistanceKm || 150;

    // Calculate estimated battery/fuel usage
    let estimatedUsageVal = 0;
    const isEVResolved = resolvedVehicleType?.toUpperCase() === 'EV';
    if (isEVResolved) {
      const fullEVRange = resolvedMileageOrRange > 150 ? resolvedMileageOrRange : 340;
      estimatedUsageVal = Math.round((tripDistanceVal / fullEVRange) * 100);
    } else {
      estimatedUsageVal = Math.round(tripDistanceVal / resolvedMileage);
    }

    // Determine warning state based on complete round trip
    const currentActiveRange = isEVResolved 
      ? resolvedMileageOrRange * (resolvedFuelOrBatteryLevel / 100)
      : (resolvedFuelOrBatteryLevel / 100) * 35 * resolvedMileage;
    
    const fuelWarningVal = currentActiveRange < tripDistanceVal;

    if (!twinState) {
      twinState = new DigitalTwin({
        tripId,
        driverTwin: {
          fatigueLevel: 15,
          distractionStatus: 'focused',
          breakNeeded: false
        },
        vehicleTwin: {
          vehicleType: resolvedVehicleType,
          fuelOrBatteryLevel: resolvedFuelOrBatteryLevel,
          range: resolvedMileageOrRange,
          healthStatus: 'good',
          tripDistance: tripDistanceVal,
          estimatedUsage: estimatedUsageVal,
          fuelWarning: fuelWarningVal
        },
        journeyTwin: {
          weather: weatherInfo.condition,
          traffic: 'normal',
          riskLevel: twinRisk,
          weatherRisk: twinRisk,
          nextStop: timelineToSave[1] ? timelineToSave[1].place : 'None'
        }
      });
      await twinState.save();
    } else {
      twinState.vehicleTwin.vehicleType = resolvedVehicleType;
      twinState.vehicleTwin.fuelOrBatteryLevel = resolvedFuelOrBatteryLevel;
      twinState.vehicleTwin.range = resolvedMileageOrRange;
      twinState.vehicleTwin.tripDistance = tripDistanceVal;
      twinState.vehicleTwin.estimatedUsage = estimatedUsageVal;
      twinState.vehicleTwin.fuelWarning = fuelWarningVal;
      twinState.journeyTwin.weather = weatherInfo.condition;
      twinState.journeyTwin.riskLevel = twinRisk;
      twinState.journeyTwin.weatherRisk = twinRisk;
      twinState.journeyTwin.nextStop = timelineToSave[1] ? timelineToSave[1].place : 'None';
      await twinState.save();
    }

    // 9. Re-evaluate agent recommendations
    const agentRecommendations = evaluateAgents(twinState, itinerary);
    await AgentRecommendation.findOneAndUpdate(
      { tripId },
      { tripId, agents: agentRecommendations },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in /itinerary/generate:', error);
    res.status(500).json({ error: error.message || 'Server error generating itinerary' });
  }
});

// POST /api/itinerary/validate
router.post('/validate', async (req, res) => {
  try {
    const { timeline, tripDetails } = req.body;
    if (!timeline || !tripDetails) {
      return res.status(400).json({ error: 'Missing timeline or tripDetails' });
    }

    if (isPastDate(tripDetails.tripDate)) {
      return res.status(400).json({
        valid: false,
        reason: "PAST_DATE",
        message: "Invalid date: Trip date cannot be in the past."
      });
    }

    if (tripDetails.startTime && isPastTimeToday(tripDetails.tripDate, tripDetails.startTime)) {
      return res.status(400).json({
        valid: false,
        reason: "PAST_TIME",
        message: "Invalid time: Start time cannot be earlier than the current time."
      });
    }

    const validation = validateTimeline(timeline, tripDetails);
    const roundTripVal = validateRoundTripItinerary(timeline, tripDetails);
    
    // Call autoRepairTimeline to see if fixes are available
    let repair = { success: validation.success && roundTripVal.isValid, timeline: validation.timeline };
    if (!validation.success) {
      repair = autoRepairTimeline(timeline, tripDetails);
    }

    const overallValid = validation.success && roundTripVal.isValid;
    const allWarnings = [
      validation.overallWarning,
      ...roundTripVal.issues
    ].filter(Boolean).join(' ');

    res.status(200).json({
      success: true,
      valid: overallValid,
      timeline: repair.timeline,
      overallWarning: allWarnings || null,
      roundTripIssues: roundTripVal.issues,
      suggestions: repair.suggestions || []
    });
  } catch (error) {
    console.error('Error in /itinerary/validate:', error);
    res.status(500).json({ error: 'Server error validating timeline' });
  }
});

// POST /api/itinerary/check-place
router.post('/check-place', async (req, res) => {
  try {
    const { tripId, place, time } = req.body;
    if (!tripId || !place || !time) {
      return res.status(400).json({ error: 'tripId, place, and time are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    // Construct a context-accurate waypoint object to validate
    const dummyWaypoint = { place, time };
    
    // Find neighbors in itinerary
    const timeline = itinerary.timeline;
    let previousWaypoint = null;
    let nextWaypoint = null;

    // Estimate position by sorting chronologically
    const targetMins = timeToMinutes(time);
    for (let i = 0; i < timeline.length; i++) {
      const currentMins = timeToMinutes(timeline[i].time);
      if (currentMins < targetMins) {
        previousWaypoint = timeline[i];
      }
      if (currentMins > targetMins && !nextWaypoint) {
        nextWaypoint = timeline[i];
      }
    }

    const editInput = {
      waypoint: dummyWaypoint,
      previousWaypoint,
      nextWaypoint,
      tripDate: itinerary.tripDate,
      tripStartTime: itinerary.startTime,
      source: itinerary.source,
      destination: itinerary.destination
    };

    const result = validateWaypointEdit(editInput);
    res.status(200).json({
      success: true,
      valid: result.valid,
      reason: result.reason,
      message: result.message
    });
  } catch (error) {
    console.error('Error in /itinerary/check-place:', error);
    res.status(500).json({ error: 'Server error checking place' });
  }
});

// PATCH /api/itinerary/:tripId/waypoint/:waypointId
router.patch('/:tripId/waypoint/:waypointId', async (req, res) => {
  try {
    const { tripId, waypointId } = req.params;
    const { time, place, purpose, reason, duration, isPinned, pinnedTime } = req.body;

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    // Locate the waypoint
    let index = -1;
    let waypoint = itinerary.timeline.id(waypointId);
    if (waypoint) {
      index = itinerary.timeline.indexOf(waypoint);
    } else {
      const idx = parseInt(waypointId, 10);
      if (!isNaN(idx) && itinerary.timeline[idx]) {
        waypoint = itinerary.timeline[idx];
        index = idx;
      } else {
        index = itinerary.timeline.findIndex(item => item.id === waypointId || item._id?.toString() === waypointId);
        if (index !== -1) {
          waypoint = itinerary.timeline[index];
        }
      }
    }

    if (!waypoint || index === -1) {
      return res.status(404).json({ error: 'Waypoint not found in timeline' });
    }

    // Apply edits
    if (place !== undefined) waypoint.place = place;
    if (purpose !== undefined) waypoint.purpose = purpose;
    if (reason !== undefined) waypoint.reason = reason;
    if (duration !== undefined) waypoint.duration = Math.max(0, Number(duration) || 0);

    if (isPinned !== undefined) {
      waypoint.isPinned = Boolean(isPinned);
      if (isPinned) {
        waypoint.pinnedTime = pinnedTime || time || waypoint.time;
      } else {
        waypoint.pinnedTime = null;
      }
    } else if (time !== undefined && time !== waypoint.time) {
      // User explicitly changed clock time: treat as pinned reservation constraint
      waypoint.isPinned = true;
      waypoint.pinnedTime = time;
      waypoint.time = time;
    }

    const tripDetails = {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      tripDate: itinerary.tripDate,
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      durationDays: itinerary.durationDays || 1,
      vehicleType: itinerary.vehicleType
    };

    // Propagate schedule dynamically to all downstream stops
    const rescheduled = recalculateSchedule(itinerary.timeline, tripDetails);
    itinerary.timeline = rescheduled;
    itinerary.roundTripMetrics = calculateRoundTripMetrics(rescheduled, tripDetails.source, tripDetails.destination, tripDetails.sourceCoords, tripDetails.destinationCoords);
    await itinerary.save();

    // Sync with digital twin & AI agents
    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in PATCH waypoint:', error);
    res.status(500).json({ error: 'Server error updating waypoint' });
  }
});

// POST /api/itinerary/insert-stop (Insert at ANY position)
router.post('/insert-stop', async (req, res) => {
  try {
    const { tripId, stop, insertIndex, tripDetails } = req.body;
    if (!tripId || !stop) {
      return res.status(400).json({ error: 'tripId and stop are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const details = {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      tripDate: itinerary.tripDate,
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      durationDays: itinerary.durationDays || 1,
      vehicleType: itinerary.vehicleType,
      ...tripDetails
    };

    const updatedTimeline = insertStopAtPosition(itinerary.timeline, stop, insertIndex, details);
    itinerary.timeline = updatedTimeline;
    itinerary.roundTripMetrics = calculateRoundTripMetrics(updatedTimeline, details.source, details.destination, details.sourceCoords, details.destinationCoords);
    await itinerary.save();

    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in POST /api/itinerary/insert-stop:', error);
    res.status(500).json({ error: 'Server error inserting stop' });
  }
});

// POST /api/itinerary/remove-stop
router.post('/remove-stop', async (req, res) => {
  try {
    const { tripId, index, stopId, tripDetails } = req.body;
    if (!tripId || (index === undefined && !stopId)) {
      return res.status(400).json({ error: 'tripId and stopId or index are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const details = {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      tripDate: itinerary.tripDate,
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      durationDays: itinerary.durationDays || 1,
      vehicleType: itinerary.vehicleType,
      ...tripDetails
    };

    const target = stopId !== undefined ? stopId : index;
    const updatedTimeline = removeStopAtPosition(itinerary.timeline, target, details);
    itinerary.timeline = updatedTimeline;
    itinerary.roundTripMetrics = calculateRoundTripMetrics(updatedTimeline, details.source, details.destination, details.sourceCoords, details.destinationCoords);
    await itinerary.save();

    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in POST /api/itinerary/remove-stop:', error);
    res.status(500).json({ error: 'Server error removing stop' });
  }
});

// POST /api/itinerary/reorder-stops
router.post('/reorder-stops', async (req, res) => {
  try {
    const { tripId, fromIndex, toIndex, tripDetails } = req.body;
    if (!tripId || fromIndex === undefined || toIndex === undefined) {
      return res.status(400).json({ error: 'tripId, fromIndex, and toIndex are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const details = {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      tripDate: itinerary.tripDate,
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      durationDays: itinerary.durationDays || 1,
      vehicleType: itinerary.vehicleType,
      ...tripDetails
    };

    const updatedTimeline = reorderStops(itinerary.timeline, fromIndex, toIndex, details);
    itinerary.timeline = updatedTimeline;
    itinerary.roundTripMetrics = calculateRoundTripMetrics(updatedTimeline, details.source, details.destination, details.sourceCoords, details.destinationCoords);
    await itinerary.save();

    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in POST /api/itinerary/reorder-stops:', error);
    res.status(500).json({ error: 'Server error reordering stops' });
  }
});

// POST /api/itinerary/update-duration
router.post('/update-duration', async (req, res) => {
  try {
    const { tripId, index, stopId, duration, tripDetails } = req.body;
    if (!tripId || (index === undefined && !stopId) || duration === undefined) {
      return res.status(400).json({ error: 'tripId, stopId/index, and duration are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const details = {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      tripDate: itinerary.tripDate,
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      durationDays: itinerary.durationDays || 1,
      vehicleType: itinerary.vehicleType,
      ...tripDetails
    };

    const target = stopId !== undefined ? stopId : index;
    const updatedTimeline = updateStopDuration(itinerary.timeline, target, duration, details);
    itinerary.timeline = updatedTimeline;
    itinerary.roundTripMetrics = calculateRoundTripMetrics(updatedTimeline, details.source, details.destination, details.sourceCoords, details.destinationCoords);
    await itinerary.save();

    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in POST /api/itinerary/update-duration:', error);
    res.status(500).json({ error: 'Server error updating stop duration' });
  }
});

// POST /api/itinerary/toggle-pin
router.post('/toggle-pin', async (req, res) => {
  try {
    const { tripId, index, stopId, isPinned, pinnedTime, tripDetails } = req.body;
    if (!tripId || (index === undefined && !stopId)) {
      return res.status(400).json({ error: 'tripId and stopId or index are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const details = {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      tripDate: itinerary.tripDate,
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      durationDays: itinerary.durationDays || 1,
      vehicleType: itinerary.vehicleType,
      ...tripDetails
    };

    const target = stopId !== undefined ? stopId : index;
    const updatedTimeline = updateStopPinnedTime(itinerary.timeline, target, isPinned, pinnedTime, details);
    itinerary.timeline = updatedTimeline;
    itinerary.roundTripMetrics = calculateRoundTripMetrics(updatedTimeline, details.source, details.destination, details.sourceCoords, details.destinationCoords);
    await itinerary.save();

    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in POST /api/itinerary/toggle-pin:', error);
    res.status(500).json({ error: 'Server error updating pinned reservation' });
  }
});

// GET /api/itinerary/:tripId
router.get('/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in GET /api/itinerary/:tripId:', error);
    res.status(500).json({ error: 'Server error retrieving itinerary' });
  }
});

// POST /api/itinerary/update-timeline
router.post('/update-timeline', async (req, res) => {
  try {
    const { tripId, timeline } = req.body;
    if (!tripId || !timeline) {
      return res.status(400).json({ error: 'tripId and timeline are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const details = {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      tripDate: itinerary.tripDate,
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      durationDays: itinerary.durationDays || 1,
      vehicleType: itinerary.vehicleType
    };

    const scheduled = recalculateSchedule(timeline, details);
    itinerary.timeline = scheduled;
    itinerary.roundTripMetrics = calculateRoundTripMetrics(scheduled, details.source, details.destination, details.sourceCoords, details.destinationCoords);
    await itinerary.save();

    // Sync state
    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in POST /api/itinerary/update-timeline:', error);
    res.status(500).json({ error: 'Server error updating itinerary timeline' });
  }
});

// GET /api/itinerary/active/:userId
router.get('/active/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const itinerary = await Itinerary.findOne({ userId, isActive: true }).sort({ createdAt: -1 });
    if (!itinerary) {
      return res.status(404).json({ error: 'No active itinerary found for this user' });
    }
    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in GET /active/:userId:', error);
    res.status(500).json({ error: 'Server error retrieving active itinerary' });
  }
});

// POST /api/itinerary/apply-fix
router.post('/apply-fix', async (req, res) => {
  try {
    const { tripId, timeline } = req.body;
    if (!tripId || !timeline) {
      return res.status(400).json({ error: 'tripId and timeline are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    // Direct drop-in of the auto-repaired timeline
    // Run validation sequence to make sure it's fully validated
    const validation = validateTimeline(timeline, {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      sourcePlaceId: itinerary.sourcePlaceId,
      destinationPlaceId: itinerary.destinationPlaceId,
      sourceAddress: itinerary.sourceAddress,
      destinationAddress: itinerary.destinationAddress,
      durationDays: itinerary.durationDays
    });

    itinerary.timeline = validation.timeline;
    await itinerary.save();

    // Sync state to twin
    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in POST /apply-fix:', error);
    res.status(500).json({ error: 'Server error applying itinerary fix' });
  }
});

// POST /api/itinerary/reschedule
router.post('/reschedule', async (req, res) => {
  try {
    const { tripId, timeline } = req.body;
    if (!tripId || !timeline) {
      return res.status(400).json({ error: 'tripId and timeline are required' });
    }

    const itinerary = await Itinerary.findOne({ tripId });
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const tripDetails = {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime || "09:00 AM",
      sourceCoords: itinerary.sourceCoords,
      destinationCoords: itinerary.destinationCoords,
      sourcePlaceId: itinerary.sourcePlaceId,
      destinationPlaceId: itinerary.destinationPlaceId,
      sourceAddress: itinerary.sourceAddress,
      destinationAddress: itinerary.destinationAddress,
      durationDays: itinerary.durationDays
    };

    const rescheduled = recalculateSchedule(timeline, tripDetails);
    itinerary.timeline = rescheduled;
    itinerary.roundTripMetrics = calculateRoundTripMetrics(rescheduled, tripDetails.source, tripDetails.destination, tripDetails.sourceCoords, tripDetails.destinationCoords);
    await itinerary.save();

    // Sync to twin
    await syncItineraryTwin(tripId, itinerary);

    res.status(200).json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Error in POST /reschedule:', error);
    res.status(500).json({ error: 'Server error rescheduling timeline' });
  }
});

export default router;
