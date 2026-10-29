import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  ShieldAlert, 
  Send, 
  History, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { sendEmergencyAlert, getEmergencyHistory } from '../services/api';
import { playAlertSound } from '../utils/audio';

const EmergencyAlerts = () => {
  const routeLocation = useLocation();

  // Load from localStorage or use defaults
  const [formData, setFormData] = useState({
    userId: localStorage.getItem('gd_userId') || 'driver_001',
    driverName: localStorage.getItem('gd_driverName') || 'John Doe',
    emergencyContactName: localStorage.getItem('gd_contactName') || 'Sarah Doe',
    emergencyContactPhone: localStorage.getItem('gd_contactPhone') || '+1 (555) 019-9000',
    emergencyContactEmail: localStorage.getItem('gd_contactEmail') || 'sarah.doe@example.com',
    currentLocation: localStorage.getItem('gd_location') || 'National Highway 275, Mandya Bypass',
    alertReason: ''
  });

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // If redirected from fatigue monitoring with a predefined reason
  useEffect(() => {
    if (routeLocation.state && routeLocation.state.reason) {
      setFormData(prev => ({
        ...prev,
        alertReason: routeLocation.state.reason
      }));
    }
  }, [routeLocation.state]);

  // Save basic fields to localStorage on change so they persist across reloads
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Persist configurations
    if (name !== 'alertReason') {
      let lsKey = 'gd_' + name;
      if (name === 'emergencyContactName') lsKey = 'gd_contactName';
      if (name === 'emergencyContactPhone') lsKey = 'gd_contactPhone';
      if (name === 'emergencyContactEmail') lsKey = 'gd_contactEmail';
      localStorage.setItem(lsKey, value);
    }
  };

  // Fetch alert dispatch history
  const fetchHistory = async () => {
    try {
      const res = await getEmergencyHistory(formData.userId);
      if (res.success) {
        setHistory(res.data);
      }
    } catch (err) {
      console.error('Error fetching emergency history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [formData.userId]);

  // Form submission: Dispatch alert
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    playAlertSound('critical');

    try {
      const res = await sendEmergencyAlert(formData);
      if (res.success) {
        setSuccessMsg(res.message || 'Emergency Alert: Sent to contact');
        // Clear alert reason input after successful dispatch
        setFormData(prev => ({ ...prev, alertReason: '' }));
        // Refresh history log list
        fetchHistory();
        
        // Hide success message after 4s
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.error || 'Failed to send emergency alert.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
          Emergency Command Center
        </h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base">
          Broadcast SOS alerts to pre-configured primary safety contacts and log system notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form Details Card (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500 fill-red-500/10" />
              Configure SOS Dispatch
            </h3>

            {/* Input grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* User ID (Hidden or Read-only/Editable) */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">Driver ID / Account</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    name="userId"
                    value={formData.userId}
                    onChange={handleChange}
                    required
                    placeholder="e.g. driver_001"
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-650 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Driver Name */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">Driver Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    name="driverName"
                    value={formData.driverName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-650 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Contact Name */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">Emergency Contact Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    name="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Sarah Doe"
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-650 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Contact Phone */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">Emergency Phone (SMS)</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={handleChange}
                    required
                    placeholder="e.g. +1 555-0199"
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-650 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Contact Email */}
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">Emergency Email (Notification)</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    name="emergencyContactEmail"
                    value={formData.emergencyContactEmail}
                    onChange={handleChange}
                    required
                    placeholder="e.g. contact@domain.com"
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-650 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Current Location */}
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">Current Vehicle Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    name="currentLocation"
                    value={formData.currentLocation}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Highway GPS coordinates or town name"
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-650 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Alert Reason */}
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">Emergency Description / Reason</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <textarea
                    name="alertReason"
                    value={formData.alertReason}
                    onChange={handleChange}
                    required
                    rows="3"
                    placeholder="Describe the nature of the emergency (e.g. Critical fatigue levels detected, driver non-responsive)."
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-650 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all resize-none"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-between border-t border-slate-850 pt-4">
              <span className="text-[10px] text-slate-500 font-mono">
                Mock Twilio SMS + Nodemailer Email active
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-red-800 disabled:to-rose-800 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-red-500/10 active:scale-[0.98] cursor-pointer"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Dispatching...' : 'Send Emergency Alert'}
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2.5 animate-scale-up">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
              <div>
                <strong className="block font-bold">Alert Successful</strong>
                <span className="text-slate-400 mt-0.5 block">{successMsg} (Twilio and Nodemailer mock alerts log successfully dispatched)</span>
              </div>
            </div>
          )}
          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2.5 animate-scale-up">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-400" />
              <div>
                <strong className="block font-bold">Dispatch Failure</strong>
                <span className="text-slate-400 mt-0.5 block">{errorMsg}</span>
              </div>
            </div>
          )}
        </form>

        {/* Right Column: Alert History Log (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-purple-400" />
                SOS Dispatch Logs
              </h3>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-3"></div>
                  <p className="text-xs">Accessing history records...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border border-dashed border-slate-850 rounded-xl bg-slate-950/20">
                  <Clock className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-400 text-sm">No Incidents Logged</h4>
                  <p className="text-xs text-slate-650 max-w-[200px] mx-auto mt-1">
                    No emergency signals have been dispatched from this terminal.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                  {history.map((alert) => (
                    <div 
                      key={alert._id} 
                      className="bg-slate-950/80 border border-red-500/10 rounded-xl p-4 shadow-sm hover:border-red-500/25 transition-all relative overflow-hidden group"
                    >
                      {/* Red border glow accent */}
                      <div className="absolute top-0 left-0 h-full w-1 bg-red-500"></div>

                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white">{alert.emergencyContactName}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-red-500/15 text-red-400 border border-red-500/20">
                          {alert.alertStatus}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-400">
                        <p className="line-clamp-2 text-slate-300 italic">
                          "{alert.alertReason}"
                        </p>
                        
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-2 font-mono">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{alert.currentLocation}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{new Date(alert.sentAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-850 pt-4 mt-6 text-[10px] text-slate-500 font-mono leading-relaxed space-y-1">
              <span className="text-red-400 font-bold block uppercase tracking-wide">SOS BROADCAST SYSTEM</span>
              <p>
                Alerts are logged to database logs and immediately print simulated Twilio SMTP / SMS payloads to the server log console.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlerts;
