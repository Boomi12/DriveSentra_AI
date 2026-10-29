import mongoose from 'mongoose';
import { createModelWrapper } from '../utils/mockDb.js';

const PlaceRecommendationSchema = new mongoose.Schema({
  tripId: {
    type: String,
    required: true,
    index: true
  },
  destination: { type: String, required: true },
  attractions: [{
    name: { type: String },
    type: { type: String },
    location: { type: String },
    rating: { type: Number },
    description: { type: String }
  }],
  restaurants: [{
    name: { type: String },
    cuisine: { type: String },
    location: { type: String },
    rating: { type: Number },
    budget: { type: String }
  }],
  restStops: [{
    name: { type: String },
    type: { type: String },
    location: { type: String },
    facilities: [{ type: String }]
  }],
  haltingPlaces: [{
    name: { type: String },
    type: { type: String },
    rating: { type: Number },
    pricePerNight: { type: String }
  }],
  fuelChargingStops: [{
    name: { type: String },
    type: { type: String },
    status: { type: String },
    location: { type: String }
  }]
});

const PlaceRecommendationModel = mongoose.model('PlaceRecommendation', PlaceRecommendationSchema);
export default createModelWrapper('PlaceRecommendation', PlaceRecommendationSchema, PlaceRecommendationModel);
