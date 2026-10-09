import express from 'express';
import mongoose from 'mongoose';
import Trip from '../models/Trip.js';

const router = express.Router();

// Helper to convert "09:00 AM" to minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Helper to add minutes to a time string
function addMinutesToTime(timeStr, minsToAdd) {
  const totalMins = timeToMinutes(timeStr) + minsToAdd;
  const mins = totalMins % 1440;
  let hours = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  const padM = String(m).padStart(2, '0');
  const padH = String(hours).padStart(2, '0');
  return `${padH}:${padM} ${ampm}`;
}

// Mock calculation based on route
function calculateRouteMetrics(source, destination) {
  const src = source.toLowerCase().trim();
  const dst = destination.toLowerCase().trim();
  
  // Defaults (e.g. Bangalore to Mysore)
  let distanceKm = 145;
  let durationHours = 3.2;

  if (src === 'bangalore') {
    if (dst === 'mysore') {
      distanceKm = 145;
      durationHours = 3.2;
    } else if (dst === 'coorg' || dst.includes('madikeri')) {
      distanceKm = 250;
      durationHours = 5.5;
    } else if (dst === 'ooty') {
      distanceKm = 270;
      durationHours = 6.2;
    } else if (dst === 'chikkamagaluru') {
      distanceKm = 240;
      durationHours = 4.8;
    }
  } else if (dst === 'bangalore') {
    if (src === 'mysore') {
      distanceKm = 145;
      durationHours = 3.2;
    } else if (src === 'coorg' || src.includes('madikeri')) {
      distanceKm = 250;
      durationHours = 5.5;
    } else if (src === 'ooty') {
      distanceKm = 270;
      durationHours = 6.2;
    } else if (src === 'chikkamagaluru') {
      distanceKm = 240;
      durationHours = 4.8;
    }
  } else {
    // Dynamic mock for other locations
    const hash = (src.length * 7 + dst.length * 13) % 150;
    distanceKm = 100 + hash;
    durationHours = Number((distanceKm / 50).toFixed(1)); // Average 50 km/h
  }

  return { distanceKm, durationHours };
}

// POST /api/trip/plan - calculate trip details without saving
router.post('/plan', async (req, res) => {
  try {
    const {
      source,
      destination,
      vehicleType,
      fuelOrBatteryLevel,
      mileageOrRange,
      passengers,
      tripDate,
      startTime,
      preference
    } = req.body;

    // Server-side validation
    if (!source || !destination) {
      return res.status(400).json({ error: 'Starting location and destination are required.' });
    }
    if (source.toLowerCase().trim() === destination.toLowerCase().trim()) {
      return res.status(400).json({ error: 'Starting location and destination cannot be the same.' });
    }

    const level = Number(fuelOrBatteryLevel);
    if (isNaN(level) || level < 1 || level > 100) {
      return res.status(400).json({ error: 'Fuel or battery level must be between 1 and 100.' });
    }

    const range = Number(mileageOrRange);
    if (isNaN(range) || range <= 0) {
      return res.status(400).json({ error: 'Vehicle range/mileage must be a positive number.' });
    }

    // Verify dates
    const todayStr = new Date().toISOString().split('T')[0];
    if (tripDate < todayStr) {
      return res.status(400).json({ error: 'Trip date cannot be in the past.' });
    }

    if (tripDate === todayStr) {
      const selectedMins = timeToMinutes(startTime);
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      if (selectedMins < currentMins) {
        return res.status(400).json({ error: 'Start time cannot be in the past today.' });
      }
    }

    // Perform route metrics calculations
    const { distanceKm, durationHours } = calculateRouteMetrics(source, destination);

    // Calculate range status
    // Available range in km
    const availableRange = (level / 100) * range;
    const isRangeEnough = availableRange >= distanceKm;
    
    // Remaining battery/fuel at destination (could be negative if insufficient)
    const remainingRange = availableRange - distanceKm;
    const remainingBatteryOrFuel = Math.round((remainingRange / range) * 100);

    // Stops suggestions
    const recommendedStops = [];
    
    const isEV = vehicleType?.toUpperCase() === 'EV';
    const isHybrid = vehicleType?.toUpperCase() === 'HYBRID';
    
    if (!isRangeEnough || remainingBatteryOrFuel < 15) {
      // Recommend charging/fuel stop midway
      const stopDistance = Math.round(availableRange * 0.7); // Stop before running out (at 70% of available range)
      const stopDist = stopDistance > 0 && stopDistance < distanceKm ? stopDistance : Math.round(distanceKm / 2);
      
      if (isEV) {
        let stopName = 'National Highway Fast EV Charger';
        const dst = destination.toLowerCase();
        if (dst.includes('mysore')) stopName = 'Mandya EV Fast Charger Hub';
        else if (dst.includes('coorg')) stopName = 'Hunsur Town EV Station';
        else if (dst.includes('ooty')) stopName = 'Bandipur National Park Charging Hub';
        else if (dst.includes('chikkamagaluru')) stopName = 'Hassan Bypass Power Station';

        recommendedStops.push({
          name: stopName,
          distanceKm: stopDist,
          type: 'charging',
          description: `Recommend stopping here. Charge for 30 minutes to reach destination with 40% battery.`
        });
      } else {
        // Petrol, Diesel, Hybrid
        let stopName = 'National Highway Fuel Station';
        const dst = destination.toLowerCase();
        if (dst.includes('mysore')) stopName = 'Shell Fuel Center Maddur';
        else if (dst.includes('coorg')) stopName = 'BPCL Highway Junction';
        else if (dst.includes('ooty')) stopName = 'IndianOil Gundlupet Petrol Station';
        else if (dst.includes('chikkamagaluru')) stopName = 'HP Fuel Outlet Hassan';

        recommendedStops.push({
          name: stopName,
          distanceKm: stopDist,
          type: 'fuel',
          description: `Refuel suggested here. Estimated refuel cost: ₹1500 - ₹2500.`
        });
      }
    }

    // Suggested Rest Breaks
    const restBreaks = [];
    if (durationHours > 2.5) {
      const minsToBreak = 120; // Suggest break after 2 hours
      const breakTime = addMinutesToTime(startTime, minsToBreak);
      
      let restStopName = 'Highway Nest Food Plaza';
      const dst = destination.toLowerCase();
      if (dst.includes('mysore')) restStopName = 'Mylari Express Highway Cafe';
      else if (dst.includes('coorg')) restStopName = 'Coorg Spices Hub & Rest Stop';
      else if (dst.includes('ooty')) restStopName = 'Hill View Highway Lounge';
      else if (dst.includes('chikkamagaluru')) restStopName = 'CCD Highway Junction';

      restBreaks.push({
        time: breakTime,
        name: restStopName,
        reason: `Fatigue Prevention: Trip duration is ${durationHours}h. A 15-minute walk and refreshments are recommended.`
      });
    }

    // Safety and Risk calculations
    let riskLevel = 'Low';
    let safetyMessage = 'All parameters are safe. Enjoy your journey!';
    let nightDriving = false;

    // Check night driving
    const startMins = timeToMinutes(startTime);
    if (startMins >= 1080 || startMins <= 300) {
      nightDriving = true;
    }

    if (!isRangeEnough) {
      riskLevel = 'High';
      safetyMessage = `Critical: Fuel/Battery range is insufficient (${availableRange.toFixed(0)} km available vs ${distanceKm} km required). Refueling/charging stop is mandatory.`;
    } else if (remainingBatteryOrFuel < 15) {
      riskLevel = 'Medium';
      safetyMessage = `Warning: Remaining range will be low (${remainingBatteryOrFuel}% left) upon arrival. Consider stopping at the recommended charger/fuel station.`;
    }

    if (nightDriving) {
      if (riskLevel === 'Low') {
        riskLevel = 'Medium';
        safetyMessage = 'Caution: Late evening/night driving detected. Visibility is reduced. Keep headlights on high-beam and driving speed moderate.';
      } else {
        riskLevel = 'High';
        safetyMessage += ' Additionally, night driving requires extra alertness.';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        source,
        destination,
        vehicleType,
        fuelOrBatteryLevel: level,
        mileageOrRange: range,
        passengers: passengers ? Number(passengers) : 1,
        tripDate,
        startTime,
        preference: preference || 'Fastest',
        distanceKm,
        durationHours,
        calculatedRange: Math.round(availableRange),
        isRangeEnough,
        remainingBatteryOrFuel,
        recommendedStops,
        restBreaks,
        riskLevel,
        safetyMessage,
        nightDriving
      }
    });
  } catch (error) {
    console.error('Error planning trip:', error);
    res.status(500).json({ error: 'Server error calculating trip plan' });
  }
});

// In-memory fallback history database when MongoDB is degraded/offline
const inMemoryHistory = [];

// POST /api/trip/save - save a planned trip to history
router.post('/save', async (req, res) => {
  try {
    const tripData = req.body;
    
    if (mongoose.connection.readyState === 1) {
      const trip = new Trip(tripData);
      await trip.save();
      return res.status(200).json({
        success: true,
        data: trip
      });
    } else {
      console.log('MongoDB is offline. Saving trip to in-memory fallback database.');
      const mockTrip = {
        ...tripData,
        _id: 'mem_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        createdAt: new Date()
      };
      inMemoryHistory.push(mockTrip);
      return res.status(200).json({
        success: true,
        data: mockTrip
      });
    }
  } catch (error) {
    console.error('Error saving trip to history:', error);
    res.status(500).json({ error: 'Server error saving trip' });
  }
});

// GET /api/trip/history - fetch all saved trips
router.get('/history', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const history = await Trip.find().sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        data: history
      });
    } else {
      console.log('MongoDB is offline. Fetching from in-memory fallback database.');
      const sortedHistory = [...inMemoryHistory].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({
        success: true,
        data: sortedHistory
      });
    }
  } catch (error) {
    console.error('Error fetching trip history:', error);
    res.status(500).json({ error: 'Server error fetching trip history' });
  }
});

// DELETE /api/trip/:id - delete a trip from history
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (mongoose.connection.readyState === 1) {
      await Trip.findByIdAndDelete(id);
      return res.status(200).json({
        success: true,
        message: 'Trip deleted successfully.'
      });
    } else {
      const index = inMemoryHistory.findIndex(t => t._id === id);
      if (index !== -1) {
        inMemoryHistory.splice(index, 1);
      }
      return res.status(200).json({
        success: true,
        message: 'Trip deleted from in-memory successfully.'
      });
    }
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Server error deleting trip' });
  }
});

export default router;
