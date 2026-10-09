import mongoose from 'mongoose';
import { createModelWrapper } from '../utils/mockDb.js';

const EmergencyAlertSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  driverName: { type: String, required: true },
  emergencyContactName: { type: String, required: true },
  emergencyContactPhone: { type: String, required: true },
  emergencyContactEmail: { type: String, required: true },
  currentLocation: { type: String, required: true },
  alertReason: { type: String, required: true },
  alertStatus: { type: String, default: 'Sent' },
  sentAt: { type: Date, default: Date.now }
});

const EmergencyAlertModel = mongoose.model('EmergencyAlert', EmergencyAlertSchema);
export default createModelWrapper('EmergencyAlert', EmergencyAlertSchema, EmergencyAlertModel);
