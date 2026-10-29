import JourneyCompanion from './JourneyCompanion';

/**
 * TripPlanner Compatibility Wrapper
 * Preserves the /trip-planner URL route, query parameters, navigation state,
 * and deep links while rendering the unified JourneyCompanion experience.
 */
const TripPlanner = () => {
  return <JourneyCompanion isFromTripPlannerRoute={true} />;
};

export default TripPlanner;
