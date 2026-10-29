import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { 
  Camera, 
  CameraOff, 
  Eye, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Coffee, 
  Save, 
  Sparkles, 
  AlertCircle,
  Database,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { saveDriverStatus } from '../services/api';
import { playAlertSound } from '../utils/audio';

const DriverMonitoring = () => {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  
  // State variables
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [fatigueLevel, setFatigueLevel] = useState(15); // Default nominal fatigue
  const [eyeClosureStatus, setEyeClosureStatus] = useState('Open');
  const [blinkCount, setBlinkCount] = useState(0);
  const [distractionStatus, setDistractionStatus] = useState('Focused');
  
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Dynamic MediaPipe CV configuration and tracking
  const [cvMode, setCvMode] = useState('Simulation'); // 'MediaPipe' or 'Simulation'
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [manualDistraction, setManualDistraction] = useState(false);
  const [isYawning, setIsYawning] = useState(false);

  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const manualDistractionRef = useRef(false);
  const lastAlertTimeRef = useRef({ warning: 0, distracted: 0, critical: 0 });
  const wasEyeClosedRef = useRef(false);

  // Retrieve userId from local storage or default
  const userId = localStorage.getItem('gd_userId') || 'driver_001';

  // State calculations based on fatigueLevel
  let driverState = 'Safe';
  let breakNeeded = 'No';
  let stateColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
  let stateGlow = 'shadow-emerald-500/10';
  let gaugeColor = 'from-emerald-500 to-teal-500';

  if (fatigueLevel < 40) {
    driverState = 'Safe';
    breakNeeded = 'No';
    stateColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    stateGlow = 'shadow-emerald-500/10 border-emerald-500/20';
    gaugeColor = 'from-emerald-500 to-teal-500';
  } else if (fatigueLevel >= 40 && fatigueLevel <= 70) {
    driverState = 'Drowsy';
    breakNeeded = 'No';
    stateColor = 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    stateGlow = 'shadow-amber-500/10 border-amber-500/20';
    gaugeColor = 'from-amber-500 to-yellow-500';
  } else if (fatigueLevel > 70 && fatigueLevel <= 80) {
    driverState = 'Warning';
    breakNeeded = 'Yes';
    stateColor = 'text-orange-400 border-orange-500/20 bg-orange-500/10';
    stateGlow = 'shadow-orange-500/10 border-orange-500/20';
    gaugeColor = 'from-orange-500 to-amber-600';
  } else {
    driverState = 'Critical';
    breakNeeded = 'Yes';
    stateColor = 'text-red-400 border-red-500/20 bg-red-500/10';
    stateGlow = 'shadow-red-500/10 border-red-500/20';
    gaugeColor = 'from-red-500 to-rose-600';
  }

  // Load MediaPipe Face Mesh script dynamically
  const loadFaceMeshScript = () => {
    return new Promise((resolve, reject) => {
      if (window.FaceMesh) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  const throttledPlayAlertSound = (type) => {
    const now = Date.now();
    const minInterval = type === 'distracted' ? 3500 : 5000;
    if (now - lastAlertTimeRef.current[type] > minInterval) {
      playAlertSound(type);
      lastAlertTimeRef.current[type] = now;
    }
  };

  const drawFaceMesh = (ctx, landmarks, isGazeDistracted, mar) => {
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)'; // Sleek light purple
    ctx.lineWidth = 1;

    const drawContour = (indices) => {
      ctx.beginPath();
      for (let i = 0; i < indices.length; i++) {
        const p = landmarks[indices[i]];
        if (i === 0) {
          ctx.moveTo(p.x * ctx.canvas.width, p.y * ctx.canvas.height);
        } else {
          ctx.lineTo(p.x * ctx.canvas.width, p.y * ctx.canvas.height);
        }
      }
      ctx.closePath();
      ctx.stroke();
    };

    // Draw eye boundaries for visual confirmation
    drawContour([33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]);
    drawContour([263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]);

    // Draw inner lip contour (colored gold if yawning)
    ctx.strokeStyle = mar > 0.52 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(168, 85, 247, 0.3)';
    ctx.lineWidth = mar > 0.52 ? 2 : 1;
    drawContour([13, 82, 38, 73, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312]);

    // Draw facial center markers
    const keyPoints = [1, 10, 152, 234, 454];
    keyPoints.forEach(idx => {
      const p = landmarks[idx];
      ctx.beginPath();
      ctx.arc(p.x * ctx.canvas.width, p.y * ctx.canvas.height, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981'; // Emerald glow
      ctx.fill();
    });

    // Face axes crosshair
    const nose = landmarks[1];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const forehead = landmarks[10];
    const chin = landmarks[152];

    ctx.beginPath();
    ctx.moveTo(leftCheek.x * ctx.canvas.width, leftCheek.y * ctx.canvas.height);
    ctx.lineTo(rightCheek.x * ctx.canvas.width, rightCheek.y * ctx.canvas.height);
    ctx.moveTo(forehead.x * ctx.canvas.width, forehead.y * ctx.canvas.height);
    ctx.lineTo(chin.x * ctx.canvas.width, chin.y * ctx.canvas.height);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Irises (Red if gaze is distracted, emerald green if focused)
    if (landmarks[468] && landmarks[473]) {
      ctx.fillStyle = isGazeDistracted ? '#ef4444' : '#10b981';
      ctx.beginPath();
      ctx.arc(landmarks[468].x * ctx.canvas.width, landmarks[468].y * ctx.canvas.height, 2.5, 0, 2 * Math.PI);
      ctx.arc(landmarks[473].x * ctx.canvas.width, landmarks[473].y * ctx.canvas.height, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Center nose tracker
    ctx.beginPath();
    ctx.arc(nose.x * ctx.canvas.width, nose.y * ctx.canvas.height, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#a855f7';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const onResults = (results) => {
    if (!canvasRef.current || !webcamRef.current || !webcamRef.current.video) return;

    const video = webcamRef.current.video;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    const canvas = canvasRef.current;
    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, videoWidth, videoHeight);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];

      // --- Heuristic Helpers ---
      const distance = (p1, p2) => {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
      };

      // 1. Gaze distraction (irises offset)
      const leftIris = landmarks[468];
      const rightIris = landmarks[473];
      let isGazeDistracted = false;

      if (leftIris && rightIris) {
        const leftEyeWidth = distance(landmarks[33], landmarks[133]);
        const rightEyeWidth = distance(landmarks[362], landmarks[263]);
        if (leftEyeWidth > 0 && rightEyeWidth > 0) {
          const leftIrisOffset = distance(landmarks[33], leftIris) / leftEyeWidth;
          const rightIrisOffset = distance(landmarks[362], rightIris) / rightEyeWidth;
          // Distracted if irises are looking far left or right (centered range: 0.38 - 0.62)
          isGazeDistracted = leftIrisOffset < 0.38 || leftIrisOffset > 0.62 || rightIrisOffset < 0.38 || rightIrisOffset > 0.62;
        }
      }

      // 2. Mouth Aspect Ratio (MAR) for Yawning
      const mouthHeight = distance(landmarks[13], landmarks[14]);
      const mouthWidth = distance(landmarks[61], landmarks[291]);
      const mar = mouthHeight / (mouthWidth || 1);

      const isYawningNow = mar > 0.52;
      if (isYawningNow) {
        setIsYawning(true);
        // Force state to Drowsy (fatigueLevel 50+)
        setFatigueLevel(prev => Math.max(prev, 50));
        throttledPlayAlertSound('warning');
      } else {
        setIsYawning(false);
      }

      // Draw the mesh overlay with these parameters
      drawFaceMesh(ctx, landmarks, isGazeDistracted, mar);

      // 3. Eye Aspect Ratio (EAR) for Drowsiness/Blink Detection
      const leftEAR = distance(landmarks[159], landmarks[145]) / distance(landmarks[33], landmarks[133]);
      const rightEAR = distance(landmarks[386], landmarks[374]) / distance(landmarks[362], landmarks[263]);
      const avgEAR = (leftEAR + rightEAR) / 2;

      const isClosedNow = avgEAR < 0.22;
      if (isClosedNow) {
        setEyeClosureStatus('Closed');
        if (!wasEyeClosedRef.current) {
          wasEyeClosedRef.current = true;
          setBlinkCount(prev => prev + 1);
        }
        // Increment fatigue rate
        setFatigueLevel(prev => Math.min(prev + 0.35, 100));
      } else {
        setEyeClosureStatus('Open');
        wasEyeClosedRef.current = false;
      }

      // 4. Head Pose (Yaw/Pitch) for Distraction detection
      const nose = landmarks[1];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];
      const forehead = landmarks[10];
      const chin = landmarks[152];

      const dxLeft = Math.abs(nose.x - leftCheek.x);
      const dxRight = Math.abs(rightCheek.x - nose.x);
      const dyForehead = Math.abs(nose.y - forehead.y);
      const dyChin = Math.abs(chin.y - nose.y);

      const yawRatio = dxLeft / dxRight;
      const pitchRatio = dyForehead / dyChin;

      const isYawDistracted = yawRatio < 0.55 || yawRatio > 1.8;
      const isPitchDistracted = pitchRatio < 0.55 || pitchRatio > 1.8;

      if (isYawDistracted || isPitchDistracted || isGazeDistracted) {
        setDistractionStatus('Distracted');
        throttledPlayAlertSound('distracted');
      } else {
        if (!manualDistractionRef.current) {
          setDistractionStatus('Focused');
        }
      }
    } else {
      // Empty feedback if face leaves the frame
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(0, 0, videoWidth, videoHeight);
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('FACIAL LANDMARKS DISRUPTED', 15, 25);
    }
  };

  const startAnalysisLoop = () => {
    const processFrame = async () => {
      if (monitoringActive && faceMeshRef.current && webcamRef.current && webcamRef.current.video) {
        const video = webcamRef.current.video;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            await faceMeshRef.current.send({ image: video });
          } catch (e) {
            console.error('MediaPipe inference frame error:', e);
          }
        }
      }
      if (monitoringActive) {
        animationFrameIdRef.current = requestAnimationFrame(processFrame);
      }
    };
    animationFrameIdRef.current = requestAnimationFrame(processFrame);
  };

  // MediaPipe lifecycle setup
  useEffect(() => {
    let active = true;

    if (monitoringActive) {
      loadFaceMeshScript()
        .then(() => {
          if (!active) return;
          setScriptsLoaded(true);
          setCvMode('MediaPipe');

          const faceMesh = new window.FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
          });

          faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });

          faceMesh.onResults(onResults);
          faceMeshRef.current = faceMesh;

          startAnalysisLoop();
        })
        .catch(err => {
          console.warn('Failed to load MediaPipe scripts. Operating in simulation mode.', err);
          if (active) {
            setCvMode('Simulation');
          }
        });
    } else {
      // Cleanup
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
      setCvMode('Simulation');
    }

    return () => {
      active = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, [monitoringActive]);

  // Simulation Fallback Interval (only processes when cvMode is Simulation)
  useEffect(() => {
    let interval;
    if (monitoringActive && cvMode === 'Simulation') {
      interval = setInterval(() => {
        // 1. Simulate eye blinks periodically
        const isBlinking = Math.random() > 0.85;
        if (isBlinking) {
          setEyeClosureStatus('Closed');
          setBlinkCount(prev => prev + 1);
          setTimeout(() => {
            setEyeClosureStatus('Open');
          }, 200);
        }

        // 2. Simulate brief distraction status if not manually overridden
        if (!manualDistractionRef.current) {
          const isDistracted = Math.random() > 0.93;
          if (isDistracted) {
            setDistractionStatus('Distracted');
            playAlertSound('distracted');
            setTimeout(() => {
              if (!manualDistractionRef.current) {
                setDistractionStatus('Focused');
              }
            }, 1500);
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [monitoringActive, cvMode]);

  // Natural slow fatigue level increment when active
  useEffect(() => {
    let interval;
    if (monitoringActive) {
      interval = setInterval(() => {
        setFatigueLevel(prev => {
          if (prev < 30) return Math.min(prev + 0.2, 30);
          return prev;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [monitoringActive]);

  // Handle warning and emergency modals based on fatigueLevel
  useEffect(() => {
    if (fatigueLevel > 70 && fatigueLevel <= 80) {
      setShowWarningModal(true);
      setShowEmergencyModal(false);
      playAlertSound('warning');
    } else if (fatigueLevel > 80) {
      setShowEmergencyModal(true);
      setShowWarningModal(false);
      playAlertSound('critical');
    } else {
      setShowWarningModal(false);
      setShowEmergencyModal(false);
    }
  }, [fatigueLevel]);

  // Action: Toggle webcam monitoring state
  const handleStartMonitoring = () => {
    setMonitoringActive(true);
  };

  const handleStopMonitoring = () => {
    setMonitoringActive(false);
    setEyeClosureStatus('Open');
    setDistractionStatus('Focused');
    setManualDistraction(false);
    manualDistractionRef.current = false;
  };

  // Action: Simulate Fatigue manually
  const handleSimulateFatigue = () => {
    if (!monitoringActive) {
      setMonitoringActive(true);
    }
    if (fatigueLevel < 35) {
      setFatigueLevel(55);
    } else if (fatigueLevel >= 35 && fatigueLevel < 70) {
      setFatigueLevel(75);
    } else if (fatigueLevel >= 70 && fatigueLevel < 81) {
      setFatigueLevel(88);
    } else {
      setFatigueLevel(15);
    }
  };

  // Action: Simulate Distraction manually
  const handleSimulateDistraction = () => {
    if (!monitoringActive) {
      setMonitoringActive(true);
    }
    const newStatus = distractionStatus === 'Focused' ? 'Distracted' : 'Focused';
    setDistractionStatus(newStatus);
    if (newStatus === 'Distracted') {
      playAlertSound('distracted');
      manualDistractionRef.current = true;
      setManualDistraction(true);
    } else {
      manualDistractionRef.current = false;
      setManualDistraction(false);
    }
  };

  // Action: Simulate Yawn manually
  const handleSimulateYawn = () => {
    if (!monitoringActive) {
      setMonitoringActive(true);
    }
    setIsYawning(true);
    setFatigueLevel(50); // Set to Drowsy (fatigueLevel >= 40 && <= 70)
    playAlertSound('warning');
    setTimeout(() => {
      setIsYawning(false);
    }, 3000);
  };

  // Action: Post telemetry to database
  const handleSaveStatus = async () => {
    setSavingStatus(true);
    setSaveSuccess(null);
    setErrorMsg(null);
    try {
      const res = await saveDriverStatus({
        userId,
        fatigueLevel,
        eyeClosureStatus,
        blinkCount,
        distractionStatus
      });
      if (res.success) {
        setSaveSuccess('Driver status log saved successfully.');
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.error || 'Failed to save driver status.');
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
          Driver Fatigue Monitoring
        </h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base">
          Live camera analysis utilizing computer vision heuristics to detect drowsiness and distraction.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Webcam Screen Card (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl relative min-h-[380px] flex items-center justify-center">
            
            {/* Scanline Overlay Effect when Active */}
            {monitoringActive && (
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-2xl">
                <div className="w-full h-0.5 bg-purple-500/20 absolute top-0 left-0 animate-[bounce_3s_infinite]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(2,6,23,0.3))]"></div>
              </div>
            )}

            {/* Distraction Warning Overlay */}
            {monitoringActive && distractionStatus === 'Distracted' && (
              <div className="absolute inset-0 pointer-events-none z-20 border-4 border-red-500/60 rounded-2xl bg-red-950/15 animate-pulse flex items-center justify-center">
                <div className="bg-red-950/90 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-2xl backdrop-blur-md animate-scale-up">
                  <AlertTriangle className="h-4.5 w-4.5 text-red-500 animate-bounce" />
                  WARNING: KEEP EYES ON ROAD!
                </div>
              </div>
            )}

            {/* Yawn Warning Overlay */}
            {monitoringActive && isYawning && (
              <div className="absolute inset-0 pointer-events-none z-20 border-4 border-amber-500/60 rounded-2xl bg-amber-950/15 animate-pulse flex items-center justify-center">
                <div className="bg-amber-950/90 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-2xl backdrop-blur-md animate-scale-up">
                  <Coffee className="h-4.5 w-4.5 text-amber-500 animate-bounce" />
                  YAWN DETECTED: DROWSY STATE
                </div>
              </div>
            )}

            {/* Live Camera Stream or Camera Off Placeholder */}
            {monitoringActive ? (
              <div className="relative w-full h-full min-h-[380px] max-h-[420px] flex items-center justify-center">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover rounded-2xl absolute inset-0"
                />
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-cover rounded-2xl absolute inset-0 z-10 pointer-events-none"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-600 shadow-inner">
                  <CameraOff className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-400">Camera Feed Idle</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Start monitoring to activate the camera lens and begin telemetry extraction.
                  </p>
                </div>
              </div>
            )}

            {/* Live Indicator Badges */}
            {monitoringActive && (
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full"></span>
                  LIVE CAMERA
                </span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border uppercase ${stateColor}`}>
                  {driverState} STATE
                </span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border uppercase ${cvMode === 'MediaPipe' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                  CV: {cvMode} MODE
                </span>
              </div>
            )}

            {monitoringActive && (
              <div className="absolute bottom-4 right-4 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-850 z-20 text-[10px] text-slate-400 font-mono">
                FPS: 30 | Res: 640x480
              </div>
            )}
          </div>

          {/* Control Action Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-4 gap-3">
            {!monitoringActive ? (
              <button
                onClick={handleStartMonitoring}
                className="px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] cursor-pointer"
              >
                <Camera className="h-4.5 w-4.5" />
                Start Monitoring
              </button>
            ) : (
              <button
                onClick={handleStopMonitoring}
                className="px-5 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                <CameraOff className="h-4.5 w-4.5" />
                Stop Monitoring
              </button>
            )}

            <button
              onClick={handleSimulateFatigue}
              className="px-5 py-3 bg-slate-900 border border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-950/15 text-purple-300 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
            >
              <TrendingUp className="h-4.5 w-4.5" />
              Simulate Fatigue
            </button>

            <button
              onClick={handleSimulateDistraction}
              className={`px-5 py-3 border rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer ${
                distractionStatus === 'Distracted'
                  ? 'bg-red-950/30 border-red-500/40 text-red-300 hover:border-red-500/60'
                  : 'bg-slate-900 border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-950/15 text-blue-300'
              }`}
            >
              <AlertCircle className="h-4.5 w-4.5" />
              {distractionStatus === 'Distracted' ? 'Clear Distracted' : 'Simulate Distracted'}
            </button>

            <button
              onClick={handleSimulateYawn}
              className={`px-5 py-3 border rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer ${
                isYawning
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-300 hover:border-amber-500/60'
                  : 'bg-slate-900 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-950/10 text-amber-300'
              }`}
            >
              <Coffee className="h-4.5 w-4.5" />
              Simulate Yawn
            </button>

            <button
              onClick={handleSaveStatus}
              disabled={savingStatus || !monitoringActive}
              className="px-5 py-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ml-auto cursor-pointer"
            >
              <Database className="h-4.5 w-4.5" />
              {savingStatus ? 'Saving...' : 'Save Driver Status'}
            </button>
          </div>

          {/* User Feedback Messages */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2 animate-scale-up">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {saveSuccess}
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2 animate-scale-up">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}
        </div>

        {/* Right Column: Telemetry & Status Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* Main Status Meter Card */}
          <div className={`bg-slate-900/60 border rounded-2xl p-6 shadow-lg relative overflow-hidden transition-all duration-300 ${stateGlow}`}>
            <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-400" />
              Telemetry Analytics
            </h3>

            {/* Fatigue Percentage Bar */}
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400 uppercase tracking-wide">FATIGUE INDEX</span>
                <span className="text-white font-bold">{fatigueLevel.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850 p-0.5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${gaugeColor} transition-all duration-500`}
                  style={{ width: `${fatigueLevel}%` }}
                ></div>
              </div>
            </div>

            {/* Stats Metrics Details Grid */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl">
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">DRIVER STATE</span>
                <span className={`block text-lg font-black mt-1 uppercase ${stateColor.split(' ')[0]}`}>
                  {driverState}
                </span>
              </div>

              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl">
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">BREAK REQUIRED</span>
                <span className={`block text-lg font-black mt-1 ${breakNeeded === 'Yes' ? 'text-orange-400' : 'text-emerald-400'}`}>
                  {breakNeeded}
                </span>
              </div>

              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl">
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">EYE STATUS</span>
                <span className={`block text-lg font-black text-white mt-1 uppercase ${eyeClosureStatus === 'Closed' ? 'text-amber-400 animate-pulse' : ''}`}>
                  {eyeClosureStatus}
                </span>
              </div>

              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl">
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">BLINK COUNT</span>
                <span className="block text-lg font-black text-white mt-1">
                  {blinkCount}
                </span>
              </div>
            </div>

            {/* Distraction Status */}
            <div className="mt-4 bg-slate-950/50 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wide">FOCUS ASSESSMENT</span>
                <span className={`block text-base font-black mt-1 uppercase ${distractionStatus === 'Focused' ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`}>
                  {distractionStatus}
                </span>
              </div>
              <div className={`h-3 w-3 rounded-full ${distractionStatus === 'Focused' ? 'bg-emerald-400' : 'bg-red-500 animate-ping'}`}></div>
            </div>
          </div>

          {/* Break Recommendation Details */}
          {breakNeeded === 'Yes' && (
            <div className="bg-gradient-to-r from-orange-500/10 to-amber-600/15 border border-orange-500/20 p-5 rounded-2xl shadow-md flex items-start gap-4 animate-scale-up">
              <div className="p-2 bg-orange-500/20 rounded-xl text-orange-400 shrink-0">
                <Coffee className="h-6 w-6" />
              </div>
              <div className="space-y-1 text-slate-300">
                <h4 className="font-bold text-white text-sm">Fatigue Alert: Rest Break Advisable</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We detected prolonged eye closures or slow eye blinks. Pulling over to a safe rest stop is highly recommended. Check Itinerary stops or coordinate with the Copilot Agent.
                </p>
              </div>
            </div>
          )}

          {/* Computer Vision Architecture Roadmap Note */}
          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 text-xs text-slate-500 font-mono leading-relaxed space-y-2">
            <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px] block">
              Developer CV Integration Panel
            </span>
            <p>
              Eye blinks and state details are currently driven by a dynamic rule-based evaluator.
            </p>
            <div className="text-[10px] text-slate-650 space-y-1">
              <p>// TODO: Hooking up MediaPipe Face Mesh & OpenCV</p>
              <p>// 1. Capture frames from webcamRef.current.getScreenshot()</p>
              <p>// 2. Calculate Eye Aspect Ratio (EAR) with landmarks 33, 160, 158, 133, 153, 144</p>
              <p>// 3. Trigger Closed state when EAR falls below 0.22 for more than 2 frames</p>
              <p>// 4. Determine distractionStatus using Pitch, Yaw, and Roll Euler angles of head mesh</p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Modal (Fatigue 71-80%) */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-orange-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden animate-scale-up">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-500"></div>
            <div className="flex items-center gap-3 text-orange-400 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-extrabold text-white text-lg">Warning: Drowsiness Warning</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Fatigue metrics report a value of <strong className="text-orange-400">{fatigueLevel.toFixed(0)}%</strong>. Drowsy driving patterns have been detected. Rest breaks prevents accidents. Keep driving safely!
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all"
              >
                Acknowledge Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Alert Suggestion Modal (Fatigue > 80%) */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden animate-scale-up">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="font-extrabold text-white text-lg">Emergency Action Trigger</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Critical drowsiness level of <strong className="text-red-400">{fatigueLevel.toFixed(0)}%</strong> detected. The mobility companion recommends notifying emergency contacts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button 
                onClick={() => setShowEmergencyModal(false)}
                className="px-4 py-2.5 bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-all cursor-pointer order-last sm:order-first"
              >
                Dismiss Warning
              </button>
              <button 
                onClick={() => {
                  setShowEmergencyModal(false);
                  navigate('/emergency-alerts', { 
                    state: { 
                      reason: `Critical fatigue levels detected (${fatigueLevel.toFixed(0)}% fatigue, state Critical). Drowsiness auto-trigger.`
                    } 
                  });
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/10 cursor-pointer"
              >
                Go to Emergency Center
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverMonitoring;
