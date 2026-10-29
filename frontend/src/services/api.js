import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gd_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Journey Itinerary API calls
export const generateItinerary = async (tripData) => {
  try {
    const response = await api.post('/itinerary/generate', tripData);
    return response.data;
  } catch (error) {
    console.error('Error generating itinerary:', error);
    throw error.response?.data || error.message;
  }
};

export const getItinerary = async (tripId) => {
  try {
    const response = await api.get(`/itinerary/${tripId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching itinerary for tripId ${tripId}:`, error);
    throw error.response?.data || error.message;
  }
};

export const updateItineraryTimeline = async (tripId, timeline) => {
  try {
    const response = await api.post('/itinerary/update-timeline', { tripId, timeline });
    return response.data;
  } catch (error) {
    console.error(`Error updating timeline for tripId ${tripId}:`, error);
    throw error.response?.data || error.message;
  }
};

export const validateItinerary = async (timeline, tripDetails) => {
  try {
    const response = await api.post('/itinerary/validate', { timeline, tripDetails });
    return response.data;
  } catch (error) {
    console.error('Error validating itinerary:', error);
    throw error.response?.data || error.message;
  }
};

export const updateWaypoint = async (tripId, waypointId, data) => {
  try {
    const response = await api.patch(`/itinerary/${tripId}/waypoint/${waypointId}`, data);
    return response.data;
  } catch (error) {
    console.error(`Error patching waypoint ${waypointId}:`, error);
    throw error.response?.data || error.message;
  }
};

export const insertItineraryStop = async (tripId, stop, insertIndex, tripDetails) => {
  try {
    const response = await api.post('/itinerary/insert-stop', { tripId, stop, insertIndex, tripDetails });
    return response.data;
  } catch (error) {
    console.error('Error inserting stop:', error);
    throw error.response?.data || error.message;
  }
};

export const removeItineraryStop = async (tripId, index, stopId, tripDetails) => {
  try {
    const response = await api.post('/itinerary/remove-stop', { tripId, index, stopId, tripDetails });
    return response.data;
  } catch (error) {
    console.error('Error removing stop:', error);
    throw error.response?.data || error.message;
  }
};

export const reorderItineraryStops = async (tripId, fromIndex, toIndex, tripDetails) => {
  try {
    const response = await api.post('/itinerary/reorder-stops', { tripId, fromIndex, toIndex, tripDetails });
    return response.data;
  } catch (error) {
    console.error('Error reordering stops:', error);
    throw error.response?.data || error.message;
  }
};

export const updateStopDurationApi = async (tripId, index, stopId, duration, tripDetails) => {
  try {
    const response = await api.post('/itinerary/update-duration', { tripId, index, stopId, duration, tripDetails });
    return response.data;
  } catch (error) {
    console.error('Error updating stop duration:', error);
    throw error.response?.data || error.message;
  }
};

export const toggleStopPinApi = async (tripId, index, stopId, isPinned, pinnedTime, tripDetails) => {
  try {
    const response = await api.post('/itinerary/toggle-pin', { tripId, index, stopId, isPinned, pinnedTime, tripDetails });
    return response.data;
  } catch (error) {
    console.error('Error updating pin status:', error);
    throw error.response?.data || error.message;
  }
};

export const rescheduleItinerary = async (tripId, timeline) => {
  try {
    const response = await api.post('/itinerary/reschedule', { tripId, timeline });
    return response.data;
  } catch (error) {
    console.error('Error rescheduling itinerary:', error);
    throw error.response?.data || error.message;
  }
};

export const checkPlaceFeasibility = async (tripId, place, time) => {
  try {
    const response = await api.post('/itinerary/check-place', { tripId, place, time });
    return response.data;
  } catch (error) {
    console.error('Error checking place feasibility:', error);
    throw error.response?.data || error.message;
  }
};

export const getActiveItinerary = async (userId) => {
  try {
    const response = await api.get(`/itinerary/active/${userId}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return { success: false, data: null, message: 'No active trip found' };
    }
    console.error('Error fetching active itinerary:', error);
    throw error.response?.data || error.message;
  }
};

export const applyItineraryFix = async (tripId, timeline) => {
  try {
    const response = await api.post('/itinerary/apply-fix', { tripId, timeline });
    return response.data;
  } catch (error) {
    console.error('Error applying itinerary fix:', error);
    throw error.response?.data || error.message;
  }
};

export const getAutocompletePredictions = async (input) => {
  try {
    const response = await api.get('/maps/autocomplete', { params: { input } });
    return response.data;
  } catch (error) {
    console.error('Error fetching autocomplete predictions:', error);
    throw error.response?.data || error.message;
  }
};

export const getPlaceDetails = async (placeId) => {
  try {
    const response = await api.get('/maps/place-details', { params: { placeId } });
    return response.data;
  } catch (error) {
    console.error('Error fetching place details:', error);
    throw error.response?.data || error.message;
  }
};

export const getCurrentWeather = async (lat, lng, cityName) => {
  try {
    const response = await api.get('/weather/current', { params: { lat, lng, cityName } });
    return response.data;
  } catch (error) {
    console.error('Error fetching current weather:', error);
    throw error.response?.data || error.message;
  }
};

// Place Recommendations API calls
export const recommendPlaces = async (preferences) => {
  try {
    const response = await api.post('/places/recommend', preferences);
    return response.data;
  } catch (error) {
    console.error('Error fetching place recommendations:', error);
    throw error.response?.data || error.message;
  }
};

// Digital Twin API calls
export const getTwinState = async (tripId) => {
  try {
    const response = await api.get(`/twin/${tripId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching digital twin for tripId ${tripId}:`, error);
    throw error.response?.data || error.message;
  }
};

export const updateTwinState = async (updateData) => {
  try {
    const response = await api.post('/twin/update', updateData);
    return response.data;
  } catch (error) {
    console.error('Error updating digital twin:', error);
    throw error.response?.data || error.message;
  }
};

// Agent Recommendations API calls
export const getAgentRecommendations = async (tripId) => {
  try {
    const response = await api.post('/agents/recommend', { tripId });
    return response.data;
  } catch (error) {
    console.error(`Error fetching agent recommendations for tripId ${tripId}:`, error);
    throw error.response?.data || error.message;
  }
};

// Authentication API calls
export const signup = async (name, email, password) => {
  try {
    const response = await api.post('/auth/signup', { name, email, password });
    return response.data;
  } catch (error) {
    console.error('Error in signup:', error);
    throw error.response?.data || error.message;
  }
};

export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  } catch (error) {
    console.error('Error in login:', error);
    throw error.response?.data || error.message;
  }
};

export const getMe = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    console.error('Error in getMe:', error);
    throw error.response?.data || error.message;
  }
};

// Vehicle API calls
export const saveVehicle = async (vehicleData) => {
  try {
    const response = await api.post('/vehicle', vehicleData);
    return response.data;
  } catch (error) {
    console.error('Error in saveVehicle:', error);
    throw error.response?.data || error.message;
  }
};

export const getVehicle = async (userId) => {
  try {
    const response = await api.get(`/vehicle/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching vehicle for userId ${userId}:`, error);
    throw error.response?.data || error.message;
  }
};

export const updateVehicle = async (userId, vehicleData) => {
  try {
    const response = await api.put(`/vehicle/${userId}`, vehicleData);
    return response.data;
  } catch (error) {
    console.error(`Error updating vehicle for userId ${userId}:`, error);
    throw error.response?.data || error.message;
  }
};

// Vehicle Intelligence API calls
export const calculateVehicleRange = async (vehicleData) => {
  try {
    const response = await api.post('/vehicle/calculate-range', vehicleData);
    return response.data;
  } catch (error) {
    console.error('Error calculating vehicle range:', error);
    throw error.response?.data || error.message;
  }
};

export const getEVBatteryHealth = async (healthData) => {
  try {
    const response = await api.post('/vehicle/battery-health', healthData);
    return response.data;
  } catch (error) {
    console.error('Error predicting battery health:', error);
    throw error.response?.data || error.message;
  }
};

export const getMileageAnalytics = async (mileageData) => {
  try {
    const response = await api.post('/vehicle/mileage', mileageData);
    return response.data;
  } catch (error) {
    console.error('Error fetching mileage analytics:', error);
    throw error.response?.data || error.message;
  }
};

export const getStopSuggestions = async (stopsData) => {
  try {
    const response = await api.post('/vehicle/stop-suggestions', stopsData);
    return response.data;
  } catch (error) {
    console.error('Error fetching stop suggestions:', error);
    throw error.response?.data || error.message;
  }
};

// Charging Slot Booking APIs
export const bookChargingSlot = async (bookingData) => {
  try {
    const response = await api.post('/charging/book', bookingData);
    return response.data;
  } catch (error) {
    console.error('Error booking charging slot:', error);
    throw error.response?.data || error.message;
  }
};

export const getChargingBookings = async (tripId) => {
  try {
    const response = await api.get(`/charging/bookings/${tripId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching charging bookings for tripId ${tripId}:`, error);
    throw error.response?.data || error.message;
  }
};

// Trip Planner API calls
export const planTrip = async (tripData) => {
  try {
    const response = await api.post('/trip/plan', tripData);
    return response.data;
  } catch (error) {
    console.error('Error planning trip:', error);
    throw error.response?.data || error.message;
  }
};

export const saveTrip = async (tripData) => {
  try {
    const response = await api.post('/trip/save', tripData);
    return response.data;
  } catch (error) {
    console.error('Error saving trip:', error);
    throw error.response?.data || error.message;
  }
};

export const getTripHistory = async () => {
  try {
    const response = await api.get('/trip/history');
    return response.data;
  } catch (error) {
    console.error('Error fetching trip history:', error);
    throw error.response?.data || error.message;
  }
};

export const deleteTrip = async (id) => {
  try {
    const response = await api.delete(`/trip/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting trip with id ${id}:`, error);
    throw error.response?.data || error.message;
  }
};

// Driver Monitoring & Fatigue API calls
export const saveDriverStatus = async (statusData) => {
  try {
    const response = await api.post('/driver/fatigue', statusData);
    return response.data;
  } catch (error) {
    console.error('Error saving driver fatigue status:', error);
    throw error.response?.data || error.message;
  }
};

export const getDriverLogs = async (userId) => {
  try {
    const response = await api.get(`/driver/logs/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching driver fatigue logs for userId ${userId}:`, error);
    throw error.response?.data || error.message;
  }
};

export const getLatestDriverStatus = async (userId) => {
  try {
    const response = await api.get(`/driver/status/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching latest driver status for userId ${userId}:`, error);
    throw error.response?.data || error.message;
  }
};

// Emergency Alerts API calls
export const sendEmergencyAlert = async (alertData) => {
  try {
    const response = await api.post('/emergency/alert', alertData);
    return response.data;
  } catch (error) {
    console.error('Error sending emergency alert:', error);
    throw error.response?.data || error.message;
  }
};

export const getEmergencyHistory = async (userId) => {
  try {
    const response = await api.get(`/emergency/history/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching emergency history for userId ${userId}:`, error);
    throw error.response?.data || error.message;
  }
};

// Scenario Simulator API calls
export const runSimulation = async (simulationData) => {
  try {
    const response = await api.post('/simulation/run', simulationData);
    return response.data;
  } catch (error) {
    console.error('Error executing scenario simulation:', error);
    throw error.response?.data || error.message;
  }
};

export const resetSimulation = async (resetData = {}) => {
  try {
    const response = await api.post('/simulation/reset', resetData);
    return response.data;
  } catch (error) {
    console.error('Error resetting scenario simulation:', error);
    throw error.response?.data || error.message;
  }
};

export const getSimulationStatus = async () => {
  try {
    const response = await api.get('/simulation/status');
    return response.data;
  } catch (error) {
    console.error('Error fetching simulation status:', error);
    throw error.response?.data || error.message;
  }
};

export default api;
