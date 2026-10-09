import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

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

export const checkPlaceFeasibility = async (tripId, place, time) => {
  try {
    const response = await api.post('/itinerary/check-place', { tripId, place, time });
    return response.data;
  } catch (error) {
    console.error('Error checking place feasibility:', error);
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

export default api;
