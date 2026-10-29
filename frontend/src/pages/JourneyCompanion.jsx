import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Compass, ArrowRight, Loader2, CalendarRange, Car, Plus, Trash2, Check, Search, PlusCircle, Sparkles, ShieldAlert, Info, RotateCcw, CheckCircle2, ChevronUp, ChevronDown, Pin, Clock, X, Lock } from 'lucide-react';
import { 
  generateItinerary, 
  recommendPlaces, 
  getItinerary, 
  getVehicle,
  getActiveItinerary,
  applyItineraryFix,
  getAutocompletePredictions,
  insertItineraryStop,
  removeItineraryStop,
  reorderItineraryStops,
  updateStopDurationApi,
  toggleStopPinApi
} from '../services/api';
import { 
  getCurrentDate, 
  getCurrentTimeRounded, 
  validateTripStart, 
  timeToMinutes, 
  getLocalSpecs, 
  isPastTimeToday,
  getLocalPlaceTimeStatus,
  calculateClientRoundTripMetrics,
  recalculateScheduleClient
} from '../utils/timeValidation';

const filterRecommendationItems = (items, query = '') => {
  if (!items || !Array.isArray(items)) return [];
  const q = (query || '').toLowerCase().trim();
  if (!q) return items;
  return items.filter(item => {
    if (!item) return false;
    const matchName = (item.name || "").toLowerCase().includes(q);
    const matchType = (item.type || "").toLowerCase().includes(q);
    const matchTags = (item.tags || []).some(tag => (tag || "").toLowerCase().includes(q));
    const matchLocation = (item.location || "").toLowerCase().includes(q);
    const matchCuisine = (item.cuisine || "").toLowerCase().includes(q);
    const matchDesc = (item.description || "").toLowerCase().includes(q);
    const matchBudget = (item.budget || "").toLowerCase().includes(q);
    return matchName || matchType || matchTags || matchLocation || matchCuisine || matchDesc || matchBudget;
  });
};

const InspectModal = ({
  selectedPlace,
  onClose,
  isPlaceInTimeline,
  selectedTimes,
  handleCardTimeChange,
  timeOptions,
  checkCardFeasibility,
  handleAddRecommendation,
  handleRemovePlace
}) => {
  if (!selectedPlace) return null;
  const { item, type } = selectedPlace;
  const added = isPlaceInTimeline(item.name);
  const defaultTimes = {
    restaurant: '01:30 PM',
    restStop: '11:30 AM',
    lodging: '09:00 PM',
    attraction: '04:00 PM',
    refuel: '10:00 AM'
  };
  const timeVal = selectedTimes[item.name] || defaultTimes[type] || '04:00 PM';
  const status = getLocalPlaceTimeStatus(item.name, timeVal);
  const specs = getLocalSpecs(item.name);
  const feasibility = checkCardFeasibility(item);
  const openTime = specs.open || specs.openTime || "09:00 AM";
  const closeTime = specs.close || specs.closeTime || "06:00 PM";
  const minDur = specs.minDuration || specs.minimumVisitDuration || 60;
  const recDur = specs.duration || specs.recommendedVisitDuration || 90;

  let availableText;
  if (openTime === "24 hours" || !closeTime) {
    availableText = "Open 24 hours";
  } else {
    const arrivalMins = timeToMinutes(timeVal);
    const closeMins = timeToMinutes(closeTime);
    const diff = closeMins - arrivalMins;
    if (diff < 0) {
      availableText = "Closed at this time";
    } else {
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      availableText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/65 backdrop-blur-sm transition-opacity duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-slate-900/95 border-l border-slate-800 h-full shadow-2xl flex flex-col z-10 animate-slide-in overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
        <div className="p-6 border-b border-slate-800 flex items-start justify-between mt-1.5">
          <div className="space-y-1">
            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border tracking-wider ${
              type === 'attraction' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
              type === 'restaurant' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              type === 'restStop' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              type === 'lodging' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-slate-500/10 text-slate-400 border-slate-500/20'
            }`}>
              {type === 'lodging' ? 'Lodging' : type}
            </span>
            <h3 className="text-xl font-bold text-white tracking-tight leading-tight">{item.name}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-0.5">
              {item.rating && (
                <span className="flex items-center gap-1 font-semibold text-yellow-500">
                  ★ {item.rating}
                </span>
              )}
              {item.budget && (
                <span>Budget: <span className="text-emerald-400 font-bold">{item.budget}</span></span>
              )}
              {item.pricePerNight && (
                <span className="text-emerald-400 font-mono font-bold">{item.pricePerNight}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <span className="text-sm font-semibold px-1">✕</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-3">
            {item.description && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">About</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
              </div>
            )}
            {item.location && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</h4>
                <p className="text-xs text-slate-300 flex items-center gap-1">
                  📍 {item.location}
                </p>
              </div>
            )}
            {item.cuisine && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cuisine</h4>
                <p className="text-xs text-slate-300">{item.cuisine}</p>
              </div>
            )}
            {item.facilities && item.facilities.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facilities</h4>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.facilities.map((f, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-300 text-[10px]">
                      ✓ {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tags</h4>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-950 text-slate-400 text-[9px] rounded-full border border-slate-800">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <hr className="border-slate-800" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opening Hours</h4>
              <p className="text-xs text-white font-semibold">
                🕒 {openTime === "24 hours" ? "24 Hours" : `${openTime} - ${closeTime}`}
              </p>
            </div>
            {item.tags && item.tags.includes("Evening") ? (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Best Time to Visit</h4>
                <p className="text-xs text-yellow-400 font-semibold">🌅 Evening</p>
              </div>
            ) : item.tags && item.tags.includes("Breakfast") ? (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Best Time to Visit</h4>
                <p className="text-xs text-orange-400 font-semibold">🍳 Morning / Breakfast</p>
              </div>
            ) : (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Best Time to Visit</h4>
                <p className="text-xs text-slate-400">Flexible hours</p>
              </div>
            )}
          </div>

          <hr className="border-slate-800" />

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visit Duration details</h4>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Available time at arrival:</span>
                <span className={`font-semibold font-mono ${
                  availableText.includes("Closed") ? "text-rose-400" : "text-white"
                }`}>{availableText}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Minimum required visit:</span>
                <span className="text-white font-semibold font-mono">{minDur} mins</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Recommended visit:</span>
                <span className="text-white font-semibold font-mono">{recDur} mins</span>
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Feasibility Status</h4>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Timing Status:</span>
              {status === 'OPEN' && (
                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg flex items-center gap-1 animate-pulse">
                  ● Open (Enough Time)
                </span>
              )}
              {status === 'LIMITED' && (
                <span className="px-2.5 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-bold rounded-lg flex items-center gap-1">
                  ● Limited Visit Window
                </span>
              )}
              {status === 'NOT ENOUGH TIME' && (
                <span className="px-2.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-lg flex items-center gap-1">
                  ⚠️ Not Enough Time
                </span>
              )}
              {status === 'CLOSED' && (
                <span className="px-2.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold rounded-lg flex items-center gap-1">
                  🚫 Closed
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-3">
          {added ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <Check className="h-4.5 w-4.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full p-0.5" />
                Added to your itinerary
              </div>
              <button
                onClick={() => handleRemovePlace(item.name)}
                className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Remove Stop
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Select Arrival Time</label>
                <select
                  value={timeVal}
                  onChange={(e) => handleCardTimeChange(item.name, e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60 cursor-pointer"
                >
                  {timeOptions.map((time, idx) => (
                    <option key={idx} value={time}>{time}</option>
                  ))}
                </select>
              </div>

              {!feasibility.valid ? (
                <div className="space-y-2">
                  <button
                    disabled
                    className="w-full py-2.5 bg-slate-800 text-slate-500 border border-slate-700 rounded-xl text-xs font-bold cursor-not-allowed opacity-50 flex items-center justify-center gap-1.5"
                  >
                    Add to Itinerary
                  </button>
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-red-400 leading-tight font-medium">
                      {feasibility.reason}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleAddRecommendation(item, type);
                    onClose();
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-900/20 hover:scale-[1.02] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add to Itinerary
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RecommendationTabList = ({
  tabKey,
  activeTab,
  items,
  type,
  emptyMessage,
  expanded,
  onToggleExpand,
  selectedTimes,
  defaultTime,
  timeOptions,
  onSelectPlace,
  onCardTimeChange,
  isPlaceInTimeline,
  onRemovePlace,
  checkCardFeasibility,
  onAddPlace,
  searchQuery
}) => {
  if (activeTab !== tabKey) return null;
  const filtered = filterRecommendationItems(items || [], searchQuery);
  const visible = expanded ? filtered : filtered.slice(0, 5);

  if (visible.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-xs">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3.5">
      {visible.map((item, i) => {
        const added = isPlaceInTimeline(item.name);
        const timeVal = selectedTimes[item.name] || defaultTime;
        const status = getLocalPlaceTimeStatus(item.name, timeVal);
        const feasibility = checkCardFeasibility(item);

        return (
          <div
            key={i}
            onClick={() => onSelectPlace({ item, type })}
            className={`p-4 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-purple-500/20 transition-all flex flex-col sm:flex-row ${
              type === 'refuel' ? 'justify-between items-center' : 'sm:items-center justify-between gap-4'
            } cursor-pointer hover:bg-slate-900/40 relative group`}
          >
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="h-3.5 w-3.5 text-purple-400" />
            </div>

            {type === 'refuel' ? (
              <>
                <div>
                  <h4 className="font-bold text-white text-sm">{item.name}</h4>
                  <span className="text-[10px] text-slate-500">📍 {item.location}</span>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border inline-block mb-1 ${
                    item.type === 'EV' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end font-semibold">
                    <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    {item.status}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1 sm:max-w-[70%]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-white text-sm">{item.name}</h4>
                    {type === 'attraction' && (
                      <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[9px] font-semibold rounded border border-purple-500/15">{item.type}</span>
                    )}
                    {type === 'restaurant' && (
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[9px] font-semibold rounded border border-blue-500/15">{item.cuisine}</span>
                    )}
                    {type === 'restStop' && (
                      <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] font-semibold rounded border border-amber-500/20">{item.type || 'Highway Rest'}</span>
                    )}
                    {type === 'lodging' && (
                      <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] font-bold rounded border border-amber-500/20">{item.type}</span>
                    )}
                    {status === 'OPEN' && <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">● Open</span>}
                    {status === 'LIMITED' && <span className="text-[10px] text-yellow-500 font-semibold flex items-center gap-1">● Limited</span>}
                    {status === 'NOT ENOUGH TIME' && <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">● Short Time</span>}
                    {status === 'CLOSED' && <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">● Closed</span>}
                  </div>
                  {item.description && <p className="text-slate-400 text-xs leading-relaxed">{item.description}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                    {item.location && <span>📍 {item.location}</span>}
                    {item.budget && <span>Budget: {item.budget}</span>}
                    {item.pricePerNight && <span className="text-emerald-400 font-bold font-mono">{item.pricePerNight}</span>}
                    {item.facilities && (
                      <div className="flex flex-wrap gap-1">
                        {item.facilities.map((f, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 text-[9px]">
                            ✓ {f}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.rating && <span className="text-yellow-500/90 font-semibold">★ {item.rating}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                  {!added && (
                    <select
                      value={timeVal}
                      onChange={(e) => onCardTimeChange(item.name, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none cursor-pointer"
                    >
                      {timeOptions.map((time, idx) => (
                        <option key={idx} value={time}>{time}</option>
                      ))}
                    </select>
                  )}

                  {added ? (
                    <button
                      onClick={() => onRemovePlace(item.name)}
                      className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer"
                    >
                      <Check className="h-3 w-3" />
                      Added
                    </button>
                  ) : !feasibility.valid ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        disabled
                        className="px-3 py-1 bg-slate-800 text-slate-500 border border-slate-700 rounded-lg text-xs font-semibold cursor-not-allowed opacity-50"
                      >
                        Add
                      </button>
                      <span className="text-[9px] text-rose-400 font-semibold text-right max-w-[130px] leading-tight">
                        {feasibility.reason}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAddPlace(item, type)}
                      className="px-3 py-1 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {filtered.length > 5 && (
        <button
          onClick={onToggleExpand}
          className="mt-2 text-purple-400 hover:text-purple-300 text-xs font-bold transition-all cursor-pointer text-center w-full py-2 bg-slate-950/30 border border-slate-800 rounded-lg hover:bg-slate-900/50"
        >
          {expanded ? 'Show Less' : `Show More (${filtered.length - 5} more)`}
        </button>
      )}
    </div>
  );
};

const JourneyCompanion = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('gd_user') || '{}');
  
  const [formData, setFormData] = useState(() => {
    const defaults = {
      source: 'Bangalore',
      destination: 'Mysore',
      tripType: 'Family',
      foodPreference: 'Any',
      budget: 'Medium',
      vehicleType: 'EV',
      tripDate: getCurrentDate(),
      startTime: getCurrentTimeRounded(),
      fuelOrBatteryLevel: 85,
      mileageOrRange: 340,
      durationDays: 1,
      tripStyle: 'Balanced',
      interests: [],
      sourcePlaceId: '',
      destinationPlaceId: '',
      tripMode: 'Round Trip'
    };
    try {
      const savedForm = localStorage.getItem('gd_form');
      if (savedForm) {
        return { ...defaults, ...JSON.parse(savedForm) };
      }
    } catch {
      // Ignore parse error
    }
    return defaults;
  });

  const [vehicle, setVehicle] = useState(() => {
    try {
      const localVehicle = localStorage.getItem('gd_vehicle');
      return localVehicle ? JSON.parse(localVehicle) : null;
    } catch {
      return null;
    }
  });

  // Real-time trip validation (derived)
  const formErrors = (() => {
    const startCheck = validateTripStart(formData.tripDate, formData.startTime);
    const errors = {};
    if (!startCheck.valid) {
      if (startCheck.reason === 'PAST_DATE') {
        errors.tripDate = startCheck.message;
      } else if (startCheck.reason === 'PAST_TIME') {
        errors.startTime = startCheck.message;
      }
    }
    
    if (vehicle) {
      if (formData.fuelOrBatteryLevel < 0 || formData.fuelOrBatteryLevel > 100) {
        errors.fuelOrBatteryLevel = "Battery/Fuel level must be between 0% and 100%.";
      }
      if (formData.mileageOrRange < 50 || formData.mileageOrRange > 1500) {
        errors.mileageOrRange = "Range must be between 50km and 1500km.";
      }
    }
    return errors;
  })();
  const isFormValid = Object.keys(formErrors).length === 0;

  const [loading, setLoading] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState(() => {
    try {
      const saved = localStorage.getItem('gd_recommendations');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('attractions');

  // Autocomplete prediction states
  const [sourceInput, setSourceInput] = useState(formData.source);
  const [destInput, setDestInput] = useState(formData.destination);
  const [sourcePredictions, setSourcePredictions] = useState([]);
  const [destPredictions, setDestPredictions] = useState([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [destLoading, setDestLoading] = useState(false);

  // Active Trip Persistence & suggestions
  const [activeTrip, setActiveTrip] = useState(null);
  const [suggestedFixes, setSuggestedFixes] = useState([]);
  const [selectedTimelineDay, setSelectedTimelineDay] = useState(1);
  const [customDays, setCustomDays] = useState(1);
  const [weather, setWeather] = useState(null);
  const [infeasible, setInfeasible] = useState(() => {
    try {
      const saved = localStorage.getItem('gd_infeasible');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [roundTripMetrics, setRoundTripMetrics] = useState(() => {
    try {
      const saved = localStorage.getItem('gd_roundTripMetrics');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [infeasibilityDetails, setInfeasibilityDetails] = useState(() => {
    try {
      const saved = localStorage.getItem('gd_infeasibilityDetails');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Load Active Trip on mount
  useEffect(() => {
    if (user.id) {
      getActiveItinerary(user.id)
        .then(res => {
          if (res.success && res.data) {
            setActiveTrip(res.data);
          } else {
            setActiveTrip(null);
          }
        })
        .catch(() => {
          // Normal empty/404 state handled silently
          setActiveTrip(null);
        });
    }
  }, [user.id]);

  // Fetch Vehicle Profile
  useEffect(() => {
    let active = true;
    const fetchVehicleProfile = async () => {
      if (!user.id) return;
      await Promise.resolve();
      if (!active) return;
      setVehicleLoading(true);
      try {
        const res = await getVehicle(user.id);
        if (active && res.success && res.data) {
          setVehicle(res.data);
          localStorage.setItem('gd_vehicle', JSON.stringify(res.data));
          setFormData(prev => ({
            ...prev,
            vehicleType: res.data.type,
            fuelOrBatteryLevel: res.data.type === 'EV' ? res.data.batteryPercentage : res.data.fuelPercentage,
            mileageOrRange: res.data.range
          }));
        }
      } catch (err) {
        console.error('Error fetching vehicle profile from API:', err);
      } finally {
        if (active) setVehicleLoading(false);
      }
    };
    fetchVehicleProfile();
    return () => { active = false; };
  }, [user.id]);

  // Custom interactive itinerary states
  const [tripId, setTripId] = useState(() => localStorage.getItem('gd_tripId') || null);
  const [timeline, setTimeline] = useState(() => {
    try {
      const saved = localStorage.getItem('gd_timeline');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const requestIdRef = useRef(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [insertModalState, setInsertModalState] = useState({ isOpen: false, index: 1 });
  const [newModalStop, setNewModalStop] = useState({
    name: '',
    purpose: 'Sightseeing',
    duration: 60,
    isPinned: false,
    pinnedTime: ''
  });
  
  // Custom place inputs
  const [customPlace, setCustomPlace] = useState({
    name: '',
    time: '04:00 PM',
    purpose: 'Sightseeing',
    reason: 'Custom preferred attraction added by traveler.',
    duration: 60,
    insertPosition: 'auto',
    isPinned: false
  });

  // Selected time for each recommended card
  const [selectedTimes, setSelectedTimes] = useState({});
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [expandedState, setExpandedState] = useState({
    attractions: false,
    restaurants: false,
    restStops: false,
    lodging: false,
    refuel: false
  });

  // Autocomplete handlers
  const handleSourceInputChange = async (e) => {
    const value = e.target.value;
    setSourceInput(value);
    setFormData(prev => ({ ...prev, source: value }));
    if (value.trim().length > 2) {
      setSourceLoading(true);
      try {
        const res = await getAutocompletePredictions(value);
        if (res.success) {
          setSourcePredictions(res.predictions || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSourceLoading(false);
      }
    } else {
      setSourcePredictions([]);
    }
  };

  const handleSelectSourcePrediction = async (prediction) => {
    setSourceInput(prediction.description);
    setSourcePredictions([]);
    setFormData(prev => ({
      ...prev,
      source: prediction.description,
      sourcePlaceId: prediction.placeId
    }));
  };

  const handleDestInputChange = async (e) => {
    const value = e.target.value;
    setDestInput(value);
    setFormData(prev => ({ ...prev, destination: value }));
    if (value.trim().length > 2) {
      setDestLoading(true);
      try {
        const res = await getAutocompletePredictions(value);
        if (res.success) {
          setDestPredictions(res.predictions || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setDestLoading(false);
      }
    } else {
      setDestPredictions([]);
    }
  };

  const handleSelectDestPrediction = async (prediction) => {
    setDestInput(prediction.description);
    setDestPredictions([]);
    setFormData(prev => ({
      ...prev,
      destination: prediction.description,
      destinationPlaceId: prediction.placeId
    }));
  };

  const handleResumeTrip = async (trip) => {
    setFormData({
      source: trip.source,
      destination: trip.destination,
      tripType: trip.tripType || 'Family',
      foodPreference: trip.foodPreference || 'Any',
      budget: trip.budget || 'Medium',
      vehicleType: trip.vehicleType || 'EV',
      tripDate: trip.tripDate,
      startTime: trip.startTime || '09:00 AM',
      fuelOrBatteryLevel: trip.fuelOrBatteryLevel || 85,
      mileageOrRange: trip.mileageOrRange || 340,
      durationDays: trip.durationDays || 1,
      tripStyle: trip.tripStyle || 'Balanced',
      interests: trip.interests || [],
      sourcePlaceId: trip.sourcePlaceId,
      destinationPlaceId: trip.destinationPlaceId,
      sourceCoords: trip.sourceCoords,
      destinationCoords: trip.destinationCoords,
      sourceAddress: trip.sourceAddress,
      destinationAddress: trip.destinationAddress,
      tripMode: trip.tripMode || 'One Way'
    });
    setSourceInput(trip.source);
    setDestInput(trip.destination);
    setTripId(trip.tripId);
    setTimeline(trip.timeline || []);
    setInfeasible(trip.infeasible || []);
    localStorage.setItem('gd_infeasible', JSON.stringify(trip.infeasible || []));
    setActiveTrip(null); // Clear banner
    if (trip.weatherData) {
      setWeather(trip.weatherData);
    }
    if (trip.roundTripMetrics) {
      setRoundTripMetrics(trip.roundTripMetrics);
      localStorage.setItem('gd_roundTripMetrics', JSON.stringify(trip.roundTripMetrics));
    }
    if (trip.isFeasible === false && trip.infeasibilityDetails) {
      setInfeasibilityDetails(trip.infeasibilityDetails);
    }

    localStorage.setItem('gd_tripId', trip.tripId);
    localStorage.setItem('gd_timeline', JSON.stringify(trip.timeline || []));

    setLoading(true);
    try {
      const recsRes = await recommendPlaces({
        destination: trip.destination,
        foodPreference: trip.foodPreference,
        budget: trip.budget,
        vehicleType: trip.vehicleType,
        tripId: trip.tripId
      });
      if (recsRes.success) {
        setRecommendations(recsRes.data);
        localStorage.setItem('gd_recommendations', JSON.stringify(recsRes.data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reschedule and sort timeline sequentially
  const sortTimeline = (list) => {
    if (!list || list.length === 0) return [];
    return recalculateScheduleClient(list, {
      source: formData.source,
      destination: formData.destination,
      startTime: formData.startTime,
      durationDays: formData.durationDays
    });
  };

  // Fetch timeline from DB if not locally cached
  useEffect(() => {
    const timer = setTimeout(() => {
      const savedTripId = localStorage.getItem('gd_tripId');
      const savedTimeline = localStorage.getItem('gd_timeline');

      if (!savedTimeline && savedTripId) {
        const loadTimeline = async () => {
          try {
            const res = await getItinerary(savedTripId);
            if (res.success && res.data.timeline) {
              const scheduled = recalculateScheduleClient(res.data.timeline, {
                source: formData.source,
                destination: formData.destination,
                startTime: formData.startTime,
                durationDays: formData.durationDays
              });
              setTimeline(scheduled);
              localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
              if (res.data.infeasible) {
                setInfeasible(res.data.infeasible);
                localStorage.setItem('gd_infeasible', JSON.stringify(res.data.infeasible));
              }
              if (res.data.roundTripMetrics) {
                setRoundTripMetrics(res.data.roundTripMetrics);
                localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
              }
              if (res.data.isFeasible === false && res.data.infeasibilityDetails) {
                setInfeasibilityDetails(res.data.infeasibilityDetails);
              }
              if (res.data.weatherData) {
                setWeather(res.data.weatherData);
              }
            }
          } catch (e) {
            console.error(e);
          }
        };
        loadTimeline();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [formData.destination, formData.durationDays, formData.source, formData.startTime]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'vehicleType') {
        updated.mileageOrRange = value === 'EV' ? 340 : 580;
      }
      return updated;
    });
  };

  const handleCustomPlaceChange = (e) => {
    const { name, value } = e.target;
    setCustomPlace((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleApplyInfeasibleAlternative = (altText) => {
    const lower = (altText || '').toLowerCase();
    if (lower.includes('2 day') || lower.includes('extend duration')) {
      setFormData(prev => ({ ...prev, durationDays: 2 }));
      setInfeasibilityDetails(null);
    } else if (lower.includes('earlier') || lower.includes('06:00 am')) {
      setFormData(prev => ({ ...prev, startTime: '06:00 AM' }));
      setInfeasibilityDetails(null);
    } else if (lower.includes('closer') || lower.includes('mysore')) {
      setFormData(prev => ({ ...prev, destination: 'Mysore' }));
      setDestInput('Mysore');
      setInfeasibilityDetails(null);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError(null);
    setTimeline([]);
    setSuggestedFixes([]);
    setRecommendations(null);
    setWeather(null);
    setInfeasible([]);
    setInfeasibilityDetails(null);
    setRoundTripMetrics(null);
    localStorage.removeItem('gd_timeline');
    localStorage.removeItem('gd_recommendations');
    localStorage.removeItem('gd_tripId');
    localStorage.removeItem('gd_infeasible');
    localStorage.removeItem('gd_roundTripMetrics');
    localStorage.removeItem('gd_infeasibilityDetails');

    const generatedTripId = 'trip_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    setTripId(generatedTripId);

    try {
      // 1. Generate Itinerary (initializes the Digital Twin and Agent recommendations)
      const itinRes = await generateItinerary({
        ...formData,
        tripId: generatedTripId,
        userId: user.id
      });

      if (itinRes.success && itinRes.data) {
        if (itinRes.data.isFeasible === false) {
          const infeasibleInfo = itinRes.data.infeasibilityDetails || {
            reason: itinRes.message || 'Trip duration is insufficient for a safe complete round trip.',
            alternatives: [
              'Extend duration to 2 Days for an overnight stay',
              'Start trip earlier (e.g. 06:00 AM) to fit safe driving hours',
              'Choose a closer destination (e.g., Mysore, Nandi Hills, Shivanasamudra)'
            ]
          };
          setInfeasibilityDetails(infeasibleInfo);
          localStorage.setItem('gd_infeasibilityDetails', JSON.stringify(infeasibleInfo));
          setTimeline([]);
          setRoundTripMetrics(null);
          setLoading(false);
          return;
        }

        if (itinRes.data.roundTripMetrics) {
          setRoundTripMetrics(itinRes.data.roundTripMetrics);
          localStorage.setItem('gd_roundTripMetrics', JSON.stringify(itinRes.data.roundTripMetrics));
        }

        if (itinRes.data.weatherData) {
          setWeather(itinRes.data.weatherData);
        }
      }

      // 2. Fetch Place Recommendations
      const recsRes = await recommendPlaces({
        destination: formData.destination,
        foodPreference: formData.foodPreference,
        budget: formData.budget,
        vehicleType: formData.vehicleType,
        tripId: generatedTripId
      });

      if (recsRes.success) {
        setRecommendations(recsRes.data);
        const generatedTimeline = sortTimeline(itinRes.data.timeline || []);
        setTimeline(generatedTimeline);
        const generatedInfeasible = itinRes.data.infeasible || [];
        setInfeasible(generatedInfeasible);

        // Save states in localStorage
        localStorage.setItem('gd_tripId', generatedTripId);
        localStorage.setItem('gd_form', JSON.stringify(formData));
        localStorage.setItem('gd_recommendations', JSON.stringify(recsRes.data));
        localStorage.setItem('gd_timeline', JSON.stringify(generatedTimeline));
        localStorage.setItem('gd_infeasible', JSON.stringify(generatedInfeasible));
      } else {
        throw new Error('Failed to retrieve places recommendations');
      }
    } catch (err) {
      setError(err.error || err.message || 'An unexpected error occurred. Make sure your backend server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Contextual Insert Stop
  const handleInsertStop = async (insertIndex, newStop) => {
    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);
    const currentTimeline = [...timeline];

    const stopToInsert = {
      id: newStop.id || `stop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      day: newStop.day || selectedTimelineDay || 1,
      place: newStop.place || newStop.name,
      purpose: newStop.purpose || 'Sightseeing',
      reason: newStop.reason || 'Added by traveler.',
      duration: Number(newStop.duration || 60),
      isPinned: Boolean(newStop.isPinned),
      pinnedTime: newStop.pinnedTime || null
    };

    const safeIndex = Math.max(1, Math.min(insertIndex, currentTimeline.length));
    currentTimeline.splice(safeIndex, 0, stopToInsert);

    const scheduledOptimistic = recalculateScheduleClient(currentTimeline, {
      source: formData.source,
      destination: formData.destination,
      startTime: formData.startTime,
      durationDays: formData.durationDays
    });

    setTimeline(scheduledOptimistic);
    localStorage.setItem('gd_timeline', JSON.stringify(scheduledOptimistic));
    const metrics = calculateClientRoundTripMetrics(scheduledOptimistic, formData.source, formData.destination);
    setRoundTripMetrics(metrics);
    localStorage.setItem('gd_roundTripMetrics', JSON.stringify(metrics));

    window.dispatchEvent(new CustomEvent('tripTwinUpdated', { 
      detail: { timeline: scheduledOptimistic, tripId } 
    }));

    if (tripId) {
      setSyncing(true);
      try {
        const res = await insertItineraryStop(tripId, safeIndex, stopToInsert, {
          source: formData.source,
          destination: formData.destination,
          startTime: formData.startTime,
          tripDate: formData.tripDate,
          durationDays: formData.durationDays,
          vehicleType: formData.vehicleType
        });
        if (currentReqId === requestIdRef.current && res && res.success && res.data) {
          setTimeline(res.data.timeline);
          localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
          if (res.data.roundTripMetrics) {
            setRoundTripMetrics(res.data.roundTripMetrics);
            localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
          }
        }
      } catch (err) {
        console.warn('Backend insert sync failed, maintained optimistic schedule:', err);
      } finally {
        setSyncing(false);
        if (currentReqId === requestIdRef.current) {
          setIsRecalculating(false);
        }
      }
    } else {
      setIsRecalculating(false);
    }
  };

  // 2. Remove Stop
  const handleRemoveStop = async (index, stopId) => {
    if (index <= 0 || index >= timeline.length - 1) return;
    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);

    const optimisticTimeline = timeline.filter((_, idx) => idx !== index);
    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: formData.source,
      destination: formData.destination,
      startTime: formData.startTime,
      durationDays: formData.durationDays
    });

    setTimeline(scheduledOptimistic);
    localStorage.setItem('gd_timeline', JSON.stringify(scheduledOptimistic));
    const metrics = calculateClientRoundTripMetrics(scheduledOptimistic, formData.source, formData.destination);
    setRoundTripMetrics(metrics);
    localStorage.setItem('gd_roundTripMetrics', JSON.stringify(metrics));

    window.dispatchEvent(new CustomEvent('tripTwinUpdated', { 
      detail: { timeline: scheduledOptimistic, tripId } 
    }));

    if (tripId) {
      try {
        const res = await removeItineraryStop(tripId, index, stopId, {
          source: formData.source,
          destination: formData.destination,
          startTime: formData.startTime,
          tripDate: formData.tripDate,
          durationDays: formData.durationDays,
          vehicleType: formData.vehicleType
        });
        if (currentReqId === requestIdRef.current && res && res.success && res.data) {
          setTimeline(res.data.timeline);
          localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
          if (res.data.roundTripMetrics) {
            setRoundTripMetrics(res.data.roundTripMetrics);
            localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
          }
        }
      } catch (err) {
        console.warn('Backend remove sync failed, maintained optimistic schedule:', err);
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsRecalculating(false);
        }
      }
    } else {
      setIsRecalculating(false);
    }
  };

  // Remove by place name
  const handleRemovePlace = async (placeName) => {
    const idx = timeline.findIndex(event => (event.place || '').toLowerCase() === (placeName || '').toLowerCase());
    if (idx !== -1) {
      await handleRemoveStop(idx, timeline[idx]?.id);
    }
  };

  // 3. Move Stop (Reorder)
  const handleMoveStop = async (fromIndex, toIndex) => {
    if (fromIndex <= 0 || toIndex <= 0 || fromIndex >= timeline.length - 1 || toIndex >= timeline.length - 1) return;
    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);

    const optimisticTimeline = [...timeline];
    const [moved] = optimisticTimeline.splice(fromIndex, 1);
    optimisticTimeline.splice(toIndex, 0, moved);

    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: formData.source,
      destination: formData.destination,
      startTime: formData.startTime,
      durationDays: formData.durationDays
    });

    setTimeline(scheduledOptimistic);
    localStorage.setItem('gd_timeline', JSON.stringify(scheduledOptimistic));
    const metrics = calculateClientRoundTripMetrics(scheduledOptimistic, formData.source, formData.destination);
    setRoundTripMetrics(metrics);
    localStorage.setItem('gd_roundTripMetrics', JSON.stringify(metrics));

    window.dispatchEvent(new CustomEvent('tripTwinUpdated', { 
      detail: { timeline: scheduledOptimistic, tripId } 
    }));

    if (tripId) {
      try {
        const res = await reorderItineraryStops(tripId, fromIndex, toIndex, {
          source: formData.source,
          destination: formData.destination,
          startTime: formData.startTime,
          tripDate: formData.tripDate,
          durationDays: formData.durationDays,
          vehicleType: formData.vehicleType
        });
        if (currentReqId === requestIdRef.current && res && res.success && res.data) {
          setTimeline(res.data.timeline);
          localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
          if (res.data.roundTripMetrics) {
            setRoundTripMetrics(res.data.roundTripMetrics);
            localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
          }
        }
      } catch (err) {
        console.warn('Backend reorder sync failed, maintained optimistic schedule:', err);
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsRecalculating(false);
        }
      }
    } else {
      setIsRecalculating(false);
    }
  };

  // 4. Update Stop Duration
  const handleUpdateDuration = async (index, stopId, newDuration) => {
    if (index <= 0 || index >= timeline.length - 1) return;
    const clampedDuration = Math.max(15, Math.min(300, Number(newDuration)));
    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);

    const optimisticTimeline = [...timeline];
    optimisticTimeline[index] = { ...optimisticTimeline[index], duration: clampedDuration };

    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: formData.source,
      destination: formData.destination,
      startTime: formData.startTime,
      durationDays: formData.durationDays
    });

    setTimeline(scheduledOptimistic);
    localStorage.setItem('gd_timeline', JSON.stringify(scheduledOptimistic));
    const metrics = calculateClientRoundTripMetrics(scheduledOptimistic, formData.source, formData.destination);
    setRoundTripMetrics(metrics);
    localStorage.setItem('gd_roundTripMetrics', JSON.stringify(metrics));

    window.dispatchEvent(new CustomEvent('tripTwinUpdated', { 
      detail: { timeline: scheduledOptimistic, tripId } 
    }));

    if (tripId) {
      try {
        const res = await updateStopDurationApi(tripId, index, stopId, clampedDuration, {
          source: formData.source,
          destination: formData.destination,
          startTime: formData.startTime,
          tripDate: formData.tripDate,
          durationDays: formData.durationDays,
          vehicleType: formData.vehicleType
        });
        if (currentReqId === requestIdRef.current && res && res.success && res.data) {
          setTimeline(res.data.timeline);
          localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
          if (res.data.roundTripMetrics) {
            setRoundTripMetrics(res.data.roundTripMetrics);
            localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
          }
        }
      } catch (err) {
        console.warn('Backend duration sync failed, maintained optimistic schedule:', err);
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsRecalculating(false);
        }
      }
    } else {
      setIsRecalculating(false);
    }
  };

  // 5. Toggle Pinned Reservation Time
  const handleTogglePin = async (index, stopId, currentIsPinned, currentTime) => {
    if (index <= 0 || index >= timeline.length - 1) return;
    const currentReqId = ++requestIdRef.current;
    const newIsPinned = !currentIsPinned;

    const optimisticTimeline = [...timeline];
    optimisticTimeline[index] = {
      ...optimisticTimeline[index],
      isPinned: newIsPinned,
      pinnedTime: newIsPinned ? currentTime : null
    };

    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: formData.source,
      destination: formData.destination,
      startTime: formData.startTime,
      durationDays: formData.durationDays
    });

    setTimeline(scheduledOptimistic);
    localStorage.setItem('gd_timeline', JSON.stringify(scheduledOptimistic));

    if (tripId) {
      try {
        const res = await toggleStopPinApi(tripId, index, stopId, newIsPinned, newIsPinned ? currentTime : null, {
          source: formData.source,
          destination: formData.destination,
          startTime: formData.startTime,
          tripDate: formData.tripDate,
          durationDays: formData.durationDays,
          vehicleType: formData.vehicleType
        });
        if (currentReqId === requestIdRef.current && res && res.success && res.data) {
          setTimeline(res.data.timeline);
          localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
          if (res.data.roundTripMetrics) {
            setRoundTripMetrics(res.data.roundTripMetrics);
            localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
          }
        }
      } catch (err) {
        console.warn('Backend pin toggle failed:', err);
      }
    }
  };

  // ADD Recommended Place to Itinerary
  const handleAddRecommendation = (item, type, targetIndex = null) => {
    if (timeline.some(e => (e.place || '').toLowerCase() === (item.name || '').toLowerCase())) {
      alert('This place is already in your itinerary.');
      return;
    }

    const purposeMap = {
      restaurant: 'Meal Break',
      restStop: 'Rest Stop',
      lodging: 'Overnight Stay',
      attraction: 'Sightseeing',
      refuel: formData.vehicleType === 'EV' ? 'EV Charging' : 'Fuel Station'
    };

    const specs = getLocalSpecs(item.name);
    const duration = specs.duration !== undefined 
      ? specs.duration 
      : (type === 'restaurant' ? 45 : (type === 'restStop' ? 20 : (type === 'refuel' ? 35 : (type === 'lodging' ? 480 : 60))));

    let insertIdx = targetIndex;
    if (insertIdx === null || insertIdx === undefined) {
      const returnIdx = timeline.findIndex(e => e.isReturnArrival || e.purpose === 'Return Arrival');
      if (returnIdx > 0) {
        insertIdx = returnIdx;
      } else {
        insertIdx = Math.max(1, timeline.length);
      }
    }

    const newStop = {
      place: item.name,
      purpose: purposeMap[type] || 'Sightseeing',
      reason: `Added from ${type} recommendations.`,
      duration: duration,
      day: selectedTimelineDay || 1,
      isPinned: false
    };

    handleInsertStop(insertIdx, newStop);
  };

  const getDayDrivingMinutes = (dayNum) => {
    return timeline
      .filter(t => (t.day || 1) === dayNum)
      .reduce((acc, t) => {
        if (!t.travelTimeFromPrevious) return acc;
        const matchH = t.travelTimeFromPrevious.match(/(\d+)h/);
        const matchM = t.travelTimeFromPrevious.match(/(\d+)m/);
        const hrs = matchH ? parseInt(matchH[1], 10) : 0;
        const mins = matchM ? parseInt(matchM[1], 10) : 0;
        return acc + (hrs * 60 + mins);
      }, 0);
  };

  const filteredTimeline = timeline.filter(event => (event.day || 1) === selectedTimelineDay);
  const dayMins = getDayDrivingMinutes(selectedTimelineDay);
  const dayDistance = dayMins; // 1 km per min average
  const energyDecrease = Math.round(dayDistance / 4);

  // ADD Custom Place
  const handleAddCustomPlace = (e) => {
    e.preventDefault();
    if (!customPlace.name.trim()) return;

    if (timeline.some(e => (e.place || '').toLowerCase() === customPlace.name.trim().toLowerCase())) {
      alert('This place is already in your itinerary.');
      return;
    }

    let insertIdx;
    if (customPlace.insertPosition === 'auto' || customPlace.insertPosition === undefined) {
      const returnIdx = timeline.findIndex(e => e.isReturnArrival || e.purpose === 'Return Arrival');
      insertIdx = returnIdx > 0 ? returnIdx : Math.max(1, timeline.length);
    } else {
      insertIdx = Number(customPlace.insertPosition);
    }

    const newStop = {
      place: customPlace.name.trim(),
      purpose: customPlace.purpose || 'Sightseeing',
      reason: customPlace.reason || 'Custom preferred attraction added by traveler.',
      duration: Number(customPlace.duration || 60),
      day: selectedTimelineDay || 1,
      isPinned: Boolean(customPlace.isPinned),
      pinnedTime: customPlace.isPinned ? customPlace.time : null
    };

    handleInsertStop(insertIdx, newStop);

    setCustomPlace({
      name: '',
      time: '04:00 PM',
      purpose: 'Sightseeing',
      reason: 'Custom preferred attraction added by traveler.',
      duration: 60,
      insertPosition: 'auto',
      isPinned: false
    });
  };

  const isPlaceInTimeline = (placeName) => {
    if (!placeName) return false;
    return timeline.some(event => (event.place || "").toLowerCase() === placeName.toLowerCase());
  };

  const checkCardFeasibility = (item) => {
    if (!item || !item.name) return { valid: false, reason: "Missing place name" };
    const specs = getLocalSpecs(item.name);
    // Dynamic engine automatically reschedules arrival and successor timings!
    if (specs && specs.closed) {
      return { valid: false, reason: "Permanently closed" };
    }
    return { valid: true };
  };

  const handleCardTimeChange = (placeName, timeVal) => {
    setSelectedTimes(prev => ({
      ...prev,
      [placeName]: timeVal
    }));
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHours = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        const padH = String(displayHours).padStart(2, '0');
        const padM = String(m).padStart(2, '0');
        options.push(`${padH}:${padM} ${ampm}`);
      }
    }
    return options;
  };
  const timeOptions = generateTimeOptions();
  const activeMetrics = roundTripMetrics || calculateClientRoundTripMetrics(timeline, formData.source, formData.destination);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Active Trip Resume Banner */}
      {activeTrip && (
        <div className="bg-gradient-to-r from-purple-950/80 to-blue-950/80 backdrop-blur-md border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl animate-scale-up">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-300">
              <Compass className="h-5 w-5 animate-spin-slow text-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Active Saved Trip Found</h4>
              <p className="text-xs text-slate-300">
                You have an active itinerary from <span className="font-bold text-purple-300">{activeTrip.source}</span> to <span className="font-bold text-blue-300">{activeTrip.destination}</span> ({activeTrip.durationDays} Days).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setActiveTrip(null)}
              className="px-3 py-1.5 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => handleResumeTrip(activeTrip)}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Resume Journey
            </button>
          </div>
        </div>
      )}

      {/* Auto-Repair Suggestions Modal */}
      {suggestedFixes.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-4 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-xl">
                <ShieldAlert className="h-6 w-6 animate-pulse text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Suggested Improvement Found</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Our AI Scheduler detected closing time or travel overlaps in your waypoints. Choose a recommended optimization path below to repair your trip timeline:
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {suggestedFixes.map((fix, idx) => (
                <div 
                  key={idx} 
                  className="p-3.5 bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all flex flex-col justify-between gap-3 group"
                >
                  <div>
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border inline-block mb-1 tracking-wider ${
                      fix.option === 'A' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      fix.option === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      Option {fix.option}: {fix.option === 'A' ? 'Move Earlier' : fix.option === 'B' ? 'Swap Stops' : 'Shift to Tomorrow'}
                    </span>
                    <p className="text-xs font-semibold text-white leading-relaxed">{fix.description}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (tripId) {
                        try {
                          const res = await applyItineraryFix(tripId, fix.timeline);
                          if (res.success) {
                            setTimeline(sortTimeline(res.data.timeline));
                            localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
                            setSuggestedFixes([]);
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Failed to apply itinerary fix.');
                        }
                      }
                    }}
                    className="self-end px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-all shadow-md cursor-pointer"
                  >
                    Apply Reschedule
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSuggestedFixes([])}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Keep Original
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contextual Stop Insertion Modal */}
      {insertModalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-purple-400" />
                Insert Stop at Step #{insertModalState.index + 1}
              </h3>
              <button
                onClick={() => setInsertModalState({ isOpen: false, index: 1 })}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Downstream stops, travel legs, and arrival times will automatically reschedule sequentially.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newModalStop.name.trim()) return;
                handleInsertStop(insertModalState.index, newModalStop);
                setNewModalStop({
                  name: '',
                  purpose: 'Sightseeing',
                  duration: 60,
                  isPinned: false,
                  pinnedTime: ''
                });
                setInsertModalState({ isOpen: false, index: 1 });
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Place Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mysore Sand Sculpture Museum"
                  value={newModalStop.name}
                  onChange={(e) => setNewModalStop(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500/80"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newModalStop.purpose}
                    onChange={(e) => setNewModalStop(prev => ({ ...prev, purpose: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/80"
                  >
                    <option value="Sightseeing">Sightseeing</option>
                    <option value="Meal Break">Meal Break</option>
                    <option value="Rest Stop">Rest Stop</option>
                    <option value="EV Charging">EV Charging</option>
                    <option value="Fuel Station">Fuel Station</option>
                    <option value="Overnight Stay">Overnight Stay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="360"
                    step="15"
                    value={newModalStop.duration}
                    onChange={(e) => setNewModalStop(prev => ({ ...prev, duration: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/80 font-mono"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500">Presets:</span>
                {[15, 30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setNewModalStop(prev => ({ ...prev, duration: mins }))}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                      newModalStop.duration === mins
                        ? 'bg-purple-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newModalStop.isPinned}
                    onChange={(e) => setNewModalStop(prev => ({ ...prev, isPinned: e.target.checked }))}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500/40"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    Pin this stop's arrival time (Hard constraint)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setInsertModalState({ isOpen: false, index: 1 })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Insert & Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            Journey Companion
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Configure trip parameters, search, add, and build your digital-twin monitored itinerary.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form + Active Timeline Preview */}
        <div className="lg:col-span-4 space-y-6">
          {/* Trip settings form */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-purple-500/20 rounded-2xl p-5 shadow-xl relative">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Compass className="text-purple-400 h-5 w-5" />
              Trip Configuration
            </h2>

            {vehicleLoading ? (
              <div className="flex flex-col items-center justify-center p-6 bg-slate-950/40 border border-slate-800 rounded-xl mb-4">
                <Loader2 className="animate-spin h-5 w-5 text-purple-500 mb-2" />
                <span className="text-[10px] text-slate-500">Retrieving vehicle profile...</span>
              </div>
            ) : vehicle ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 mb-4 relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">{vehicle.model}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[9px] font-bold rounded border border-purple-500/20">
                    {vehicle.type}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[9px] font-semibold uppercase">Charge / Fuel</span>
                    <span className="text-slate-200 font-bold">
                      {vehicle.type === 'EV' ? `${vehicle.batteryPercentage}%` : `${vehicle.fuelPercentage}%`}
                    </span>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[9px] font-semibold uppercase">Current Range</span>
                    <span className="text-slate-200 font-bold">{vehicle.range} km</span>
                  </div>
                  {vehicle.type !== 'EV' && (
                    <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 col-span-2">
                      <span className="text-slate-500 block text-[9px] font-semibold uppercase">Mileage</span>
                      <span className="text-slate-200 font-bold">{vehicle.mileage} km/l</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/vehicle-setup')}
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/30 text-purple-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center"
                >
                  Edit Vehicle Profile
                </button>
              </div>
            ) : (
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 mb-4 text-center">
                <ShieldAlert className="h-8 w-8 text-rose-400 mx-auto mb-2 animate-pulse" />
                <h4 className="text-xs font-bold text-white mb-1">Vehicle Setup Required</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Complete Vehicle Setup before planning a trip.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/vehicle-setup')}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  Go to Vehicle Setup
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Source Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input
                    type="text"
                    value={sourceInput}
                    onChange={handleSourceInputChange}
                    required
                    placeholder="Search source city (e.g. Bangalore)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors"
                  />
                  {sourceLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-500 animate-spin" />
                  )}
                </div>
                {sourcePredictions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-xl max-h-48 overflow-y-auto py-1">
                    {sourcePredictions.map((pred, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectSourcePrediction(pred)}
                        className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                      >
                        {pred.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Destination
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 h-4 w-4" />
                  <input
                    type="text"
                    value={destInput}
                    onChange={handleDestInputChange}
                    required
                    placeholder="Search destination city (e.g. Mysore)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors"
                  />
                  {destLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-500 animate-spin" />
                  )}
                </div>
                {destPredictions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-xl max-h-48 overflow-y-auto py-1">
                    {destPredictions.map((pred, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectDestPrediction(pred)}
                        className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                      >
                        {pred.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Trip Type
                  </label>
                  <select
                    name="tripType"
                    value={formData.tripType}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="Solo">Solo</option>
                    <option value="Family">Family</option>
                    <option value="Friends">Friends</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Trip Mode
                  </label>
                  <select
                    name="tripMode"
                    value={formData.tripMode || 'One Way'}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="One Way">One Way</option>
                    <option value="Round Trip">Round Trip</option>
                  </select>
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
                        : 'border-emerald-500/30 focus:border-purple-500/80'
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
                        : 'border-emerald-500/30 focus:border-purple-500/80'
                    }`}
                  >
                    {timeOptions.map((time, idx) => {
                      const isDisabled = isPastTimeToday(formData.tripDate, time);
                      return (
                        <option key={idx} value={time} disabled={isDisabled}>
                          {time} {isDisabled ? '(Past)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {formErrors.startTime && (
                    <span className="text-[9px] text-red-400 mt-1 block font-medium">{formErrors.startTime}</span>
                  )}
                </div>
              </div>

              {/* Trip Duration, Trip Style, and Interests Preferences */}
              <div className="space-y-3 pt-1 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Trip Duration
                    </label>
                    <select
                      name="durationDaysSelect"
                      value={[1, 2, 3, 4, 5].includes(formData?.durationDays || 1) ? formData.durationDays : 'Custom'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Custom') {
                          setFormData(prev => ({ ...prev, durationDays: customDays }));
                        } else {
                          setFormData(prev => ({ ...prev, durationDays: Number(val) }));
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors appearance-none cursor-pointer"
                    >
                      <option value={1}>1 Day</option>
                      <option value={2}>2 Days</option>
                      <option value={3}>3 Days</option>
                      <option value={4}>4 Days</option>
                      <option value={5}>5 Days</option>
                      <option value="Custom">Custom</option>
                    </select>
                    {![1, 2, 3, 4, 5].includes(formData?.durationDays || 1) && (
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={formData.durationDays}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCustomDays(val);
                          setFormData(prev => ({ ...prev, durationDays: val }));
                        }}
                        className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80"
                        placeholder="Enter number of days"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Trip Style
                    </label>
                    <select
                      name="tripStyle"
                      value={formData.tripStyle}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="Relaxed">Relaxed (Slow-paced)</option>
                      <option value="Balanced">Balanced (Standard)</option>
                      <option value="Packed">Packed (Full-itinerary)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Travel Interests
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {['Nature', 'Food', 'Heritage', 'Adventure', 'Family', 'Spiritual'].map((interest) => {
                      const selected = (formData?.interests || []).includes(interest);
                      return (
                        <button
                          type="button"
                          key={interest}
                          onClick={() => {
                            setFormData(prev => {
                              const interests = (prev.interests || []).includes(interest)
                                ? (prev.interests || []).filter(i => i !== interest)
                                : [...(prev.interests || []), interest];
                              return { ...prev, interests };
                            });
                          }}
                          className={`py-1.5 px-1.5 rounded border text-[9px] font-bold transition-all cursor-pointer text-center ${
                            selected
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Food Preference
                  </label>
                  <select
                    name="foodPreference"
                    value={formData.foodPreference}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="Any">Any</option>
                    <option value="Veg">Veg Only</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Vegan">Vegan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Budget
                  </label>
                  <select
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500/80 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              {/* Live validation summary status bar */}
              <div className={`mt-2 py-1.5 px-3 rounded-lg border text-[10px] font-semibold flex items-center justify-between transition-all ${
                isFormValid 
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/5 border-rose-500/20 text-rose-400 animate-pulse'
              }`}>
                <span>System Validation:</span>
                <span>
                  {isFormValid 
                    ? '✓ Trip timing configuration looks valid.' 
                    : `⚠️ Fix ${Object.keys(formErrors).length} issues before generating itinerary.`}
                </span>
              </div>

              <button
                type="submit"
                disabled={!isFormValid || loading || !vehicle}
                className={`w-full text-white rounded-lg py-2.5 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 mt-3 shadow-md ${
                  (!isFormValid || !vehicle)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 border border-slate-700'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 cursor-pointer hover:shadow-purple-500/15'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    Synchronizing Twin...
                  </>
                ) : (
                  <>
                    Generate Itinerary
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

          {/* Timeline preview list */}
          {timeline.length > 0 && (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl animate-scale-up">
              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2.5">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <CalendarRange className="h-4.5 w-4.5 text-purple-400" />
                  Active Waypoints ({timeline.length})
                </h3>
                <div className="flex items-center gap-2">
                  {syncing && <span className="text-[10px] text-purple-400 font-semibold animate-pulse">Saving changes...</span>}
                  {isRecalculating && <span className="text-[10px] text-amber-400 font-semibold animate-pulse">Recalculating...</span>}
                </div>
              </div>

              {/* Daywise tabs inside Waypoints list */}
              {formData.durationDays > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-3.5 border-b border-slate-800 pb-2">
                  {Array.from({ length: formData.durationDays }).map((_, idx) => {
                    const d = idx + 1;
                    return (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setSelectedTimelineDay(d)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          selectedTimelineDay === d
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Day {d}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Round-Trip Journey Overview Bar */}
              <div className="mb-3.5 p-3 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-blue-950/40 border border-purple-500/25 rounded-xl">
                <div className="flex items-center justify-between text-[11px] mb-2 border-b border-slate-800 pb-1.5">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                    Complete Round Trip
                  </span>
                  <span className="text-[10px] text-emerald-300 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {formData.source} ➔ {formData.destination} ➔ {formData.source}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-semibold">Total Round-Trip Dist.</span>
                    <span className="text-white font-mono font-bold">{activeMetrics.totalDistanceKm} km</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-semibold">Total Driving Time</span>
                    <span className="text-purple-300 font-mono font-bold">
                      {activeMetrics.totalDrivingTime || `${Math.floor((activeMetrics.totalTravelTimeMinutes || 0) / 60)}h ${(activeMetrics.totalTravelTimeMinutes || 0) % 60}m`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-semibold">Expected Final Return</span>
                    <span className="text-emerald-300 font-mono font-bold">
                      Day {activeMetrics.finalReturnDay || activeMetrics.returnDay || 1} • {activeMetrics.finalReturnArrival || activeMetrics.expectedReturnTime || '10:00 PM'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-semibold">Overnight Stay</span>
                    <span className="text-slate-200 font-semibold truncate block">
                      {activeMetrics.overnightHalt || (formData.durationDays > 1 ? `${formData.destination} Hotel` : 'None (Single-Day)')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Daywise stats bar */}
              <div className="grid grid-cols-3 gap-2 text-[10px] mb-3.5 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                <div className="text-center">
                  <span className="text-slate-500 block text-[8px] font-bold uppercase tracking-wider">Driving Time</span>
                  <span className="text-slate-200 font-bold font-mono">
                    {dayMins < 60 ? `${dayMins}m` : `${Math.floor(dayMins / 60)}h ${dayMins % 60}m`}
                  </span>
                </div>
                <div className="text-center border-x border-slate-800">
                  <span className="text-slate-500 block text-[8px] font-bold uppercase tracking-wider">Est. Distance</span>
                  <span className="text-slate-200 font-bold font-mono">{dayDistance} km</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-500 block text-[8px] font-bold uppercase tracking-wider">{formData.vehicleType === 'EV' ? 'Battery Use' : 'Fuel Use'}</span>
                  <span className="text-slate-200 font-bold font-mono">~{energyDecrease}%</span>
                </div>
              </div>

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1.5 custom-scrollbar">
                {/* Contextual Insert button at the very beginning (after origin departure) */}
                {filteredTimeline.length > 0 && selectedTimelineDay === 1 && (
                  <div className="flex justify-center my-1">
                    <button
                      type="button"
                      onClick={() => setInsertModalState({ isOpen: true, index: 1 })}
                      className="px-2.5 py-0.5 bg-slate-900/80 hover:bg-purple-600/80 border border-slate-800 hover:border-purple-500/50 text-slate-400 hover:text-white rounded-full text-[9px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Insert Stop After Departure
                    </button>
                  </div>
                )}

                {filteredTimeline.map((event, index) => {
                  const globalIndex = timeline.findIndex(e => (e.id && event.id) ? e.id === event.id : (e.place === event.place && e.time === event.time));
                  const isFirstStop = globalIndex <= 0;
                  const isReturnArrival = event.isReturnArrival || event.purpose === 'Return Arrival' || (event.place && event.place.toLowerCase().includes(`arrive at ${(formData.source || '').toLowerCase()}`));
                  const isOvernight = event.isOvernight || event.purpose === 'Overnight Stay' || event.purpose === 'Resort Check-in';

                  return (
                    <Fragment key={event.id || `${event.place}-${index}`}>
                      {/* Insertion divider between intermediate stops */}
                      {globalIndex > 1 && !isReturnArrival && (
                        <div className="relative flex items-center justify-center my-1 group/divider">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-dashed border-slate-800 group-hover/divider:border-purple-500/40 transition-colors"></div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInsertModalState({ isOpen: true, index: globalIndex })}
                            className="relative z-10 px-2 py-0.5 bg-slate-900 group-hover/divider:bg-purple-600 border border-slate-800 group-hover/divider:border-purple-500 text-slate-500 group-hover/divider:text-white rounded-full text-[9px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer scale-90 group-hover/divider:scale-100"
                            title="Insert stop here"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Insert Stop Here
                          </button>
                        </div>
                      )}

                      <div 
                        className={`flex items-start justify-between p-2.5 rounded-lg group transition-all border ${
                          isReturnArrival 
                            ? 'bg-emerald-950/30 border-emerald-500/40 shadow-emerald-950/20 shadow-md'
                            : isOvernight 
                              ? 'bg-indigo-950/30 border-indigo-500/40 shadow-indigo-950/20 shadow-md'
                              : 'bg-slate-950/70 border-slate-800 hover:border-purple-500/20'
                        }`}
                      >
                        <div className="min-w-0 pr-2 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold font-mono px-1 rounded shrink-0 ${
                              isReturnArrival 
                                ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30'
                                : isOvernight
                                  ? 'text-indigo-300 bg-indigo-500/20 border border-indigo-500/30'
                                  : 'text-purple-300 bg-purple-500/10'
                            }`}>
                              {event.time}
                            </span>
                            <h4 className="text-xs font-bold text-white truncate max-w-[150px]">{event.place}</h4>
                            {event.isPinned && (
                              <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[8px] font-extrabold uppercase rounded tracking-wider flex items-center gap-0.5">
                                <Lock className="h-2 w-2" /> Pinned
                              </span>
                            )}
                            {isReturnArrival && (
                              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] font-extrabold uppercase rounded tracking-wider">
                                Origin Return
                              </span>
                            )}
                            {isOvernight && (
                              <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[8px] font-extrabold uppercase rounded tracking-wider">
                                Overnight
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-slate-500 truncate">{event.purpose}</p>
                            {event.travelTimeFromPrevious && (
                              <span className="text-[9px] text-slate-400 font-mono">
                                • +{event.travelTimeFromPrevious} drive ({event.distanceFromPrevious || '0 km'})
                              </span>
                            )}
                          </div>

                          {/* Duration Adjuster */}
                          {!isFirstStop && !isReturnArrival && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5 text-slate-400" />
                                Visit:
                              </span>
                              <div className="flex items-center border border-slate-800 rounded bg-slate-900/80 px-1 py-0.5 gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDuration(globalIndex, event.id, (event.duration || 60) - 15)}
                                  disabled={(event.duration || 60) <= 15}
                                  className="text-[9px] font-bold text-slate-400 hover:text-white disabled:opacity-30 px-1 cursor-pointer"
                                  title="Reduce duration by 15 mins"
                                >
                                  -15m
                                </button>
                                <span className="text-[9px] font-mono font-bold text-purple-300 px-1">
                                  {event.duration || 60}m
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDuration(globalIndex, event.id, (event.duration || 60) + 15)}
                                  disabled={(event.duration || 60) >= 300}
                                  className="text-[9px] font-bold text-slate-400 hover:text-white disabled:opacity-30 px-1 cursor-pointer"
                                  title="Add 15 mins duration"
                                >
                                  +15m
                                </button>
                              </div>
                            </div>
                          )}

                          {event.warning && (
                            <p className="text-[9px] text-rose-400 leading-tight mt-1 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 whitespace-pre-wrap max-w-[200px]">{event.warning}</p>
                          )}
                          {event.autoFixed && (
                            <p className="text-[9px] text-emerald-400 leading-tight mt-1 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 whitespace-pre-wrap max-w-[200px]">{event.autoFixMessage || '[Auto-Fixed Slot]'}</p>
                          )}
                        </div>

                        {/* Action buttons on stop */}
                        {!isFirstStop && !isReturnArrival && (
                          <div className="flex items-center gap-1 shrink-0 pt-0.5">
                            {/* Pin Toggle */}
                            <button
                              type="button"
                              onClick={() => handleTogglePin(globalIndex, event.id, event.isPinned, event.time)}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                event.isPinned
                                  ? 'text-purple-400 bg-purple-500/20 border border-purple-500/30'
                                  : 'text-slate-500 hover:text-purple-400 hover:bg-slate-800'
                              }`}
                              title={event.isPinned ? "Unlock pinned time" : "Lock / Pin this time"}
                            >
                              <Pin className="h-3 w-3" />
                            </button>

                            {/* Move Up */}
                            <button
                              type="button"
                              onClick={() => handleMoveStop(globalIndex, globalIndex - 1)}
                              disabled={globalIndex <= 1}
                              className="p-1 text-slate-500 hover:text-white disabled:opacity-20 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Move Stop Up"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>

                            {/* Move Down */}
                            <button
                              type="button"
                              onClick={() => handleMoveStop(globalIndex, globalIndex + 1)}
                              disabled={globalIndex >= timeline.length - 2}
                              className="p-1 text-slate-500 hover:text-white disabled:opacity-20 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Move Stop Down"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete Stop */}
                            <button
                              type="button"
                              onClick={() => handleRemoveStop(globalIndex, event.id)}
                              className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete stop"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </Fragment>
                  );
                })}

                {/* Contextual Insert before Return Arrival */}
                {filteredTimeline.length > 0 && (
                  <div className="flex justify-center my-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const returnIdx = timeline.findIndex(e => e.isReturnArrival || e.purpose === 'Return Arrival');
                        setInsertModalState({ 
                          isOpen: true, 
                          index: returnIdx > 0 ? returnIdx : Math.max(1, timeline.length) 
                        });
                      }}
                      className="px-2.5 py-0.5 bg-slate-900/80 hover:bg-purple-600/80 border border-slate-800 hover:border-purple-500/50 text-slate-400 hover:text-white rounded-full text-[9px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Insert Stop Before Return
                    </button>
                  </div>
                )}
              </div>

              {/* Not Added due to Timing Section */}
              {infeasible && infeasible.length > 0 && (
                <div className="mt-4 p-4 bg-slate-950/60 border border-amber-500/20 rounded-xl shadow-inner">
                  <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    Not Added due to Timing
                  </h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {infeasible.map((item, idx) => (
                      <div key={idx} className="p-2 bg-slate-900/50 border border-slate-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300">{item.place}</span>
                          <span className="text-[9px] text-amber-500/80 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">Infeasible</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal mt-1">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Search + Recommendations Tabs */}
        <div className="lg:col-span-8 flex flex-col min-h-[480px]">
          {recommendations ? (
            <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl animate-scale-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-yellow-400" />
                  Recommendations for {recommendations.destination}
                </h3>
                <button
                  onClick={() => navigate('/itinerary')}
                  className="px-3.5 py-1.5 bg-purple-900/40 hover:bg-purple-800/50 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 hover:translate-x-1 cursor-pointer"
                >
                  View Itinerary
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Weather Forecast Widget */}
              {weather && (
                <div className="bg-slate-950/60 border border-purple-500/20 rounded-xl p-3 mb-4 flex items-center justify-between text-xs animate-scale-up">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">
                      {weather.condition === 'thunderstorm' ? '⛈️' :
                       weather.condition === 'rain' ? '🌧️' :
                       weather.condition === 'clear' ? '☀️' :
                       weather.condition === 'clouds' ? '☁️' : '🌫️'}
                    </span>
                    <div>
                      <span className="text-slate-300 font-bold">Weather at {formData.destination}: </span>
                      <span className="text-purple-300 font-semibold capitalize">{weather.description || weather.condition}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-200 font-bold">{Math.round(weather.temperature)}°C</span>
                    <span className="text-slate-500 block text-[9px] mt-0.5">Wind: {weather.windSpeed} km/h</span>
                  </div>
                </div>
              )}

              {/* Search Bar */}
              {['attractions', 'restaurants', 'restStops', 'lodging'].includes(activeTab) && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search within ${activeTab}...`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                </div>
              )}

              {/* Tabs */}
              <div className="flex flex-wrap gap-1.5 mb-4 border-b border-slate-800 pb-2">
                {[
                  { id: 'attractions', label: 'Attractions' },
                  { id: 'restaurants', label: 'Restaurants' },
                  { id: 'restStops', label: 'Rest Stops' },
                  { id: 'lodging', label: 'Lodging (Halts)' },
                  { id: 'refuel', label: formData.vehicleType === 'EV' ? 'EV Charging' : 'Fuel Stations' },
                  { id: 'custom', label: '+ Add Custom Stop' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSearchQuery(''); // reset search
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto max-h-[350px] space-y-3.5 pr-1.5 custom-scrollbar">
                {/* ATTRACTIONS TAB */}
                <RecommendationTabList
                  tabKey="attractions"
                  activeTab={activeTab}
                  items={recommendations.attractions}
                  type="attraction"
                  emptyMessage="No matching attractions found."
                  expanded={expandedState.attractions}
                  onToggleExpand={() => setExpandedState(prev => ({ ...prev, attractions: !prev.attractions }))}
                  selectedTimes={selectedTimes}
                  defaultTime="04:00 PM"
                  timeOptions={timeOptions}
                  onSelectPlace={setSelectedPlace}
                  onCardTimeChange={handleCardTimeChange}
                  isPlaceInTimeline={isPlaceInTimeline}
                  onRemovePlace={handleRemovePlace}
                  checkCardFeasibility={checkCardFeasibility}
                  onAddPlace={handleAddRecommendation}
                  searchQuery={searchQuery}
                />

                {/* RESTAURANTS TAB */}
                <RecommendationTabList
                  tabKey="restaurants"
                  activeTab={activeTab}
                  items={recommendations.restaurants}
                  type="restaurant"
                  emptyMessage="No matching restaurants found."
                  expanded={expandedState.restaurants}
                  onToggleExpand={() => setExpandedState(prev => ({ ...prev, restaurants: !prev.restaurants }))}
                  selectedTimes={selectedTimes}
                  defaultTime="01:30 PM"
                  timeOptions={timeOptions}
                  onSelectPlace={setSelectedPlace}
                  onCardTimeChange={handleCardTimeChange}
                  isPlaceInTimeline={isPlaceInTimeline}
                  onRemovePlace={handleRemovePlace}
                  checkCardFeasibility={checkCardFeasibility}
                  onAddPlace={handleAddRecommendation}
                  searchQuery={searchQuery}
                />

                {/* REST STOPS TAB */}
                <RecommendationTabList
                  tabKey="restStops"
                  activeTab={activeTab}
                  items={recommendations.restStops}
                  type="restStop"
                  emptyMessage="No matching rest stops found."
                  expanded={expandedState.restStops}
                  onToggleExpand={() => setExpandedState(prev => ({ ...prev, restStops: !prev.restStops }))}
                  selectedTimes={selectedTimes}
                  defaultTime="11:30 AM"
                  timeOptions={timeOptions}
                  onSelectPlace={setSelectedPlace}
                  onCardTimeChange={handleCardTimeChange}
                  isPlaceInTimeline={isPlaceInTimeline}
                  onRemovePlace={handleRemovePlace}
                  checkCardFeasibility={checkCardFeasibility}
                  onAddPlace={handleAddRecommendation}
                  searchQuery={searchQuery}
                />

                {/* LODGING TAB */}
                <RecommendationTabList
                  tabKey="lodging"
                  activeTab={activeTab}
                  items={recommendations.haltingPlaces}
                  type="lodging"
                  emptyMessage="No matching lodging options found."
                  expanded={expandedState.lodging}
                  onToggleExpand={() => setExpandedState(prev => ({ ...prev, lodging: !prev.lodging }))}
                  selectedTimes={selectedTimes}
                  defaultTime="09:00 PM"
                  timeOptions={timeOptions}
                  onSelectPlace={setSelectedPlace}
                  onCardTimeChange={handleCardTimeChange}
                  isPlaceInTimeline={isPlaceInTimeline}
                  onRemovePlace={handleRemovePlace}
                  checkCardFeasibility={checkCardFeasibility}
                  onAddPlace={handleAddRecommendation}
                  searchQuery={searchQuery}
                />

                {/* REFUEL TAB */}
                <RecommendationTabList
                  tabKey="refuel"
                  activeTab={activeTab}
                  items={recommendations.fuelChargingStops}
                  type="refuel"
                  emptyMessage="No matching stations found."
                  expanded={expandedState.refuel}
                  onToggleExpand={() => setExpandedState(prev => ({ ...prev, refuel: !prev.refuel }))}
                  selectedTimes={selectedTimes}
                  defaultTime="10:00 AM"
                  timeOptions={timeOptions}
                  onSelectPlace={setSelectedPlace}
                  onCardTimeChange={handleCardTimeChange}
                  isPlaceInTimeline={isPlaceInTimeline}
                  onRemovePlace={handleRemovePlace}
                  checkCardFeasibility={checkCardFeasibility}
                  onAddPlace={handleAddRecommendation}
                  searchQuery={searchQuery}
                />

                {/* CUSTOM ADD FORM TAB */}
                {activeTab === 'custom' && (
                  <form onSubmit={handleAddCustomPlace} className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <PlusCircle className="text-purple-400 h-4.5 w-4.5" />
                      Add Custom Waypoint Stop
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Place Name *</label>
                        <input
                          type="text"
                          name="name"
                          value={customPlace.name}
                          onChange={handleCustomPlaceChange}
                          required
                          placeholder="e.g. Lalitha Mahal Palace"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/60"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Category / Purpose</label>
                        <select
                          name="purpose"
                          value={customPlace.purpose}
                          onChange={handleCustomPlaceChange}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/60 cursor-pointer"
                        >
                          <option value="Sightseeing">Sightseeing</option>
                          <option value="Meal Break">Meal Break</option>
                          <option value="Rest Stop">Rest Stop</option>
                          <option value="EV Charging">EV Charging</option>
                          <option value="Fuel Station">Fuel Station</option>
                          <option value="Overnight Stay">Overnight Stay</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Insert Position
                        </label>
                        <select
                          name="insertPosition"
                          value={customPlace.insertPosition || 'auto'}
                          onChange={handleCustomPlaceChange}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/60 cursor-pointer"
                        >
                          <option value="auto">Auto (Before Return Journey)</option>
                          {timeline.map((event, idx) => (
                            <option key={idx} value={idx + 1}>
                              After Step {idx + 1}: {event.place}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Duration (Minutes)
                        </label>
                        <input
                          type="number"
                          name="duration"
                          min="15"
                          max="360"
                          step="15"
                          value={customPlace.duration || 60}
                          onChange={handleCustomPlaceChange}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/60 font-mono"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500">Presets:</span>
                      {[15, 30, 45, 60, 90, 120].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setCustomPlace(prev => ({ ...prev, duration: mins }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                            (customPlace.duration || 60) === mins
                              ? 'bg-purple-600 text-white font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Recommendation / Note</label>
                      <input
                        type="text"
                        name="reason"
                        value={customPlace.reason}
                        onChange={handleCustomPlaceChange}
                        placeholder="e.g. Scenic resort view with high local ratings."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/60"
                      />
                    </div>

                    <div className="pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(customPlace.isPinned)}
                          onChange={(e) => setCustomPlace(prev => ({ ...prev, isPinned: e.target.checked }))}
                          className="rounded border-slate-700 text-purple-600 focus:ring-purple-500/40"
                        />
                        <span className="text-xs text-slate-300 font-medium">
                          Pin this stop's arrival time (Hard constraint)
                        </span>
                      </label>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <button
                        type="submit"
                        disabled={!customPlace.name.trim()}
                        className={`px-4 py-2 font-semibold text-xs rounded-lg transition-all flex items-center gap-1 ${
                          !customPlace.name.trim()
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white cursor-pointer shadow-md'
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        Add Stop & Auto-Reschedule
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : infeasibilityDetails ? (
            <div className="flex-1 bg-slate-900/60 border border-amber-500/30 rounded-2xl p-6 shadow-2xl flex flex-col justify-center animate-scale-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-extrabold uppercase tracking-wider rounded">
                    Feasibility Constraint Alert
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">
                    Complete Round Trip Infeasible within {formData.durationDays} Day{formData.durationDays > 1 ? 's' : ''}
                  </h3>
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl mb-5 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Constraint Analysis</h4>
                <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                  {infeasibilityDetails.reason}
                </p>
                <p className="text-[11px] text-slate-400">
                  DriveSentra AI enforces complete round trips back to <strong className="text-slate-200">{formData.source}</strong> to guarantee traveler safety and avoid incomplete or stranded itineraries.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                  Recommended Feasible Alternatives:
                </h4>
                <div className="space-y-2">
                  {(infeasibilityDetails.alternatives || []).map((alt, i) => (
                    <div 
                      key={i} 
                      className="p-3 bg-slate-950/60 border border-slate-800 hover:border-purple-500/40 rounded-xl flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>{alt}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyInfeasibleAlternative(alt)}
                        className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-200 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                      >
                        Apply Alternative
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
                <span>Safe Driving Limit: Max 10h driving / day</span>
                <button
                  type="button"
                  onClick={() => setInfeasibilityDetails(null)}
                  className="text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Dismiss Alert
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-900/10">
              <Compass className="h-12 w-12 text-slate-700 mb-4 animate-pulse" />
              <h3 className="text-lg font-bold text-slate-400 mb-1">No Active Journey Twin</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Enter your start and target destination on the left, then click "Generate Itinerary" to load attractions and stops.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Google Maps-style Side Panel / Inspect Modal */}
      <InspectModal
        selectedPlace={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        isPlaceInTimeline={isPlaceInTimeline}
        selectedTimes={selectedTimes}
        handleCardTimeChange={handleCardTimeChange}
        timeOptions={timeOptions}
        checkCardFeasibility={checkCardFeasibility}
        handleAddRecommendation={handleAddRecommendation}
        handleRemovePlace={handleRemovePlace}
      />
    </div>
  );
};

export default JourneyCompanion;
