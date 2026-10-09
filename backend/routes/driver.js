import express from 'express';
import mongoose from 'mongoose';
import DriverStatus from '../models/DriverStatus.js';

const router = express.Router();

// Fallback in-memory logs
const inMemoryLogs = [];

// Helper to determine fatigue state and break status
function evaluateFatigue(level) {
  const fatigueLevel = Number(level);
  let state = 'Safe';
  let breakNeeded = false;

  if (fatigueLevel < 40) {
    state = 'Safe';
  } else if (fatigueLevel >= 40 && fatigueLevel <= 70) {
    state = 'Drowsy';
  } else if (fatigueLevel > 70 && fatigueLevel <= 80) {
    state = 'Warning';
    breakNeeded = true;
  } else {
    state = 'Critical';
    breakNeeded = true;
  }

  return { driverState: state, breakNeeded };
}

// POST /api/driver/fatigue - Save driver fatigue status
router.post('/fatigue', async (req, res) => {
  try {
    const { userId, fatigueLevel, eyeClosureStatus, blinkCount, distractionStatus } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (fatigueLevel === undefined || isNaN(Number(fatigueLevel))) {
      return res.status(400).json({ success: false, error: 'fatigueLevel is required and must be a number' });
    }

    const { driverState, breakNeeded } = evaluateFatigue(fatigueLevel);

    const logData = {
      userId,
      fatigueLevel: Number(fatigueLevel),
      eyeClosureStatus: eyeClosureStatus || 'Open',
      blinkCount: blinkCount !== undefined ? Number(blinkCount) : 0,
      distractionStatus: distractionStatus || 'Focused',
      driverState,
      breakNeeded,
      timestamp: new Date()
    };

    if (mongoose.connection.readyState === 1) {
      const newLog = new DriverStatus(logData);
      await newLog.save();
      return res.status(201).json({
        success: true,
        data: newLog
      });
    } else {
      console.log('MongoDB offline. Saving DriverStatus to in-memory store.');
      const mockLog = {
        _id: 'ds_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        ...logData
      };
      inMemoryLogs.push(mockLog);
      return res.status(201).json({
        success: true,
        data: mockLog
      });
    }
  } catch (err) {
    console.error('Error saving driver status:', err);
    res.status(500).json({ success: false, error: 'Server error saving fatigue status' });
  }
});

// GET /api/driver/logs/:userId - Get driver logs history
router.get('/logs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (mongoose.connection.readyState === 1) {
      const logs = await DriverStatus.find({ userId }).sort({ timestamp: -1 });
      return res.status(200).json({
        success: true,
        data: logs
      });
    } else {
      console.log('MongoDB offline. Fetching DriverStatus logs from in-memory store.');
      const filteredLogs = inMemoryLogs
        .filter(l => l.userId === userId)
        .sort((a, b) => b.timestamp - a.timestamp);
      return res.status(200).json({
        success: true,
        data: filteredLogs
      });
    }
  } catch (err) {
    console.error('Error fetching driver logs:', err);
    res.status(500).json({ success: false, error: 'Server error fetching fatigue logs' });
  }
});

// GET /api/driver/status/:userId - Get the latest driver status only
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (mongoose.connection.readyState === 1) {
      const status = await DriverStatus.findOne({ userId }).sort({ timestamp: -1 });
      return res.status(200).json({
        success: true,
        data: status
      });
    } else {
      console.log('MongoDB offline. Fetching latest DriverStatus from in-memory store.');
      const filteredLogs = inMemoryLogs.filter(l => l.userId === userId);
      const latest = filteredLogs.length > 0 
        ? [...filteredLogs].sort((a, b) => b.timestamp - a.timestamp)[0]
        : null;
      return res.status(200).json({
        success: true,
        data: latest
      });
    }
  } catch (err) {
    console.error('Error fetching latest driver status:', err);
    res.status(500).json({ success: false, error: 'Server error fetching latest driver status' });
  }
});

export default router;
