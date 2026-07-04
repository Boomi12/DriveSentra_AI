import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  tripId: {
    type: String,
    required: true
  },
  stationName: {
    type: String,
    required: true
  },
  slot: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  vehicleNumber: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Booking', BookingSchema);
