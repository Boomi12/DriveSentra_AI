import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  MapPin, 
  Navigation, 
  ArrowRight, 
  Loader2, 
  Users, 
  Activity, 
  ShieldAlert, 
  ShieldCheck, 
  Shield, 
  Battery, 
  Fuel, 
  Save, 
  Trash2, 
  AlertTriangle, 
  Coffee, 
  Info 
} from 'lucide-react';
import { planTrip, saveTrip, getTripHistory, deleteTrip } from '../services/api';
import { getCurrentDate, getCurrentTimeRounded, validateTripStart } from '../utils/timeValidation';

const TripPlanner = () => {
  const [formData, setFormData] = useState({
    source: 'Bangalore',
    destination: 'Mysore',
    vehicleType: 'EV',
    fuelOrBatteryLevel: 85,
    mileageOrRange: 340,
    tripDate: getCurrentDate(),
    startTime: getCurrentTimeRounded(),
    passengers: 1,
    preference: 'Fastest'
  });

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [tripPlan, setTripPlan] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await getTripHistory();
      if (res.success) {
        setHistory(res.data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, []);

  // Fetch history on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      loadHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  // Derived immediate frontend validation
  const formErrors = useMemo(() => {
    const errors = {};

    // Source & Destination validation
    if (!formData.source.trim()) {
      errors.source = "Starting location is required.";
    }
    if (!formData.destination.trim()) {
      errors.destination = "Destination is required.";
    }
    if (formData.source.trim() && formData.destination.trim() && 
        formData.source.toLowerCase().trim() === formData.destination.toLowerCase().trim()) {
      errors.destination = "Starting location and destination cannot be the same.";
    }

    // Battery/Fuel validation
    const level = Number(formData.fuelOrBatteryLevel);
    if (isNaN(level) || level < 1 || level > 100) {
      errors.fuelOrBatteryLevel = "Must be between 1% and 100%.";
    }

    // Mileage/Range validation
    const range = Number(formData.mileageOrRange);
    if (isNaN(range) || range <= 0) {
      errors.mileageOrRange = "Range must be a positive number.";
    }

    // Passengers validation
    const passengers = Number(formData.passengers);
    if (isNaN(passengers) || passengers < 1) {
      errors.passengers = "Must be at least 1 passenger.";
    }

    // Date & Time validation
    const dateCheck = validateTripStart(formData.tripDate, formData.startTime);
    if (!dateCheck.valid) {
      if (dateCheck.reason === 'PAST_DATE') {
        errors.tripDate = dateCheck.message;
      } else if (dateCheck.reason === 'PAST_TIME') {
        errors.startTime = dateCheck.message;
      }
    }

    return errors;
  }, [formData]);

  const isFormValid = useMemo(() => Object.keys(formErrors).length === 0, [formErrors]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Auto-set ranges based on typical values for vehicle types
      if (name === 'vehicleType') {
        if (value === 'EV') {
          updated.mileageOrRange = 340;
          updated.fuelOrBatteryLevel = 85;
        } else if (value === 'Petrol') {
          updated.mileageOrRange = 580;
          updated.fuelOrBatteryLevel = 70;
        } else if (value === 'Diesel') {
          updated.mileageOrRange = 720;
          updated.fuelOrBatteryLevel = 60;
        } else if (value === 'Hybrid') {
          updated.mileageOrRange = 650;
          updated.fuelOrBatteryLevel = 75;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await planTrip(formData);
      if (res.success) {
        setTripPlan(res.data);
      }
    } catch (err) {
      setError(err.error || err.message || 'An error occurred during calculations. Check if the server is active.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrip = async () => {
    if (!tripPlan) return;
    setSaveLoading(true);
    setError(null);
    
    try {
      const res = await saveTrip(tripPlan);
      if (res.success) {
        setSaveSuccess(true);
        loadHistory();
      }
    } catch (err) {
      setError(err.error || err.message || 'Could not save trip.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this trip from history?")) return;
    try {
      await deleteTrip(id);
      loadHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadHistoryItem = (trip) => {
    setTripPlan(trip);
    setFormData({
      source: trip.source,
      destination: trip.destination,
      vehicleType: trip.vehicleType,
      fuelOrBatteryLevel: trip.fuelOrBatteryLevel,
      mileageOrRange: trip.mileageOrRange,
      tripDate: trip.tripDate,
      startTime: trip.startTime,
      passengers: trip.passengers || 1,
      preference: trip.preference || 'Fastest'
    });
  };

  const timeOptions = [
    '06:00 AM', '07:30 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:30 AM',
    '12:00 PM', '01:00 PM', '01:30 PM', '02:30 PM', '03:30 PM', '04:00 PM',
    '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM',
    '11:00 PM', '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM', '05:00 AM'
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
          Smart Trip Planner
        </h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base">
          Analyze vehicle range constraints, schedule charging/refueling stops, and mitigate journey safety risks automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input Form & History */}
        <div className="lg:col-span-4 space-y-6">
          {/* Trip configuration form */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-purple-500/20 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Navigation className="text-purple-400 h-5 w-5" />
              Configure Route
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Source */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Starting Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input
                    type="text"
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Bangalore"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors"
                  />
                </div>
                {formErrors.source && (
                  <span className="text-[9px] text-red-400 mt-1 block font-medium">{formErrors.source}</span>
                )}
              </div>

              {/* Destination */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Destination
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 h-4 w-4" />
                  <input
                    type="text"
                    name="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Mysore"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors"
                  />
                </div>
                {formErrors.destination && (
                  <span className="text-[9px] text-red-400 mt-1 block font-medium">{formErrors.destination}</span>
                )}
              </div>

              {/* Vehicle parameters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors appearance-none"
                  >
                    <option value="EV">Electric (EV)</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Preference
                  </label>
                  <select
                    name="preference"
                    value={formData.preference}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors appearance-none"
                  >
                    <option value="Fastest">Fastest</option>
                    <option value="Safest">Safest Route</option>
                    <option value="Scenic">Scenic Road</option>
                  </select>
                </div>
              </div>

              {/* Fuel Level & Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    {formData.vehicleType === 'EV' ? 'Battery level (%)' : 'Fuel Level (%)'}
                  </label>
                  <input
                    type="number"
                    name="fuelOrBatteryLevel"
                    min="1"
                    max="100"
                    value={formData.fuelOrBatteryLevel}
                    onChange={handleChange}
                    required
                    className={`w-full bg-slate-950 border rounded-lg py-1.5 px-3 text-white text-xs focus:outline-none transition-colors ${
                      formErrors.fuelOrBatteryLevel
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-slate-800 focus:border-purple-500/80'
                    }`}
                  />
                  {formErrors.fuelOrBatteryLevel && (
                    <span className="text-[9px] text-red-400 mt-1 block font-medium">{formErrors.fuelOrBatteryLevel}</span>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    {formData.vehicleType === 'EV' ? 'Max Range (km)' : 'Tank Range (km)'}
                  </label>
                  <input
                    type="number"
                    name="mileageOrRange"
                    min="1"
                    value={formData.mileageOrRange}
                    onChange={handleChange}
                    required
                    className={`w-full bg-slate-950 border rounded-lg py-1.5 px-3 text-white text-xs focus:outline-none transition-colors ${
                      formErrors.mileageOrRange
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-slate-800 focus:border-purple-500/80'
                    }`}
                  />
                  {formErrors.mileageOrRange && (
                    <span className="text-[9px] text-red-400 mt-1 block font-medium">{formErrors.mileageOrRange}</span>
                  )}
                </div>
              </div>

              {/* Trip Date & Start Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Trip Date
                  </label>
                  <input
                    type="date"
                    name="tripDate"
                    value={formData.tripDate}
                    onChange={handleChange}
                    required
                    className={`w-full bg-slate-950 border rounded-lg py-1.5 px-3 text-white text-xs focus:outline-none transition-colors ${
                      formErrors.tripDate 
                        ? 'border-red-500 focus:border-red-500' 
                        : 'border-slate-800 focus:border-purple-500/80'
                    }`}
                  />
                  {formErrors.tripDate && (
                    <span className="text-[9px] text-red-400 mt-1 block font-medium">{formErrors.tripDate}</span>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Start Time
                  </label>
                  <select
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    className={`w-full bg-slate-950 border rounded-lg py-2 px-3 text-white text-xs focus:outline-none transition-colors appearance-none cursor-pointer ${
                      formErrors.startTime
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-slate-800 focus:border-purple-500/80'
                    }`}
                  >
                    {timeOptions.map((time, idx) => (
                      <option key={idx} value={time}>{time}</option>
                    ))}
                  </select>
                  {formErrors.startTime && (
                    <span className="text-[9px] text-red-400 mt-1 block font-medium">{formErrors.startTime}</span>
                  )}
                </div>
              </div>

              {/* Passengers */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Number of Passengers
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input
                    type="number"
                    name="passengers"
                    min="1"
                    value={formData.passengers}
                    onChange={handleChange}
                    required
                    className={`w-full bg-slate-950 border rounded-lg py-2 pl-9 pr-4 text-white text-xs focus:outline-none transition-colors ${
                      formErrors.passengers
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-slate-800 focus:border-purple-500/80'
                    }`}
                  />
                </div>
                {formErrors.passengers && (
                  <span className="text-[9px] text-red-400 mt-1 block font-medium">{formErrors.passengers}</span>
                )}
              </div>

              {/* Validation alert bar */}
              <div className={`mt-2 py-1.5 px-3 rounded-lg border text-[10px] font-semibold flex items-center justify-between transition-all ${
                isFormValid 
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/5 border-rose-500/20 text-rose-400 animate-pulse'
              }`}>
                <span>Config Validation:</span>
                <span>
                  {isFormValid 
                    ? 'Ready for Analysis' 
                    : `⚠️ Correct fields before planning.`}
                </span>
              </div>

              <button
                type="submit"
                disabled={!isFormValid || loading}
                className={`w-full text-white rounded-lg py-2.5 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 mt-3 shadow-md ${
                  !isFormValid
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 border border-slate-700'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 cursor-pointer hover:shadow-purple-500/15'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    Calculating Metrics...
                  </>
                ) : (
                  <>
                    Calculate Trip Plan
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-3 p-2.5 bg-red-950/40 border border-red-500/20 rounded-lg text-red-300 text-[11px] leading-relaxed">
                {error}
              </div>
            )}
          </div>

          {/* Trip History Section */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2 pb-2 border-b border-slate-800">
              <Activity className="text-blue-400 h-4.5 w-4.5" />
              Saved Routes History ({history.length})
            </h2>

            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
              {history.length === 0 ? (
                <p className="text-slate-500 text-xs py-4 text-center">No saved trips found.</p>
              ) : (
                history.map((trip) => (
                  <div 
                    key={trip._id}
                    onClick={() => handleLoadHistoryItem(trip)}
                    className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-purple-500/20 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-white text-xs truncate max-w-[90px]">{trip.source}</span>
                        <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                        <span className="font-extrabold text-purple-300 text-xs truncate max-w-[90px]">{trip.destination}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                        <span>{trip.vehicleType}</span>
                        <span>•</span>
                        <span>{trip.tripDate}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistoryItem(trip._id, e)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-red-500/10 opacity-30 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Delete trip"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Output Results Dashboard */}
        <div className="lg:col-span-8 space-y-6">
          {tripPlan ? (
            <div className="space-y-6 animate-scale-up">
              {/* Trip Header Status */}
              <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15">
                      ROUTE PREFERENCE: {tripPlan.preference.toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-extrabold font-mono px-2 py-0.5 rounded border ${
                      tripPlan.riskLevel === 'High' 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                        : tripPlan.riskLevel === 'Medium'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      RISK LEVEL: {tripPlan.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-2 flex items-center gap-2">
                    {tripPlan.source} <ArrowRight className="h-4 w-4 text-purple-400" /> {tripPlan.destination}
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Scheduled for {tripPlan.tripDate} starting at {tripPlan.startTime} with {tripPlan.passengers} passenger(s)
                  </p>
                </div>

                <div className="flex gap-2 self-start md:self-auto">
                  <button
                    onClick={handleSaveTrip}
                    disabled={saveLoading || saveSuccess}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      saveSuccess
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-not-allowed'
                        : 'bg-purple-600/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50'
                    }`}
                  >
                    {saveLoading ? (
                      <>
                        <Loader2 className="animate-spin h-3.5 w-3.5" />
                        Saving...
                      </>
                    ) : saveSuccess ? (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Trip Saved
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Save Journey
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Main metrics display */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Distance Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-md">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Estimated Distance</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-black text-white">{tripPlan.distanceKm}</span>
                    <span className="text-xs text-slate-400 font-bold">km</span>
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-1 font-medium">Mock Map Calculation</span>
                </div>

                {/* Duration Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-md">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Estimated Time</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-black text-white">{tripPlan.durationHours}</span>
                    <span className="text-xs text-slate-400 font-bold">hrs</span>
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-1 font-medium">Highway speeds avg</span>
                </div>

                {/* Range Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-md">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Initial Range</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-black text-white">{tripPlan.calculatedRange}</span>
                    <span className="text-xs text-slate-400 font-bold">km</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {tripPlan.vehicleType === 'EV' ? (
                      <Battery className="h-3 w-3 text-purple-400" />
                    ) : (
                      <Fuel className="h-3 w-3 text-blue-400" />
                    )}
                    <span className="text-[10px] text-slate-400 font-semibold">{tripPlan.fuelOrBatteryLevel}% battery/fuel</span>
                  </div>
                </div>

                {/* Remaining Card */}
                <div className={`bg-slate-900/60 border rounded-2xl p-4 shadow-md ${
                  tripPlan.remainingBatteryOrFuel < 0 
                    ? 'border-rose-500/30 bg-rose-950/5' 
                    : 'border-slate-800'
                }`}>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Remaining at Dest.</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className={`text-2xl font-black ${
                      tripPlan.remainingBatteryOrFuel < 0 
                        ? 'text-rose-400' 
                        : tripPlan.remainingBatteryOrFuel < 15
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {tripPlan.remainingBatteryOrFuel < 0 ? '0' : tripPlan.remainingBatteryOrFuel}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">%</span>
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-1 font-medium">
                    {tripPlan.remainingBatteryOrFuel < 0 
                      ? 'Out of battery/fuel' 
                      : `${Math.round((tripPlan.remainingBatteryOrFuel / 100) * tripPlan.mileageOrRange)} km left`}
                  </span>
                </div>
              </div>

              {/* Stop suggestions & Rest Breaks Dashboard Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fuel/Charging Stops Suggestions */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        {tripPlan.vehicleType === 'EV' ? (
                          <>
                            <Battery className="h-4.5 w-4.5 text-purple-400" />
                            EV Charging Recommendation
                          </>
                        ) : (
                          <>
                            <Fuel className="h-4.5 w-4.5 text-blue-400" />
                            Refueling Stop Suggestions
                          </>
                        )}
                      </h4>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        tripPlan.isRangeEnough ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                      }`}>
                        {tripPlan.isRangeEnough ? 'Range Sufficient' : 'Refuel Required'}
                      </span>
                    </div>

                    <div className="mt-4 space-y-4">
                      {tripPlan.recommendedStops.length === 0 ? (
                        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center gap-2">
                          <Info className="h-4 w-4 text-emerald-400 shrink-0" />
                          <p className="text-[11px] text-slate-400 leading-normal">
                            Your starting vehicle range of <b>{tripPlan.calculatedRange} km</b> is fully sufficient to cover the <b>{tripPlan.distanceKm} km</b> trip safely. No mid-route energy stops required.
                          </p>
                        </div>
                      ) : (
                        tripPlan.recommendedStops.map((stop, index) => (
                          <div key={index} className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl relative overflow-hidden group hover:border-purple-500/20 transition-all">
                            <div className="absolute top-0 right-0 p-3">
                              <span className="text-[10px] font-black text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded">
                                Stop at {stop.distanceKm} km
                              </span>
                            </div>
                            <h5 className="font-bold text-white text-xs">{stop.name}</h5>
                            <p className="text-slate-400 text-[10px] mt-1 pr-16">{stop.description}</p>
                            <p className="text-slate-500 text-[9px] mt-2 font-mono">
                              * Location ready for integration with Google Maps/Mapbox APIs
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Mileage/Analytics details card inside stops */}
                  <div className="mt-4 p-3 bg-slate-950/30 border border-dashed border-slate-800 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">
                      {tripPlan.vehicleType === 'EV' ? 'Battery Degradation Predictor' : 'Mileage Efficiency Factors'}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {tripPlan.vehicleType === 'EV' 
                        ? 'Estimated efficiency: 16.5 kWh/100km. Degradation index: Low (0.02% health impact).' 
                        : `Estimated mileage: 15.2 km/l. Fuel grade recommendation: Premium octane for optimal highway performance.`}
                    </p>
                  </div>
                </div>

                {/* Rest Breaks Cards */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <Coffee className="h-4.5 w-4.5 text-amber-400" />
                        Suggested Rest Breaks
                      </h4>
                      <span className="text-[9px] text-slate-400 font-mono">
                        Limit: 2.5 hrs continuous
                      </span>
                    </div>

                    <div className="mt-4 space-y-4">
                      {tripPlan.restBreaks.length === 0 ? (
                        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center gap-2">
                          <Info className="h-4 w-4 text-emerald-400 shrink-0" />
                          <p className="text-[11px] text-slate-400 leading-normal">
                            This trip duration is approximately <b>{tripPlan.durationHours} hours</b>. Since it is below the 2.5 hour safety limit, no intermediate rest breaks are strictly mandated.
                          </p>
                        </div>
                      ) : (
                        tripPlan.restBreaks.map((item, index) => (
                          <div key={index} className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl relative overflow-hidden group hover:border-amber-500/20 transition-all">
                            <div className="absolute top-0 right-0 p-3">
                              <span className="text-[10px] font-black text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded">
                                Break at {item.time}
                              </span>
                            </div>
                            <h5 className="font-bold text-white text-xs">{item.name}</h5>
                            <p className="text-slate-400 text-[10px] mt-1 pr-16">{item.reason}</p>
                            <p className="text-slate-500 text-[9px] mt-2 font-mono">
                              * Spot suggestion optimized based on traveler reviews
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Safety advisory */}
                  <div className="mt-4 p-3 bg-slate-950/30 border border-dashed border-slate-800 rounded-xl flex items-start gap-2">
                    <Shield className="h-4.5 w-4.5 text-purple-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">DriveSentra Journey Advisory</span>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                        Ensure seatbelts are fastened for all {tripPlan.passengers} passenger(s). Drive safely!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Assessment & Safety Message card */}
              <div className={`p-5 border rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden ${
                tripPlan.riskLevel === 'High'
                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                  : tripPlan.riskLevel === 'Medium'
                  ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
              }`}>
                {/* Backdrop Glow */}
                <div className={`absolute -right-10 -bottom-10 h-36 w-36 rounded-full blur-3xl opacity-20 ${
                  tripPlan.riskLevel === 'High' ? 'bg-rose-500' : tripPlan.riskLevel === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                }`}></div>

                <div className="flex items-start gap-4">
                  {tripPlan.riskLevel === 'High' ? (
                    <ShieldAlert className="h-10 w-10 text-rose-400 mt-1 shrink-0" />
                  ) : tripPlan.riskLevel === 'Medium' ? (
                    <AlertTriangle className="h-10 w-10 text-amber-400 mt-1 shrink-0" />
                  ) : (
                    <ShieldCheck className="h-10 w-10 text-emerald-400 mt-1 shrink-0" />
                  )}

                  <div>
                    <h4 className="font-extrabold text-white text-base">
                      {tripPlan.riskLevel === 'High' 
                        ? 'High Hazard Level Detected' 
                        : tripPlan.riskLevel === 'Medium'
                        ? 'Moderate Safety Caution Advised'
                        : 'Safe Journey Clearance Approved'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-xl leading-relaxed">
                      {tripPlan.safetyMessage}
                    </p>
                    
                    {tripPlan.nightDriving && (
                      <div className="mt-2.5 p-2 bg-slate-950/50 rounded-lg border border-slate-800 text-[10px] text-amber-300 flex items-center gap-1.5 max-w-lg">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span><b>Night Driving Mode Active:</b> Reduced lighting requires defensive driving, low headlight adjustment, and extra awareness.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="self-end md:self-auto flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">DriveSentra Safety Score</span>
                  <span className={`text-3xl font-black mt-1 font-mono ${
                    tripPlan.riskLevel === 'High' ? 'text-rose-400' : tripPlan.riskLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {tripPlan.riskLevel === 'High' ? '42/100' : tripPlan.riskLevel === 'Medium' ? '74/100' : '98/100'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Placeholder Card
            <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[480px]">
              <div className="h-16 w-16 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-4 text-purple-400">
                <Navigation className="h-8 w-8 animate-pulse" />
              </div>
              <h3 className="text-white font-bold text-lg">No Active Trip Plan Generated</h3>
              <p className="text-slate-500 text-xs mt-2 max-w-sm mx-auto leading-relaxed">
                Configure your starting location, destination, vehicle parameters, and preferences on the left panel to execute a safety metrics analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripPlanner;
