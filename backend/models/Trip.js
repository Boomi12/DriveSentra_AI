import mongoose from 'mongoose';
import { createModelWrapper } from '../utils/mockDb.js';

const TripSchema = new mongoose.Schema({
  source: { type: String, required: true },
  destination: { type: String, required: true },
  vehicleType: { type: String, required: true },
  fuelOrBatteryLevel: { type: Number, required: true },
  mileageOrRange: { type: Number, required: true },
  passengers: { type: Number, default: 1 },
  preference: { type: String, default: 'Fastest' },
  tripDate: { type: String, required: true },
  startTime: { type: String, required: true },
  
  // Calculated trip results
  distanceKm: { type: Number },
  durationHours: { type: Number },
  calculatedRange: { type: Number },
  isRangeEnough: { type: Boolean },
  remainingBatteryOrFuel: { type: Number },
  recommendedStops: [{
    name: { type: String },
    distanceKm: { type: Number },
    type: { type: String } // "charging", "fuel", "rest"
  }],
  restBreaks: [{
    time: { type: String },
    reason: { type: String }
  }],
  riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  safetyMessage: { type: String },
  
  createdAt: { type: Date, default: Date.now }
});

const TripModel = mongoose.model('Trip', TripSchema);
export default createModelWrapper('Trip', TripSchema, TripModel);
