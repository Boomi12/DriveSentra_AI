import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Calendar, Activity, BrainCircuit, Shield, Menu, X, LayoutDashboard, Sliders, LogOut, Gauge, Eye, ShieldAlert, History, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

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
import Simulator from './pages/Simulator';

// Import Protected Route Guard
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

import './App.css';

// Dashboard layout component that wraps routes
const DashboardLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isTabletCollapsed, setIsTabletCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024;
  });
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

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    const timer = setTimeout(() => {
      setMobileMenuOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [location.pathname]);

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
    { name: 'Itinerary Planner', path: '/itinerary', icon: Calendar },
    { name: 'Digital Twin Studio', path: '/digital-twin', icon: Activity },
    { name: 'AI Agent Panel', path: '/agents', icon: BrainCircuit },
    { name: 'Vehicle Intelligence', path: '/vehicle-intelligence', icon: Gauge },
    { name: 'Driver Monitoring', path: '/driver-monitoring', icon: Eye },
    { name: 'Emergency Alerts', path: '/emergency-alerts', icon: ShieldAlert },
    { name: 'Driver Logs', path: '/driver-logs', icon: History },
    { name: 'Scenario Simulator', path: '/simulator', icon: SlidersHorizontal }
  ];

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 font-sans antialiased">
      {/* Mobile Top Navbar */}
      <header className="md:hidden h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-md shadow-purple-500/20">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-white text-base tracking-wider leading-none bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
              DRIVESENTRA AI
            </span>
            <span className="text-[9px] text-purple-400 font-bold tracking-widest mt-0.5">
              MOBILITY COMPANION
            </span>
          </div>
        </div>
        <button
          onClick={toggleMobileMenu}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-800/60"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      <div className="flex-1 flex relative min-h-0">
        {/* Left Sidebar (Tablet icon-rail or Desktop full sidebar) */}
        <aside 
          className={`hidden md:flex flex-col justify-between sticky top-0 h-screen border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md z-30 transition-all duration-300 ease-in-out thin-scrollbar ${
            isTabletCollapsed ? 'w-20 p-2.5' : 'w-64 p-3.5 lg:p-4'
          }`}
          aria-label="Sidebar navigation"
        >
          <div className="space-y-3 overflow-y-auto overflow-x-hidden pr-0.5 thin-scrollbar">
            {/* Header / Logo + Collapse Toggle */}
            <div className={`flex items-center ${isTabletCollapsed ? 'justify-center flex-col gap-2' : 'justify-between px-1'}`}>
              <Link to="/dashboard" className="flex items-center gap-2 group">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0 group-hover:scale-105 transition-transform">
                  <Shield className="h-4.5 w-4.5 text-white" />
                </div>
                {!isTabletCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="font-black text-white text-sm tracking-widest leading-none truncate">
                      DRIVESENTRA
                    </span>
                    <span className="text-[9px] text-purple-400 font-bold tracking-widest mt-0.5 truncate">
                      MOBILITY COMPANION
                    </span>
                  </div>
                )}
              </Link>
              
              <button
                onClick={() => setIsTabletCollapsed(!isTabletCollapsed)}
                aria-label={isTabletCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="h-7 w-7 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title={isTabletCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isTabletCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Navigation links */}
            <nav className="space-y-0.5" aria-label="Main menu">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={isTabletCollapsed ? item.name : undefined}
                    className={`flex items-center rounded-lg text-xs font-semibold transition-all group ${
                      isTabletCollapsed 
                        ? 'justify-center p-2 min-h-[38px]' 
                        : 'gap-2.5 px-2.5 py-1.5 min-h-[34px]'
                    } ${
                      isActive
                        ? 'bg-purple-600/10 text-purple-300 border border-purple-500/30 shadow-md shadow-purple-500/5'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-white'
                    }`} />
                    {!isTabletCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User profile, Active Trip Info and Sign Out (Ultra-compact) */}
          <div className="space-y-1 pt-1.5 border-t border-slate-800/80">
            {activeTripId && (
              <div className={`bg-slate-950/70 border border-purple-500/20 rounded-md ${
                isTabletCollapsed ? 'p-1 text-center' : 'px-2 py-0.5 flex items-center justify-between'
              }`}>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-[8px] text-purple-300 font-bold uppercase tracking-wider truncate">
                    {isTabletCollapsed ? 'TRIP' : 'ACTIVE TRIP'}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-medium truncate ml-1">
                  {isTabletCollapsed ? `#${activeTripId.slice(0, 4)}` : activeTripId}
                </span>
              </div>
            )}

            {user && (
              <div 
                onClick={!isEditingName ? startEditing : undefined}
                className={`bg-slate-950/40 border border-slate-800/80 rounded-md flex items-center ${
                  isTabletCollapsed ? 'p-1 justify-center' : 'px-2 py-1 gap-2'
                } ${!isEditingName ? 'cursor-pointer hover:bg-slate-900/50 hover:border-slate-700/60 transition-all' : ''}`}
                title={isTabletCollapsed ? `${user.name} (${user.email})` : undefined}
              >
                <div className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center font-bold text-slate-300 text-[10px] shrink-0 select-none">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                {!isTabletCollapsed && (
                  <div className="min-w-0 flex-1 leading-none">
                    {isEditingName ? (
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleSaveName}
                        className="w-full bg-slate-900 border border-purple-500/40 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-purple-500 font-medium"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center justify-between group/name">
                        <h4 className="text-[11px] font-semibold text-slate-200 truncate">{user.name}</h4>
                        <span className="text-[8px] text-slate-500 opacity-0 group-hover/name:opacity-100 transition-opacity ml-1 select-none">Edit</span>
                      </div>
                    )}
                    <p className="text-[9px] text-slate-500 truncate select-none mt-0.5">{user.email}</p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleLogout}
              title={isTabletCollapsed ? "Sign Out" : undefined}
              className={`flex items-center w-full rounded-md text-[11px] font-medium transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent cursor-pointer ${
                isTabletCollapsed ? 'justify-center p-1.5 min-h-[30px]' : 'gap-2 px-2 py-1'
              }`}
            >
              <LogOut className="h-3 w-3 shrink-0" />
              {!isTabletCollapsed && <span>Sign Out</span>}
            </button>

            {!isTabletCollapsed && (
              <div className="text-[8px] text-slate-600 text-center font-normal pt-0.5">
                DriveSentra AI © 2026
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
              onClick={toggleMobileMenu}
              aria-hidden="true"
            ></div>

            {/* Menu */}
            <nav className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-5 z-50 animate-fade-in h-full overflow-y-auto shadow-2xl thin-scrollbar">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-400" />
                    <span className="font-extrabold text-white text-sm tracking-wider">DRIVESENTRA AI</span>
                  </div>
                  <button
                    onClick={toggleMobileMenu}
                    aria-label="Close menu"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {user && (
                  <div 
                    onClick={!isEditingName ? startEditing : undefined}
                    className={`px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-3 ${!isEditingName ? 'cursor-pointer hover:bg-slate-900/50' : ''}`}
                  >
                    <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0 select-none">
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
                          className="w-full bg-slate-900 border border-purple-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex items-center justify-between group/name">
                          <h4 className="text-xs font-bold text-slate-200 truncate">{user.name}</h4>
                          <span className="text-[10px] text-purple-400 ml-1">Edit</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={toggleMobileMenu}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold min-h-[44px] transition-all ${
                          isActive
                            ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2.5 mt-2.5 border-t border-slate-800 space-y-2">
                {activeTripId && (
                  <div className="px-2.5 py-1 bg-slate-950/80 border border-purple-500/20 rounded-lg flex items-center justify-between">
                    <span className="text-[8px] text-purple-400 font-bold uppercase tracking-wider">ACTIVE TRIP</span>
                    <span className="text-[11px] text-emerald-400 font-mono font-semibold truncate">{activeTripId}</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    toggleMobileMenu();
                    handleLogout();
                  }}
                  className="flex items-center justify-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 cursor-pointer min-h-[40px]"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col bg-slate-950/40 relative">
          <div className="p-3.5 sm:p-5 md:p-8 lg:p-10 flex-1 overflow-y-auto w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 min-w-0">
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
          <Route path="/simulator" element={<ProtectedRoute><Simulator /></ProtectedRoute>} />

          {/* Root Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    </BrowserRouter>
  );
};

export default App;
