import mongoose from 'mongoose';
import { createModelWrapper } from '../utils/mockDb.js';

const DriverStatusSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  fatigueLevel: { type: Number, required: true },
  eyeClosureStatus: { type: String, default: 'Open' },
  blinkCount: { type: Number, default: 0 },
  distractionStatus: { type: String, default: 'Focused' },
  breakNeeded: { type: Boolean, default: false },
  driverState: { type: String, default: 'Safe' },
  timestamp: { type: Date, default: Date.now }
});

const DriverStatusModel = mongoose.model('DriverStatus', DriverStatusSchema);
export default createModelWrapper('DriverStatus', DriverStatusSchema, DriverStatusModel);
