import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertTriangle, Sliders, ShieldCheck, Clock, Upload, Play, Square, Eye, Zap, UserPlus, Info, Users, LogOut, Brain, UserCheck } from 'lucide-react';
import { Faculty, AttendanceRecord, SystemSettings } from '../types/biometric';
import { checkAlreadyMarkedToday, getISTDateString, getISTTimeString, formatTime12Hour } from '../services/biometricEngine';
import { biometricAudio } from '../services/audioEffects';
import * as faceapi from 'face-api.js';
import { loadFaceApiModels, isFaceApiReady, onFaceApiStatus, faceDescriptorDistance, distanceToSimilarity, type FaceApiStatus } from '../services/faceApiEngine';

interface LiveScannerProps {
  facultyList: Faculty[];
  attendanceRecords: AttendanceRecord[];
  onAttendanceMarked: (record: AttendanceRecord) => void;
  settings: SystemSettings;
  onOpenSettings: () => void;
  onNavigateToEnroll: () => void;
  theme?: 'dark' | 'light';
}

interface LiveFaceResult {
  box: { x: number; y: number; width: number; height: number };
  faculty: Faculty | null;
  similarity: number;
  label: string;
}

const MATCH_THRESHOLD = 0.50;

export const LiveScanner: React.FC<LiveScannerProps> = ({
  facultyList, attendanceRecords, onAttendanceMarked, settings, onOpenSettings, onNavigateToEnroll, theme = 'dark',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveFacesRef = useRef<LiveFaceResult[]>([]);
  const isCapturingRef = useRef(false);

  const [liveFaces, setLiveFaces] = useState<LiveFaceResult[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [lastCapturedSnapshot, setLastCapturedSnapshot] = useState<string | null>(null);
  const [lastCapturedTime, setLastCapturedTime] = useState<string | null>(null);
  const facultyCooldowns = useRef<Map<string, number>>(new Map());
  const [, setCooldownTrigger] = useState(0);
  const [facultyFilterQuery, setFacultyFilterQuery] = useState('');
  const [modalCountdown, setModalCountdown] = useState(3);
  const [sampleImageActive, setSampleImageActive] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'AUTO' | 'CHECK_IN' | 'CHECK_OUT'>('AUTO');
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [currentISTTime, setCurrentISTTime] = useState(getISTTimeString());
  const [faceApiStatus, setFaceApiStatus] = useState<FaceApiStatus>('idle');
  const [faceApiDetail, setFaceApiDetail] = useState('');
  const [lastResult, setLastResult] = useState<{ faculty: Faculty | null; similarity: number; confirmed: boolean } | null>(null);

  const [verificationModal, setVerificationModal] = useState<{
    record: AttendanceRecord | null; alreadyMarked: boolean; existingRecord?: AttendanceRecord | null;
    faculty: Faculty | null; similarity: number; show: boolean; capturedImage?: string | null;
  }>({ record: null, alreadyMarked: false, existingRecord: null, faculty: null, similarity: 0, show: false, capturedImage: null });

  const isFacultyOnCooldown = useCallback((id: string) => {
    if (!id) return false;
    const clean = id.trim().toLowerCase();
    for (const [key, exp] of facultyCooldowns.current.entries()) {
      if (key.trim().toLowerCase() === clean && exp > Date.now()) return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!verificationModal.show) { setModalCountdown(3); return; }
    setModalCountdown(3);
    const iv = setInterval(() => setModalCountdown((p) => { if (p <= 1) { clearInterval(iv); setVerificationModal((m) => ({ ...m, show: false })); return 0; } return p - 1; }), 1000);
    return () => clearInterval(iv);
  }, [verificationModal.show]);

  useEffect(() => { const t = setInterval(() => setCurrentISTTime(getISTTimeString()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const unsub = onFaceApiStatus((s, d) => { setFaceApiStatus(s); if (d) setFaceApiDetail(d); });
    setFaceApiStatus('loading');
    loadFaceApiModels().catch(() => { setFaceApiStatus('error'); setFaceApiDetail('Model load failed'); });
    return unsub;
  }, []);

  const getEnrolled = useCallback(() =>
    facultyList.filter((f) => f.faceDescriptor && (f.faceDescriptor as number[]).length === 128)
      .map((f) => ({ faculty: f, descriptor: f.faceDescriptor as number[] })), [facultyList]);

  const matchDescriptor = useCallback((desc: Float32Array): { faculty: Faculty; similarity: number } | null => {
    const enrolled = getEnrolled();
    if (!enrolled.length) return null;
    let bestFac: Faculty | null = null; let bestDist = Infinity;
    for (const e of enrolled) { const d = faceDescriptorDistance(desc, e.descriptor); if (d < bestDist) { bestDist = d; bestFac = e.faculty; } }
    const similarity = distanceToSimilarity(bestDist);
    if (bestDist <= MATCH_THRESHOLD && similarity >= (settings.buffaloThreshold || 0.60) && bestFac) {
      return { faculty: bestFac, similarity };
    }
    return null;
  }, [getEnrolled, settings.buffaloThreshold]);

  const captureSnapshot = useCallback((): string => {
    if (sampleImageActive) return sampleImageActive;
    const v = videoRef.current;
    if (v && v.videoWidth > 0 && v.readyState >= 2) {
      const c = captureCanvasRef.current || document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0);
        ctx.fillStyle = 'rgba(2,6,23,0.75)'; ctx.fillRect(0, c.height - 28, c.width, 28);
        ctx.fillStyle = '#10b981'; ctx.font = 'bold 11px monospace';
        ctx.fillText('ADIC FACE APP \u00B7 ' + getISTDateString() + ' ' + getISTTimeString() + ' IST', 8, c.height - 9);
        return c.toDataURL('image/jpeg', 0.92);
      }
    }
    return '';
  }, [sampleImageActive]);

  const startCamera = async () => {
    setCameraError(null); setSampleImageActive(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); setCameraActive(true); };
      }
    } catch (err) {
      console.warn('Camera error:', err);
      setCameraError('Camera access denied. Please allow camera permissions and refresh.');
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop()); videoRef.current.srcObject = null; }
    setCameraActive(false); setLiveFaces([]); liveFacesRef.current = [];
    const oc = overlayCanvasRef.current;
    if (oc) oc.getContext('2d')?.clearRect(0, 0, oc.width, oc.height);
  }, []);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  // Real-time OpenCV-style CNN detection loop
  useEffect(() => {
    if (!cameraActive) return;
    let stopped = false; let fc = 0; let lastFpsT = performance.now();
    const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });

    const loop = async () => {
      while (!stopped) {
        const video = videoRef.current; const overlay = overlayCanvasRef.current;
        if (!video || video.readyState < 2 || !overlay) { await new Promise((r) => setTimeout(r, 100)); continue; }
        const vw = video.videoWidth || video.clientWidth; const vh = video.videoHeight || video.clientHeight;
        if (!vw || !vh) { await new Promise((r) => setTimeout(r, 100)); continue; }
        if (overlay.width !== vw || overlay.height !== vh) { overlay.width = vw; overlay.height = vh; }
        const ctx = overlay.getContext('2d');
        if (!ctx) { await new Promise((r) => setTimeout(r, 100)); continue; }
        const t0 = performance.now();
        ctx.clearRect(0, 0, vw, vh);
        if (!isFaceApiReady()) { await new Promise((r) => setTimeout(r, 200)); continue; }
        try {
          const dets = await faceapi.detectAllFaces(video, OPTS).withFaceLandmarks().withFaceDescriptors();
          if (!stopped) {
            if (!dets.length) { liveFacesRef.current = []; setLiveFaces([]); }
            else {
              const resized = faceapi.resizeResults(dets, { width: vw, height: vh });
              const results: LiveFaceResult[] = [];
              for (const det of resized) {
                const { x, y, width, height } = det.detection.box;
                const match = matchDescriptor(det.descriptor);
                const faculty = match?.faculty ?? null;
                const similarity = match?.similarity ?? det.detection.score;
                const accuracyPct = (similarity * 100).toFixed(1);
                const label = faculty 
                  ? `${faculty.name} (${accuracyPct}%)` 
                  : facultyList.length === 0 
                    ? 'Enroll First' 
                    : `UNKNOWN (${accuracyPct}%)`;
                results.push({ box: { x, y, width, height }, faculty, similarity, label });
                // Draw box
                const color = faculty ? '#34d399' : '#fbbf24';
                ctx.save();
                ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.shadowColor = color; ctx.shadowBlur = 10;
                ctx.strokeRect(x, y, width, height);
                ctx.shadowBlur = 0;
                // Corners
                const cs = 14; ctx.lineWidth = 3;
                [[x,y,1,1],[x+width,y,-1,1],[x,y+height,1,-1],[x+width,y+height,-1,-1]].forEach(([px,py,dx,dy]) => {
                  ctx.beginPath(); ctx.moveTo((px as number)+(dx as number)*cs, py as number); ctx.lineTo(px as number, py as number); ctx.lineTo(px as number, (py as number)+(dy as number)*cs); ctx.stroke();
                });
                // Label tag
                ctx.font = 'bold 13px monospace';
                const tw = ctx.measureText(label).width + 14; const th = 21; const ty = Math.max(0, y - th - 3);
                ctx.fillStyle = faculty ? 'rgba(2,12,20,0.95)' : 'rgba(38,16,4,0.95)';
                ctx.beginPath(); if ((ctx as any).roundRect) (ctx as any).roundRect(x, ty, tw, th, 3); else ctx.rect(x, ty, tw, th); ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 5;
                ctx.beginPath(); if ((ctx as any).roundRect) (ctx as any).roundRect(x, ty, tw, th, 3); else ctx.rect(x, ty, tw, th); ctx.stroke();
                ctx.shadowBlur = 0; ctx.fillStyle = color;
                ctx.fillText(label, x + 7, ty + 14);
                // Dot
                ctx.beginPath(); ctx.arc(x + width/2, y + height/2, 4, 0, Math.PI*2); ctx.fillStyle = color + '99'; ctx.fill();
                ctx.restore();
              }
              liveFacesRef.current = results; setLiveFaces([...results]);
            }
            fc++;
            const now = performance.now();
            if (now - lastFpsT >= 1000) { setFps(Math.round(fc * 1000 / (now - lastFpsT))); fc = 0; lastFpsT = now; }
            setLatencyMs(Math.round(performance.now() - t0));
          }
        } catch (err) { console.warn('[CNN]', err); }
        await new Promise((r) => setTimeout(r, 40));
      }
    };
    loop();
    return () => { stopped = true; };
  }, [cameraActive, matchDescriptor, facultyList.length]);

  // Auto-attendance
  useEffect(() => {
    if (!autoScanEnabled || scanMode === 'CHECK_OUT' || isAutoCapturing || verificationModal.show || isCapturingRef.current) return;
    for (const face of liveFaces) {
      if (face.faculty && face.similarity >= settings.buffaloThreshold && !isFacultyOnCooldown(face.faculty.id)) {
        recordAttendance(face.faculty, face.similarity); break;
      }
    }
  }, [liveFaces, autoScanEnabled, scanMode, isAutoCapturing, verificationModal.show, settings.buffaloThreshold]);

  const recordAttendance = async (faculty: Faculty, similarity: number, explicitMode?: 'AUTO' | 'CHECK_IN' | 'CHECK_OUT') => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true; setIsAutoCapturing(true);
    try {
      const snap = captureSnapshot() || faculty.photoUrl || '';
      setLastCapturedSnapshot(snap); setLastCapturedTime(getISTTimeString());
      const res = await fetch('/api/attendance/mark', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyId: faculty.id, similarityScore: similarity, detectionConfidence: 0.98, deviceSource: 'WEB_KIOSK', verificationMethod: 'FACE_API_CNN', capturedFrameThumb: snap, mode: explicitMode ?? scanMode }),
      });
      const data = await res.json();
      facultyCooldowns.current.set(faculty.id, Date.now() + 8000);
      facultyCooldowns.current.set(faculty.staffId, Date.now() + 8000);
      setCooldownTrigger((t) => t + 1); setTimeout(() => setCooldownTrigger((t) => t + 1), 8000);
      if (res.status === 409 || data.alreadyMarked) {
        biometricAudio.playAlreadyMarkedAlert();
        if (settings.speechAnnouncements) biometricAudio.speak('Attendance already recorded for ' + faculty.name);
        setVerificationModal({ record: null, alreadyMarked: true, existingRecord: data.record, faculty, similarity, show: true, capturedImage: snap });
      } else if (data.success && data.record) {
        biometricAudio.playSuccessChime();
        if (settings.speechAnnouncements) biometricAudio.speak((data.action === 'CHECK_OUT' ? 'Goodbye ' : 'Welcome ') + faculty.name);
        onAttendanceMarked(data.record);
        setVerificationModal({ record: data.record, alreadyMarked: false, existingRecord: null, faculty, similarity, show: true, capturedImage: snap });
      }
    } catch (err) { console.error('Attendance error:', err); }
    finally { isCapturingRef.current = false; setIsAutoCapturing(false); }
  };

  const triggerManual = async (modeOverride?: 'AUTO' | 'CHECK_IN' | 'CHECK_OUT') => {
    const faces = liveFacesRef.current;
    if (!faces.length) { biometricAudio.playUnknownBuzz(); if (settings.speechAnnouncements) biometricAudio.speak('No face detected.'); setLastResult({ faculty: null, similarity: 0, confirmed: false }); return; }
    const best = faces.find((f) => f.faculty && f.similarity >= settings.buffaloThreshold) || faces[0];
    if (!best.faculty || best.similarity < settings.buffaloThreshold) { biometricAudio.playUnknownBuzz(); if (settings.speechAnnouncements) biometricAudio.speak('Face not recognized.'); setLastResult({ faculty: null, similarity: best.similarity, confirmed: false }); return; }
    setLastResult({ faculty: best.faculty, similarity: best.similarity, confirmed: true });
    await recordAttendance(best.faculty, best.similarity, modeOverride);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string; setSampleImageActive(url); stopCamera();
      if (isFaceApiReady()) {
        const img = new Image(); img.onload = async () => {
          try {
            const OPTS2 = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
            const dets = await faceapi.detectAllFaces(img, OPTS2).withFaceLandmarks().withFaceDescriptors();
            const results: LiveFaceResult[] = dets.map((det) => {
              const m = matchDescriptor(det.descriptor);
              const faculty = m?.faculty ?? null;
              const similarity = m?.similarity ?? det.detection.score;
              const accuracyPct = (similarity * 100).toFixed(1);
              const label = faculty 
                ? `${faculty.name} (${accuracyPct}%)` 
                : facultyList.length === 0 
                  ? 'Enroll First' 
                  : `UNKNOWN (${accuracyPct}%)`;
              return { 
                box: { x: det.detection.box.x, y: det.detection.box.y, width: det.detection.box.width, height: det.detection.box.height }, 
                faculty, 
                similarity, 
                label 
              };
            });
            setLiveFaces(results); liveFacesRef.current = results;
          } catch {}
        }; img.src = url;
      }
    }; reader.readAsDataURL(file);
  };

  const todayIST = getISTDateString();
  const todayRecords = attendanceRecords.filter((r) => r.date === todayIST);
  const markedCount = todayRecords.length;
  const primaryFace = liveFaces.find((f) => f.faculty) || liveFaces[0] || null;
  const dk = theme === 'dark';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* IST Clock Bar */}
      <div className={`border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg ${dk ? 'bg-slate-900/80 border-slate-800/80' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
          <span className={`font-mono text-xs ${dk ? 'text-slate-400' : 'text-slate-500'}`}>IST:</span>
          <span className={`text-sm font-mono font-bold px-2.5 py-0.5 rounded-md border ${dk ? 'bg-slate-950 text-emerald-400 border-slate-800' : 'bg-slate-100 text-emerald-600 border-slate-200'}`}>{currentISTTime}</span>
          <span className={`text-xs font-mono hidden md:inline ${dk ? 'text-slate-300' : 'text-slate-600'}`}>Hours: <strong>{formatTime12Hour(settings.collegeStartTime)} – {formatTime12Hour(settings.collegeEndTime)}</strong></span>
        </div>
        <div className={`flex items-center gap-3 font-mono text-xs ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-cyan-500" />{latencyMs}ms</span>
          <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-cyan-500" />{fps} FPS</span>
          <span className="flex items-center gap-1">
            <Brain className={`w-3.5 h-3.5 ${faceApiStatus === 'ready' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
            <span className={faceApiStatus === 'ready' ? 'text-emerald-400' : 'text-amber-400'}>{faceApiStatus === 'ready' ? 'CNN Ready' : 'Loading...'}</span>
          </span>
        </div>
      </div>

      {/* Model banner */}
      {faceApiStatus !== 'ready' && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono ${faceApiStatus === 'loading' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          <Brain className="w-3.5 h-3.5 animate-pulse" />
          <span>{faceApiStatus === 'loading' ? '⏳ Loading face recognition AI... (128-dim CNN, runs locally, no API key needed)' : `⚠ ${faceApiDetail}`}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left: Video + Controls */}
        <div className="lg:col-span-8 space-y-4">
          {/* Video container */}
          <div className="relative rounded-2xl bg-black border border-cyan-900/50 overflow-hidden shadow-2xl aspect-video w-full">
            <video ref={videoRef} autoPlay playsInline muted style={{ display: sampleImageActive ? 'none' : 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={overlayCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', display: sampleImageActive ? 'none' : 'block' }} />
            <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

            {sampleImageActive && (
              <div className="relative w-full h-full">
                <img src={sampleImageActive} alt="Test face" className="w-full h-full object-contain" />
                {liveFaces.map((face, i) => (
                  <div key={i} className={`absolute border-2 rounded ${face.faculty ? 'border-emerald-400' : 'border-amber-400'}`} style={{ left: face.box.x+'px', top: face.box.y+'px', width: face.box.width+'px', height: face.box.height+'px' }}>
                    <div className={`absolute -top-7 left-0 text-xs font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap ${face.faculty ? 'bg-slate-950/95 text-emerald-300 border border-emerald-400' : 'bg-amber-950/95 text-amber-200 border border-amber-400'}`}>{face.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* HUD corners */}
            {(cameraActive || sampleImageActive) && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-cyan-400/60" />
                <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-cyan-400/60" />
                <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-cyan-400/60" />
                <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-cyan-400/60" />
              </div>
            )}

            {/* Top status banner */}
            {(cameraActive || sampleImageActive) && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                {primaryFace?.faculty ? (
                  <div className="bg-slate-950/95 border border-emerald-400 px-4 py-1.5 rounded-full text-xs sm:text-sm font-mono text-emerald-300 flex items-center gap-2.5 whitespace-nowrap shadow-2xl">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-bold text-white">DETECTED: {primaryFace.faculty.name} ({primaryFace.faculty.staffId})</span>
                    <span className="text-slate-400 text-xs hidden sm:inline">· {primaryFace.faculty.department}</span>
                  </div>
                ) : primaryFace && facultyList.length > 0 ? (
                  <div className="bg-amber-950/90 border border-amber-500/80 px-4 py-1.5 rounded-full text-xs sm:text-sm font-mono text-amber-200 flex items-center gap-2.5 whitespace-nowrap shadow-2xl">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-bold">⚠️ UNKNOWN ({(primaryFace.similarity * 100).toFixed(1)}%) — NOT ENROLLED</span>
                    <button type="button" className="ml-1 px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] pointer-events-auto" onClick={onNavigateToEnroll}>Enroll</button>
                  </div>
                ) : (
                  <div className="bg-slate-950/85 border border-cyan-500/30 px-3.5 py-1.5 rounded-full text-xs font-mono text-cyan-300 flex items-center gap-2 whitespace-nowrap shadow-lg">
                    <span className={`w-2 h-2 rounded-full ${faceApiStatus === 'ready' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                    <span className="uppercase font-semibold">{faceApiStatus !== 'ready' ? 'LOADING AI...' : facultyList.length === 0 ? 'ENROLLMENT REQUIRED' : 'SCANNING — NO FACE IN FRAME'}</span>
                  </div>
                )}
              </div>
            )}

            {/* IST + face count */}
            {(cameraActive || sampleImageActive) && (
              <>
                <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
                  <div className="text-sm font-mono font-bold text-emerald-400 bg-slate-950/90 px-2.5 py-0.5 rounded border border-emerald-500/40">IST: {currentISTTime}</div>
                </div>
                <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
                  <div className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${liveFaces.length > 0 ? 'text-emerald-300 bg-slate-950/90 border-emerald-500/40' : 'text-slate-400 bg-slate-950/70 border-slate-700/40'}`}>
                    {liveFaces.length > 0 ? liveFaces.length + ' face' + (liveFaces.length !== 1 ? 's' : '') + ' detected' : 'No face in frame'}
                  </div>
                </div>
              </>
            )}

            {/* Capture flash */}
            {isAutoCapturing && (
              <div className="absolute inset-0 bg-cyan-400/20 z-30 flex items-center justify-center pointer-events-none">
                <div className="bg-slate-950/90 border border-cyan-400 rounded-xl px-5 py-3 text-center">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold font-mono text-sm"><Camera className="w-4 h-4 animate-bounce" /><span>LOGGING ATTENDANCE...</span></div>
                  <div className="text-xs font-mono text-emerald-400 mt-1">IST: {currentISTTime}</div>
                </div>
              </div>
            )}

            {/* No camera placeholder */}
            {!cameraActive && !sampleImageActive && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center p-6 max-w-md space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900/90 border border-cyan-800/40 flex items-center justify-center text-cyan-400"><Camera className="w-7 h-7" /></div>
                  <h3 className="text-sm font-semibold text-slate-200">Live Feed Inactive</h3>
                  <p className="text-xs text-slate-400">{cameraError || 'Click below to activate webcam for real-time face detection.'}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button onClick={startCamera} className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /><span>Start Webcam</span></button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700"><Upload className="w-3.5 h-3.5" /><span>Upload Test Face</span></button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-500 font-mono text-[10px] px-2 uppercase">Mode:</span>
                {(['AUTO','CHECK_IN','CHECK_OUT'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setScanMode(m)} className={`px-3 py-1 rounded-md font-medium text-xs transition-colors ${scanMode===m ? (m==='AUTO'?'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40':m==='CHECK_IN'?'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40':'bg-purple-500/20 text-purple-300 border border-purple-500/40'):'text-slate-400 hover:text-slate-200'}`}>{m==='AUTO'?'Smart Auto':m==='CHECK_IN'?'Check-In':'Check-Out'}</button>
                ))}
              </div>
              <button type="button" onClick={() => setAutoScanEnabled(!autoScanEnabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${autoScanEnabled ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                <Camera className={`w-3.5 h-3.5 ${autoScanEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} /><span>Auto Mark: {autoScanEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => triggerManual()} disabled={!cameraActive && !sampleImageActive} className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg shadow-lg transition-all min-h-[44px] ${scanMode==='CHECK_OUT'?'text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400':'text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300'} disabled:opacity-40 disabled:pointer-events-none`}><Camera className="w-4 h-4" /><span>📸 Capture & Verify</span></button>
                <button type="button" onClick={() => { setScanMode('CHECK_IN'); triggerManual('CHECK_IN'); }} disabled={!cameraActive && !sampleImageActive} className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 rounded-lg min-h-[44px]"><CheckCircle2 className="w-4 h-4" /><span>Check-In</span></button>
                <button type="button" onClick={() => { setScanMode('CHECK_OUT'); triggerManual('CHECK_OUT'); }} disabled={!cameraActive && !sampleImageActive} className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg min-h-[44px]"><LogOut className="w-4 h-4" /><span>Check-Out</span></button>
                {cameraActive ? <button onClick={stopCamera} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 min-h-[44px]"><Square className="w-3.5 h-3.5 text-rose-400" /><span>Pause</span></button>
                  : <button onClick={startCamera} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 min-h-[44px]"><Play className="w-3.5 h-3.5 text-emerald-400" /><span>Start</span></button>}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg min-h-[44px]"><Upload className="w-3.5 h-3.5 text-cyan-400" /><span className="hidden sm:inline">Upload</span></button>
                <button onClick={onOpenSettings} className="p-2.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg min-h-[44px]"><Sliders className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* Faculty cards */}
          <div className={`border rounded-xl p-4 space-y-3 ${dk ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className={`font-semibold flex items-center gap-1.5 ${dk ? 'text-slate-200' : 'text-slate-800'}`}><Users className="w-4 h-4 text-cyan-500" /><span>Enrolled Faculty ({facultyList.length})</span></span>
              <div className="flex items-center gap-2">
                {facultyList.length > 6 && <input type="text" placeholder="Search..." value={facultyFilterQuery} onChange={(e) => setFacultyFilterQuery(e.target.value)} className={`px-2.5 py-1 text-xs rounded-lg border focus:outline-none focus:border-cyan-500 w-36 ${dk?'bg-slate-950 border-slate-700 text-slate-100':'bg-slate-50 border-slate-300 text-slate-900'}`} />}
                <button onClick={onNavigateToEnroll} className="text-cyan-500 hover:text-cyan-400 flex items-center gap-1 text-[11px] font-medium"><UserPlus className="w-3.5 h-3.5" /><span>+ Enroll</span></button>
              </div>
            </div>
            {facultyList.length === 0 ? (
              <div className={`p-5 rounded-xl border border-dashed text-center space-y-2 ${dk?'bg-slate-950/70 border-slate-800':'bg-slate-50 border-slate-200'}`}>
                <Info className="w-5 h-5 text-cyan-500 mx-auto" />
                <p className={`text-xs font-medium ${dk?'text-slate-300':'text-slate-700'}`}>No faculty enrolled yet.</p>
                <p className={`text-[11px] ${dk?'text-slate-500':'text-slate-400'}`}>Enroll faculty with face photo to enable real-time recognition.</p>
                <button onClick={onNavigateToEnroll} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg mt-1"><UserPlus className="w-3.5 h-3.5" /><span>Open Enrollment</span></button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                <button type="button" onClick={() => { if (!cameraActive) startCamera(); }} className={`p-2 rounded-lg border text-left ${!sampleImageActive?'bg-cyan-500/20 border-cyan-400 text-cyan-200':dk?'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800':'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-cyan-500"><Camera className="w-3.5 h-3.5 animate-pulse" /><span>Auto-Detect</span></div>
                  <div className={`text-[10px] ${dk?'text-slate-400':'text-slate-500'}`}>Live CNN</div>
                </button>
                {facultyList
                  .filter((f) => !facultyFilterQuery.trim() || f.name.toLowerCase().includes(facultyFilterQuery.toLowerCase()) || f.staffId.toLowerCase().includes(facultyFilterQuery.toLowerCase()))
                  .map((f) => {
                    const isMarked = checkAlreadyMarkedToday(f.id, attendanceRecords) !== null;
                    return (
                      <button key={f.id} onClick={() => { if (!cameraActive) setSampleImageActive(f.photoUrl); }} className={`relative p-2 rounded-lg border text-left ${dk?'bg-slate-900 hover:bg-slate-800 border-slate-800':'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-1.5"><img src={f.photoUrl} alt={f.name} className="w-7 h-7 rounded-full object-cover border border-cyan-400/40" /><span className="text-[10px] font-mono text-cyan-400 font-bold truncate">{f.staffId}</span></div>
                        <div className={`text-[11px] font-medium truncate ${dk?'text-slate-200':'text-slate-800'}`}>{f.name}</div>
                        <div className={`text-[9px] truncate ${dk?'text-slate-400':'text-slate-500'}`}>{f.department.split('&')[0]}</div>
                        {isMarked && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400" title="Marked today" />}
                        {f.faceDescriptor ? <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400" title="CNN enrolled" /> : <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" title="Re-enroll needed" />}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {lastCapturedSnapshot && (
            <div className={`border rounded-xl p-4 space-y-2.5 ${dk?'bg-slate-900/90 border-emerald-500/40':'bg-white border-emerald-500/40'}`}>
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5"><Camera className="w-4 h-4" /><span>Last Captured</span></span><span className="text-sm font-mono font-bold text-emerald-400">{lastCapturedTime} IST</span></div>
              <div className="relative rounded-lg overflow-hidden border border-slate-700/60 aspect-video bg-black"><img src={lastCapturedSnapshot} alt="" className="w-full h-full object-cover" /><div className="absolute bottom-1 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300">LIVE SNAPSHOT</div></div>
            </div>
          )}

          <div className={`border rounded-xl p-4 space-y-3 ${dk?'bg-slate-900/80 border-slate-800':'bg-white border-slate-200 shadow-sm'}`}>
            <h4 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${dk?'text-slate-200':'text-slate-800'}`}><Eye className="w-4 h-4 text-cyan-500" /><span>Live Detection Feed</span></h4>
            {liveFaces.length === 0 ? (
              <div className={`p-4 rounded-lg border border-dashed text-center text-xs ${dk?'bg-slate-950/60 border-slate-800 text-slate-500':'bg-slate-50 border-slate-200 text-slate-400'}`}><Camera className="w-5 h-5 mx-auto mb-1 opacity-40" />{faceApiStatus === 'ready' ? 'No faces in frame' : 'Loading AI model...'}</div>
            ) : (
              <div className="space-y-2">
                {liveFaces.map((face, i) => (
                  <div key={i} className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${face.faculty?'bg-emerald-500/10 border-emerald-500/40':'bg-amber-500/10 border-amber-500/40'}`}>
                    <div className="flex items-center gap-2">
                      {face.faculty?.photoUrl ? <img src={face.faculty.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-emerald-400/60 shrink-0" /> : <div className="w-8 h-8 rounded-full bg-amber-900/50 border-2 border-amber-400/60 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-amber-400" /></div>}
                      <div><div className={`font-bold ${face.faculty?'text-emerald-300':'text-amber-300'}`}>{face.faculty?.name || 'UNKNOWN'}</div>{face.faculty && <div className="text-[10px] font-mono text-cyan-400">{face.faculty.staffId}</div>}</div>
                    </div>
                    <div className="text-right shrink-0"><div className={`font-mono font-bold text-sm ${face.faculty?'text-emerald-400':'text-amber-400'}`}>{(face.similarity*100).toFixed(1)}%</div><div className="text-[9px] text-slate-400">CNN</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`border rounded-xl p-4 space-y-3 ${dk?'bg-slate-900/80 border-slate-800':'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <h4 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${dk?'text-slate-200':'text-slate-800'}`}><ShieldCheck className="w-4 h-4 text-cyan-500" /><span>Last Result</span></h4>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">min {(settings.buffaloThreshold*100).toFixed(0)}%</span>
            </div>
            {lastResult ? (
              <div className={`p-3 rounded-lg border text-xs font-mono ${lastResult.confirmed?'bg-emerald-500/15 border-emerald-500/40 text-emerald-200':'bg-amber-500/15 border-amber-500/40 text-amber-200'}`}>
                <div className="flex items-center gap-2 font-bold mb-1">{lastResult.confirmed?<CheckCircle2 className="w-4 h-4 text-emerald-500"/>:<AlertTriangle className="w-4 h-4 text-amber-500"/>}<span>{lastResult.confirmed?'MATCH: '+lastResult.faculty?.name:'UNKNOWN / NOT MATCHED'}</span></div>
                <p className="text-[11px] text-slate-300">Score: {(lastResult.similarity*100).toFixed(1)}%</p>
              </div>
            ) : <div className={`p-3 rounded-lg text-xs text-center ${dk?'text-slate-500 bg-slate-950/40':'text-slate-400 bg-slate-50'}`}>Manual capture result here</div>}
          </div>

          <div className={`border rounded-xl p-4 space-y-3 ${dk?'bg-slate-900/80 border-slate-800':'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <h4 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${dk?'text-slate-200':'text-slate-800'}`}><Clock className="w-4 h-4 text-cyan-500" /><span>Today ({todayIST})</span></h4>
              <span className="text-xs font-mono text-cyan-400 font-bold">{markedCount} Logged</span>
            </div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {todayRecords.length === 0 ? (
                <div className={`text-center py-8 text-xs ${dk?'text-slate-500':'text-slate-400'}`}>No attendance logged for today ({todayIST}).</div>
              ) : todayRecords.slice(0, 8).map((rec) => (
                <div key={rec.id} className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${dk?'bg-slate-950/60 border-slate-800/80':'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={rec.capturedFrameThumb || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} alt="" className="w-8 h-8 rounded-full object-cover border border-cyan-500/30 shrink-0" />
                    <div className="min-w-0"><div className={`font-semibold truncate ${dk?'text-slate-200':'text-slate-900'}`}>{rec.facultyName}</div><div className="text-[10px] font-mono text-cyan-400 font-bold">{rec.staffId}</div></div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-bold text-emerald-400">{rec.checkInTime || rec.formattedTime}</div>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${rec.status==='PRESENT'?'bg-emerald-500/10 text-emerald-300 border-emerald-500/20':'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{rec.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {verificationModal.show && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 ${dk?'bg-slate-900 border-cyan-500/30':'bg-white border-slate-200'}`}>
            {verificationModal.alreadyMarked ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-500"><AlertTriangle className="w-6 h-6" /></div>
                <div className="text-center"><span className="text-[10px] font-mono uppercase text-amber-500 font-bold">Already Marked</span><h3 className={`text-base font-bold mt-1 ${dk?'text-slate-100':'text-slate-900'}`}>Attendance Already Recorded Today</h3></div>
                <div className={`p-4 rounded-xl border ${dk?'bg-slate-950 border-slate-800':'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-3"><img src={verificationModal.faculty?.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/60" /><div><div className={`font-bold text-sm ${dk?'text-slate-200':'text-slate-900'}`}>{verificationModal.faculty?.name}</div><div className="text-xs font-mono text-cyan-400">{verificationModal.faculty?.staffId}</div></div></div>
                  <div className="flex justify-between text-xs font-mono pt-3 border-t border-slate-700/60 mt-3"><span className="text-slate-500">Recorded at:</span><span className="font-bold text-amber-500">{verificationModal.existingRecord?.checkInTime || 'Earlier'} IST</span></div>
                </div>
                <button onClick={() => setVerificationModal({ ...verificationModal, show: false })} className="w-full py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg min-h-[44px]">Dismiss ({modalCountdown}s)</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${verificationModal.record?.checkOutTime?'bg-purple-500/15 border border-purple-500/40 text-purple-400':'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'}`}><CheckCircle2 className="w-6 h-6" /></div>
                <div className="text-center"><span className={`text-[10px] font-mono uppercase font-bold ${verificationModal.record?.checkOutTime?'text-purple-400':'text-emerald-500'}`}>{verificationModal.record?.checkOutTime?'Check-Out Recorded':'Attendance Logged (IST)'}</span><h3 className={`text-base font-bold mt-1 ${dk?'text-slate-100':'text-slate-900'}`}>{verificationModal.faculty?.name}</h3></div>
                <div className={`p-4 rounded-xl border space-y-3 ${dk?'bg-slate-950 border-slate-800':'bg-slate-50 border-slate-200'}`}>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div><div className="text-[10px] font-mono text-emerald-500 uppercase font-bold flex items-center justify-center gap-1 mb-1"><Camera className="w-3 h-3" /><span>Live Capture</span></div><div className="aspect-square rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-black"><img src={verificationModal.capturedImage || verificationModal.faculty?.photoUrl} alt="" className="w-full h-full object-cover" /></div></div>
                    <div><div className="text-[10px] font-mono text-cyan-500 uppercase font-bold flex items-center justify-center gap-1 mb-1"><UserCheck className="w-3 h-3" /><span>Enrolled</span></div><div className="aspect-square rounded-xl overflow-hidden border-2 border-cyan-500/60 bg-black"><img src={verificationModal.faculty?.photoUrl} alt="" className="w-full h-full object-cover" /></div></div>
                  </div>
                  <div className="pt-2 border-t border-slate-700/60 text-xs font-mono space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-500">Check-In:</span><span className="font-bold text-emerald-400">{verificationModal.record?.checkInTime || verificationModal.record?.formattedTime} IST</span></div>
                    {verificationModal.record?.checkOutTime && <div className="flex justify-between"><span className="text-slate-500">Check-Out:</span><span className="font-bold text-purple-400">{verificationModal.record.checkOutTime} IST</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">CNN Score:</span><span className="font-bold text-cyan-400">{((verificationModal.similarity||0)*100).toFixed(1)}%</span></div>
                  </div>
                </div>
                <button onClick={() => setVerificationModal({ ...verificationModal, show: false })} className="w-full py-2.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 rounded-lg min-h-[44px]">Continue Scanning ({modalCountdown}s)</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
