// Time calculations and validation helper
import { mockDestinations, defaultMockDestination } from './mockData.js';
import { MOCK_PLACES, searchPlaces } from './googleMaps.js';

// Convert "09:00 AM" to minutes from midnight
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Convert minutes from midnight to "09:00 AM"
export function minutesToTime(minutes) {
  let mins = minutes % 1440;
  if (mins < 0) mins += 1440;
  let hours = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  const padM = m < 10 ? '0' + m : m;
  const padH = hours < 10 ? '0' + hours : hours;
  return `${padH}:${padM} ${ampm}`;
}

// Parse a date string (supporting YYYY-MM-DD and DD-MM-YYYY) manually in the local timezone
export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  
  const cleaned = dateStr.trim();
  let parts = cleaned.split('-');
  if (parts.length !== 3) {
    parts = cleaned.split('/');
  }
  
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else {
      // Fallback
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  
  const d = new Date(cleaned);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Check if a date string is today's date in local time
export function isToday(dateStr, relativeTo = new Date()) {
  if (!dateStr) return false;
  const selectedDate = parseLocalDate(dateStr);
  const today = relativeTo;
  return selectedDate.getFullYear() === today.getFullYear() &&
         selectedDate.getMonth() === today.getMonth() &&
         selectedDate.getDate() === today.getDate();
}

// Check if a date string is in the past
export function isPastDate(dateStr, relativeTo = new Date()) {
  if (!dateStr) return false;
  const selectedDate = parseLocalDate(dateStr);
  const today = new Date(relativeTo);
  today.setHours(0, 0, 0, 0);
  return selectedDate.getTime() < today.getTime();
}

// Check if a time string is in the past for today's date
export function isPastTimeToday(dateStr, timeStr, relativeTo = new Date()) {
  if (!dateStr || !timeStr) return false;
  if (!isToday(dateStr, relativeTo)) return false;
  
  const selectedMins = timeToMinutes(timeStr);
  const now = relativeTo;
  const currentMins = now.getHours() * 60 + now.getMinutes();
  return selectedMins < currentMins;
}

// Predefined places database with open, close, visitDuration, type, popularity, coordinates, etc.
export const PLACE_DATABASE = {
  // Mysore Attractions
  "mysore palace": { open: "10:00 AM", close: "05:30 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 10, lat: 12.3051, lng: 76.6551, tags: ["Heritage", "Palace", "Royal", "History"] },
  "chamundi hill temple": { open: "07:30 AM", close: "09:00 PM", duration: 90, minDuration: 45, type: "attraction", popularity: 9, lat: 12.2748, lng: 76.6710, tags: ["Spiritual", "Temple", "Views", "Heritage"] },
  "brindavan gardens": { open: "06:00 AM", close: "08:00 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 8, lat: 12.4278, lng: 76.5728, tags: ["Nature", "Gardens", "Fountains", "Views"] },
  "karanji lake": { open: "08:30 AM", close: "05:30 PM", duration: 90, minDuration: 45, type: "attraction", popularity: 7, lat: 12.3025, lng: 76.6744, tags: ["Nature", "Lake", "Boating"] },
  "mysore zoo": { open: "08:30 AM", close: "05:30 PM", duration: 180, minDuration: 90, type: "attraction", popularity: 7, lat: 12.3018, lng: 76.6644, tags: ["Nature", "Wildlife", "Zoo", "Family"] },
  "jaganmohan palace art gallery": { open: "10:00 AM", close: "05:00 PM", duration: 90, minDuration: 45, type: "attraction", popularity: 6, lat: 12.3061, lng: 76.6496, tags: ["Heritage", "Art", "Gallery", "History"] },
  "st. philomena's church": { open: "08:00 AM", close: "06:00 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 5, lat: 12.3208, lng: 76.6586, tags: ["Heritage", "Church", "Spiritual"] },
  "railway museum": { open: "09:30 AM", close: "05:30 PM", duration: 75, minDuration: 45, type: "attraction", popularity: 4, lat: 12.3168, lng: 76.6429, tags: ["Educational", "Museum", "Family"] },
  "grs fantasy park": { open: "10:30 AM", close: "06:00 PM", duration: 240, minDuration: 120, type: "attraction", popularity: 3, lat: 12.3481, lng: 76.6210, tags: ["Adventure", "Theme Park", "Family"] },
  "lalitha mahal palace": { open: "10:00 AM", close: "06:00 PM", duration: 90, minDuration: 45, type: "attraction", popularity: 2, lat: 12.3005, lng: 76.6908, tags: ["Heritage", "Palace", "Luxury"] },

  // Mysore Restaurants
  "hotel mylari": { open: "07:00 AM", close: "10:00 PM", duration: 45, minDuration: 30, type: "restaurant", popularity: 8, lat: 12.3090, lng: 76.6610, tags: ["Food", "Breakfast", "Dosa", "Iconic"] },
  "gufha restaurant": { open: "12:00 PM", close: "11:00 PM", duration: 75, minDuration: 45, type: "restaurant", popularity: 7, lat: 12.3060, lng: 76.6530, tags: ["Food", "Dinner", "Multi-cuisine", "Ambience"] },
  "the olive garden": { open: "11:00 AM", close: "10:30 PM", duration: 90, minDuration: 45, type: "restaurant", popularity: 7, lat: 12.3011, lng: 76.6890, tags: ["Food", "Fine Dining", "Italian"] },
  "oyster bay": { open: "11:30 AM", close: "11:00 PM", duration: 75, minDuration: 45, type: "restaurant", popularity: 6, lat: 12.3245, lng: 76.6210, tags: ["Food", "Seafood"] },
  "mahesh prasad": { open: "07:00 AM", close: "09:30 PM", duration: 45, minDuration: 30, type: "restaurant", popularity: 6, lat: 12.3015, lng: 76.6430, tags: ["Food", "Vegetarian", "South Indian"] },
  "parklane hotel restaurant": { open: "11:00 AM", close: "11:30 PM", duration: 75, minDuration: 45, type: "restaurant", popularity: 5, lat: 12.3110, lng: 76.6570, tags: ["Food", "Beer", "Open Air"] },
  "sizzler bistro": { open: "12:00 PM", close: "10:30 PM", duration: 60, minDuration: 40, type: "restaurant", popularity: 5, lat: 12.3256, lng: 76.6190, tags: ["Food", "Cafe", "Pasta"] },
  "spring at radisson blu": { open: "06:30 AM", close: "11:30 PM", duration: 90, minDuration: 60, type: "restaurant", popularity: 7, lat: 12.2980, lng: 76.6660, tags: ["Food", "Buffet", "Fine Dining"] },
  "poojari's fish land": { open: "11:30 AM", close: "10:30 PM", duration: 75, minDuration: 45, type: "restaurant", popularity: 6, lat: 12.3550, lng: 76.7110, tags: ["Food", "Highway Diner", "Seafood"] },
  "depth n green": { open: "08:00 AM", close: "08:30 PM", duration: 60, minDuration: 30, type: "restaurant", popularity: 7, lat: 12.3270, lng: 76.6220, tags: ["Food", "Cafe", "Healthy", "Vegan"] },

  // Mysore Rest Stops
  "highway nest food plaza": { open: "07:00 AM", close: "11:00 PM", duration: 45, minDuration: 20, type: "restStop", popularity: 5, lat: 12.5510, lng: 76.9910, tags: ["Rest", "Expressway Stop", "Food Court"] },
  "cafe coffee day - highway stop": { open: "24 hours", duration: 30, minDuration: 15, type: "restStop", popularity: 6, lat: 12.6120, lng: 77.0120, tags: ["Rest", "24/7", "Coffee"] },
  "kamath lokaruchi": { open: "06:00 AM", close: "10:00 PM", duration: 60, minDuration: 30, type: "restStop", popularity: 8, lat: 12.7210, lng: 77.2910, tags: ["Rest", "Traditional breakfast", "Vegetarian"] },
  "empire restaurant - expressway halt": { open: "24 hours", duration: 45, minDuration: 30, type: "restStop", popularity: 7, lat: 12.5890, lng: 77.0420, tags: ["Rest", "24/7", "Non-veg"] },
  "maddur tiffany's": { open: "06:30 AM", close: "09:30 PM", duration: 35, minDuration: 20, type: "restStop", popularity: 6, lat: 12.5850, lng: 77.0410, tags: ["Rest", "Local Snacks"] },
  "shell select fuel & convenience": { open: "24 hours", duration: 25, minDuration: 10, type: "restStop", popularity: 5, lat: 12.7910, lng: 77.4120, tags: ["Rest", "24/7", "Convenience"] },
  "shivalli restaurant stop": { open: "07:00 AM", close: "10:30 PM", duration: 45, minDuration: 25, type: "restStop", popularity: 6, lat: 12.6510, lng: 77.1210, tags: ["Rest", "Pure Veg"] },
  "adyar ananda bhavan (a2b) - ramanagara": { open: "06:30 AM", close: "10:30 PM", duration: 45, minDuration: 25, type: "restStop", popularity: 7, lat: 12.7110, lng: 77.2810, tags: ["Rest", "Veg", "Sweets"] },
  "polar bear ice cream sundaes": { open: "11:00 AM", close: "11:00 PM", duration: 40, minDuration: 20, type: "restStop", popularity: 5, lat: 12.6100, lng: 77.0100, tags: ["Rest", "Dessert", "AC"] },
  "highway chai point": { open: "06:00 AM", close: "11:00 PM", duration: 30, minDuration: 15, type: "restStop", popularity: 6, lat: 12.3850, lng: 76.7310, tags: ["Rest", "Tea", "Quick Stop"] },

  // Mysore Lodging
  "the windflower resort & spa": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 8, lat: 12.2995, lng: 76.6811, tags: ["Resort", "Spa", "Luxury"] },
  "radisson blu plaza hotel": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 9, lat: 12.2980, lng: 76.6660, tags: ["Luxury", "Hotel", "Pool"] },
  "grand mercure mysore": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 8, lat: 12.3290, lng: 76.6510, tags: ["Premium", "Rooftop Pool"] },
  "silent shores resort & spa": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 8, lat: 12.3411, lng: 76.5821, tags: ["Resort", "Lakeview", "Quiet"] },
  "fortune jp palace": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 7, lat: 12.3210, lng: 76.6690, tags: ["Heritage", "Hotel", "Luxury"] },
  "southern star mysore": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 7, lat: 12.3115, lng: 76.6415, tags: ["Premium", "Location", "Garden"] },
  "roost guesthouse": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 5, lat: 12.3390, lng: 76.5910, tags: ["Budget", "Guesthouse"] },
  "country inn & suites by radisson": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 7, lat: 12.3551, lng: 76.6110, tags: ["Suites", "Family", "Pool"] },
  "ginger mysore": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 6, lat: 12.3190, lng: 76.6710, tags: ["Budget", "Clean", "Business"] },
  "lalitha mahal palace hotel": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 9, lat: 12.3005, lng: 76.6908, tags: ["Heritage", "Luxury", "Royal Experience"] },

  // Mysore Fuel / EV Charging
  "tata power ev fast charger": { open: "24 hours", duration: 45, minDuration: 20, type: "refuel", popularity: 8, lat: 12.2980, lng: 76.6660, tags: ["EV", "Fast Charger"] },
  "hp cl petrol pump - mysore road": { open: "24 hours", duration: 20, minDuration: 10, type: "refuel", popularity: 7, lat: 12.3610, lng: 76.7210, tags: ["Fuel", "Petrol", "Diesel"] },
  "zeon ev charging station - mall of mysore": { open: "10:00 AM", close: "10:00 PM", duration: 45, minDuration: 20, type: "refuel", popularity: 7, lat: 12.2990, lng: 76.6640, tags: ["EV", "Zeon", "Fast Charger"] },
  "jio-bp pulse ev station": { open: "24 hours", duration: 45, minDuration: 20, type: "refuel", popularity: 6, lat: 12.3510, lng: 76.6190, tags: ["EV", "DC Fast Charger"] },
  "shell fuel station - ring road": { open: "24 hours", duration: 20, minDuration: 10, type: "refuel", popularity: 7, lat: 12.3312, lng: 76.6990, tags: ["Fuel", "Shell", "Nitrogen Air"] },
  "indian oil petrol pump - city center": { open: "06:00 AM", close: "11:30 PM", duration: 15, minDuration: 5, type: "refuel", popularity: 6, lat: 12.3099, lng: 76.6570, tags: ["Fuel", "IOCL", "City Center"] },
  "bharat petroleum fast ev station": { open: "24 hours", duration: 45, minDuration: 20, type: "refuel", popularity: 7, lat: 12.3650, lng: 76.7180, tags: ["EV", "BPCL", "24/7"] },
  "ather grid fast charger - gokulam": { open: "08:00 AM", close: "10:00 PM", duration: 30, minDuration: 15, type: "refuel", popularity: 6, lat: 12.3310, lng: 76.6210, tags: ["EV", "Two-wheeler"] },
  "nayara energy fuel station": { open: "24 hours", duration: 20, minDuration: 10, type: "refuel", popularity: 5, lat: 12.3780, lng: 76.6790, tags: ["Fuel", "Bypass"] },
  "relux ev charging hub": { open: "24 hours", duration: 45, minDuration: 20, type: "refuel", popularity: 7, lat: 12.3411, lng: 76.5821, tags: ["EV", "Relux"] },

  // Chennai Attractions
  "marina beach": { open: "24 hours", duration: 90, minDuration: 45, type: "attraction", popularity: 10, lat: 13.0500, lng: 80.2824, tags: ["Nature", "Beach", "Sea", "Scenic"] },
  "kapaleeshwarar temple": { open: "06:00 AM", close: "09:00 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 9, lat: 13.0335, lng: 80.2697, tags: ["Spiritual", "Temple", "Heritage"] },
  "fort st. george": { open: "09:00 AM", close: "05:00 PM", duration: 90, minDuration: 60, type: "attraction", popularity: 8, lat: 13.0792, lng: 80.2882, tags: ["Heritage", "Museum", "History"] },
  "government museum chennai": { open: "09:30 AM", close: "05:00 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 8, lat: 13.0717, lng: 80.2582, tags: ["Educational", "Museum", "History", "Gallery"] },
  "santhome basilica": { open: "06:00 AM", close: "09:00 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 7, lat: 13.0338, lng: 80.2778, tags: ["Heritage", "Church", "Spiritual"] },
  "valluvar kottam": { open: "08:30 AM", close: "05:30 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 6, lat: 13.0583, lng: 80.2422, tags: ["Heritage", "Monument"] },
  "guindy national park": { open: "09:00 AM", close: "05:30 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 7, lat: 13.0067, lng: 80.2206, tags: ["Nature", "Park", "Wildlife"] },
  "besant nagar beach": { open: "24 hours", duration: 90, minDuration: 45, type: "attraction", popularity: 8, lat: 13.0003, lng: 80.2755, tags: ["Nature", "Beach", "Sea", "Sunset"] },
  "dakshinachitra": { open: "10:00 AM", close: "06:00 PM", duration: 180, minDuration: 90, type: "attraction", popularity: 7, lat: 12.8136, lng: 80.2417, tags: ["Culture", "Museum", "Bazaar"] },
  "arignar anna zoological park": { open: "09:00 AM", close: "05:00 PM", duration: 240, minDuration: 120, type: "attraction", popularity: 8, lat: 12.8797, lng: 80.0822, tags: ["Nature", "Zoo", "Wildlife", "Family", "Kids"] },

  // Chennai Restaurants
  "murugan idli shop": { open: "07:00 AM", close: "11:00 PM", duration: 45, minDuration: 30, type: "restaurant", popularity: 9, lat: 13.0326, lng: 80.2355, tags: ["Breakfast", "Idli", "Vegetarian", "Pure Veg", "South Indian"] },
  "ratna cafe": { open: "06:30 AM", close: "10:30 PM", duration: 45, minDuration: 30, type: "restaurant", popularity: 8, lat: 13.0573, lng: 80.2745, tags: ["Breakfast", "Sambar", "Vegetarian", "Pure Veg", "South Indian"] },
  "mathsya": { open: "07:00 AM", close: "11:30 PM", duration: 60, minDuration: 30, type: "restaurant", popularity: 7, lat: 13.0732, lng: 80.2601, tags: ["Vegetarian", "Pure Veg", "Dinner"] },
  "sangeetha veg restaurant": { open: "06:30 AM", close: "10:30 PM", duration: 45, minDuration: 30, type: "restaurant", popularity: 8, lat: 13.0331, lng: 80.2687, tags: ["Breakfast", "Vegetarian", "Pure Veg", "South Indian"] },
  "annalakshmi": { open: "12:00 PM", close: "09:30 PM", duration: 90, minDuration: 60, type: "restaurant", popularity: 9, lat: 13.0641, lng: 80.2562, tags: ["Fine Dining", "Vegetarian", "Pure Veg"] },
  "southern spice": { open: "12:30 PM", close: "11:30 PM", duration: 90, minDuration: 60, type: "restaurant", popularity: 9, lat: 13.0617, lng: 80.2407, tags: ["Fine Dining", "Heritage", "Luxury"] },
  "ponnusamy hotel": { open: "11:30 AM", close: "11:00 PM", duration: 60, minDuration: 40, type: "restaurant", popularity: 6, lat: 13.0592, lng: 80.2435, tags: ["Chettinad", "Spicy", "Non-veg"] },
  "the marina": { open: "12:00 PM", close: "11:00 PM", duration: 75, minDuration: 45, type: "restaurant", popularity: 7, lat: 13.0581, lng: 80.2458, tags: ["Seafood", "Fine Dining"] },
  "buhari": { open: "11:00 AM", close: "11:30 PM", duration: 60, minDuration: 40, type: "restaurant", popularity: 7, lat: 13.0628, lng: 80.2635, tags: ["Biryani", "Chicken 65"] },
  "adyar ananda bhavan": { open: "06:30 AM", close: "10:30 PM", duration: 45, minDuration: 25, type: "restaurant", popularity: 8, lat: 13.0062, lng: 80.2560, tags: ["Sweets", "Vegetarian", "Pure Veg", "South Indian"] },

  // Chennai Rest Stops
  "cafe coffee day": { open: "24 hours", duration: 30, minDuration: 15, type: "restStop", popularity: 7, lat: 12.8532, lng: 80.2260, tags: ["Coffee", "24/7", "Washrooms"] },
  "writer’s cafe": { open: "09:00 AM", close: "10:00 PM", duration: 45, minDuration: 20, type: "restStop", popularity: 8, lat: 13.0526, lng: 80.2587, tags: ["Cafe", "Bakery"] },
  "amethyst cafe": { open: "07:30 AM", close: "11:00 PM", duration: 60, minDuration: 30, type: "restStop", popularity: 8, lat: 13.0558, lng: 80.2612, tags: ["Premium Lounge", "GardenSetting"] },
  "sandy’s chocolate laboratory": { open: "11:00 AM", close: "11:00 PM", duration: 45, minDuration: 25, type: "restStop", popularity: 7, lat: 13.0601, lng: 80.2452, tags: ["Dessert", "Chocolate"] },
  "a2b highway stop": { open: "06:00 AM", close: "11:00 PM", duration: 40, minDuration: 20, type: "restStop", popularity: 8, lat: 12.8252, lng: 80.2241, tags: ["Veg", "Restrooms"] },

  // Chennai Lodging
  "taj coromandel": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 9, lat: 13.0617, lng: 80.2407, tags: ["Luxury", "Hotel", "Pool"] },
  "itc grand chola": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 10, lat: 13.0101, lng: 80.2206, tags: ["Luxury", "Hotel", "Spa"] },
  "radisson blu chennai": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 8, lat: 12.9961, lng: 80.1982, tags: ["Premium", "Airport Hotel"] },
  "the park chennai": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 8, lat: 13.0524, lng: 80.2498, tags: ["Premium", "Boutique"] },
  "hyatt regency chennai": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 8, lat: 13.0436, lng: 80.2475, tags: ["Luxury", "Hotel"] },
  "ginger chennai": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 7, lat: 12.9892, lng: 80.2468, tags: ["Budget", "Business"] },
  "fabhotel options": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 6, lat: 13.0450, lng: 80.2500, tags: ["Budget", "Guesthouse"] },

  // Chennai EV/Fuel
  "tata power ev charging": { open: "24 hours", duration: 45, minDuration: 20, type: "refuel", popularity: 8, lat: 13.0100, lng: 80.2210, tags: ["EV", "Tata Power", "Fast Charger"] },
  "statiq ev charging": { open: "24 hours", duration: 45, minDuration: 20, type: "refuel", popularity: 8, lat: 13.0430, lng: 80.2480, tags: ["EV", "Statiq"] },
  "ather grid chennai": { open: "08:00 AM", close: "10:00 PM", duration: 30, minDuration: 15, type: "refuel", popularity: 7, lat: 13.0600, lng: 80.2460, tags: ["EV", "Two-wheeler"] },
  "indianoil": { open: "24 hours", duration: 20, minDuration: 10, type: "refuel", popularity: 7, lat: 13.0700, lng: 80.2600, tags: ["Fuel", "IOCL"] },
  "bharat petroleum": { open: "24 hours", duration: 20, minDuration: 10, type: "refuel", popularity: 7, lat: 12.8300, lng: 80.2250, tags: ["Fuel", "BPCL"] },
  "hp petrol pump": { open: "24 hours", duration: 20, minDuration: 10, type: "refuel", popularity: 7, lat: 13.0620, lng: 80.2620, tags: ["Fuel", "HPCL"] },

  // Coorg Attractions
  "abbey falls": { open: "09:00 AM", close: "05:00 PM", duration: 60, minDuration: 45, type: "attraction", popularity: 9, lat: 12.4578, lng: 75.7210, tags: ["Nature", "Waterfall"] },
  "raja's seat": { open: "06:00 AM", close: "08:00 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 8, lat: 12.4190, lng: 75.7390, tags: ["Scenic", "Sunset", "Gardens"] },
  "namdroling golden temple": { open: "09:00 AM", close: "06:00 PM", duration: 90, minDuration: 45, type: "attraction", popularity: 10, lat: 12.4280, lng: 75.9690, tags: ["Spiritual", "Temple", "Heritage"] },

  // Delhi
  "red fort": { open: "09:30 AM", close: "04:30 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 10, lat: 28.6562, lng: 77.2410, tags: ["Heritage", "Fort", "History"] },
  "qutub minar": { open: "07:00 AM", close: "09:00 PM", duration: 90, minDuration: 45, type: "attraction", popularity: 9, lat: 28.5244, lng: 77.1855, tags: ["Heritage", "History"] },
  "lotus temple": { open: "09:00 AM", close: "06:00 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 8, lat: 28.5535, lng: 77.2588, tags: ["Spiritual", "Temple"] },
  "india gate": { open: "24 hours", duration: 45, minDuration: 20, type: "attraction", popularity: 7, lat: 28.6129, lng: 77.2295, tags: ["Heritage", "Memorial"] },
  "bukhara restaurant": { open: "12:30 PM", close: "11:45 PM", duration: 75, minDuration: 45, type: "restaurant", popularity: 8, lat: 28.5975, lng: 77.1722, tags: ["Food", "North Indian"] },
  "haldirams delhi": { open: "09:00 AM", close: "10:30 PM", duration: 40, minDuration: 20, type: "restaurant", popularity: 7, lat: 28.6304, lng: 77.2177, tags: ["Food", "Vegetarian", "Snacks"] },
  "the taj mahal hotel delhi": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 8, lat: 28.6044, lng: 77.2215, tags: ["Luxury", "Hotel"] },

  // Agra
  "taj mahal": { open: "06:00 AM", close: "07:00 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 10, lat: 27.1751, lng: 78.0421, tags: ["Heritage", "Palace", "Architecture", "Spiritual"] },
  "agra fort": { open: "06:00 AM", close: "06:00 PM", duration: 90, minDuration: 45, type: "attraction", popularity: 9, lat: 27.1795, lng: 78.0211, tags: ["Heritage", "Fort", "History"] },
  "mehtab bagh": { open: "06:00 AM", close: "06:00 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 8, lat: 27.1798, lng: 78.0435, tags: ["Nature", "Gardens", "Views"] },
  "pinch of spice": { open: "12:00 PM", close: "11:00 PM", duration: 60, minDuration: 45, type: "restaurant", popularity: 8, lat: 27.1991, lng: 78.0152, tags: ["Food", "Multi-cuisine"] },
  "dasaprakash agra": { open: "11:00 AM", close: "10:30 PM", duration: 45, minDuration: 30, type: "restaurant", popularity: 7, lat: 27.1611, lng: 78.0121, tags: ["Food", "South Indian"] },
  "oberoi amarvilas": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 9, lat: 27.1712, lng: 78.0411, tags: ["Luxury", "Hotel"] },
  "itc mughal agra": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 8, lat: 27.1615, lng: 78.0289, tags: ["Luxury", "Hotel"] },

  // Paris
  "eiffel tower": { open: "09:00 AM", close: "11:45 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 10, lat: 48.8584, lng: 2.2945, tags: ["Heritage", "Views"] },
  "louvre museum": { open: "09:00 AM", close: "06:00 PM", duration: 180, minDuration: 90, type: "attraction", popularity: 9, lat: 48.8606, lng: 2.3376, tags: ["Heritage", "Art", "Museum"] },
  "notre dame cathedral": { open: "08:00 AM", close: "06:45 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 8, lat: 48.8530, lng: 2.3499, tags: ["Spiritual", "Heritage", "Church"] },
  "le jules verne": { open: "12:00 PM", close: "10:30 PM", duration: 90, minDuration: 60, type: "restaurant", popularity: 8, lat: 48.8584, lng: 2.2945, tags: ["Food", "Fine Dining", "French"] },
  "l'avenue": { open: "12:00 PM", close: "11:00 PM", duration: 60, minDuration: 40, type: "restaurant", popularity: 7, lat: 48.8665, lng: 2.3023, tags: ["Food", "Cafe"] },
  "the ritz paris": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 9, lat: 48.8682, lng: 2.3292, tags: ["Luxury", "Hotel"] },

  // London
  "british museum": { open: "10:00 AM", close: "05:00 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 10, lat: 51.5194, lng: -0.1270, tags: ["Educational", "Museum", "History"] },
  "london eye": { open: "10:00 AM", close: "08:30 PM", duration: 60, minDuration: 30, type: "attraction", popularity: 9, lat: 51.5033, lng: -0.1195, tags: ["Scenic", "Views"] },
  "tower of london": { open: "09:00 AM", close: "05:30 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 8, lat: 51.5081, lng: -0.0759, tags: ["Heritage", "Castle", "History"] },
  "rules restaurant": { open: "12:00 PM", close: "11:00 PM", duration: 75, minDuration: 45, type: "restaurant", popularity: 8, lat: 51.5108, lng: -0.1235, tags: ["Food", "British"] },
  "the savoy": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 9, lat: 51.5098, lng: -0.1200, tags: ["Luxury", "Hotel"] },

  // New York
  "statue of liberty": { open: "08:30 AM", close: "04:00 PM", duration: 150, minDuration: 90, type: "attraction", popularity: 10, lat: 40.6892, lng: -74.0445, tags: ["Heritage", "Scenic"] },
  "central park": { open: "06:00 AM", close: "11:00 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 9, lat: 40.7829, lng: -73.9654, tags: ["Nature", "Gardens"] },
  "empire state building": { open: "09:00 AM", close: "12:00 AM", duration: 90, minDuration: 45, type: "attraction", popularity: 8, lat: 40.7484, lng: -73.9857, tags: ["Scenic", "Views"] },
  "eleven madison park": { open: "05:30 PM", close: "10:30 PM", duration: 120, minDuration: 90, type: "restaurant", popularity: 9, lat: 40.7416, lng: -73.9872, tags: ["Food", "Fine Dining", "Vegetarian"] },
  "the plaza hotel": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 9, lat: 40.7644, lng: -73.9744, tags: ["Luxury", "Hotel"] },

  // Washington
  "lincoln memorial": { open: "24 hours", duration: 45, minDuration: 20, type: "attraction", popularity: 10, lat: 38.8893, lng: -77.0502, tags: ["Heritage", "History"] },
  "smithsonian museum": { open: "10:00 AM", close: "05:30 PM", duration: 120, minDuration: 60, type: "attraction", popularity: 9, lat: 38.8913, lng: -77.0260, tags: ["Educational", "Museum", "History"] },
  "united states capitol": { open: "08:30 AM", close: "04:30 PM", duration: 90, minDuration: 45, type: "attraction", popularity: 8, lat: 38.8899, lng: -77.0090, tags: ["Heritage", "Government"] },
  "the hay-adams": { open: "24 hours", duration: 720, minDuration: 360, type: "lodging", popularity: 9, lat: 38.9002, lng: -77.0368, tags: ["Luxury", "Hotel"] }
};

// Retrieve place specs or return defaults
export function getPlaceSpecs(name) {
  if (!name) return { open: "24 hours", duration: 60, type: "general" };
  const key = name.toLowerCase().trim();
  
  if (PLACE_DATABASE[key]) {
    return PLACE_DATABASE[key];
  }

  // Dynamic keyword checking
  if (key.includes("arrive in") || key.includes("arrive at")) {
    return { open: "24 hours", duration: 0, type: "arrival" };
  }
  if (key.includes("palace") || key.includes("temple") || key.includes("garden") || key.includes("lake") || key.includes("falls") || key.includes("peak") || key.includes("hills") || key.includes("viewpoint")) {
    return { open: "09:00 AM", close: "06:00 PM", duration: 90, type: "attraction" };
  }
  if (key.includes("restaurant") || key.includes("hotel") || key.includes("diner") || key.includes("cafe") || key.includes("bhavan") || key.includes("brewpub") || key.includes("food") || key.includes("mylari") || key.includes("gufha")) {
    return { open: "07:00 AM", close: "11:00 PM", duration: 45, type: "restaurant" };
  }
  if (key.includes("charging") || key.includes("charger") || key.includes("station") || key.includes("pump") || key.includes("petrol")) {
    return { open: "24 hours", duration: 20, type: "refuel" };
  }
  if (key.includes("resort") || key.includes("inn") || key.includes("stay") || key.includes("villa")) {
    return { open: "24 hours", duration: 480, type: "lodging" };
  }
  return { open: "08:00 AM", close: "09:00 PM", duration: 60, type: "attraction" };
}

// Worldwide destination records mapped for autocomplete and multi-day routing
export const WORLDWIDE_DESTINATIONS = {
  delhi: {
    name: "Delhi",
    attractions: [
      { name: "Red Fort", type: "Heritage", description: "Grand Mughal-era fort with historical museum.", tags: ["Heritage", "Fort", "History"] },
      { name: "Qutub Minar", type: "Heritage", description: "Ancient victory tower and world heritage site.", tags: ["Heritage", "History"] },
      { name: "Lotus Temple", type: "Spiritual", description: "Flowerlike Bahai temple known for quiet meditation.", tags: ["Spiritual", "Temple"] },
      { name: "India Gate", type: "Heritage", description: "War memorial arch dedicated to soldiers.", tags: ["Heritage", "Memorial"] }
    ],
    restaurants: [
      { name: "Bukhara Restaurant", cuisine: "North Indian", budget: "High", description: "Highly acclaimed tandoor grill dinner.", tags: ["Food", "North Indian"] },
      { name: "Haldirams Delhi", cuisine: "Vegetarian Snacks", budget: "Low", description: "Popular vegetarian fast snacks and sweets.", tags: ["Food", "Vegetarian", "Snacks"] }
    ],
    haltingPlaces: [
      { name: "The Taj Mahal Hotel Delhi", pricePerNight: "₹15,000/night", tags: ["Luxury", "Hotel"] }
    ],
    fuelChargingStops: [
      { name: "City EV Grid Hub", type: "EV", tags: ["EV", "Fast Charger"] }
    ]
  },
  agra: {
    name: "Agra",
    attractions: [
      { name: "Taj Mahal", type: "Heritage", description: "One of the Seven Wonders of the World, majestic white marble mausoleum.", tags: ["Heritage", "Palace", "Architecture"] },
      { name: "Agra Fort", type: "Heritage", description: "Red sandstone fortress containing imperial palaces.", tags: ["Heritage", "Fort", "History"] },
      { name: "Mehtab Bagh", type: "Nature", description: "Moonlight garden aligning directly across from the Taj Mahal.", tags: ["Nature", "Gardens", "Views"] }
    ],
    restaurants: [
      { name: "Pinch of Spice", cuisine: "Multi-cuisine", budget: "Medium", description: "Popular fine-dining curry house.", tags: ["Food", "Multi-cuisine"] },
      { name: "Dasaprakash Agra", cuisine: "South Indian", budget: "Low", description: "Delicious traditional vegetarian thalis.", tags: ["Food", "South Indian"] }
    ],
    haltingPlaces: [
      { name: "Oberoi Amarvilas", pricePerNight: "₹28,000/night", tags: ["Luxury", "Hotel"] },
      { name: "ITC Mughal Agra", pricePerNight: "₹11,000/night", tags: ["Luxury", "Hotel"] }
    ],
    fuelChargingStops: [
      { name: "HP Fuel Station - Bypass", type: "Fuel", tags: ["Fuel", "Petrol"] }
    ]
  },
  paris: {
    name: "Paris",
    attractions: [
      { name: "Eiffel Tower", type: "Heritage", description: "Iconic tower overlooking Champ de Mars.", tags: ["Heritage", "Views"] },
      { name: "Louvre Museum", type: "Heritage", description: "World's largest art museum holding the Mona Lisa.", tags: ["Heritage", "Art", "Museum"] },
      { name: "Notre Dame Cathedral", type: "Spiritual", description: "Gothic cathedral located on the Seine.", tags: ["Spiritual", "Heritage", "Church"] }
    ],
    restaurants: [
      { name: "Le Jules Verne", cuisine: "French Fine Dining", budget: "High", description: "Michelin-starred restaurant inside the Eiffel Tower.", tags: ["Food", "Fine Dining", "French"] },
      { name: "L'Avenue", cuisine: "Cafe", budget: "Medium", description: "Trendy Paris bistro with terrace seating.", tags: ["Food", "Cafe"] }
    ],
    haltingPlaces: [
      { name: "The Ritz Paris", pricePerNight: "€1200/night", tags: ["Luxury", "Hotel"] }
    ],
    fuelChargingStops: [
      { name: "Voltaic EV Charging Station", type: "EV", tags: ["EV", "Fast Charger"] }
    ]
  },
  london: {
    name: "London",
    attractions: [
      { name: "British Museum", type: "Educational", description: "Human history, art, and culture museum.", tags: ["Educational", "Museum", "History"] },
      { name: "London Eye", type: "Scenic Viewpoint", description: "Giant observation wheel on the South Bank.", tags: ["Scenic", "Views"] },
      { name: "Tower of London", type: "Heritage", description: "Historic castle housing the Crown Jewels.", tags: ["Heritage", "Castle", "History"] }
    ],
    restaurants: [
      { name: "Rules Restaurant", cuisine: "British", budget: "High", description: "London's oldest restaurant serving classic game.", tags: ["Food", "British"] }
    ],
    haltingPlaces: [
      { name: "The Savoy", pricePerNight: "£650/night", tags: ["Luxury", "Hotel"] }
    ],
    fuelChargingStops: [
      { name: "Voltaic EV Charging Station", type: "EV", tags: ["EV", "Fast Charger"] }
    ]
  },
  "new york": {
    name: "New York",
    attractions: [
      { name: "Statue of Liberty", type: "Heritage", description: "Famous copper sculpture on Liberty Island.", tags: ["Heritage", "Scenic"] },
      { name: "Central Park", type: "Nature", description: "Massive urban park with lakes and fields.", tags: ["Nature", "Gardens"] },
      { name: "Empire State Building", type: "Scenic Viewpoint", description: "Famous Art Deco tower with skyline viewpoints.", tags: ["Scenic", "Views"] }
    ],
    restaurants: [
      { name: "Eleven Madison Park", cuisine: "Vegetarian Fine Dining", budget: "High", description: "Luxury plant-based gourmet menu.", tags: ["Food", "Fine Dining", "Vegetarian"] }
    ],
    haltingPlaces: [
      { name: "The Plaza Hotel", pricePerNight: "$950/night", tags: ["Luxury", "Hotel"] }
    ],
    fuelChargingStops: [
      { name: "Voltaic EV Charging Station", type: "EV", tags: ["EV", "Fast Charger"] }
    ]
  },
  washington: {
    name: "Washington",
    attractions: [
      { name: "Lincoln Memorial", type: "Heritage", description: "Neoclassical temple honoring Abraham Lincoln.", tags: ["Heritage", "History"] },
      { name: "Smithsonian Museum", type: "Educational", description: "World's largest museum and research complex.", tags: ["Educational", "Museum", "History"] },
      { name: "United States Capitol", type: "Heritage", description: "Historic government dome building.", tags: ["Heritage", "Government"] }
    ],
    restaurants: [
      { name: "Highway Diner", cuisine: "Multi-cuisine", budget: "Medium", description: "Classic retro american diner.", tags: ["Diner", "24/7", "Burger"] }
    ],
    haltingPlaces: [
      { name: "The Hay-Adams", pricePerNight: "$550/night", tags: ["Luxury", "Hotel"] }
    ],
    fuelChargingStops: [
      { name: "Voltaic EV Charging Station", type: "EV", tags: ["EV", "Fast Charger"] }
    ]
  }
};

// Calculate travel time between two waypoints
export function getTravelTime(fromPlace, toPlace, source, destination) {
  const f = (fromPlace || '').toLowerCase().trim();
  const t = (toPlace || '').toLowerCase().trim();
  const src = (source || 'bangalore').toLowerCase().trim();
  const dst = (destination || 'mysore').toLowerCase().trim();

  if (!f || !t) return 0;
  if (f === t) return 0;

  const isFromSrc = f === src || f.includes(src) || f.includes("start from") || f.includes("depart from " + src);
  const isToDst = t === dst || t.includes(dst) || t.includes("arrive at " + dst) || t.includes("arrive in " + dst);

  const isFromDst = f === dst || f.includes(dst) || f.includes("check out from") || f.includes("depart from " + dst);
  const isToSrc = t === src || t.includes(src) || t.includes("arrive at " + src) || t.includes("return to " + src);

  // Highway stop identifier
  const isHighwayStop = (name) => {
    return name.includes("highway") || name.includes("plaza") || name.includes("food court") || 
           name.includes("coffee day") || name.includes("spices hub") || name.includes("shell select") || 
           name.includes("a2b") || name.includes("rest area") || name.includes("rest stop") ||
           name.includes("maddur") || name.includes("kamath") || name.includes("expressway");
  };

  // Major highway routes (Bidirectional: Onward or Return)
  if ((isFromSrc && isToDst) || (isFromDst && isToSrc)) {
    if ((src.includes("bangalore") && dst.includes("mysore")) || (src.includes("mysore") && dst.includes("bangalore"))) return 120; // 2h 0m
    if ((src.includes("bangalore") && dst.includes("coorg")) || (src.includes("coorg") && dst.includes("bangalore"))) return 270; // 4h 30m
    if ((src.includes("bangalore") && dst.includes("ooty")) || (src.includes("ooty") && dst.includes("bangalore"))) return 330; // 5h 30m
    if ((src.includes("bangalore") && dst.includes("chikkamagaluru")) || (src.includes("chikkamagaluru") && dst.includes("bangalore"))) return 240; // 4h 0m
    if ((src.includes("bangalore") && dst.includes("chennai")) || (src.includes("chennai") && dst.includes("bangalore"))) return 300; // 5h 0m
    if ((src.includes("delhi") && dst.includes("agra")) || (src.includes("agra") && dst.includes("delhi"))) return 210;
    if ((src.includes("paris") && dst.includes("london")) || (src.includes("london") && dst.includes("paris"))) return 330;
    if ((src.includes("new york") && dst.includes("washington")) || (src.includes("washington") && dst.includes("new york"))) return 240;
    return 150; // default 2.5h
  }

  // Onward Highway stop checks
  if (isFromSrc && isHighwayStop(t)) {
    if (src.includes("bangalore") && dst.includes("mysore")) return 60; 
    if (src.includes("bangalore") && dst.includes("coorg")) return 140;
    if (src.includes("bangalore") && dst.includes("ooty")) return 170;
    if (src.includes("bangalore") && dst.includes("chikkamagaluru")) return 120;
    if (src.includes("bangalore") && dst.includes("chennai")) return 150;
    return 60;
  }

  if (isHighwayStop(f) && isToDst) {
    if (src.includes("bangalore") && dst.includes("mysore")) return 60; 
    if (src.includes("bangalore") && dst.includes("coorg")) return 140;
    if (src.includes("bangalore") && dst.includes("ooty")) return 170;
    if (src.includes("bangalore") && dst.includes("chikkamagaluru")) return 120;
    if (src.includes("bangalore") && dst.includes("chennai")) return 150;
    return 60;
  }

  // Return Leg Highway stop checks
  if (isFromDst && isHighwayStop(t)) {
    if (src.includes("bangalore") && dst.includes("mysore")) return 60; 
    if (src.includes("bangalore") && dst.includes("coorg")) return 140;
    if (src.includes("bangalore") && dst.includes("ooty")) return 170;
    if (src.includes("bangalore") && dst.includes("chikkamagaluru")) return 120;
    if (src.includes("bangalore") && dst.includes("chennai")) return 150;
    return 60;
  }

  if (isHighwayStop(f) && isToSrc) {
    if (src.includes("bangalore") && dst.includes("mysore")) return 60; 
    if (src.includes("bangalore") && dst.includes("coorg")) return 140;
    if (src.includes("bangalore") && dst.includes("ooty")) return 170;
    if (src.includes("bangalore") && dst.includes("chikkamagaluru")) return 120;
    if (src.includes("bangalore") && dst.includes("chennai")) return 150;
    return 60;
  }

  // Destination area back to Source (Return journey)
  if (isToSrc && !isHighwayStop(f)) {
    return getTravelTime(dst, src, src, dst);
  }

  // Source to Destination area (Onward journey)
  if (isFromSrc && !isHighwayStop(t)) {
    return getTravelTime(src, dst, src, dst);
  }

  // Travel within destination local network
  let hash = 0;
  const key = [f, t].sort().join('-');
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return 15 + (Math.abs(hash) % 21); // 15 to 35 mins
}

// Haversine formula helper for coordinate distance fallback
export function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Travel time calculation utilizing absolute coordinates if present
export function getTravelTimeWithCoords(fromPlace, toPlace, source, destination, fromCoords, toCoords) {
  const f = (fromPlace || "").toLowerCase().trim();
  const t = (toPlace || "").toLowerCase().trim();
  const src = (source || "").toLowerCase().trim();
  const dst = (destination || "").toLowerCase().trim();

  // Check known major corridors first
  const isFromSrc = f === src || f.includes(src) || f.includes("start from") || f.includes("depart from " + src);
  const isToDst = t === dst || t.includes(dst) || t.includes("arrive at " + dst) || t.includes("arrive in " + dst);
  const isFromDst = f === dst || f.includes(dst) || f.includes("check out from") || f.includes("depart from " + dst);
  const isToSrc = t === src || t.includes(src) || t.includes("arrive at " + src) || t.includes("return to " + src);

  if ((isFromSrc && isToDst) || (isFromDst && isToSrc)) {
    return getTravelTime(fromPlace, toPlace, source, destination);
  }

  const getCityCoords = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('mysore') || lower.includes('mysuru')) return { lat: 12.2958, lng: 76.6394 };
    if (lower.includes('bangalore') || lower.includes('bengaluru')) return { lat: 12.9716, lng: 77.5946 };
    if (lower.includes('ooty')) return { lat: 11.4102, lng: 76.6950 };
    if (lower.includes('coorg') || lower.includes('madikeri')) return { lat: 12.4244, lng: 75.7382 };
    if (lower.includes('chikkamagaluru')) return { lat: 13.3161, lng: 75.7720 };
    if (lower.includes('chennai')) return { lat: 13.0827, lng: 80.2707 };
    if (lower.includes('delhi')) return { lat: 28.6139, lng: 77.2090 };
    if (lower.includes('agra')) return { lat: 27.1767, lng: 78.0081 };
    return { lat: 12.9716, lng: 77.5946 };
  };

  let resolvedFromCoords = fromCoords;
  let resolvedToCoords = toCoords;
  if (!resolvedFromCoords || resolvedFromCoords.lat === undefined) {
    const s = getPlaceSpecs(fromPlace);
    if (s && s.lat) resolvedFromCoords = { lat: s.lat, lng: s.lng };
    else if (isFromSrc) resolvedFromCoords = getCityCoords(source);
    else if (isFromDst) resolvedFromCoords = getCityCoords(destination);
  }
  if (!resolvedToCoords || resolvedToCoords.lat === undefined) {
    const s = getPlaceSpecs(toPlace);
    if (s && s.lat) resolvedToCoords = { lat: s.lat, lng: s.lng };
    else if (isToSrc) resolvedToCoords = getCityCoords(source);
    else if (isToDst) resolvedToCoords = getCityCoords(destination);
  }

  if (resolvedFromCoords && resolvedToCoords && resolvedFromCoords.lat !== undefined && resolvedFromCoords.lng !== undefined && resolvedToCoords.lat !== undefined && resolvedToCoords.lng !== undefined) {
    const dist = getHaversineDistance(resolvedFromCoords.lat, resolvedFromCoords.lng, resolvedToCoords.lat, resolvedToCoords.lng);
    const isHighway = f.includes("start") || f.includes("highway") || f.includes("rest") || 
                      f.includes("arrive") || t.includes("highway") || t.includes("rest") || 
                      t.includes("arrive") || isFromSrc || isToSrc || dist > 40;
    const speed = isHighway ? 70 : 40; // average speed in km/h
    const mins = (dist / speed) * 60;
    return Math.max(10, Math.round(mins)); // minimum 10 minutes transit
  }
  return getTravelTime(fromPlace, toPlace, source, destination);
}

// Estimated driving distance in km between source and destination
export function getRouteEstimatedDistanceKm(source, destination, sourceCoords, destinationCoords) {
  const s = (source || "").toLowerCase().trim();
  const d = (destination || "").toLowerCase().trim();
  if ((s.includes("bangalore") && d.includes("mysore")) || (d.includes("bangalore") && s.includes("mysore"))) return 145;
  if ((s.includes("bangalore") && d.includes("coorg")) || (d.includes("bangalore") && s.includes("coorg"))) return 250;
  if ((s.includes("bangalore") && d.includes("ooty")) || (d.includes("bangalore") && s.includes("ooty"))) return 275;
  if ((s.includes("bangalore") && d.includes("chikkamagaluru")) || (d.includes("bangalore") && s.includes("chikkamagaluru"))) return 240;
  if ((s.includes("bangalore") && d.includes("chennai")) || (d.includes("bangalore") && s.includes("chennai"))) return 345;
  if ((s.includes("delhi") && d.includes("agra")) || (d.includes("agra") && s.includes("delhi"))) return 230;
  if ((s.includes("paris") && d.includes("london")) || (d.includes("london") && s.includes("paris"))) return 450;
  if ((s.includes("new york") && d.includes("washington")) || (d.includes("washington") && s.includes("new york"))) return 360;

  if (sourceCoords && destinationCoords && sourceCoords.lat !== undefined && destinationCoords.lat !== undefined) {
    const directKm = getHaversineDistance(sourceCoords.lat, sourceCoords.lng, destinationCoords.lat, destinationCoords.lng);
    // Driving distance is typically ~1.25x - 1.3x straight-line distance
    return Math.round(directKm * 1.3);
  }
  return 150;
}

// Format duration to string
export function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins === 0 ? `${hrs}h` : `${hrs}h ${remainingMins}m`;
}

export function getPlaceTimeStatus(placeName, arrivalTime) {
  const specs = getPlaceSpecs(placeName);
  const openTime = specs.open || specs.openTime;
  const closeTime = specs.close || specs.closeTime;
  const minDur = specs.minDuration || specs.minimumVisitDuration || 60;
  const recDur = specs.duration || specs.recommendedVisitDuration || 90;

  if (openTime === "24 hours" || openTime === "24 Hours" || !closeTime) {
    return "OPEN";
  }

  const arrivalMins = timeToMinutes(arrivalTime);
  const openMins = timeToMinutes(openTime);
  const closeMins = timeToMinutes(closeTime);

  if (arrivalMins < openMins || arrivalMins >= closeMins) {
    return "CLOSED";
  }

  const availableMins = closeMins - arrivalMins;
  if (availableMins < minDur) {
    return "NOT ENOUGH TIME";
  }
  if (availableMins < recDur) {
    return "LIMITED";
  }
  return "OPEN";
}

// Check if a place is open at arrival time and stays open throughout duration
export function checkOpeningHours(placeName, arrivalTime, durationMinutes) {
  const status = getPlaceTimeStatus(placeName, arrivalTime);
  return status === "OPEN" || status === "LIMITED";
}

// Calculate earliest possible arrival
export function calculateEarliestArrival(prevPlace, currentPlace, prevEndTime, source, destination, prevCoords, currentCoords) {
  const transit = getTravelTimeWithCoords(prevPlace, currentPlace, source, destination, prevCoords, currentCoords);
  const prevEndMins = timeToMinutes(prevEndTime);
  return minutesToTime(prevEndMins + transit);
}

// Detect overlaps in the timeline
export function detectOverlaps(timeline, source, destination) {
  let prevEnd = 0;
  let prevPlace = null;
  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const arrival = timeToMinutes(item.time);
    if (i > 0) {
      const prevCoords = timeline[i-1] ? { lat: timeline[i-1].lat, lng: timeline[i-1].lng } : null;
      const currentCoords = { lat: item.lat, lng: item.lng };
      const travel = getTravelTimeWithCoords(prevPlace, item.place, source, destination, prevCoords, currentCoords);
      if (arrival < prevEnd + travel) {
        return { overlap: true, index: i, place: item.place };
      }
    }
    const specs = getPlaceSpecs(item.place);
    const duration = specs.duration || 60;
    prevEnd = arrival + duration;
    prevPlace = item.place;
  }
  return { overlap: false };
}

// Suggest next available slot if place is closed
export function suggestNextAvailableSlot(placeName, currentMinutes) {
  const specs = getPlaceSpecs(placeName);
  if (specs.open === "24 hours") return "any time (24 hours)";
  const openMins = timeToMinutes(specs.open);
  
  if (currentMinutes < openMins) {
    return `today at ${specs.open}`;
  } else {
    return `tomorrow at ${specs.open}`;
  }
}

// Validate individual waypoint edit parameters
export function validateWaypointEdit(input) {
  const { waypoint, previousWaypoint, nextWaypoint, tripDate, tripStartTime, source, destination } = input;
  const arrivalTime = waypoint.time;
  const arrivalMins = timeToMinutes(arrivalTime);

  // 1. Check trip start limits
  const startMins = timeToMinutes(tripStartTime);
  if (arrivalMins < startMins) {
    return { valid: false, reason: "BEFORE_TRIP_START", message: `Invalid timing: Stop cannot be scheduled before trip start (${tripStartTime}).` };
  }

  // 2. Check past time today
  if (isPastTimeToday(tripDate, arrivalTime)) {
    return { valid: false, reason: "PAST_TIME", message: "Invalid time: Start time cannot be earlier than current time today." };
  }

  // 3. Check preceding offset constraints
  if (previousWaypoint) {
    const prevCoords = previousWaypoint.lat !== undefined ? { lat: previousWaypoint.lat, lng: previousWaypoint.lng } : null;
    const waypointCoords = waypoint.lat !== undefined ? { lat: waypoint.lat, lng: waypoint.lng } : null;
    const travelTime = getTravelTimeWithCoords(previousWaypoint.place, waypoint.place, source, destination, prevCoords, waypointCoords);
    const earliestArrivalStr = calculateEarliestArrival(previousWaypoint.place, waypoint.place, previousWaypoint.endTime || previousWaypoint.time, source, destination, prevCoords, waypointCoords);
    const earliestArrivalMins = timeToMinutes(earliestArrivalStr);
    
    if (arrivalMins < earliestArrivalMins) {
      return { 
        valid: false, 
        reason: "TRAVEL_TIME_CONFLICT", 
        message: `Invalid timing: ${waypoint.place} cannot be scheduled at ${arrivalTime} because estimated arrival from ${previousWaypoint.place} is ${earliestArrivalStr} (including travel time).` 
      };
    }
  }

  // 4. Check following offset constraints
  if (nextWaypoint) {
    const specs = getPlaceSpecs(waypoint.place);
    const duration = specs.duration || 60;
    const endMins = arrivalMins + duration;
    const waypointCoords = waypoint.lat !== undefined ? { lat: waypoint.lat, lng: waypoint.lng } : null;
    const nextCoords = nextWaypoint.lat !== undefined ? { lat: nextWaypoint.lat, lng: nextWaypoint.lng } : null;
    const travelToNext = getTravelTimeWithCoords(waypoint.place, nextWaypoint.place, source, destination, waypointCoords, nextCoords);
    const nextArrivalMins = timeToMinutes(nextWaypoint.time);

    if (endMins + travelToNext > nextArrivalMins) {
      return {
        valid: false,
        reason: "OVERLAP_NEXT",
        message: `Invalid timing: This stop overlaps with your next waypoint (${nextWaypoint.place}) which is scheduled at ${nextWaypoint.time}.`
      };
    }
  }

  // 5. Check opening hours (skip if it is the starting city, i.e., previousWaypoint is null)
  if (previousWaypoint !== null && previousWaypoint !== undefined) {
    const status = getPlaceTimeStatus(waypoint.place, arrivalTime);
    if (status === "CLOSED" || status === "NOT ENOUGH TIME") {
      const specs = getPlaceSpecs(waypoint.place);
      const openTime = specs.open || specs.openTime || "09:00 AM";
      const closeTime = specs.close || specs.closeTime || "06:00 PM";
      const minDur = specs.minDuration || specs.minimumVisitDuration || 60;
      if (status === "CLOSED") {
        const nextSlot = suggestNextAvailableSlot(waypoint.place, arrivalMins);
        return {
          valid: false,
          reason: "PLACE_CLOSED",
          message: `${waypoint.place} is closed at ${arrivalTime}. Opening hours: ${openTime} - ${closeTime}. Suggested next opening: ${nextSlot}.`
        };
      } else {
        const closeMins = timeToMinutes(closeTime);
        const availableMins = closeMins - arrivalMins;
        return {
          valid: false,
          reason: "NOT_ENOUGH_TIME",
          message: `${waypoint.place} does not have enough visit time at ${arrivalTime}. Minimum required: ${minDur} mins, available: ${availableMins} mins.`
        };
      }
    }
  }

  return { valid: true };
}

// Generate accurate multi-day itinerary
export async function generateAccurateItinerary(input) {
  const {
    source,
    destination,
    tripDate,
    startTime = "09:00 AM",
    tripType,
    foodPreference,
    budget,
    vehicleType,
    fuelOrBatteryLevel = 85,
    mileageOrRange = 340,
    durationDays = 1,
    tripStyle = 'Balanced',
    interests = [],
    sourceCoords,
    destinationCoords,
    sourcePlaceId,
    destinationPlaceId,
    sourceAddress,
    destinationAddress,
    tripMode = 'Round Trip',
    needStay = false,
    overnightHalt
  } = input;

  const key = (destination || "").toLowerCase().trim();
  const allDestData = { ...mockDestinations, ...WORLDWIDE_DESTINATIONS };
  
  let destData = defaultMockDestination;
  let matchKey = Object.keys(allDestData).find(k => key.includes(k) || k.includes(key));
  if (!matchKey && (key.includes('mysore') || key.includes('mysuru'))) {
    matchKey = 'mysore';
  }
  if (matchKey) {
    destData = allDestData[matchKey];
  }

  // Google Places Dynamic Sourcing
  if (process.env.GOOGLE_MAPS_API_KEY && destinationCoords && destinationCoords.lat) {
    try {
      const gQuery = (queryType) => `${destination} ${queryType}`;
      const searchG = async (queryType, typeTag) => {
        const results = await searchPlaces(gQuery(queryType), destinationCoords.lat, destinationCoords.lng);
        return results.map(r => ({
          name: r.name,
          type: typeTag,
          location: r.address || destination,
          rating: r.rating || 4.2,
          description: `Highly rated spot in ${destination}.`,
          openTime: typeTag === 'lodging' || typeTag === 'refuel' ? "24 hours" : "09:00 AM",
          closeTime: typeTag === 'lodging' || typeTag === 'refuel' ? "24 hours" : "08:00 PM",
          minimumVisitDuration: typeTag === 'lodging' ? 360 : 45,
          recommendedVisitDuration: typeTag === 'lodging' ? 720 : 90,
          tags: r.tags || [],
          lat: r.lat,
          lng: r.lng,
          placeId: r.placeId,
          address: r.address
        }));
      };

      const gAttractions = await searchG("attractions", "attraction");
      const gRestaurants = await searchG("restaurants", "restaurant");
      const gHotels = await searchG("hotels", "lodging");
      const gCharging = await searchG(vehicleType === 'EV' ? "ev charging station" : "gas station", "refuel");

      if (gAttractions.length > 0) {
        destData = {
          name: destination,
          attractions: gAttractions,
          restaurants: gRestaurants.length > 0 ? gRestaurants : destData.restaurants,
          haltingPlaces: gHotels.length > 0 ? gHotels : destData.haltingPlaces,
          fuelChargingStops: gCharging.length > 0 ? gCharging : destData.fuelChargingStops,
          restStops: destData.restStops
        };
      }
    } catch (err) {
      console.error("Failed dynamically fetching Google Places for itinerary generation:", err);
    }
  }

  // -------------------------------------------------------------
  // FEASIBILITY VALIDATION BEFORE GENERATION
  // -------------------------------------------------------------
  const estimatedOneWayKm = getRouteEstimatedDistanceKm(source, destination, sourceCoords, destinationCoords);
  const oneWayTransitMins = getTravelTimeWithCoords(source, destination, source, destination, sourceCoords, destinationCoords);
  const isRoundTrip = tripMode !== 'One Way';
  const effectiveRoundTripKm = isRoundTrip ? estimatedOneWayKm * 2 : estimatedOneWayKm;
  const effectiveTransitMins = isRoundTrip ? oneWayTransitMins * 2 : oneWayTransitMins;

  // Feasibility Check for 1-Day Trip
  if (durationDays === 1 && isRoundTrip) {
    const startMins = timeToMinutes(startTime);
    const safeCutoffMins = timeToMinutes("10:30 PM"); // 1350 mins from midnight
    const availableWindowMins = safeCutoffMins - startMins;

    const outboundRestMins = oneWayTransitMins >= 90 ? 30 : 0;
    const returnRestMins = oneWayTransitMins >= 90 ? 30 : 0;
    const lunchMins = 45;
    const minSightseeingMins = 60;
    const minRequiredMins = effectiveTransitMins + outboundRestMins + returnRestMins + lunchMins + minSightseeingMins;

    // Daily safe driving threshold is 600 mins (10 hours pure driving)
    if (effectiveTransitMins > 600 || minRequiredMins > availableWindowMins) {
      const reason = `A 1-day round trip from ${source} to ${destination} is not feasible. The total round-trip driving time alone is approximately ${formatMinutes(effectiveTransitMins)} (~${effectiveRoundTripKm} km), which exceeds safe daily driving limits (max 10 hours) and leaves insufficient time for required rest breaks, meals, sightseeing, and a safe return before 10:30 PM.`;
      const alternatives = [
        `Increase trip duration to 2 or 3 days for a comfortable round trip with an overnight halt.`,
        `Choose a closer destination within 150 km (such as Mysore, Ramanagara, or Nandi Hills) that fits within Day 1.`,
        `If extending to 2 days, start earlier (e.g., 06:00 AM) to maximize daytime sightseeing.`
      ];

      const infeasibleArr = [];
      infeasibleArr.isFeasible = false;
      infeasibleArr.reason = reason;
      infeasibleArr.alternatives = alternatives;
      infeasibleArr.infeasible = (destData.attractions || []).map(a => ({
        place: a.name,
        reason: `Cannot be scheduled: 1-day round trip to ${destination} is infeasible due to round-trip driving distance (~${effectiveRoundTripKm} km).`
      }));
      return infeasibleArr;
    }
  }

  // Feasibility Check for 2-Day Trip
  if (durationDays === 2 && isRoundTrip) {
    // 2-day safe driving threshold is 1200 mins (20 hours total pure driving across 2 days)
    if (effectiveTransitMins > 1200) {
      const reason = `A 2-day round trip between ${source} and ${destination} is not feasible. The total round-trip driving time of ${formatMinutes(effectiveTransitMins)} (~${effectiveRoundTripKm} km) exceeds safe 2-day driving limits.`;
      const alternatives = [
        `Extend your trip duration to 4 or more days to travel safely.`,
        `Select a closer regional destination within 350 km.`,
        `Consider flight or train travel rather than self-driving for this long-distance route.`
      ];

      const infeasibleArr = [];
      infeasibleArr.isFeasible = false;
      infeasibleArr.reason = reason;
      infeasibleArr.alternatives = alternatives;
      infeasibleArr.infeasible = [];
      return infeasibleArr;
    }
  }

  // -------------------------------------------------------------
  // TIMELINE INITIALIZATION & DRIVETRAIN TRACKING
  // -------------------------------------------------------------
  const timeline = [];
  const infeasible = [];
  const isEV = vehicleType?.toUpperCase() === 'EV';
  
  // Calculate activeRange dynamically based on drivetrain technology
  let activeRange;
  if (isEV) {
    activeRange = (mileageOrRange <= 150) ? mileageOrRange : mileageOrRange * (fuelOrBatteryLevel / 100);
  } else {
    const tankCapacity = 35;
    const fuelLevel = (fuelOrBatteryLevel / 100) * tankCapacity;
    const resolvedMileage = input.mileage || 15;
    activeRange = fuelLevel * resolvedMileage;
  }

  // 1. Determine daily sightseeing curation limits
  let maxPerDay = 3;
  if (tripStyle?.toLowerCase() === 'relaxed') maxPerDay = 2;
  else if (tripStyle?.toLowerCase() === 'packed') maxPerDay = 4;

  // 2. Select & sort attractions matching interests
  let attractionPool = [...(destData.attractions || [])];
  if (interests && interests.length > 0) {
    attractionPool.sort((a, b) => {
      const aMatch = (a.tags || []).some(t => interests.some(i => i.toLowerCase() === t.toLowerCase()));
      const bMatch = (b.tags || []).some(t => interests.some(i => i.toLowerCase() === t.toLowerCase()));
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      const aPop = getPlaceSpecs(a.name).popularity || a.rating || 0;
      const bPop = getPlaceSpecs(b.name).popularity || b.rating || 0;
      return bPop - aPop;
    });
  } else {
    attractionPool.sort((a, b) => {
      const aPop = getPlaceSpecs(a.name).popularity || a.rating || 0;
      const bPop = getPlaceSpecs(b.name).popularity || b.rating || 0;
      return bPop - aPop;
    });
  }

  let currentDay = 1;
  let currentTime = timeToMinutes(startTime);

  // Overnight halt location resolution (respects input.overnightHalt for Test D)
  const resolvedOvernightHalt = overnightHalt || destData.haltingPlaces?.[0]?.name || "Resort & Spa";
  const haltSpecs = getPlaceSpecs(resolvedOvernightHalt);
  const haltCoords = {
    lat: haltSpecs.lat || destinationCoords?.lat || 12.2980,
    lng: haltSpecs.lng || destinationCoords?.lng || 76.6660
  };
  
  let currentLoc = source;
  let currentCoords = sourceCoords || { lat: 12.9716, lng: 77.5946 };

  // Closure helper to add a waypoint, track vehicle range, and insert fuel/charging stops dynamically
  async function travelToPlace(targetName, purpose, reasonText, visitDuration, targetSpecs) {
    const isSourceLoc = targetName.includes(`Arrive at ${source}`) || targetName.includes(`Return to ${source}`) || targetName === source;
    const isHaltLoc = targetName.includes(resolvedOvernightHalt);

    let defaultCoords = destinationCoords || { lat: 12.2958, lng: 76.6394 };
    if (isSourceLoc) {
      defaultCoords = sourceCoords || { lat: 12.9716, lng: 77.5946 };
    } else if (isHaltLoc) {
      defaultCoords = haltCoords;
    }

    const targetCoords = { 
      lat: targetSpecs?.lat !== undefined ? targetSpecs.lat : defaultCoords?.lat, 
      lng: targetSpecs?.lng !== undefined ? targetSpecs.lng : defaultCoords?.lng 
    };

    let transit = getTravelTimeWithCoords(currentLoc, targetName, source, destination, currentCoords, targetCoords);
    const dist = transit; // 1 min ~ 1 km

    // Check vehicle range constraint (insert EV Charging or Fuel stop if remaining range < 50 km)
    if (activeRange - dist < 50) {
      const isReturnLeg = isSourceLoc || currentDay > 1;
      const station = destData.fuelChargingStops?.[0] || { name: isEV ? "Tata Power EV Fast Charger" : "HP Fuel Station" };
      const stationSpecs = getPlaceSpecs(station.name);
      const stationCoords = { 
        lat: stationSpecs.lat || (isReturnLeg ? 12.5850 : destinationCoords?.lat) || 12.2958, 
        lng: stationSpecs.lng || (isReturnLeg ? 77.0410 : destinationCoords?.lng) || 76.6394 
      };
      
      const transitToStation = getTravelTimeWithCoords(currentLoc, station.name, source, destination, currentCoords, stationCoords);
      currentTime += transitToStation;
      activeRange -= transitToStation;

      const stopDuration = isEV ? 35 : 15;
      timeline.push({
        day: currentDay,
        time: minutesToTime(currentTime),
        endTime: minutesToTime(currentTime + stopDuration),
        duration: stopDuration,
        place: isReturnLeg ? `${station.name} (Return Leg)` : station.name,
        purpose: isEV ? "EV Fast Charging" : "Refuel Stop",
        reason: `Stop required: Remaining range is critically low (${Math.round(Math.max(activeRange, 15))} km). Recharging/Refueling is necessary to prevent route breakdown risk on the journey to ${targetName}.`,
        travelTimeFromPrevious: formatMinutes(transitToStation),
        isOpen: true,
        warning: null,
        lat: stationCoords.lat,
        lng: stationCoords.lng,
        placeId: stationSpecs.placeId || `station_${station.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        address: stationSpecs.address || station.name
      });

      currentTime += stopDuration;
      const fullRangeLimit = isEV 
        ? (mileageOrRange <= 150 ? 340 : mileageOrRange) 
        : (mileageOrRange <= 300 ? 580 : mileageOrRange);
      activeRange = isEV ? fullRangeLimit * 0.9 : fullRangeLimit;

      currentLoc = isReturnLeg ? `${station.name} (Return Leg)` : station.name;
      currentCoords = stationCoords;
      transit = getTravelTimeWithCoords(currentLoc, targetName, source, destination, currentCoords, targetCoords);
    }

    currentTime += transit;
    activeRange -= transit;

    timeline.push({
      day: currentDay,
      time: minutesToTime(currentTime),
      endTime: minutesToTime(currentTime + visitDuration),
      duration: visitDuration,
      place: targetName,
      purpose,
      isReturnArrival: purpose === 'Return Arrival' || isSourceLoc,
      isOvernight: purpose === 'Overnight Stay' || purpose === 'Resort Check-in',
      reason: reasonText,
      travelTimeFromPrevious: formatMinutes(transit),
      isOpen: purpose === 'Sightseeing' 
        ? getPlaceTimeStatus(targetName, minutesToTime(currentTime)) === 'OPEN'
        : checkOpeningHours(targetName, minutesToTime(currentTime), visitDuration),
      warning: null,
      lat: targetCoords.lat,
      lng: targetCoords.lng,
      placeId: targetSpecs?.placeId || `${purpose.toLowerCase().replace(/[^a-z0-9]/g, '')}_${targetName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      address: targetSpecs?.address || (isSourceLoc ? (sourceAddress || source) : `${targetName}, ${destination}`)
    });

    currentTime += visitDuration;
    currentLoc = targetName;
    currentCoords = targetCoords;
  }

  // -------------------------------------------------------------
  // GENERATE SCHEDULE: ONE-DAY ROUND TRIP
  // -------------------------------------------------------------
  if (durationDays === 1) {
    currentDay = 1;
    currentTime = timeToMinutes(startTime);

    // 1. Start from Source
    timeline.push({
      day: 1,
      time: startTime,
      endTime: startTime,
      place: source.startsWith("Start from") ? source : `Start from ${source}`,
      purpose: "Departure",
      reason: "Begin your road trip journey with optimized multi-agent route mapping.",
      travelTimeFromPrevious: "0m",
      isOpen: true,
      warning: null,
      lat: sourceCoords?.lat,
      lng: sourceCoords?.lng,
      placeId: sourcePlaceId,
      address: sourceAddress || source
    });

    // 2. Outbound rest stop (if drive >= 90 mins)
    if (oneWayTransitMins >= 90) {
      const restStopName = destData.restStops?.[0]?.name || "Highway Nest Food Plaza";
      const restStopSpecs = getPlaceSpecs(restStopName);
      await travelToPlace(restStopName, "Rest & Coffee", "Stop for refreshments and clean amenities. Essential for safety to prevent fatigue after highway driving.", 30, restStopSpecs);
    }

    // 3. Arrive at destination
    await travelToPlace(`Arrive at ${destination}`, "Arrival", `Arrive safely at your destination city ${destination}.`, 0, {
      lat: destinationCoords?.lat,
      lng: destinationCoords?.lng,
      placeId: destinationPlaceId,
      address: destinationAddress || destination
    });

    // 4. Lunch break in destination (if arriving before 02:30 PM)
    if (currentTime < timeToMinutes("02:30 PM")) {
      const preferredRestaurant = destData.restaurants?.[0]?.name || "Local Dine";
      const restaurantSpecs = getPlaceSpecs(preferredRestaurant);
      await travelToPlace(preferredRestaurant, "Lunch Break", `Enjoy regional dining at ${preferredRestaurant} in ${destination}.`, restaurantSpecs.duration || 45, restaurantSpecs);
    }

    // 5. Sightseeing in destination (ensuring return can finish comfortably before 10:00 PM)
    const returnTransitEst = getTravelTimeWithCoords(destination, source, source, destination, destinationCoords, sourceCoords);
    const returnRestEst = returnTransitEst >= 90 ? 30 : 0;
    const safeCutoff = timeToMinutes("10:00 PM"); // 22:00 allows room for dinner, return drive & charging

    let day1AttractionsScheduled = 0;
    for (let i = 0; i < attractionPool.length; i++) {
      if (day1AttractionsScheduled >= maxPerDay) break;

      const att = attractionPool[i];
      const specs = getPlaceSpecs(att.name);
      const attCoords = { lat: specs.lat, lng: specs.lng };
      const transitToAtt = getTravelTimeWithCoords(currentLoc, att.name, source, destination, currentCoords, attCoords);
      const attArrival = currentTime + transitToAtt;
      const attEnd = attArrival + (specs.duration || 60);

      // Transit from this sight back to source, accounting for complete return drive, rest, dinner, and EV charging
      const transitFromAttToSource = getTravelTimeWithCoords(att.name, source, source, destination, attCoords, sourceCoords);
      const chargingBuffer = isEV ? 75 : 20; // transit to charger + charging time
      const expectedFinishTime = attEnd + transitFromAttToSource + returnRestEst + chargingBuffer + 45;

      if (expectedFinishTime > safeCutoff) {
        infeasible.push({
          place: att.name,
          reason: `${att.name} cannot fit on Day 1: required return journey to ${source} (${formatMinutes(transitFromAttToSource + returnRestEst + chargingBuffer)}) would exceed the 10:30 PM safe return cutoff.`
        });
        continue;
      }

      const status = getPlaceTimeStatus(att.name, minutesToTime(attArrival));
      if (status === 'OPEN' || status === 'LIMITED') {
        await travelToPlace(att.name, "Sightseeing", att.description || "Top rated local sight.", specs.duration || 60, specs);
        day1AttractionsScheduled++;
        attractionPool.splice(i, 1);
        i--;
      } else {
        infeasible.push({
          place: att.name,
          reason: `${att.name} is closed at ${minutesToTime(attArrival)}. Opening hours: ${specs.open || "09:00 AM"} - ${specs.close || "06:00 PM"}.`
        });
      }
    }

    // 6. Dinner break if time allows before return drive
    const currentReturnTransit = getTravelTimeWithCoords(currentLoc, source, source, destination, currentCoords, sourceCoords);
    if (currentTime < timeToMinutes("08:00 PM") && (currentTime + 45 + currentReturnTransit + returnRestEst <= safeCutoff)) {
      const preferredRestaurant = destData.restaurants?.[1]?.name || destData.restaurants?.[0]?.name;
      if (preferredRestaurant) {
        const restaurantSpecs = getPlaceSpecs(preferredRestaurant);
        await travelToPlace(preferredRestaurant, "Dinner Break", `Dinner stop at ${preferredRestaurant} before commencing the evening return drive.`, 40, restaurantSpecs);
      }
    }

    // 7. Complete Return Journey to Source on Day 1!
    if (isRoundTrip) {
      if (returnTransitEst >= 90) {
        const returnRestStop = "Highway Express Rest Stop (Return)";
        await travelToPlace(returnRestStop, "Rest & Coffee", "Essential highway break on the return leg to reduce driving fatigue and maintain alertness.", 30, {
          lat: 12.5850,
          lng: 77.0410,
          address: `${source} - ${destination} Expressway`
        });
      }

      // Final Return Arrival at Source on Day 1
      await travelToPlace(`Arrive at ${source}`, "Return Arrival", `Complete your road trip and safely arrive back at your original departure location (${source}).`, 0, {
        lat: sourceCoords?.lat,
        lng: sourceCoords?.lng,
        placeId: sourcePlaceId,
        address: sourceAddress || source
      });
    } else {
      timeline.push({
        day: 1,
        time: minutesToTime(currentTime),
        endTime: minutesToTime(currentTime),
        place: `End of Day at ${destination}`,
        purpose: "Arrival",
        reason: "Arrive at destination city. Your one-way road trip is successfully completed.",
        travelTimeFromPrevious: "0m",
        isOpen: true,
        warning: null,
        lat: destinationCoords?.lat,
        lng: destinationCoords?.lng,
        placeId: destinationPlaceId,
        address: destinationAddress || destination
      });
    }
  }

  // -------------------------------------------------------------
  // GENERATE SCHEDULE: TWO-DAY ROUND TRIP
  // -------------------------------------------------------------
  else if (durationDays === 2) {
    // --- DAY 1 ---
    currentDay = 1;
    currentTime = timeToMinutes(startTime);

    // 1. Day 1 Departure
    timeline.push({
      day: 1,
      time: startTime,
      endTime: startTime,
      place: source.startsWith("Start from") ? source : `Start from ${source}`,
      purpose: "Departure",
      reason: "Begin Day 1 of your multi-agent road trip journey.",
      travelTimeFromPrevious: "0m",
      isOpen: true,
      warning: null,
      lat: sourceCoords?.lat,
      lng: sourceCoords?.lng,
      placeId: sourcePlaceId,
      address: sourceAddress || source
    });

    // 2. Outbound rest stop if transit >= 90 mins
    if (oneWayTransitMins >= 90) {
      const restStopName = destData.restStops?.[0]?.name || "Highway Nest Food Plaza";
      const restStopSpecs = getPlaceSpecs(restStopName);
      await travelToPlace(restStopName, "Rest & Coffee", "Stop for refreshments and clean amenities on the onward journey.", 30, restStopSpecs);
    }

    // 3. Arrive at destination
    await travelToPlace(`Arrive at ${destination}`, "Arrival", `Arrive safely at your destination city ${destination}.`, 0, {
      lat: destinationCoords?.lat,
      lng: destinationCoords?.lng,
      placeId: destinationPlaceId,
      address: destinationAddress || destination
    });

    // 4. Day 1 Lunch Break
    if (currentTime < timeToMinutes("02:30 PM")) {
      const preferredRestaurant = destData.restaurants?.[0]?.name || "Local Dine";
      const restaurantSpecs = getPlaceSpecs(preferredRestaurant);
      await travelToPlace(preferredRestaurant, "Lunch Break", `Enjoy regional dining at ${preferredRestaurant} in ${destination}.`, restaurantSpecs.duration || 45, restaurantSpecs);
    }

    // 5. Day 1 Sightseeing
    let day1AttractionsScheduled = 0;
    for (let i = 0; i < attractionPool.length; i++) {
      if (day1AttractionsScheduled >= maxPerDay) break;

      const att = attractionPool[i];
      const specs = getPlaceSpecs(att.name);
      const attCoords = { lat: specs.lat, lng: specs.lng };
      const transitToAtt = getTravelTimeWithCoords(currentLoc, att.name, source, destination, currentCoords, attCoords);
      const attArrival = currentTime + transitToAtt;

      // Ensure day 1 attractions fit before 08:30 PM (before dinner & overnight check-in)
      if (attArrival + (specs.duration || 60) > timeToMinutes("08:30 PM")) {
        continue; // Keep in attractionPool for Day 2!
      }

      const status = getPlaceTimeStatus(att.name, minutesToTime(attArrival));
      if (status === 'OPEN' || status === 'LIMITED') {
        await travelToPlace(att.name, "Sightseeing", att.description || "Top rated local sight.", specs.duration || 60, specs);
        day1AttractionsScheduled++;
        attractionPool.splice(i, 1);
        i--;
      }
    }

    // 6. Day 1 Dinner Break
    if (currentTime < timeToMinutes("09:30 PM")) {
      const preferredRestaurant = destData.restaurants?.[1]?.name || destData.restaurants?.[0]?.name || "Local Dine";
      const restaurantSpecs = getPlaceSpecs(preferredRestaurant);
      await travelToPlace(preferredRestaurant, "Dinner Break", `Dinner stop at ${preferredRestaurant}.`, 45, restaurantSpecs);
    }

    // 7. Day 1 Overnight Halt (Meaningful overnight stay, respects overnightHalt for Test D)
    const haltDisplayName = resolvedOvernightHalt.includes("Stay") || resolvedOvernightHalt.includes("Hotel") || resolvedOvernightHalt.includes("Resort")
      ? resolvedOvernightHalt
      : `${resolvedOvernightHalt} Overnight Stay`;
    await travelToPlace(haltDisplayName, "Overnight Stay", `Check into ${resolvedOvernightHalt} for overnight rest and recharge. Essential overnight halt before Day 2 journey.`, 600, haltSpecs);

    // --- DAY 2 ---
    currentDay = 2;
    currentTime = timeToMinutes("09:00 AM");
    currentLoc = haltDisplayName;
    currentCoords = haltCoords;

    // Day 2 Checkout
    timeline.push({
      day: 2,
      time: "09:00 AM",
      endTime: "09:00 AM",
      place: `Check out from ${resolvedOvernightHalt}`,
      purpose: "Hotel Checkout",
      reason: `Check out of ${resolvedOvernightHalt} and prepare for Day 2 exploration and return journey to ${source}.`,
      travelTimeFromPrevious: "0m",
      isOpen: true,
      warning: null,
      lat: haltCoords.lat,
      lng: haltCoords.lng,
      placeId: haltSpecs.placeId || `halt_${resolvedOvernightHalt.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      address: haltSpecs.address || `${resolvedOvernightHalt}, ${destination}`
    });

    // Day 2 Morning Sightseeing (subject to return departure window)
    const returnTransitEst = getTravelTimeWithCoords(currentLoc, source, source, destination, currentCoords, sourceCoords);
    const returnRestEst = returnTransitEst >= 90 ? 30 : 0;
    const safeDay2Cutoff = timeToMinutes("10:30 PM"); // Must return before 10:30 PM on Day 2

    let day2AttractionsScheduled = 0;
    for (let i = 0; i < attractionPool.length; i++) {
      if (day2AttractionsScheduled >= Math.max(1, maxPerDay - 1)) break;

      const att = attractionPool[i];
      const specs = getPlaceSpecs(att.name);
      const attCoords = { lat: specs.lat, lng: specs.lng };
      const transitToAtt = getTravelTimeWithCoords(currentLoc, att.name, source, destination, currentCoords, attCoords);
      const attArrival = currentTime + transitToAtt;
      const attEnd = attArrival + (specs.duration || 60);

      // Remaining return transit from this attraction to source
      const transitToSource = getTravelTimeWithCoords(att.name, source, source, destination, attCoords, sourceCoords);
      const expectedFinishTime = attEnd + 45 + returnRestEst + transitToSource; // 45m lunch + rest + drive

      if (expectedFinishTime > safeDay2Cutoff) {
        infeasible.push({
          place: att.name,
          reason: `${att.name} cannot fit on Day 2: required return journey to ${source} (${formatMinutes(transitToSource + returnRestEst)}) would exceed the Day 2 safe arrival cutoff.`
        });
        continue;
      }

      const status = getPlaceTimeStatus(att.name, minutesToTime(attArrival));
      if (status === 'OPEN' || status === 'LIMITED') {
        await travelToPlace(att.name, "Sightseeing", att.description || "Top rated local sight.", specs.duration || 60, specs);
        day2AttractionsScheduled++;
        attractionPool.splice(i, 1);
        i--;
      }
    }

    // Day 2 Lunch Break
    if (currentTime < timeToMinutes("02:30 PM")) {
      const preferredRestaurant = destData.restaurants?.[0]?.name || "Local Dine";
      const restaurantSpecs = getPlaceSpecs(preferredRestaurant);
      await travelToPlace(preferredRestaurant, "Lunch Break", `Lunch stop for local specialties before commencing return journey.`, 45, restaurantSpecs);
    }

    // Day 2 Return Journey
    if (isRoundTrip) {
      if (returnTransitEst >= 90) {
        const returnRestStop = "Highway Express Rest Stop (Return)";
        await travelToPlace(returnRestStop, "Rest & Coffee", "Essential highway break on the Day 2 return journey to maintain driver alertness.", 30, {
          lat: 12.5850,
          lng: 77.0410,
          address: `${source} - ${destination} Expressway`
        });
      }

      // Final Return Arrival at Source on Day 2!
      await travelToPlace(`Arrive at ${source}`, "Return Arrival", `Complete your 2-day road trip and safely arrive back at your original departure location (${source}).`, 0, {
        lat: sourceCoords?.lat,
        lng: sourceCoords?.lng,
        placeId: sourcePlaceId,
        address: sourceAddress || source
      });
    } else {
      await travelToPlace(`End of Journey at ${resolvedOvernightHalt}`, "Stay & Rest", "Check into your destination lodging. Your one-way road trip is successfully completed.", 0, haltSpecs);
    }
  }

  // -------------------------------------------------------------
  // MULTI-DAY (3+ DAYS) ITINERARY
  // -------------------------------------------------------------
  else {
    for (let day = 1; day <= durationDays; day++) {
      currentDay = day;
      const isFinalDay = (day === durationDays);

      if (day === 1) {
        currentTime = timeToMinutes(startTime);

        // Start from Source
        timeline.push({
          day: 1,
          time: startTime,
          endTime: startTime,
          place: source.startsWith("Start from") ? source : `Start from ${source}`,
          purpose: "Departure",
          reason: "Begin your multi-day road trip journey.",
          travelTimeFromPrevious: "0m",
          isOpen: true,
          warning: null,
          lat: sourceCoords?.lat,
          lng: sourceCoords?.lng,
          placeId: sourcePlaceId,
          address: sourceAddress || source
        });

        if (oneWayTransitMins >= 90) {
          const restStopName = destData.restStops?.[0]?.name || "Highway Nest Food Plaza";
          await travelToPlace(restStopName, "Rest & Coffee", "Highway rest stop for amenities.", 30, getPlaceSpecs(restStopName));
        }

        await travelToPlace(`Arrive at ${destination}`, "Arrival", `Arrive in ${destination}.`, 0, {
          lat: destinationCoords?.lat,
          lng: destinationCoords?.lng,
          placeId: destinationPlaceId,
          address: destinationAddress || destination
        });

        if (currentTime < timeToMinutes("02:30 PM")) {
          const preferredRestaurant = destData.restaurants?.[0]?.name || "Local Dine";
          await travelToPlace(preferredRestaurant, "Lunch Break", "Lunch break at a top spot.", 45, getPlaceSpecs(preferredRestaurant));
        }

        let scheduled = 0;
        for (let i = 0; i < attractionPool.length; i++) {
          if (scheduled >= maxPerDay) break;
          const att = attractionPool[i];
          const specs = getPlaceSpecs(att.name);
          const transit = getTravelTimeWithCoords(currentLoc, att.name, source, destination, currentCoords, { lat: specs.lat, lng: specs.lng });
          if (currentTime + transit + specs.duration > timeToMinutes("08:30 PM")) continue;
          if (getPlaceTimeStatus(att.name, minutesToTime(currentTime + transit)) === 'OPEN') {
            await travelToPlace(att.name, "Sightseeing", att.description || "Top sight.", specs.duration, specs);
            scheduled++;
            attractionPool.splice(i, 1);
            i--;
          }
        }

        if (currentTime < timeToMinutes("09:30 PM")) {
          const preferredRestaurant = destData.restaurants?.[1]?.name || destData.restaurants?.[0]?.name || "Local Dine";
          await travelToPlace(preferredRestaurant, "Dinner Break", "Evening dinner.", 45, getPlaceSpecs(preferredRestaurant));
        }

        await travelToPlace(resolvedOvernightHalt, "Overnight Stay", `Check-in for overnight stay at ${resolvedOvernightHalt}.`, 600, haltSpecs);
      } else {
        currentTime = timeToMinutes("09:00 AM");
        currentLoc = resolvedOvernightHalt;
        currentCoords = haltCoords;

        timeline.push({
          day,
          time: "09:00 AM",
          endTime: "09:00 AM",
          place: isFinalDay ? `Check out from ${resolvedOvernightHalt}` : `Depart from ${resolvedOvernightHalt}`,
          purpose: isFinalDay ? "Hotel Checkout" : "Hotel Departure",
          reason: isFinalDay ? `Check out of ${resolvedOvernightHalt} for return journey.` : `Depart from ${resolvedOvernightHalt} for Day ${day} exploration.`,
          travelTimeFromPrevious: "0m",
          isOpen: true,
          warning: null,
          lat: haltCoords.lat,
          lng: haltCoords.lng,
          placeId: haltSpecs.placeId || `halt_${resolvedOvernightHalt.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          address: haltSpecs.address || `${resolvedOvernightHalt}, ${destination}`
        });

        let scheduled = 0;
        for (let i = 0; i < attractionPool.length; i++) {
          if (scheduled >= maxPerDay) break;
          const att = attractionPool[i];
          const specs = getPlaceSpecs(att.name);
          const transit = getTravelTimeWithCoords(currentLoc, att.name, source, destination, currentCoords, { lat: specs.lat, lng: specs.lng });
          if (currentTime + transit + specs.duration > timeToMinutes("07:30 PM")) continue;
          if (getPlaceTimeStatus(att.name, minutesToTime(currentTime + transit)) === 'OPEN') {
            await travelToPlace(att.name, "Sightseeing", att.description || "Top sight.", specs.duration, specs);
            scheduled++;
            attractionPool.splice(i, 1);
            i--;
          }
        }

        if (currentTime < timeToMinutes("02:30 PM")) {
          const preferredRestaurant = destData.restaurants?.[0]?.name || "Local Dine";
          await travelToPlace(preferredRestaurant, "Lunch Break", "Lunch break.", 45, getPlaceSpecs(preferredRestaurant));
        }

        if (isFinalDay) {
          if (isRoundTrip) {
            const returnTransitEst = getTravelTimeWithCoords(currentLoc, source, source, destination, currentCoords, sourceCoords);
            if (returnTransitEst >= 90) {
              await travelToPlace("Highway Express Rest Stop (Return)", "Rest & Coffee", "Rest stop on return journey.", 30, { lat: 12.5850, lng: 77.0410, address: "Highway" });
            }
            await travelToPlace(`Arrive at ${source}`, "Return Arrival", `Complete road trip and safely arrive back at ${source}.`, 0, {
              lat: sourceCoords?.lat,
              lng: sourceCoords?.lng,
              placeId: sourcePlaceId,
              address: sourceAddress || source
            });
          } else {
            await travelToPlace(`End of Journey at ${resolvedOvernightHalt}`, "Stay & Rest", "Trip completed.", 0, haltSpecs);
          }
        } else {
          await travelToPlace(resolvedOvernightHalt, "Overnight Stay", `Return to ${resolvedOvernightHalt} for overnight rest.`, 600, haltSpecs);
        }
      }
    }
  }

  // Append leftover attractions that did not fit in the capacity
  for (const att of attractionPool) {
    let reasonMsg = "Could not fit into this plan: ";
    if (durationDays === 1) {
      reasonMsg += "schedule capacity limit reached or too far for a 1-day trip.";
    } else {
      reasonMsg += "schedule capacity limit reached for this trip style.";
    }
    infeasible.push({
      place: att.name,
      reason: reasonMsg
    });
  }

  // Run through recalculateSchedule to ensure 100% physically coherent timings and stable IDs
  const scheduledTimeline = recalculateSchedule(timeline, input);
  scheduledTimeline.isFeasible = true;
  scheduledTimeline.infeasible = infeasible;
  return scheduledTimeline;
}

// Auto-repair Timeline schedules
export function autoRepairTimeline(timeline, tripDetails) {
  const { source, destination, startTime = "09:00 AM" } = tripDetails;
  
  const initialValidation = validateTimeline(timeline, tripDetails);
  if (initialValidation.success) {
    return { success: true, timeline: initialValidation.timeline, autoApplied: false };
  }

  // Find the first index with timing warning (excluding fatigue warning)
  const badIndex = initialValidation.timeline.findIndex(item => 
    item.warning && (item.warning.includes("closed") || item.warning.includes("visit time") || item.warning.includes("cannot be visited"))
  );

  if (badIndex === -1) {
    return { success: false, timeline: initialValidation.timeline, autoApplied: false };
  }

  const options = [];

  // OPTION A: Shift earlier
  for (let newIdx = badIndex - 1; newIdx >= 1; newIdx--) {
    const newTimeline = [...timeline.map(item => ({ ...item }))];
    const [target] = newTimeline.splice(badIndex, 1);
    newTimeline.splice(newIdx, 0, target);
    
    const testVal = validateTimeline(newTimeline, tripDetails);
    if (testVal.success) {
      options.push({
        option: 'A',
        description: `Move ${target.place} earlier in the timeline (before ${newTimeline[newIdx + 1].place})`,
        timeline: testVal.timeline
      });
      break;
    }
  }

  // OPTION B: Swap with neighbors
  if (badIndex > 1) {
    const newTimeline = [...timeline.map(item => ({ ...item }))];
    
    // Swap elements
    const temp = newTimeline[badIndex];
    newTimeline[badIndex] = newTimeline[badIndex - 1];
    newTimeline[badIndex - 1] = temp;

    // Also swap their scheduled times!
    const tempTime = newTimeline[badIndex].time;
    newTimeline[badIndex].time = newTimeline[badIndex - 1].time;
    newTimeline[badIndex - 1].time = tempTime;

    const testVal = validateTimeline(newTimeline, tripDetails);
    if (testVal.success) {
      options.push({
        option: 'B',
        description: `Swap ${temp.place} with ${newTimeline[badIndex].place}`,
        timeline: testVal.timeline
      });
    }
  }
  if (badIndex < timeline.length - 1) {
    const newTimeline = [...timeline.map(item => ({ ...item }))];
    
    // Swap elements
    const temp = newTimeline[badIndex];
    newTimeline[badIndex] = newTimeline[badIndex + 1];
    newTimeline[badIndex + 1] = temp;

    // Also swap their scheduled times!
    const tempTime = newTimeline[badIndex].time;
    newTimeline[badIndex].time = newTimeline[badIndex + 1].time;
    newTimeline[badIndex + 1].time = tempTime;

    const testVal = validateTimeline(newTimeline, tripDetails);
    if (testVal.success) {
      options.push({
        option: 'B',
        description: `Swap ${temp.place} with ${newTimeline[badIndex].place}`,
        timeline: testVal.timeline
      });
    }
  }

  // OPTION C: Move to next day
  const currentDay = timeline[badIndex].day || 1;
  const maxDays = tripDetails.durationDays || 1;
  if (maxDays > 1 && currentDay < maxDays) {
    const newTimeline = [...timeline.map(item => ({ ...item }))];
    const target = newTimeline[badIndex];
    target.day = currentDay + 1;
    
    let insertIdx = newTimeline.findIndex(item => item.day === currentDay + 1);
    if (insertIdx !== -1) {
      if (newTimeline[insertIdx].purpose?.toLowerCase().includes("hotel") || newTimeline[insertIdx].purpose?.toLowerCase().includes("lodging")) {
        insertIdx += 1;
      }
      newTimeline.splice(badIndex, 1);
      const adjustedInsertIdx = insertIdx > badIndex ? insertIdx - 1 : insertIdx;
      newTimeline.splice(adjustedInsertIdx, 0, target);
    } else {
      newTimeline.splice(badIndex, 1);
      newTimeline.push(target);
    }

    const testVal = validateTimeline(newTimeline, tripDetails);
    if (testVal.success) {
      options.push({
        option: 'C',
        description: `Move ${target.place} to Day ${currentDay + 1}`,
        timeline: testVal.timeline
      });
    }
  }

  // Decision logic
  if (options.length === 1) {
    const opt = options[0];
    const updatedTimeline = opt.timeline.map(item => {
      if (item.place === timeline[badIndex].place) {
        return {
          ...item,
          autoFixed: true,
          autoFixMessage: `[Auto-Fixed] ${opt.description}`
        };
      }
      return item;
    });

    const finalVal = validateTimeline(updatedTimeline, tripDetails);
    return {
      success: true,
      timeline: finalVal.timeline,
      autoApplied: true,
      autoFixMessage: opt.description
    };
  } else if (options.length > 1) {
    return {
      success: false,
      timeline: initialValidation.timeline,
      autoApplied: false,
      suggestions: options.map(opt => ({
        option: opt.option,
        description: opt.description,
        timeline: opt.timeline
      }))
    };
  }

  return {
    success: false,
    timeline: initialValidation.timeline,
    autoApplied: false
  };
}

// Validate entire itinerary
export function validateItinerary(itinerary) {
  const { timeline, source, destination, startTime, tripDate, durationDays = 1 } = itinerary;
  
  if (isPastDate(tripDate)) {
    return { success: false, reason: "PAST_DATE", message: "Invalid date: Trip date cannot be in the past." };
  }
  
  if (startTime && isPastTimeToday(tripDate, startTime)) {
    return { success: false, reason: "PAST_TIME", message: "Invalid time: Start time cannot be earlier than the current time." };
  }

  const validation = validateTimeline(timeline, { 
    source, 
    destination, 
    startTime,
    sourceCoords: itinerary.sourceCoords,
    destinationCoords: itinerary.destinationCoords,
    sourcePlaceId: itinerary.sourcePlaceId,
    destinationPlaceId: itinerary.destinationPlaceId,
    sourceAddress: itinerary.sourceAddress,
    destinationAddress: itinerary.destinationAddress,
    durationDays
  });
  return {
    success: validation.success,
    timeline: validation.timeline,
    overallWarning: validation.overallWarning
  };
}

// Validate timeline sequence
export function validateTimeline(timeline, tripDetails) {
  const { 
    source, 
    destination, 
    startTime = "09:00 AM",
    sourceCoords,
    destinationCoords,
    sourcePlaceId,
    destinationPlaceId,
    sourceAddress,
    destinationAddress
  } = tripDetails;
  
  if (!timeline || timeline.length === 0) {
    return { success: true, timeline: [], overallWarning: null };
  }

  // Use the central scheduling engine to calculate physically accurate timeline
  const scheduled = recalculateSchedule(timeline, tripDetails);

  let overallWarning = null;
  const hardConflict = scheduled.find(v => v.warning?.includes("Hard constraint conflict"));
  const fatigueWarning = scheduled.find(v => v.warning?.includes("Driver fatigue advisory"));
  const closedWarning = scheduled.find(v => v.warning?.includes("closed"));
  const durationWarning = scheduled.find(v => v.warning?.includes("exceeds"));

  if (hardConflict) {
    overallWarning = hardConflict.warning;
  } else if (closedWarning) {
    overallWarning = closedWarning.warning;
  } else if (durationWarning) {
    overallWarning = durationWarning.warning;
  } else if (fatigueWarning) {
    overallWarning = fatigueWarning.warning;
  }

  const success = !hardConflict && !closedWarning;
  return {
    success,
    timeline: scheduled,
    overallWarning
  };
}

// Add calendar days to a YYYY-MM-DD date string
export function addDaysToDate(dateStr, days) {
  if (!dateStr || days === 0) return dateStr;
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// -------------------------------------------------------------
// CENTRAL ITINERARY SCHEDULING ENGINE
// -------------------------------------------------------------
export function recalculateSchedule(timeline, tripDetails = {}, options = {}) {
  if (!timeline || timeline.length === 0) {
    return [];
  }

  const safeTripDetails = (tripDetails && typeof tripDetails === 'object') ? tripDetails : {};
  const {
    source = "Bangalore",
    destination = "Mysore",
    startTime = "09:00 AM",
    tripDate = new Date().toLocaleDateString('en-CA'),
    durationDays = 1,
    sourceCoords = null,
    destinationCoords = null
  } = safeTripDetails;

  const safeSource = source || "Bangalore";
  const safeDestination = destination || "Mysore";
  const srcLower = safeSource.toLowerCase();
  const dstLower = safeDestination.toLowerCase();

  const rescheduled = [];
  let currentDay = 1;
  let currentMinutes = timeToMinutes(startTime);
  let previousPlace = safeSource;
  let prevCoords = sourceCoords || null;
  let timeSinceLastBreak = 0;

  for (let i = 0; i < timeline.length; i++) {
    const rawItem = timeline[i];
    const item = { ...rawItem };

    // 1. Assign Stable ID
    if (!item.id && !item._id) {
      item.id = `stop_${item.day || currentDay}_${i}_${Math.random().toString(36).substr(2, 6)}`;
    } else {
      item.id = item.id || (item._id ? item._id.toString() : `stop_${i}`);
    }

    // 2. Identify Stop Types
    const placeLower = (item.place || '').toLowerCase();
    const isDeparture = i === 0 || item.purpose === 'Departure' || placeLower.includes(`start from ${srcLower}`) || placeLower.includes(`depart from ${srcLower}`);
    const isReturn = item.purpose === 'Return Arrival' || item.isReturnArrival || placeLower.includes(`arrive at ${srcLower}`) || placeLower.includes(`return to ${srcLower}`);
    const isOvernight = item.purpose === 'Overnight Stay' || item.purpose === 'Resort Check-in' || item.isOvernight || placeLower.includes('overnight');

    // 3. Resolve Coordinates & Place Specs
    const specs = getPlaceSpecs(item.place) || {};
    let itemCoords = {
      lat: item.lat || specs.lat,
      lng: item.lng || specs.lng
    };

    if (isDeparture || isReturn) {
      itemCoords = sourceCoords || itemCoords;
    } else if (!itemCoords.lat && placeLower.includes(dstLower)) {
      itemCoords = destinationCoords || itemCoords;
    }

    item.lat = itemCoords.lat || item.lat;
    item.lng = itemCoords.lng || item.lng;
    item.placeId = item.placeId || specs.placeId || `mock_${(item.place || 'place').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    item.address = item.address || specs.address || `${item.place}, ${safeDestination}`;

    // 4. Multi-Day Rollover & Overnight Transitions
    if (i > 0) {
      const prevStop = rescheduled[i - 1];
      const prevWasOvernight = prevStop.isOvernight || prevStop.purpose === 'Overnight Stay' || prevStop.purpose === 'Resort Check-in';
      if (prevWasOvernight || (item.day && item.day > prevStop.day)) {
        currentDay = (prevStop.day || 1) + 1;
        // Day 2 (or next day) resumes at 08:30 AM from the overnight accommodation
        currentMinutes = timeToMinutes("08:30 AM");
        timeSinceLastBreak = 0;
        previousPlace = prevStop.place;
        prevCoords = { lat: prevStop.lat, lng: prevStop.lng };
      }
    }
    item.day = currentDay;
    item.date = addDaysToDate(tripDate, currentDay - 1);

    // 5. Travel Transit Time & Distance from Preceding Stop
    let transit = 0;
    let distanceKm = 0;
    if (i > 0) {
      transit = getTravelTimeWithCoords(previousPlace, item.place, source, destination, prevCoords, itemCoords);
      if (prevCoords && itemCoords && prevCoords.lat && itemCoords.lat) {
        distanceKm = Math.round(getHaversineDistance(prevCoords.lat, prevCoords.lng, itemCoords.lat, itemCoords.lng) * 1.3);
      } else {
        distanceKm = Math.round((transit / 60) * 65);
      }
      currentMinutes += transit;
      timeSinceLastBreak += transit;
    }

    item.travelTimeFromPrevious = formatMinutes(transit);
    item.distanceFromPrevious = distanceKm;
    const rawArrivalMinutes = currentMinutes;
    const arrivalTimeStr = minutesToTime(rawArrivalMinutes);

    // 6. Planned Visit / Service Duration
    let duration = 60;
    if (isDeparture || isReturn) {
      duration = 0;
    } else if (isOvernight) {
      duration = 600; // overnight rest interval
    } else if (item.duration !== undefined && item.duration !== null && !isNaN(Number(item.duration))) {
      duration = Number(item.duration);
    } else if (item.purpose === 'EV Charging' || item.place.toLowerCase().includes('charger') || item.place.toLowerCase().includes('ev fast')) {
      duration = 40; // EV fast charging service duration
    } else if (item.purpose === 'Refueling' || item.place.toLowerCase().includes('petrol') || item.place.toLowerCase().includes('fuel station')) {
      duration = 15; // Fuel service duration
    } else if (item.purpose === 'Rest Stop' || item.purpose === 'Rest & Coffee') {
      duration = 30;
    } else if (item.purpose === 'Meal Break' || item.purpose === 'Lunch Break' || item.purpose === 'Dinner Break') {
      duration = specs.duration || 60;
    } else if (specs.duration !== undefined) {
      duration = specs.duration;
    }
    item.duration = duration;

    // 7. Intelligent Time Conflict Resolution & Constraint Application
    let waitMinutes = 0;
    let activityStartMinutes = rawArrivalMinutes;

    if (item.isPinned && item.pinnedTime) {
      // User explicitly pinned this hard appointment / reservation
      item.time = item.pinnedTime;
      const pinnedMinutes = timeToMinutes(item.pinnedTime);
      if (rawArrivalMinutes > pinnedMinutes) {
        // Hard constraint cannot be satisfied!
        item.hasConflict = true;
        item.isPinnedConflict = true;
        item.estimatedArrival = arrivalTimeStr;
        item.warning = `Pinned reservation conflict: Cannot reach pinned reservation at ${item.pinnedTime}. Estimated arrival from ${previousPlace} is ${arrivalTimeStr}.`;
        activityStartMinutes = rawArrivalMinutes;
      } else {
        // Arrival is on or before pinned time: wait until pinned time
        waitMinutes = pinnedMinutes - rawArrivalMinutes;
        activityStartMinutes = pinnedMinutes;
        item.hasConflict = false;
        item.isPinnedConflict = false;
        item.warning = null;
      }
    } else {
      // Flexible activity: adjust schedule to arrival time & check opening hours
      item.time = arrivalTimeStr;
      item.hasConflict = false;
      item.isPinnedConflict = false;
      item.warning = null;
      const openTime = specs.open || specs.openTime;
      const closeTime = specs.close || specs.closeTime;

      if (openTime && openTime !== "24 hours" && openTime !== "24 Hours" && closeTime) {
        const openMins = timeToMinutes(openTime);
        const closeMins = timeToMinutes(closeTime);

        if (rawArrivalMinutes < openMins) {
          // Arrives before opening: user waits until venue opens
          waitMinutes = openMins - rawArrivalMinutes;
          activityStartMinutes = openMins;
          item.isOpen = true;
          item.autoFixed = true;
          item.autoFixMessage = `Adjusted: waiting ${waitMinutes}m for ${specs.open || openTime} opening`;
        } else if (rawArrivalMinutes >= closeMins) {
          // Arrives after venue is closed
          item.isOpen = false;
          item.warning = `${item.place} is closed at arrival time ${arrivalTimeStr}. (Operating hours: ${openTime} - ${closeTime}).`;
        } else {
          // Arrives during operating hours
          item.isOpen = true;
          if (rawArrivalMinutes + duration > closeMins) {
            const availableMins = closeMins - rawArrivalMinutes;
            item.warning = `${item.place} closes at ${closeTime}. Only ${availableMins} mins available (planned: ${duration} mins).`;
          }
        }
      } else {
        item.isOpen = true;
      }
    }

    // Set timestamps
    if (waitMinutes > 0) {
      item.waitTime = `${waitMinutes}m`;
      item.activityStartTime = minutesToTime(activityStartMinutes);
    } else {
      item.waitTime = null;
      item.activityStartTime = item.time;
    }

    // Departure time from this stop
    const departureMinutes = activityStartMinutes + duration;
    item.endTime = minutesToTime(departureMinutes);
    currentMinutes = departureMinutes;

    // 8. Driver Fatigue Tracking
    if (item.purpose === 'Rest Stop' || item.purpose === 'Rest & Coffee' || item.purpose === 'Lunch Break' || isOvernight) {
      timeSinceLastBreak = 0;
    }
    if (timeSinceLastBreak > 180 && !isDeparture && !isReturn && !item.warning) {
      item.warning = "Driver fatigue advisory: driving time exceeds 3 hours without rest. Consider adding a rest stop.";
    }

    item.isReturnArrival = isReturn;
    item.isOvernight = isOvernight;

    rescheduled.push(item);
    previousPlace = item.place;
    prevCoords = itemCoords;
  }

  // 9. Round-Trip Feasibility & Safe Cutoff Verification
  const lastStop = rescheduled[rescheduled.length - 1];
  if (lastStop && lastStop.isReturnArrival) {
    if (durationDays === 1 && lastStop.day > 1) {
      lastStop.warning = `Trip exceeds 1-day limit (returns on Day ${lastStop.day}). Consider extending duration or removing stops.`;
    } else if (durationDays === 1 && timeToMinutes(lastStop.time) > timeToMinutes("11:00 PM")) {
      lastStop.warning = `Late return at ${lastStop.time} (exceeds safe 11:00 PM cutoff). Consider starting earlier or reducing stop durations.`;
    } else if (durationDays === 2 && lastStop.day > 2) {
      lastStop.warning = `Trip exceeds 2-day limit (returns on Day ${lastStop.day}).`;
    } else if (durationDays === 2 && timeToMinutes(lastStop.time) > timeToMinutes("11:00 PM")) {
      lastStop.warning = `Late Day 2 return at ${lastStop.time} (exceeds safe 11:00 PM cutoff).`;
    }
  }

  return rescheduled;
}

// Chronologically reschedule timeline (alias to central engine)
export function rescheduleTimeline(timeline, tripDetails) {
  return recalculateSchedule(timeline, tripDetails);
}

// Insert stop at ANY position in itinerary
export function insertStopAtPosition(timeline, arg1, arg2, arg3) {
  if (!timeline || timeline.length === 0) return [];
  const list = [...timeline.map(item => ({ ...item }))];

  let newStop, insertIndex, tripDetails;
  if (typeof arg1 === 'number') {
    insertIndex = arg1;
    newStop = arg2 || {};
    tripDetails = arg3;
  } else {
    newStop = arg1 || {};
    insertIndex = arg2;
    tripDetails = arg3;
  }
  
  const specs = getPlaceSpecs(newStop.place) || {};
  let defaultDuration = 60;
  const purpose = newStop.purpose || (specs.type === 'restaurant' ? 'Meal Break' : (specs.type === 'restStop' ? 'Rest Stop' : (specs.type === 'lodging' ? 'Overnight Stay' : 'Sightseeing')));
  
  if (purpose === 'Meal Break' || purpose === 'Lunch Break' || purpose === 'Dinner Break') {
    defaultDuration = specs.duration || 60;
  } else if (purpose === 'Rest Stop' || purpose === 'Rest & Coffee') {
    defaultDuration = 30;
  } else if (purpose === 'EV Charging' || (newStop.place && newStop.place.toLowerCase().includes('charger'))) {
    defaultDuration = 40;
  } else if (purpose === 'Refueling' || (newStop.place && (newStop.place.toLowerCase().includes('petrol') || newStop.place.toLowerCase().includes('fuel')))) {
    defaultDuration = 15;
  } else if (purpose === 'Overnight Stay' || purpose === 'Resort Check-in') {
    defaultDuration = 600;
  } else if (specs.duration !== undefined) {
    defaultDuration = specs.duration;
  }

  const stopToAdd = {
    id: newStop.id || `stop_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    place: newStop.place,
    purpose: purpose,
    reason: newStop.reason || `Waypoint added by traveler.`,
    duration: newStop.duration !== undefined ? Number(newStop.duration) : defaultDuration,
    isPinned: Boolean(newStop.isPinned),
    pinnedTime: newStop.pinnedTime || null,
    isOvernight: purpose === 'Overnight Stay' || purpose === 'Resort Check-in',
    isReturnArrival: false,
    lat: newStop.lat || specs.lat,
    lng: newStop.lng || specs.lng,
    placeId: newStop.placeId || specs.placeId,
    address: newStop.address || specs.address,
    day: newStop.day || 1
  };

  // Determine index boundary
  let targetIndex = insertIndex;
  const returnIdx = list.findIndex(item => item.purpose === 'Return Arrival' || item.isReturnArrival);
  
  if (targetIndex === undefined || targetIndex === null || isNaN(targetIndex) || targetIndex <= 0) {
    targetIndex = returnIdx > 0 ? returnIdx : list.length;
  } else if (returnIdx !== -1 && targetIndex > returnIdx) {
    targetIndex = returnIdx;
  }

  // Determine day context from predecessors
  if (targetIndex > 0 && targetIndex < list.length) {
    const prevItem = list[targetIndex - 1];
    const prevIsOvernight = prevItem.isOvernight || prevItem.purpose === 'Overnight Stay' || prevItem.purpose === 'Resort Check-in';
    if (prevIsOvernight) {
      stopToAdd.day = (prevItem.day || 1) + 1;
    } else {
      stopToAdd.day = prevItem.day || 1;
    }
  }

  list.splice(targetIndex, 0, stopToAdd);
  const safeDetails = (tripDetails && typeof tripDetails === 'object') ? tripDetails : {};
  if (!safeDetails.source && list[0]?.place) safeDetails.source = list[0].place;
  return recalculateSchedule(list, safeDetails);
}

// Remove stop from itinerary
export function removeStopAtPosition(timeline, arg1, arg2, arg3) {
  if (!timeline || timeline.length === 0) return [];
  const list = [...timeline.map(item => ({ ...item }))];

  let stopIdOrIndex = arg1;
  let tripDetails = arg2;
  if (typeof arg2 === 'string' && typeof arg3 === 'object') {
    tripDetails = arg3;
  } else if (typeof arg2 === 'string') {
    tripDetails = {};
  }
  tripDetails = (tripDetails && typeof tripDetails === 'object') ? tripDetails : {};
  if (!tripDetails.source && list[0]?.place) tripDetails.source = list[0].place;

  let targetIndex = -1;
  if (typeof stopIdOrIndex === 'number') {
    targetIndex = stopIdOrIndex;
  } else {
    targetIndex = list.findIndex(item => item.id === stopIdOrIndex || item._id?.toString() === stopIdOrIndex || (item.place || '').toLowerCase() === (stopIdOrIndex || '').toLowerCase());
  }

  // Prevent removing Departure (index 0) or Return Arrival (the last stop)
  if (targetIndex <= 0 || targetIndex >= list.length - 1) {
    return recalculateSchedule(list, tripDetails);
  }

  list.splice(targetIndex, 1);
  return recalculateSchedule(list, tripDetails);
}

// Reorder stops in itinerary
export function reorderStops(timeline, fromIndex, toIndex, tripDetails = {}) {
  if (!timeline || timeline.length === 0) return [];
  const list = [...timeline.map(item => ({ ...item }))];

  tripDetails = (tripDetails && typeof tripDetails === 'object') ? tripDetails : {};
  if (!tripDetails.source && list[0]?.place) tripDetails.source = list[0].place;

  const maxIdx = list.length - 2;
  const validFrom = Math.max(1, Math.min(fromIndex, maxIdx));
  const validTo = Math.max(1, Math.min(toIndex, maxIdx));

  if (validFrom === validTo) {
    return recalculateSchedule(list, tripDetails);
  }

  const [movedItem] = list.splice(validFrom, 1);
  list.splice(validTo, 0, movedItem);

  return recalculateSchedule(list, tripDetails);
}

// Update stop duration in itinerary
export function updateStopDuration(timeline, arg1, arg2, arg3, arg4) {
  if (!timeline || timeline.length === 0) return [];
  const list = [...timeline.map(item => ({ ...item }))];

  let stopIdOrIndex, newDuration, tripDetails;
  if (typeof arg3 === 'number') {
    stopIdOrIndex = arg1 !== undefined ? arg1 : arg2;
    newDuration = arg3;
    tripDetails = arg4;
  } else {
    stopIdOrIndex = arg1;
    newDuration = arg2;
    tripDetails = arg3;
  }

  tripDetails = (tripDetails && typeof tripDetails === 'object') ? tripDetails : {};
  if (!tripDetails.source && list[0]?.place) tripDetails.source = list[0].place;

  let targetIndex = -1;
  if (typeof stopIdOrIndex === 'number') {
    targetIndex = stopIdOrIndex;
  } else {
    targetIndex = list.findIndex(item => item.id === stopIdOrIndex || item._id?.toString() === stopIdOrIndex || (item.place || '').toLowerCase() === (stopIdOrIndex || '').toLowerCase());
  }

  if (targetIndex >= 0 && targetIndex < list.length) {
    list[targetIndex].duration = Math.max(0, Number(newDuration) || 0);
  }

  return recalculateSchedule(list, tripDetails);
}

// Update stop pinned reservation time
export function updateStopPinnedTime(timeline, arg1, arg2, arg3, arg4, arg5) {
  if (!timeline || timeline.length === 0) return [];
  const list = [...timeline.map(item => ({ ...item }))];

  let stopIdOrIndex, isPinned, pinnedTime, tripDetails;
  if (typeof arg2 === 'string' && typeof arg3 === 'boolean') {
    stopIdOrIndex = arg1 !== undefined ? arg1 : arg2;
    isPinned = arg3;
    pinnedTime = arg4;
    tripDetails = arg5;
  } else {
    stopIdOrIndex = arg1;
    isPinned = arg2;
    pinnedTime = arg3;
    tripDetails = arg4;
  }

  tripDetails = (tripDetails && typeof tripDetails === 'object') ? tripDetails : {};
  if (!tripDetails.source && list[0]?.place) tripDetails.source = list[0].place;

  let targetIndex = -1;
  if (typeof stopIdOrIndex === 'number') {
    targetIndex = stopIdOrIndex;
  } else {
    targetIndex = list.findIndex(item => item.id === stopIdOrIndex || item._id?.toString() === stopIdOrIndex || (item.place || '').toLowerCase() === (stopIdOrIndex || '').toLowerCase());
  }

  if (targetIndex >= 0 && targetIndex < list.length) {
    list[targetIndex].isPinned = Boolean(isPinned);
    if (isPinned && pinnedTime) {
      list[targetIndex].pinnedTime = pinnedTime;
    } else if (!isPinned) {
      list[targetIndex].pinnedTime = null;
    }
  }

  return recalculateSchedule(list, tripDetails);
}

// Calculate comprehensive round-trip metrics
export function calculateRoundTripMetrics(timeline, source, destination, sourceCoords, destinationCoords) {
  if (!timeline || timeline.length === 0) {
    return {
      totalDistanceKm: 0,
      totalDrivingMins: 0,
      totalDrivingTime: "0h 0m",
      totalTripMins: 0,
      totalTripTime: "0h",
      expectedReturnTime: "N/A",
      returnDay: 1,
      overnightHalt: null,
      outboundDrivingMins: 0,
      returnDrivingMins: 0,
      activityMins: 0,
      restMins: 0
    };
  }

  let totalDrivingMins = 0;
  let outboundDrivingMins = 0;
  let returnDrivingMins = 0;
  let activityMins = 0;
  let restMins = 0;
  let overnightHalt = null;

  let reachedDestination = false;
  let startedReturn = false;

  const dstLower = (destination || "").toLowerCase().trim();
  const srcLower = (source || "").toLowerCase().trim();

  let sumDistanceFromPrevious = 0;
  let sumOutboundDist = 0;
  let sumReturnDist = 0;

  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const placeLower = (item.place || "").toLowerCase();

    // Check if this item reached the destination area
    if (i > 0 && !startedReturn && dstLower && (placeLower.includes(dstLower) || item.purpose === "Arrival" || placeLower.includes(`arrive at ${dstLower}`) || placeLower.includes(`arrive in ${dstLower}`))) {
      reachedDestination = true;
    }

    if (item.place?.includes("Return") || item.purpose === "Return Arrival" || (reachedDestination && srcLower && placeLower.includes(srcLower))) {
      startedReturn = true;
    }
    
    if (item.travelTimeFromPrevious && item.travelTimeFromPrevious !== "0m") {
      const matchH = item.travelTimeFromPrevious.match(/(\d+)h/);
      const matchM = item.travelTimeFromPrevious.match(/(\d+)m/);
      const h = matchH ? parseInt(matchH[1], 10) : 0;
      const m = matchM ? parseInt(matchM[1], 10) : 0;
      const mins = h * 60 + m;
      totalDrivingMins += mins;

      if (!reachedDestination) {
        outboundDrivingMins += mins;
      } else if (startedReturn || item.purpose === "Return Arrival" || (srcLower && placeLower.includes(srcLower))) {
        returnDrivingMins += mins;
      }
    }

    const dist = (typeof item.distanceFromPrevious === 'number' && item.distanceFromPrevious > 0) ? item.distanceFromPrevious : 0;
    if (dist > 0) {
      sumDistanceFromPrevious += dist;
      if (!reachedDestination) {
        sumOutboundDist += dist;
      } else if (startedReturn || item.purpose === "Return Arrival" || (srcLower && placeLower.includes(srcLower))) {
        sumReturnDist += dist;
      }
    }

    if (item.purpose === "Overnight Stay" || item.purpose === "Resort Check-in") {
      overnightHalt = item.place.replace("Overnight Stay at ", "").replace("Check-in at ", "");
      restMins += 600;
    } else if (item.purpose === "Sightseeing" || item.purpose === "Lunch Break" || item.purpose === "Dinner Break" || item.purpose === "Rest & Coffee") {
      const specs = getPlaceSpecs(item.place);
      activityMins += (specs.duration || 45);
    }
  }

  const firstItem = timeline[0];
  const lastItem = timeline[timeline.length - 1];
  const returnDay = lastItem.day || 1;
  const startMins = timeToMinutes(firstItem.time);
  const endMins = timeToMinutes(lastItem.endTime || lastItem.time);
  const totalTripMins = (returnDay - 1) * 1440 + (endMins - startMins);

  const estOneWay = (source && destination) ? getRouteEstimatedDistanceKm(source, destination, sourceCoords, destinationCoords) : 140;
  const speedBasedKm = Math.round((totalDrivingMins / 60) * 72.5);

  let totalDistanceKm = sumDistanceFromPrevious > 0 ? sumDistanceFromPrevious : speedBasedKm;
  if (reachedDestination && startedReturn && totalDistanceKm < estOneWay * 2) {
    totalDistanceKm = Math.max(totalDistanceKm, estOneWay * 2);
  }

  let outwardDistanceKm = sumOutboundDist > 0 ? sumOutboundDist : Math.round((outboundDrivingMins / 60) * 72.5);
  let returnDistanceKm = sumReturnDist > 0 ? sumReturnDist : Math.round((returnDrivingMins / 60) * 72.5);
  if (reachedDestination && outwardDistanceKm < estOneWay) outwardDistanceKm = Math.max(outwardDistanceKm, estOneWay);
  if (startedReturn && returnDistanceKm < estOneWay) returnDistanceKm = Math.max(returnDistanceKm, estOneWay);

  return {
    totalDistanceKm,
    totalDrivingMins,
    totalDrivingTime: formatMinutes(totalDrivingMins),
    totalTripMins,
    totalTripTime: formatMinutes(totalTripMins),
    expectedReturnTime: lastItem.time,
    finalReturnArrival: lastItem.time,
    returnDay,
    finalReturnDay: returnDay,
    overnightHalt,
    outboundDrivingMins,
    returnDrivingMins,
    outwardDistanceKm,
    returnDistanceKm,
    activityMins,
    restMins,
    isFeasible: totalDrivingMins <= (returnDay * 600)
  };
}

// Validate complete round-trip itinerary against all core constraints
export function validateRoundTripItinerary(timeline, tripDetails) {
  const { source, destination, durationDays = 1 } = tripDetails;
  const issues = [];

  if (!timeline || timeline.length === 0) {
    return { isValid: false, issues: ["Itinerary has no waypoints."] };
  }

  const first = timeline[0];
  const last = timeline[timeline.length - 1];

  // 1. Starts at departure location
  const firstPlace = (first.place || "").toLowerCase();
  const srcLower = (source || "").toLowerCase();
  if (!firstPlace.includes(srcLower)) {
    issues.push(`Itinerary does not start at the original departure location (${source}).`);
  }

  // 2. Returns to exact departure location
  const lastPlace = (last.place || "").toLowerCase();
  if (!lastPlace.includes(srcLower) && last.purpose !== "Return Arrival") {
    issues.push(`Itinerary does not return to the original departure location (${source}). Final stop is ${last.place}.`);
  }

  // 3. Day 1 duration check
  if (durationDays === 1) {
    if (last.day && last.day > 1) {
      issues.push(`1-Day trip exceeds Day 1 (returns on Day ${last.day}).`);
    }
    const returnMins = timeToMinutes(last.time);
    if (returnMins > timeToMinutes("11:00 PM")) {
      issues.push(`Return arrival time (${last.time}) exceeds safe Day 1 operating cutoff (11:00 PM).`);
    }
  }

  // 4. Day 2 duration and overnight halt check
  if (durationDays === 2) {
    const hasOvernightHalt = timeline.some(t => 
      t.day === 1 && (t.purpose === "Overnight Stay" || t.purpose === "Resort Check-in" || t.place.toLowerCase().includes("overnight") || t.place.toLowerCase().includes("hotel"))
    );
    if (!hasOvernightHalt) {
      issues.push("2-Day trip does not include an explicit overnight halt on Day 1.");
    }
    if (last.day !== 2) {
      issues.push(`2-Day trip must return on Day 2, but returns on Day ${last.day}.`);
    }
    const returnMins = timeToMinutes(last.time);
    if (returnMins > timeToMinutes("11:00 PM")) {
      issues.push(`Day 2 return arrival time (${last.time}) exceeds safe operating cutoff (11:00 PM).`);
    }
  }

  // 5. Check consecutive driving intervals without break (fatigue)
  let continuousDriving = 0;
  for (let i = 1; i < timeline.length; i++) {
    const item = timeline[i];
    const prevItem = timeline[i - 1];

    // Reset fatigue on day change (overnight rest)
    if (item.day && prevItem && prevItem.day && item.day !== prevItem.day) {
      continuousDriving = 0;
    }

    if (item.travelTimeFromPrevious) {
      const matchH = item.travelTimeFromPrevious.match(/(\d+)h/);
      const matchM = item.travelTimeFromPrevious.match(/(\d+)m/);
      const transit = (matchH ? parseInt(matchH[1], 10) * 60 : 0) + (matchM ? parseInt(matchM[1], 10) : 0);
      continuousDriving += transit;
    }

    const purposeLower = (item.purpose || "").toLowerCase();
    const isBreak = 
      purposeLower.includes("rest") || 
      purposeLower.includes("break") || 
      purposeLower.includes("lunch") || 
      purposeLower.includes("dinner") || 
      purposeLower.includes("meal") || 
      purposeLower.includes("overnight") || 
      purposeLower.includes("stay") || 
      purposeLower.includes("charge") || 
      purposeLower.includes("refuel") || 
      purposeLower.includes("sightseeing") || 
      (item.duration && item.duration >= 20);

    if (isBreak) {
      continuousDriving = 0;
    }

    if (continuousDriving > 240) {
      issues.push(`Continuous driving time exceeds 4 hours without a rest break before ${item.place}.`);
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    valid: issues.length === 0,
    issues,
    errors: issues
  };
}
