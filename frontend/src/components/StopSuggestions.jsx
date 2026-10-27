import React, { useState, useEffect } from 'react';
import { MapPin, AlertOctagon, CheckCircle2, ShieldAlert, Zap, Fuel, Calendar, Clock, Loader2, X } from 'lucide-react';
import { bookChargingSlot, getChargingBookings } from '../services/api';

const StopSuggestions = ({ vehicleType, isTripPossible, estimatedRange, tripDistance, stops }) => {
  const tripId = localStorage.getItem('gd_tripId');
  const savedForm = localStorage.getItem('gd_form');
  const tripDate = savedForm ? JSON.parse(savedForm).tripDate : new Date().toLocaleDateString('en-CA');
  const user = JSON.parse(localStorage.getItem('gd_user') || '{}');

  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookings, setBookings] = useState({});
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const timeSlots = [
    "08:00 AM - 08:45 AM",
    "10:00 AM - 10:45 AM",
    "12:00 PM - 12:45 PM",
    "02:00 PM - 02:45 PM",
    "04:00 PM - 04:45 PM",
    "06:00 PM - 06:45 PM"
  ];

  // Load existing bookings on mount or when tripId changes
  useEffect(() => {
    const fetchBookings = async () => {
      if (!tripId) return;
      try {
        const res = await getChargingBookings(tripId);
        if (res.success && res.data) {
          const mapping = {};
          res.data.forEach(b => {
            mapping[b.stationName] = b.slot;
          });
          setBookings(mapping);
        }
      } catch (err) {
        console.warn('Failed to load bookings from API, using offline local state:', err);
        // Fallback to local storage bookings if database fails
        const savedBookings = localStorage.getItem(`gd_bookings_${tripId}`);
        if (savedBookings) {
          setBookings(JSON.parse(savedBookings));
        }
      }
    };
    fetchBookings();
  }, [tripId]);

  const handleOpenBooking = (station) => {
    setSelectedStation(station);
    setSelectedSlot(bookings[station.name] || timeSlots[0]);
    setShowModal(true);
    setSuccessMessage('');
  };

  const handleConfirmBooking = async () => {
    if (!tripId || !selectedStation || !selectedSlot) return;
    setBookingLoading(true);
    setSuccessMessage('');

    const payload = {
      userId: user.id,
      tripId,
      stationName: selectedStation.name,
      slot: selectedSlot,
      date: tripDate,
      vehicleNumber: user.vehicleNumber || 'DEMO-1234'
    };

    try {
      const res = await bookChargingSlot(payload);
      if (res.success) {
        const newBookings = { ...bookings, [selectedStation.name]: selectedSlot };
        setBookings(newBookings);
        localStorage.setItem(`gd_bookings_${tripId}`, JSON.stringify(newBookings));
        setSuccessMessage('Slot booked successfully!');
        setTimeout(() => {
          setShowModal(false);
          setSelectedStation(null);
        }, 1500);
      }
    } catch (err) {
      console.warn('Backend booking failed, using local offline fallback booking:', err);
      // Local fallback booking save
      const newBookings = { ...bookings, [selectedStation.name]: selectedSlot };
      setBookings(newBookings);
      localStorage.setItem(`gd_bookings_${tripId}`, JSON.stringify(newBookings));
      setSuccessMessage('Booked successfully (Offline Mode)');
      setTimeout(() => {
        setShowModal(false);
        setSelectedStation(null);
      }, 1500);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Trip Feasibility Banner */}
      <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${isTripPossible
          ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5'
          : 'bg-rose-500/5 border-rose-500/20 shadow-lg shadow-rose-500/5'
        }`}>
        <div className="absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-10 -mt-10 opacity-30 bg-emerald-500"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-md ${isTripPossible
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
              {isTripPossible ? <CheckCircle2 className="h-6 w-6" /> : <AlertOctagon className="h-6 w-6" />}
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">ROUTE FEASIBILITY STATE</span>
              <h4 className={`text-lg font-black mt-0.5 tracking-tight ${isTripPossible ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isTripPossible ? 'SAFE TO CONTINUE' : 'STOPS REQUIRED'}
              </h4>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">RANGE VS. DISTANCE</span>
            <p className="text-xs text-slate-300 mt-1 font-semibold">
              Estimated Range: <span className="text-white font-bold font-mono">{estimatedRange} km</span> | Trip Distance: <span className="text-white font-bold font-mono">{tripDistance} km</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mt-4 pt-4 border-t border-slate-800/60 relative z-10">
          {isTripPossible
            ? `Your vehicle's active range is ${estimatedRange}km, which satisfies the target trip destination distance of ${tripDistance}km. No stops are mandatory for range requirements.`
            : `Warning: The target trip distance of ${tripDistance}km exceeds your current calculated range of ${estimatedRange}km. You must stop at refueling/charging facilities along the highway route.`}
        </p>
      </div>

      {/* Suggested Stations Timeline */}
      {!isTripPossible && stops && stops.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -ml-5 -mt-5"></div>

          <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
            <MapPin className="text-purple-400 h-4.5 w-4.5" />
            Recommended Stops Timeline ({stops.length})
          </h3>

          <div className="relative border-l border-slate-800/80 ml-3 pl-6 space-y-6">
            {stops.map((stop, idx) => (
              <div key={idx} className="relative group">
                {/* Timeline node icon */}
                <span className="absolute -left-[35px] top-0 h-[18px] w-[18px] rounded-full bg-slate-900 border-2 border-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {vehicleType === 'EV'
                    ? <Zap className="h-2 w-2 text-purple-400 fill-purple-400/10" />
                    : <Fuel className="h-2 w-2 text-orange-400" />
                  }
                </span>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-purple-500/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-white text-xs tracking-wide">{stop.name}</h4>
                    <span className="inline-block text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-1">{stop.type}</span>
                    
                    {bookings[stop.name] && (
                      <div className="mt-2 text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        Booked: {bookings[stop.name]}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                      <MapPin className="h-3 w-3 text-purple-400" />
                      <span className="text-[10px] text-purple-300 font-bold font-mono">{stop.distance} km</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleOpenBooking(stop)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md cursor-pointer active:scale-95 ${
                        bookings[stop.name]
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {bookings[stop.name] ? 'Update Slot' : 'Book Slot'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showModal && selectedStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-5 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                {vehicleType === 'EV' ? <Zap className="h-4.5 w-4.5 text-purple-400" /> : <Fuel className="h-4.5 w-4.5 text-orange-400" />}
                Slot Booking Prototype
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {successMessage ? (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 animate-bounce" />
                <h4 className="text-xs font-bold text-white mb-1">Booking Confirmed</h4>
                <p className="text-[11px] text-slate-300 leading-normal">
                  {successMessage}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase">STATION</span>
                  <span className="block text-xs font-bold text-white mt-0.5">{selectedStation.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      DATE
                    </span>
                    <span className="block text-xs font-bold text-slate-200 mt-1 font-mono">{tripDate}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      DRIVETRAIN
                    </span>
                    <span className="block text-xs font-bold text-slate-200 mt-1">{vehicleType}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase mb-2">
                    SELECT AVAILABLE SLOT
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-2 border rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-800'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={bookingLoading}
                  onClick={handleConfirmBooking}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {bookingLoading ? (
                    <>
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                      Reserving Slot...
                    </>
                  ) : (
                    <>
                      Confirm Booking Slot
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StopSuggestions;
