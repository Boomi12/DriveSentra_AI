import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  History, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Frown,
  Activity,
  Database
} from 'lucide-react';
import { getDriverLogs } from '../services/api';

const DriverLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem('gd_userId') || 'driver_001';

  const fetchLogs = useCallback(async () => {
    try {
      const res = await getDriverLogs(userId);
      if (res.success) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error('Error fetching driver fatigue logs:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  // Derived analytics state
  const analytics = useMemo(() => {
    if (!logs || logs.length === 0) {
      return {
        highestFatigue: 0,
        totalWarnings: 0,
        totalCriticals: 0,
        lastMonitoringTime: 'N/A'
      };
    }

    let highest = 0;
    let warnings = 0;
    let criticals = 0;

    logs.forEach((log) => {
      if (log.fatigueLevel > highest) highest = log.fatigueLevel;
      if (log.driverState === 'Warning') warnings++;
      if (log.driverState === 'Critical') criticals++;
    });

    const lastTime = new Date(logs[0].timestamp).toLocaleString();

    return {
      highestFatigue: highest,
      totalWarnings: warnings,
      totalCriticals: criticals,
      lastMonitoringTime: lastTime
    };
  }, [logs]);

  // Helper styles for states
  const getStateBadge = (state) => {
    switch (state) {
      case 'Safe':
        return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
      case 'Drowsy':
        return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      case 'Warning':
        return 'text-orange-400 border-orange-500/20 bg-orange-500/10';
      case 'Critical':
        return 'text-red-400 border-red-500/20 bg-red-500/10';
      default:
        return 'text-slate-400 border-slate-500/20 bg-slate-500/10';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            Safety & Drowsiness History
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Detailed chronological analysis of telemetry logs and fatigue diagnostics.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-2"
        >
          <Activity className="h-3.5 w-3.5" />
          Refresh Database
        </button>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Highest Fatigue */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-md flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all"></div>
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">MAX FATIGUE</span>
            <span className="block text-2xl font-black text-white mt-0.5 font-mono">
              {analytics.highestFatigue.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Warning Events */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-md flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl group-hover:bg-orange-500/10 transition-all"></div>
          <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">WARNING INCIDENTS</span>
            <span className="block text-2xl font-black text-white mt-0.5 font-mono">
              {analytics.totalWarnings}
            </span>
          </div>
        </div>

        {/* Critical Events */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-md flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl group-hover:bg-red-500/10 transition-all"></div>
          <div className="p-3 bg-red-500/10 rounded-xl text-red-400 shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">CRITICAL INCIDENTS</span>
            <span className="block text-2xl font-black text-white mt-0.5 font-mono">
              {analytics.totalCriticals}
            </span>
          </div>
        </div>

        {/* Last Monitored Time */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-md flex items-center gap-4 relative overflow-hidden group col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all"></div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">LAST TELEMETRY</span>
            <span className="block text-xs font-bold text-white mt-1 truncate max-w-full font-mono">
              {analytics.lastMonitoringTime}
            </span>
          </div>
        </div>

      </div>

      {/* Main Logs Table Card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <History className="h-5 w-5 text-purple-400" />
            Driver Status Database
          </h3>
          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Active User: {userId}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-3"></div>
            <p className="text-xs">Accessing driver database...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-slate-500 max-w-sm mx-auto">
            <Frown className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <h4 className="font-bold text-slate-400">No Logs Found</h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              We couldn't locate any driver monitoring database records for this account. Open Driver Monitoring to save status logs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider bg-slate-950/20">
                  <th className="p-4 pl-6">Timestamp</th>
                  <th className="p-4">Fatigue Index</th>
                  <th className="p-4">Driver State</th>
                  <th className="p-4">Blinks</th>
                  <th className="p-4">Eye Status</th>
                  <th className="p-4">Distraction</th>
                  <th className="p-4 pr-6 text-center">Break Needed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-900/35 transition-colors group">
                    <td className="p-4 pl-6 text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono font-bold text-white">
                      <div className="flex items-center gap-3">
                        <span className="w-8 shrink-0">{log.fatigueLevel.toFixed(0)}%</span>
                        <div className="h-1.5 w-16 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div 
                            className={`h-full rounded-full ${
                              log.fatigueLevel < 40 ? 'bg-emerald-500' :
                              log.fatigueLevel <= 70 ? 'bg-amber-500' :
                              log.fatigueLevel <= 80 ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${log.fatigueLevel}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${getStateBadge(log.driverState)}`}>
                        {log.driverState}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-semibold text-slate-300">
                      {log.blinkCount}
                    </td>
                    <td className="p-4 text-slate-400 uppercase font-mono">
                      {log.eyeClosureStatus || 'Open'}
                    </td>
                    <td className="p-4">
                      <span className={`font-semibold ${log.distractionStatus === 'Focused' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {log.distractionStatus || 'Focused'}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-center">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                        log.breakNeeded ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-slate-950 text-slate-600 border border-slate-800'
                      }`}>
                        {log.breakNeeded ? 'YES' : 'NO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverLogs;
