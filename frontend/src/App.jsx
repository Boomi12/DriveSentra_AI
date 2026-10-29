import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Calendar, Activity, BrainCircuit, Shield, Menu, X, LayoutDashboard, Sliders, LogOut, Gauge, Navigation, Eye, ShieldAlert, History } from 'lucide-react';

import JourneyCompanion from './pages/JourneyCompanion';
import TripPlanner from './pages/TripPlanner';
import Itinerary from './pages/Itinerary';
import DigitalTwin from './pages/DigitalTwin';
import AgentPanel from './pages/AgentPanel';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VehicleSetup from './pages/VehicleSetup';
import Dashboard from './pages/Dashboard';
import VehicleIntelligence from './pages/VehicleIntelligence';
import DriverMonitoring from './pages/DriverMonitoring';
import EmergencyAlerts from './pages/EmergencyAlerts';
import DriverLogs from './pages/DriverLogs';

// Import Protected Route Guard
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

import './App.css';

// Dashboard layout component that wraps routes
const DashboardLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTripId, setActiveTripId] = useState(() => localStorage.getItem('gd_tripId'));
  const [user, setUser] = useState(() => {
    try {
      const loggedUser = localStorage.getItem('gd_user');
      return loggedUser ? JSON.parse(loggedUser) : null;
    } catch {
      return null;
    }
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  const isEditingNameRef = useRef(isEditingName);
  useEffect(() => {
    isEditingNameRef.current = isEditingName;
  }, [isEditingName]);

<<<<<<< HEAD
  // Poll localStorage occasionally to show active trip status and auth state in the navbar/sidebar
  const checkState = () => {
    const tripId = localStorage.getItem('gd_tripId');
    setActiveTripId(tripId);

    if (!isEditingNameRef.current) {
      const loggedUser = localStorage.getItem('gd_user');
      if (loggedUser) {
        setUser(JSON.parse(loggedUser));
      } else {
        setUser(null);
      }
    }
  };

  const startEditing = () => {
    if (user) {
      setNewName(user.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim() === user.name) {
      setIsEditingName(false);
      return;
    }

    try {
      const token = localStorage.getItem('gd_token');
      const response = await fetch('http://127.0.0.1:5000/api/auth/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName.trim() })
      });

      const data = await response.json();
      if (data.success) {
        const updatedUser = { ...user, name: data.user.name };
        localStorage.setItem('gd_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        window.dispatchEvent(new Event('auth-change'));
      } else {
        console.error('Failed to update username:', data.error);
        alert(data.error || 'Failed to update username');
      }
    } catch (error) {
      console.error('Error updating username:', error);
      alert('Error updating username. Please try again.');
    } finally {
      setIsEditingName(false);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  useEffect(() => {
    window.addEventListener('storage', checkState);
    window.addEventListener('twin-updated', checkState);
    window.addEventListener('auth-change', checkState);
    
    // Custom interval to keep active trip ID in sync
    const interval = setInterval(checkState, 2000);
    
=======
    checkTrip();
    window.addEventListener('storage', checkTrip);
    window.addEventListener('twin-updated', checkTrip);

    // Custom interval to keep active trip ID in sync
    const interval = setInterval(checkTrip, 2000);

>>>>>>> origin/shwetha-work
    return () => {
      window.removeEventListener('storage', checkState);
      window.removeEventListener('twin-updated', checkState);
      window.removeEventListener('auth-change', checkState);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('gd_token');
    localStorage.removeItem('gd_user');
    localStorage.removeItem('gd_vehicle');
    localStorage.removeItem('gd_tripId');
    localStorage.removeItem('gd_timeline');
    localStorage.removeItem('gd_recommendations');
    
    // Dispatch auth state change locally
    window.dispatchEvent(new Event('auth-change'));
    
    // Redirect to login
    navigate('/login');
  };

  const isPublicPage = location.pathname === '/login' || location.pathname === '/signup';

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100 font-sans antialiased">
        {children}
      </div>
    );
  }

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Vehicle Setup', path: '/vehicle-setup', icon: Sliders },
    { name: 'Journey Companion', path: '/journey', icon: Compass },
    { name: 'Trip Planner', path: '/trip-planner', icon: Navigation },
    { name: 'Itinerary Planner', path: '/itinerary', icon: Calendar },
    { name: 'Digital Twin Studio', path: '/digital-twin', icon: Activity },
    { name: 'AI Agent Panel', path: '/agents', icon: BrainCircuit },
    { name: 'Vehicle Intelligence', path: '/vehicle-intelligence', icon: Gauge },
    { name: 'Driver Monitoring', path: '/driver-monitoring', icon: Eye },
    { name: 'Emergency Alerts', path: '/emergency-alerts', icon: ShieldAlert },
    { name: 'Driver Logs', path: '/driver-logs', icon: History }
  ];

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 font-sans antialiased">
      {/* Mobile Top Navbar */}
      <header className="lg:hidden h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-purple-500 fill-purple-500/20" />
          <span className="font-extrabold text-white text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
            DRIVESENTRA AI
          </span>
        </div>
        <button
          onClick={toggleMobileMenu}
          className="text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      <div className="flex-1 flex relative">
        {/* Left Sidebar (Desktop only) */}
        <aside className="hidden lg:flex w-72 bg-slate-900/60 border-r border-slate-800/80 flex-col justify-between sticky top-0 h-screen p-6 z-30 backdrop-blur-md">
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-white text-base tracking-widest leading-none">
                  DRIVESENTRA
                </span>
                <span className="text-[10px] text-purple-400 font-bold tracking-widest mt-0.5">
                  MOBILITY COMPANION
                </span>
              </div>
            </div>



            {/* Navigation links */}
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
<<<<<<< HEAD
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                      isActive
                        ? 'bg-purple-600/10 text-purple-300 border border-purple-500/30 shadow-md shadow-purple-500/5'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <Icon className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-white'
                    }`} />
=======
                    className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group ${isActive
                      ? 'bg-purple-600/10 text-purple-300 border border-purple-500/30 shadow-md shadow-purple-500/5'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                      }`}
                  >
                    <Icon className={`h-4.5 w-4.5 transition-colors ${isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-white'
                      }`} />
>>>>>>> origin/shwetha-work
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Active Trip Info and Credits */}
          <div className="space-y-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-red-400" />
              Sign Out
            </button>

            {user && (
              <div 
                onClick={!isEditingName ? startEditing : undefined}
                className={`px-3.5 py-2.5 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center gap-3 ${!isEditingName ? 'cursor-pointer hover:bg-slate-900/30 hover:border-slate-700/60 transition-all' : ''}`}
              >
                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0 select-none">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  {isEditingName ? (
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleSaveName}
                      className="w-full bg-slate-900/80 border border-purple-500/30 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex items-center justify-between group/name">
                      <h4 className="text-xs font-bold text-slate-200 truncate">{user.name}</h4>
                      <span className="text-[9px] text-slate-500 opacity-0 group-hover/name:opacity-100 transition-opacity ml-1 select-none">Edit</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 truncate mt-0.5 select-none">{user.email}</p>
                </div>
              </div>
            )}

            <div className="text-[10px] text-slate-500 text-center font-medium">
              DriveSentra AI © 2026
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-30 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm"
              onClick={toggleMobileMenu}
            ></div>

            {/* Menu */}
            <nav className="relative w-64 max-w-xs bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-6 z-45 animate-fade-in h-full">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <span className="font-extrabold text-white text-sm tracking-wider">NAVIGATION</span>
                  <button
                    onClick={toggleMobileMenu}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {user && (
                  <div 
                    onClick={!isEditingName ? startEditing : undefined}
                    className={`px-3.5 py-2.5 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center gap-3 ${!isEditingName ? 'cursor-pointer hover:bg-slate-900/30 hover:border-slate-700/60 transition-all' : ''}`}
                  >
                    <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0 select-none">
                      {user.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditingName ? (
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                          onBlur={handleSaveName}
                          className="w-full bg-slate-900/80 border border-purple-500/30 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex items-center justify-between group/name">
                          <h4 className="text-xs font-bold text-slate-200 truncate">{user.name}</h4>
                          <span className="text-[9px] text-slate-500 opacity-0 group-hover/name:opacity-100 transition-opacity ml-1 select-none">Edit</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-500 truncate mt-0.5 select-none">{user.email}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={toggleMobileMenu}
<<<<<<< HEAD
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-purple-600/10 text-purple-300 border border-purple-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
=======
                        className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${isActive
                          ? 'bg-purple-600/10 text-purple-300 border border-purple-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                          }`}
>>>>>>> origin/shwetha-work
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    );
                  })}

                  <button
                    onClick={() => {
                      toggleMobileMenu();
                      handleLogout();
                    }}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>

              {activeTripId && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">ACTIVE MONITORING</span>
                  <span className="text-xs text-emerald-400 font-mono font-semibold">{activeTripId}</span>
                </div>
              )}
            </nav>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col bg-slate-950/40 relative">
          <div className="p-6 md:p-8 lg:p-10 flex-1 overflow-y-auto w-full max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <DashboardLayout>
        <Routes>
          {/* Public Authentication routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/vehicle-setup" element={<ProtectedRoute><VehicleSetup /></ProtectedRoute>} />
          <Route path="/journey" element={<ProtectedRoute><ErrorBoundary><JourneyCompanion /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/trip-planner" element={<ProtectedRoute><TripPlanner /></ProtectedRoute>} />
          <Route path="/itinerary" element={<ProtectedRoute><Itinerary /></ProtectedRoute>} />
          <Route path="/digital-twin" element={<ProtectedRoute><DigitalTwin /></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute><AgentPanel /></ProtectedRoute>} />
          <Route path="/vehicle-intelligence" element={<ProtectedRoute><VehicleIntelligence /></ProtectedRoute>} />
          <Route path="/driver-monitoring" element={<ProtectedRoute><DriverMonitoring /></ProtectedRoute>} />
          <Route path="/emergency-alerts" element={<ProtectedRoute><EmergencyAlerts /></ProtectedRoute>} />
          <Route path="/driver-logs" element={<ProtectedRoute><DriverLogs /></ProtectedRoute>} />

          {/* Root Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    </BrowserRouter>
  );
};

export default App;
