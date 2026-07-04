import express from 'express';
import Booking from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';

const router = express.Router();

// POST /api/charging/book - Book a charging/refuel slot
router.post('/book', async (req, res) => {
  try {
    const { userId, tripId, stationName, slot, date, vehicleNumber } = req.body;

    if (!tripId || !stationName || !slot || !date) {
      return res.status(400).json({ error: 'Missing required booking parameters (tripId, stationName, slot, date)' });
    }

    let resolvedVehicleNumber = vehicleNumber;
    if (!resolvedVehicleNumber && userId) {
      const vehicle = await Vehicle.findOne({ userId });
      if (vehicle) {
        resolvedVehicleNumber = vehicle.number;
      }
    }

    const booking = new Booking({
      userId,
      tripId,
      stationName,
      slot,
      date,
      vehicleNumber: resolvedVehicleNumber || 'DEMO-VEHICLE'
    });

    await booking.save();
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error creating slot booking:', error);
    res.status(500).json({ error: 'Server error booking slot' });
  }
});

// GET /api/charging/bookings/:tripId - Get bookings for a specific tripId
router.get('/bookings/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const bookings = await Booking.find({ tripId });

    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Server error fetching bookings' });
  }
});

export default router;
