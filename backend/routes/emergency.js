import express from 'express';
import mongoose from 'mongoose';
import EmergencyAlert from '../models/EmergencyAlert.js';

const router = express.Router();

// Fallback in-memory history
const inMemoryAlerts = [];

// POST /api/emergency/alert - Dispatch alert and save
router.post('/alert', async (req, res) => {
  try {
    const {
      userId,
      driverName,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactEmail,
      currentLocation,
      alertReason
    } = req.body;

    // Validation
    if (!userId || !driverName || !emergencyContactName || !emergencyContactPhone || !emergencyContactEmail || !currentLocation || !alertReason) {
      return res.status(400).json({ success: false, error: 'All fields are required to send an emergency alert.' });
    }

    // Mock notification dispatch (console logging Nodemailer/Twilio behavior)
    console.log(`\n=================== [MOCK EMERGENCY ALERT SENT] ===================`);
    console.log(`[Twilio SMS] Dispatching to: ${emergencyContactPhone}`);
    console.log(`Content: "CRITICAL ALERT: Driver ${driverName} requires immediate assistance. Reason: ${alertReason}. Location: ${currentLocation}."`);
    console.log(`[Nodemailer Email] Sending to: ${emergencyContactEmail}`);
    console.log(`Subject: [DRIVESENTRA AI] EMERGENCY ALERT - ${driverName}`);
    console.log(`Body:\nHello ${emergencyContactName},\nThis is an automated emergency message from DriveSentra AI.\n\nDriver: ${driverName}\nLocation: ${currentLocation}\nReason: ${alertReason}\n\nPlease check on them immediately.\n`);
    console.log(`===================================================================\n`);

    const alertData = {
      userId,
      driverName,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactEmail,
      currentLocation,
      alertReason,
      alertStatus: 'Sent',
      sentAt: new Date()
    };

    if (mongoose.connection.readyState === 1) {
      const newAlert = new EmergencyAlert(alertData);
      await newAlert.save();
      return res.status(200).json({
        success: true,
        message: 'Emergency Alert: Sent to contact',
        alertStatus: 'Sent',
        data: newAlert
      });
    } else {
      console.log('MongoDB offline. Saving EmergencyAlert to in-memory store.');
      const mockAlert = {
        _id: 'ea_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        ...alertData
      };
      inMemoryAlerts.push(mockAlert);
      return res.status(200).json({
        success: true,
        message: 'Emergency Alert: Sent to contact',
        alertStatus: 'Sent',
        data: mockAlert
      });
    }
  } catch (err) {
    console.error('Error sending emergency alert:', err);
    res.status(500).json({ success: false, error: 'Server error dispatching emergency alert' });
  }
});

// GET /api/emergency/history/:userId - Fetch alert history for a user
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (mongoose.connection.readyState === 1) {
      const history = await EmergencyAlert.find({ userId }).sort({ sentAt: -1 });
      return res.status(200).json({
        success: true,
        data: history
      });
    } else {
      console.log('MongoDB offline. Fetching EmergencyAlerts from in-memory store.');
      const filteredAlerts = inMemoryAlerts
        .filter(a => a.userId === userId)
        .sort((a, b) => b.sentAt - a.sentAt);
      return res.status(200).json({
        success: true,
        data: filteredAlerts
      });
    }
  } catch (err) {
    console.error('Error fetching alert history:', err);
    res.status(500).json({ success: false, error: 'Server error fetching emergency history' });
  }
});

export default router;
