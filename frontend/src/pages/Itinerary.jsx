import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, Sparkles, Navigation, ChevronRight, AlertCircle, 
  ArrowRight, Edit3, Check, X, RotateCcw, Hotel, Home,
  Plus, Trash2, ChevronUp, ChevronDown, Pin, Zap, Fuel, Coffee, Utensils, Compass, Loader2
} from 'lucide-react';
import { 
  getItinerary, 
  updateWaypoint, 
  insertItineraryStop, 
  removeItineraryStop, 
  reorderItineraryStops, 
  updateStopDurationApi, 
  toggleStopPinApi
} from '../services/api';
import { 
  calculateClientRoundTripMetrics, 
  recalculateScheduleClient 
} from '../utils/timeValidation';

const Itinerary = () => {
  const navigate = useNavigate();
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(() => !localStorage.getItem('gd_tripId') ? false : true);
  const [error, setError] = useState(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Time editing states
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingTime, setEditingTime] = useState('');
  const [updating, setUpdating] = useState(false);

  // Stop insertion modal state
  const [insertModal, setInsertModal] = useState({
    isOpen: false,
    index: 1,
    prevPlace: '',
    nextPlace: '',
    place: '',
    purpose: 'Sightseeing',
    duration: 60,
    isPinned: false,
    pinnedTime: '02:00 PM'
  });

  // Async request sequence counter to prevent stale race conditions (Test J)
  const requestIdRef = useRef(0);

  const timeOptions = [
    '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM',
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
    '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM',
    '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM', '11:00 PM'
  ];

  const fetchItinerary = async () => {
    await Promise.resolve();
    const tripId = localStorage.getItem('gd_tripId');
    if (!tripId) {
      setLoading(false);
      return;
    }

    try {
      const res = await getItinerary(tripId);
      if (res.success) {
        setItinerary(res.data);
      } else {
        throw new Error('Failed to retrieve itinerary');
      }
    } catch (err) {
      console.error('Error fetching itinerary from DB, using fallback:', err);
      const savedForm = localStorage.getItem('gd_form');
      const savedTimeline = localStorage.getItem('gd_timeline');
      const savedMetrics = localStorage.getItem('gd_roundTripMetrics');
      if (savedForm && savedTimeline) {
        const form = JSON.parse(savedForm);
        setItinerary({
          tripId,
          source: form.source,
          destination: form.destination,
          tripType: form.tripType,
          vehicleType: form.vehicleType,
          tripDate: form.tripDate,
          startTime: form.startTime,
          durationDays: form.durationDays || 1,
          tripMode: form.tripMode || 'Round Trip',
          timeline: JSON.parse(savedTimeline),
          roundTripMetrics: savedMetrics ? JSON.parse(savedMetrics) : null
        });
      } else {
        setError('No active trip itinerary found. Please create a trip in the Trip Planner first.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItinerary();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Dispatch twin update event helper
  const notifyTwinUpdated = () => {
    window.dispatchEvent(new Event('twin-updated'));
  };

  // 1. CONTEXTUAL INSERTION: Insert stop at ANY position
  const handleOpenInsertModal = (targetIndex) => {
    const timeline = itinerary?.timeline || [];
    const prevPlace = targetIndex > 0 && timeline[targetIndex - 1] ? timeline[targetIndex - 1].place : itinerary?.source || 'Departure';
    const nextPlace = targetIndex < timeline.length && timeline[targetIndex] ? timeline[targetIndex].place : itinerary?.source || 'Return';
    
    // Default time based on predecessor
    const prevEndTime = targetIndex > 0 && timeline[targetIndex - 1]?.endTime ? timeline[targetIndex - 1].endTime : (itinerary?.startTime || '09:00 AM');

    setInsertModal({
      isOpen: true,
      index: targetIndex,
      prevPlace,
      nextPlace,
      place: '',
      purpose: 'Sightseeing',
      duration: 60,
      isPinned: false,
      pinnedTime: prevEndTime
    });
  };

  const handleConfirmInsertStop = async () => {
    if (!insertModal.place.trim() || !itinerary) return;

    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);

    const tripId = itinerary.tripId || localStorage.getItem('gd_tripId');
    const newStop = {
      place: insertModal.place.trim(),
      purpose: insertModal.purpose,
      duration: Number(insertModal.duration) || 60,
      isPinned: insertModal.isPinned,
      pinnedTime: insertModal.isPinned ? insertModal.pinnedTime : null,
      reason: `Contextually added stop between ${insertModal.prevPlace} and ${insertModal.nextPlace}.`
    };

    // Optimistic client update with instant recalculation
    const optimisticTimeline = [...itinerary.timeline];
    optimisticTimeline.splice(insertModal.index, 0, newStop);
    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime
    });

    setItinerary(prev => ({
      ...prev,
      timeline: scheduledOptimistic,
      roundTripMetrics: calculateClientRoundTripMetrics(scheduledOptimistic, itinerary.source, itinerary.destination)
    }));
    setInsertModal(prev => ({ ...prev, isOpen: false }));

    try {
      const res = await insertItineraryStop(tripId, newStop, insertModal.index, {
        source: itinerary.source,
        destination: itinerary.destination,
        startTime: itinerary.startTime,
        tripDate: itinerary.tripDate,
        durationDays: itinerary.durationDays,
        vehicleType: itinerary.vehicleType
      });

      // Avoid stale response overwriting newer state (Test J)
      if (currentReqId === requestIdRef.current && res.success && res.data) {
        setItinerary(res.data);
        localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
        if (res.data.roundTripMetrics) {
          localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
        }
        notifyTwinUpdated();
      }
    } catch (err) {
      console.warn('Backend insert sync failed, maintained optimistic calculation:', err);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsRecalculating(false);
      }
    }
  };

  // 2. STOP REMOVAL
  const handleRemoveStop = async (index, stopId) => {
    if (!itinerary || index <= 0 || index >= itinerary.timeline.length - 1) return;

    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);

    const tripId = itinerary.tripId || localStorage.getItem('gd_tripId');

    // Optimistic removal
    const optimisticTimeline = itinerary.timeline.filter((_, idx) => idx !== index);
    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime
    });

    setItinerary(prev => ({
      ...prev,
      timeline: scheduledOptimistic,
      roundTripMetrics: calculateClientRoundTripMetrics(scheduledOptimistic, itinerary.source, itinerary.destination)
    }));

    try {
      const res = await removeItineraryStop(tripId, index, stopId, {
        source: itinerary.source,
        destination: itinerary.destination,
        startTime: itinerary.startTime,
        tripDate: itinerary.tripDate,
        durationDays: itinerary.durationDays,
        vehicleType: itinerary.vehicleType
      });

      if (currentReqId === requestIdRef.current && res.success && res.data) {
        setItinerary(res.data);
        localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
        if (res.data.roundTripMetrics) {
          localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
        }
        notifyTwinUpdated();
      }
    } catch (err) {
      console.warn('Backend removal sync failed, maintained optimistic state:', err);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsRecalculating(false);
      }
    }
  };

  // 3. REORDER STOPS (Move Up / Move Down)
  const handleMoveStop = async (fromIndex, toIndex) => {
    if (!itinerary || fromIndex <= 0 || toIndex <= 0 || fromIndex >= itinerary.timeline.length - 1 || toIndex >= itinerary.timeline.length - 1) return;

    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);

    const tripId = itinerary.tripId || localStorage.getItem('gd_tripId');

    // Optimistic reorder
    const optimisticTimeline = [...itinerary.timeline];
    const [moved] = optimisticTimeline.splice(fromIndex, 1);
    optimisticTimeline.splice(toIndex, 0, moved);

    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime
    });

    setItinerary(prev => ({
      ...prev,
      timeline: scheduledOptimistic,
      roundTripMetrics: calculateClientRoundTripMetrics(scheduledOptimistic, itinerary.source, itinerary.destination)
    }));

    try {
      const res = await reorderItineraryStops(tripId, fromIndex, toIndex, {
        source: itinerary.source,
        destination: itinerary.destination,
        startTime: itinerary.startTime,
        tripDate: itinerary.tripDate,
        durationDays: itinerary.durationDays,
        vehicleType: itinerary.vehicleType
      });

      if (currentReqId === requestIdRef.current && res.success && res.data) {
        setItinerary(res.data);
        localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
        if (res.data.roundTripMetrics) {
          localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
        }
        notifyTwinUpdated();
      }
    } catch (err) {
      console.warn('Backend reorder sync failed, maintained optimistic state:', err);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsRecalculating(false);
      }
    }
  };

  // 4. DURATION EDITING & DOWNSTREAM PROPAGATION
  const handleUpdateDuration = async (index, stopId, newDuration) => {
    if (!itinerary || index <= 0 || index >= itinerary.timeline.length - 1) return;

    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);

    const tripId = itinerary.tripId || localStorage.getItem('gd_tripId');

    // Optimistic duration update
    const optimisticTimeline = [...itinerary.timeline];
    optimisticTimeline[index] = { ...optimisticTimeline[index], duration: Number(newDuration) };

    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime
    });

    setItinerary(prev => ({
      ...prev,
      timeline: scheduledOptimistic,
      roundTripMetrics: calculateClientRoundTripMetrics(scheduledOptimistic, itinerary.source, itinerary.destination)
    }));

    try {
      const res = await updateStopDurationApi(tripId, index, stopId, newDuration, {
        source: itinerary.source,
        destination: itinerary.destination,
        startTime: itinerary.startTime,
        tripDate: itinerary.tripDate,
        durationDays: itinerary.durationDays,
        vehicleType: itinerary.vehicleType
      });

      if (currentReqId === requestIdRef.current && res.success && res.data) {
        setItinerary(res.data);
        localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
        if (res.data.roundTripMetrics) {
          localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
        }
        notifyTwinUpdated();
      }
    } catch (err) {
      console.warn('Backend duration sync failed, maintained optimistic state:', err);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsRecalculating(false);
      }
    }
  };

  // 5. TOGGLE PINNED RESERVATION TIME
  const handleTogglePin = async (index, stopId, currentIsPinned, currentTime) => {
    if (!itinerary || index <= 0 || index >= itinerary.timeline.length - 1) return;

    const currentReqId = ++requestIdRef.current;
    setIsRecalculating(true);

    const tripId = itinerary.tripId || localStorage.getItem('gd_tripId');
    const newIsPinned = !currentIsPinned;

    const optimisticTimeline = [...itinerary.timeline];
    optimisticTimeline[index] = {
      ...optimisticTimeline[index],
      isPinned: newIsPinned,
      pinnedTime: newIsPinned ? currentTime : null
    };

    const scheduledOptimistic = recalculateScheduleClient(optimisticTimeline, {
      source: itinerary.source,
      destination: itinerary.destination,
      startTime: itinerary.startTime
    });

    setItinerary(prev => ({
      ...prev,
      timeline: scheduledOptimistic,
      roundTripMetrics: calculateClientRoundTripMetrics(scheduledOptimistic, itinerary.source, itinerary.destination)
    }));

    try {
      const res = await toggleStopPinApi(tripId, index, stopId, newIsPinned, currentTime, {
        source: itinerary.source,
        destination: itinerary.destination,
        startTime: itinerary.startTime,
        tripDate: itinerary.tripDate,
        durationDays: itinerary.durationDays,
        vehicleType: itinerary.vehicleType
      });

      if (currentReqId === requestIdRef.current && res.success && res.data) {
        setItinerary(res.data);
        localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
        if (res.data.roundTripMetrics) {
          localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
        }
        notifyTwinUpdated();
      }
    } catch (err) {
      console.warn('Backend pin toggle failed, maintained optimistic state:', err);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsRecalculating(false);
      }
    }
  };

  // 6. SAVE EDITED TIME (Automatically schedules and propagates)
  const handleSaveTime = async (index, waypointId) => {
    const tripId = localStorage.getItem('gd_tripId');
    if (!tripId || !itinerary) return;

    const currentReqId = ++requestIdRef.current;
    setUpdating(true);
    setIsRecalculating(true);

    try {
      const res = await updateWaypoint(tripId, waypointId || index, { 
        time: editingTime,
        isPinned: true,
        pinnedTime: editingTime
      });
      if (currentReqId === requestIdRef.current && res.success && res.data) {
        setItinerary(res.data);
        localStorage.setItem('gd_timeline', JSON.stringify(res.data.timeline));
        if (res.data.roundTripMetrics) {
          localStorage.setItem('gd_roundTripMetrics', JSON.stringify(res.data.roundTripMetrics));
        }
        setEditingIndex(null);
        notifyTwinUpdated();
      }
    } catch (err) {
      console.warn('Backend sync failed, saving waypoint change locally:', err);
      const updatedTimeline = [...itinerary.timeline];
      updatedTimeline[index] = {
        ...updatedTimeline[index],
        time: editingTime,
        isPinned: true,
        pinnedTime: editingTime
      };

      const scheduledOptimistic = recalculateScheduleClient(updatedTimeline, {
        source: itinerary.source,
        destination: itinerary.destination,
        startTime: itinerary.startTime
      });

      setItinerary(prev => ({
        ...prev,
        timeline: scheduledOptimistic,
        roundTripMetrics: calculateClientRoundTripMetrics(scheduledOptimistic, itinerary.source, itinerary.destination)
      }));
      setEditingIndex(null);
    } finally {
      setUpdating(false);
      if (currentReqId === requestIdRef.current) {
        setIsRecalculating(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500 mb-4"></div>
        <p className="text-sm">Synthesizing itinerary timeline...</p>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
        <AlertCircle className="h-12 w-12 text-slate-600 mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-slate-400 mb-1">No Active Itinerary Found</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6">
          To view your journey timeline, you first need to plan a trip with your companion.
        </p>
        <button
          onClick={() => navigate('/journey')}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-semibold text-sm transition-all shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] cursor-pointer"
        >
          Plan a Trip
        </button>
      </div>
    );
  }

  const metrics = itinerary.roundTripMetrics || calculateClientRoundTripMetrics(itinerary.timeline, itinerary.source, itinerary.destination);

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              Trip Itinerary
            </h1>
            {isRecalculating && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-semibold animate-pulse shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                Auto-Rescheduling Timeline...
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-1 text-sm md:text-base flex items-center flex-wrap gap-2">
            <span>Route: </span>
            <span className="text-purple-300 font-semibold">{itinerary.source}</span>
            <ChevronRight className="h-3 w-3 text-slate-600 font-bold" />
            <span className="text-blue-300 font-semibold">{itinerary.destination}</span>
            <ChevronRight className="h-3 w-3 text-slate-600 font-bold" />
            <span className="text-emerald-300 font-semibold">{itinerary.source}</span>
            <span className="px-2.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] uppercase font-bold tracking-wider rounded">
              {itinerary.tripType}
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-wider rounded">
              {itinerary.tripMode || 'Round Trip'}
            </span>
            <span className="px-2.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] uppercase font-bold tracking-wider rounded">
              {itinerary.durationDays || 1} {itinerary.durationDays === 1 ? 'Day' : 'Days'}
            </span>
            {itinerary.tripDate && (
              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase rounded">
                📅 {itinerary.tripDate}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/digital-twin')}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md hover:shadow-purple-500/15 cursor-pointer self-start md:self-auto"
        >
          View Twin Studio
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Round-Trip Summary Metrics Bar */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl animate-scale-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              Complete Round-Trip Journey Overview
            </span>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono font-bold rounded-lg self-start sm:self-auto">
            {itinerary.source} ➔ {itinerary.destination} ➔ {itinerary.source}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">Total Distance</span>
            <span className="text-lg font-bold text-white font-mono">{metrics.totalDistanceKm} km</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Round trip cumulative</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">Total Driving</span>
            <span className="text-lg font-bold text-purple-300 font-mono">
              {metrics.totalDrivingTime || `${Math.floor((metrics.totalTravelTimeMinutes || 0) / 60)}h ${(metrics.totalTravelTimeMinutes || 0) % 60}m`}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Both onward & return</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">Origin Return</span>
            <span className="text-lg font-bold text-emerald-300 font-mono">
              Day {metrics.finalReturnDay || metrics.returnDay || 1} • {metrics.finalReturnArrival || metrics.expectedReturnTime || '10:00 PM'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Arrival at {itinerary.source}</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">Overnight Halt</span>
            <span className="text-sm font-bold text-slate-200 truncate block mt-1">
              {metrics.overnightHalt || (itinerary.durationDays > 1 ? `${itinerary.destination} Hotel` : 'Same-Day Return')}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {itinerary.durationDays > 1 ? 'Day 1 Rest & Recharge' : 'Day 1 Return'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-950/30 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Offline Sync Mode: </span>
            {error} Local fallback database loaded successfully.
          </div>
        </div>
      )}

      {/* Dynamic Timeline with Contextual Insertion at ANY Position */}
      <div className="relative pl-2 md:pl-10 space-y-2">
        {itinerary.timeline.map((event, idx) => {
          const isDeparture = idx === 0 || event.purpose === 'Departure';
          const isLodging = event.purpose === 'Resort Check-in' || event.purpose === 'Overnight Stay' || event.isOvernight;
          const isReturnArrival = idx === itinerary.timeline.length - 1 || event.isReturnArrival || event.purpose === 'Return Arrival';
          const isNewDay = idx === 0 || (event.day && event.day !== (itinerary.timeline[idx - 1]?.day || 1));
          
          return (
            <Fragment key={event.id || `stop_${idx}`}>
              {/* Day divider header */}
              {isNewDay && (
                <div className="py-4 my-2 flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>
                  <div className="px-4 py-1.5 bg-gradient-to-r from-purple-950/80 to-blue-950/80 border border-purple-500/30 rounded-xl text-purple-200 text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    Day {event.day || 1} {event.day === 1 ? '• Onward Journey & Destination Activities' : `• Leisure & Return Journey to ${itinerary.source}`}
                  </div>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>
                </div>
              )}

              {/* CONTEXTUAL INSERTION CONTROL: Between previous stop and current stop */}
              {idx > 0 && (
                <div className="relative pl-8 ml-3 py-1 group/insert">
                  <div className="border-t border-dashed border-slate-800 group-hover/insert:border-purple-500/40 transition-colors my-1 relative flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleOpenInsertModal(idx)}
                      className="opacity-40 group-hover/insert:opacity-100 transition-all px-3 py-1 bg-slate-900/90 hover:bg-purple-900/60 border border-slate-700 hover:border-purple-500/50 text-slate-300 hover:text-purple-200 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer hover:scale-105"
                      title={`Insert stop between ${itinerary.timeline[idx - 1]?.place} and ${event.place}`}
                    >
                      <Plus className="h-3 w-3 text-purple-400" />
                      Insert Stop Here
                    </button>
                  </div>
                </div>
              )}
              
              {/* Travel Time Offset Arrow Indicator */}
              {idx > 0 && event.travelTimeFromPrevious && event.travelTimeFromPrevious !== '0m' && (
                <div className="flex items-center gap-3 pl-8 py-2 border-l-2 border-dashed border-slate-800 ml-3">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-900 border border-slate-800 text-purple-400 animate-pulse">
                    <Navigation className="h-3 w-3 rotate-90" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                    Transit Drive: <strong className="text-slate-300 font-semibold">{event.travelTimeFromPrevious}</strong>
                    {event.distanceFromPrevious > 0 && (
                      <span className="text-[10px] text-slate-500">({event.distanceFromPrevious} km)</span>
                    )}
                  </span>
                </div>
              )}

              {/* Event Card Container */}
              <div className="relative pl-8 border-l-2 border-slate-800 ml-3 py-2">
                
                {/* Timeline Bullet Badge */}
                <div className={`absolute -left-[7px] top-4 h-3 w-3 rounded-full border-2 bg-slate-950 z-10 ${
                  isReturnArrival 
                    ? 'border-emerald-400' 
                    : isLodging 
                      ? 'border-indigo-400' 
                      : event.isOpen 
                        ? 'border-purple-500' 
                        : 'border-rose-500 animate-pulse'
                }`}></div>

                {/* Event Card */}
                <div className={`p-5 rounded-2xl shadow-xl transition-all hover:-translate-y-0.5 group border ${
                  isReturnArrival 
                    ? 'bg-emerald-950/25 border-emerald-500/40 shadow-emerald-950/20' 
                    : isLodging
                      ? 'bg-indigo-950/25 border-indigo-500/40 shadow-indigo-950/20'
                      : event.warning 
                        ? 'bg-slate-900/40 border-rose-500/30' 
                        : 'bg-slate-900/40 hover:bg-slate-900/70 border-slate-800 hover:border-purple-500/20'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    
                    {/* Time & Title */}
                    <div className="flex flex-wrap items-center gap-2">
                      {editingIndex === idx ? (
                        <div className="flex flex-col gap-1.5 bg-slate-950 p-2 rounded-lg border border-slate-800 animate-scale-up">
                          <div className="flex items-center gap-1">
                            <select
                              value={editingTime}
                              onChange={(e) => setEditingTime(e.target.value)}
                              className="bg-slate-900 text-xs text-white outline-none font-bold py-1 px-1.5 rounded cursor-pointer border border-slate-800"
                            >
                              {timeOptions.map((opt, i) => (
                                <option key={i} value={opt} className="text-white bg-slate-900">
                                  {opt}
                                </option>
                              ))}
                            </select>
                            
                            <button
                              onClick={() => handleSaveTime(idx, event._id || event.id)}
                              disabled={updating}
                              className="p-1 hover:bg-slate-800 text-emerald-400 rounded transition-colors cursor-pointer"
                              title="Confirm time edit"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingIndex(null)}
                              className="p-1 hover:bg-slate-800 text-rose-400 rounded transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                            isReturnArrival 
                              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' 
                              : isLodging 
                                ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' 
                                : 'text-purple-300 bg-purple-500/10 border-purple-500/10'
                          }`}>
                            <Clock className="h-3 w-3" />
                            {event.time} {event.endTime && `– ${event.endTime}`}
                          </span>
                          {!isDeparture && !isReturnArrival && (
                            <button
                              onClick={() => {
                                setEditingIndex(idx);
                                setEditingTime(event.time);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-all cursor-pointer"
                              title="Edit time"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                      
                      <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                        {event.place}
                      </h3>
                      {isReturnArrival && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold uppercase rounded tracking-wider flex items-center gap-1">
                          <Home className="h-3 w-3" /> Origin Return
                        </span>
                      )}
                      {isLodging && (
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-extrabold uppercase rounded tracking-wider flex items-center gap-1">
                          <Hotel className="h-3 w-3" /> Overnight Stay
                        </span>
                      )}
                      {event.isPinned && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold rounded flex items-center gap-1">
                          📌 Pinned: {event.pinnedTime || event.time}
                        </span>
                      )}
                    </div>

                    {/* Controls & Badges */}
                    <div className="flex items-center gap-2">
                      {/* Duration Adjuster */}
                      {!isDeparture && !isReturnArrival && !isLodging && (
                        <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[10px]">
                          <span className="text-slate-500 font-bold">Visit:</span>
                          <span className="text-slate-300 font-mono font-bold">{event.duration || 60}m</span>
                          <div className="flex items-center ml-1 gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateDuration(idx, event.id || event._id, Math.max(15, (event.duration || 60) - 15))}
                              className="px-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded font-bold cursor-pointer"
                              title="Reduce 15 mins"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateDuration(idx, event.id || event._id, (event.duration || 60) + 15)}
                              className="px-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded font-bold cursor-pointer"
                              title="Add 15 mins"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Pin/Unpin Reservation Toggle */}
                      {!isDeparture && !isReturnArrival && (
                        <button
                          type="button"
                          onClick={() => handleTogglePin(idx, event.id || event._id, event.isPinned, event.time)}
                          className={`p-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            event.isPinned 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                          }`}
                          title={event.isPinned ? "Unpin this reservation constraint" : "Lock / Pin this time as a fixed reservation"}
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                      )}

                      {/* Move Up / Move Down Reordering */}
                      {!isDeparture && !isReturnArrival && (
                        <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleMoveStop(idx, idx - 1)}
                            disabled={idx <= 1}
                            className="p-1 hover:bg-slate-800 disabled:opacity-20 text-slate-400 hover:text-white rounded cursor-pointer disabled:cursor-not-allowed"
                            title="Move stop earlier"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStop(idx, idx + 1)}
                            disabled={idx >= itinerary.timeline.length - 2}
                            className="p-1 hover:bg-slate-800 disabled:opacity-20 text-slate-400 hover:text-white rounded cursor-pointer disabled:cursor-not-allowed"
                            title="Move stop later"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Delete Stop */}
                      {!isDeparture && !isReturnArrival && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStop(idx, event.id || event._id)}
                          className="opacity-40 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remove stop"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                        event.isOpen 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {event.isOpen ? 'Open' : 'Closed'}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[9px] rounded font-bold uppercase tracking-wider">
                        {event.purpose}
                      </span>
                    </div>

                  </div>

                  <div className="flex items-start gap-2.5 text-slate-400 text-xs leading-relaxed">
                    <Sparkles className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                    <p>{event.reason}</p>
                  </div>

                  {/* Auto-Fixed or Waiting details */}
                  {event.autoFixed && (
                    <div className="mt-2 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      ✨ {event.autoFixMessage || `Schedule automatically coordinated for opening hours.`}
                    </div>
                  )}

                  {/* Warning Messages Alert Banner */}
                  {event.warning && (
                    <div className="mt-3 p-3 bg-rose-950/20 border border-rose-500/25 rounded-xl text-rose-300 text-[11px] leading-relaxed flex items-start gap-2 animate-pulse">
                      <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <strong className="font-bold">Schedule Notice: </strong>
                        {event.warning}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* CONTEXTUAL INSERTION MODAL */}
      {insertModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scale-up space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Compass className="h-5 w-5 text-purple-400" />
                  Insert Stop into Itinerary
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inserting between <span className="text-purple-300 font-semibold">{insertModal.prevPlace}</span> and <span className="text-blue-300 font-semibold">{insertModal.nextPlace}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInsertModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Place Name */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Place Name / Stop Location
                </label>
                <input
                  type="text"
                  placeholder="e.g., Mysore Zoo, Raintree Restaurant, Bescom EV Charger"
                  value={insertModal.place}
                  onChange={(e) => setInsertModal(prev => ({ ...prev, place: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Stop Category */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Stop Category & Purpose
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Sightseeing', label: 'Sightseeing', icon: Compass },
                    { id: 'Meal Break', label: 'Meal Break', icon: Utensils },
                    { id: 'Rest Stop', label: 'Rest Stop', icon: Coffee },
                    { id: 'EV Fast Charging', label: 'EV Charger', icon: Zap },
                    { id: 'Refuel Stop', label: 'Refuel Stop', icon: Fuel },
                    { id: 'Overnight Stay', label: 'Overnight Hotel', icon: Hotel }
                  ].map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setInsertModal(prev => ({ ...prev, purpose: cat.id }))}
                        className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          insertModal.purpose === cat.id
                            ? 'bg-purple-600/20 text-purple-200 border-purple-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Planned Duration */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Planned Visit Duration
                </label>
                <div className="flex items-center gap-2">
                  {[15, 30, 45, 60, 90, 120].map(dur => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setInsertModal(prev => ({ ...prev, duration: dur }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold font-mono cursor-pointer transition-all ${
                        insertModal.duration === dur
                          ? 'bg-purple-500 text-white border-purple-400 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Pinned Reservation Time */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={insertModal.isPinned}
                    onChange={(e) => setInsertModal(prev => ({ ...prev, isPinned: e.target.checked }))}
                    className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Lock as Hard-Pinned Appointment / Reservation</span>
                </label>

                {insertModal.isPinned && (
                  <div className="pt-2 flex items-center gap-3">
                    <span className="text-xs text-slate-400">Fixed Time:</span>
                    <select
                      value={insertModal.pinnedTime}
                      onChange={(e) => setInsertModal(prev => ({ ...prev, pinnedTime: e.target.value }))}
                      className="bg-slate-900 text-xs text-white border border-slate-800 rounded px-2.5 py-1 outline-none font-bold cursor-pointer"
                    >
                      {timeOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-amber-400">Will strictly reserve this slot</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInsertModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInsertStop}
                disabled={!insertModal.place.trim()}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-lg hover:shadow-purple-500/20 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Insert Stop & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Nav */}
      <div className="flex justify-between items-center pt-8">
        <button
          onClick={() => navigate('/journey')}
          className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg text-sm font-bold transition-all cursor-pointer"
        >
          Modify Preferences
        </button>
        <button
          onClick={() => navigate('/agents')}
          className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg text-sm font-bold transition-all cursor-pointer"
        >
          Open AI Agent Panel
        </button>
      </div>
    </div>
  );
};

export default Itinerary;
