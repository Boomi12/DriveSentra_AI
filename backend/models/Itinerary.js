import mongoose from 'mongoose';

const ItinerarySchema = new mongoose.Schema({
  tripId: {
    type: String,
    required: true,
    unique: true
  },
  userId: { type: String, index: true },
  source: { type: String, required: true },
  destination: { type: String, required: true },
  tripType: { type: String, required: true },
  foodPreference: { type: String, required: true },
  budget: { type: String, required: true },
  vehicleType: { type: String, required: true },
  tripDate: { type: String },
  startTime: { type: String },
  fuelOrBatteryLevel: { type: Number, default: 85 },
  mileageOrRange: { type: Number, default: 340 },
  durationDays: { type: Number, default: 1 },
  tripStyle: { type: String, default: 'Balanced' }, // Relaxed, Balanced, Packed
  interests: [{ type: String }],
  sourcePlaceId: { type: String },
  destinationPlaceId: { type: String },
  sourceCoords: {
    lat: { type: Number },
    lng: { type: Number }
  },
  destinationCoords: {
    lat: { type: Number },
    lng: { type: Number }
  },
  sourceAddress: { type: String },
  destinationAddress: { type: String },
  weatherData: {
    temperature: { type: Number },
    condition: { type: String },
    windSpeed: { type: Number },
    description: { type: String }
  },
  tripMode: { type: String, default: 'Round Trip' },
  isFeasible: { type: Boolean, default: true },
  infeasibilityDetails: {
    reason: { type: String },
    alternatives: [{ type: String }]
  },
  roundTripMetrics: {
    totalDistanceKm: { type: Number },
    totalDrivingMinutes: { type: Number },
    totalTripDurationMinutes: { type: Number },
    returnTime: { type: String },
    returnDay: { type: Number }
  },
  overnightHalt: {
    place: { type: String },
    day: { type: Number },
    checkInTime: { type: String },
    checkOutTime: { type: String },
    address: { type: String }
  },
  infeasible: [{
    place: { type: String },
    reason: { type: String }
  }],
  isActive: { type: Boolean, default: true },
  timeline: [{
    id: { type: String },
    day: { type: Number, default: 1 },
    date: { type: String },
    time: { type: String, required: true },
    endTime: { type: String },
    duration: { type: Number, default: 60 },
    place: { type: String, required: true },
    purpose: { type: String, required: true },
    reason: { type: String, required: true },
    travelTimeFromPrevious: { type: String },
    distanceFromPrevious: { type: Number, default: 0 },
    isOpen: { type: Boolean, default: true },
    isPinned: { type: Boolean, default: false },
    pinnedTime: { type: String },
    isOvernight: { type: Boolean, default: false },
    isReturnArrival: { type: Boolean, default: false },
    waitTime: { type: String },
    activityStartTime: { type: String },
    warning: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    placeId: { type: String },
    address: { type: String },
    autoFixed: { type: Boolean, default: false },
    autoFixMessage: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Itinerary', ItinerarySchema);
