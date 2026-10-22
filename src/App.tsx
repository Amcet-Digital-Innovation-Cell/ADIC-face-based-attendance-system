import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { LiveScanner } from './components/LiveScanner';
import { AttendanceManagement } from './components/AttendanceManagement';
import { FacultyEnrollment } from './components/FacultyEnrollment';
import { BiometricDashboard } from './components/BiometricDashboard';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { AdminGate } from './components/AdminGate';
import { Sliders, X, Lock, AlertTriangle } from 'lucide-react';
import { Faculty, AttendanceRecord, SystemSettings } from './types/biometric';
import { 
  loadFacultyFromStorage, saveFacultyToStorage, 
  loadAttendanceFromStorage, saveAttendanceToStorage, 
  loadSettingsFromStorage, saveSettingsToStorage, 
  INITIAL_FACULTY, DEFAULT_SETTINGS, getISTDateString 
} from './services/biometricEngine';
import { biometricAudio } from './services/audioEffects';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('adic_admin_auth') === 'true' || sessionStorage.getItem('aetherface_admin_auth') === 'true';
  });

  const [activeTab, setActiveTab] = useState<'scanner' | 'attendance' | 'faculty' | 'dashboard'>('scanner');
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Timing / Settings Admin Key gate (strictly not autofilled)
  const [isTimingAuthOpen, setIsTimingAuthOpen] = useState<boolean>(false);
  const [timingAdminKey, setTimingAdminKey] = useState<string>('');
  const [timingAuthError, setTimingAuthError] = useState<string | null>(null);
  const [isVerifyingTimingKey, setIsVerifyingTimingKey] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('adic_theme') as 'dark' | 'light') || 
           (localStorage.getItem('aetherface_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('adic_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Load data on startup from server API with local storage fallback
  const fetchFaculty = async () => {
    try {
      const res = await fetch('/api/faculty');
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          setFacultyList(data.data);
          saveFacultyToStorage(data.data);
          return;
        }
      }
    } catch {
      // Fallback
    }
    const local = loadFacultyFromStorage();
    setFacultyList(local);
    saveFacultyToStorage(local);
  };

  const fetchAttendance = async () => {
    try {
      const res = await fetch('/api/attendance');
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          setAttendanceRecords(data.data);
          saveAttendanceToStorage(data.data);
          return;
        }
      }
    } catch {
      // Fallback
    }
    const local = loadAttendanceFromStorage();
    setAttendanceRecords(local);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setSettings(data.data);
          saveSettingsToStorage(data.data);
          return;
        }
      }
    } catch {
      // Fallback
    }
    const local = loadSettingsFromStorage();
    setSettings(local);
  };

  useEffect(() => {
    fetchFaculty();
    fetchAttendance();
    fetchSettings();
  }, []);

  // Unlock system after admin key verification
  const handleUnlock = (verifiedKey: string) => {
    sessionStorage.setItem('adic_admin_auth', 'true');
    sessionStorage.setItem('adic_admin_key', verifiedKey);
    setIsAuthenticated(true);
    biometricAudio.playSuccessChime();
  };

  // Lock system back to security gate
  const handleLockSystem = () => {
    sessionStorage.removeItem('adic_admin_auth');
    sessionStorage.removeItem('aetherface_admin_auth');
    setIsAuthenticated(false);
  };

  // Sync mute with biometric audio system
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    biometricAudio.setMuted(nextMuted);
  };

  // Add faculty handler
  const handleFacultyAdded = async (newFaculty: Faculty) => {
    try {
      await fetch('/api/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFaculty),
      });
    } catch {
      // Local fallback
    }
    const updated = [newFaculty, ...facultyList];
    setFacultyList(updated);
    saveFacultyToStorage(updated);
  };

  // Edit faculty handler with Admin Key authorization from .env
  const handleFacultyUpdated = async (
    updatedFaculty: Faculty,
    adminKey: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedKey = adminKey.trim();
      const res = await fetch(`/api/faculty/${encodeURIComponent(updatedFaculty.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': trimmedKey,
        },
        body: JSON.stringify({ ...updatedFaculty, adminKey: trimmedKey, admin_key: trimmedKey }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to update faculty details. Invalid Admin Key.',
        };
      }

      const updated = facultyList.map((f) =>
        f.id === updatedFaculty.id || f.staffId === updatedFaculty.staffId ? updatedFaculty : f
      );
      setFacultyList(updated);
      saveFacultyToStorage(updated);

      // Keep attendance logs in sync if name/staffId changed
      setAttendanceRecords((prev) => {
        const synced = prev.map((r) => {
          if (r.facultyId === updatedFaculty.id || r.staffId === updatedFaculty.staffId) {
            return {
              ...r,
              facultyName: updatedFaculty.name,
              staffId: updatedFaculty.staffId,
              department: updatedFaculty.department,
            };
          }
          return r;
        });
        saveAttendanceToStorage(synced);
        return synced;
      });

      biometricAudio.playSuccessChime();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server error updating faculty details.' };
    }
  };

  // Delete faculty handler with Admin Key authorization from .env
  const handleFacultyDeleted = async (id: string, adminKey: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedKey = adminKey.trim();
      const res = await fetch(`/api/faculty/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': trimmedKey,
        },
        body: JSON.stringify({ adminKey: trimmedKey, admin_key: trimmedKey }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Authentication failed. Invalid Admin Key. Please verify admin_key in your .env file.',
        };
      }

      const cleanId = String(id).toLowerCase();
      const updated = facultyList.filter(
        (f) => String(f.id).toLowerCase() !== cleanId && String(f.staffId).toLowerCase() !== cleanId
      );
      setFacultyList(updated);
      saveFacultyToStorage(updated);
      biometricAudio.playSuccessChime();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server error verifying admin key.' };
    }
  };

  // Attendance marked handler
  const handleAttendanceMarked = (newRecord: AttendanceRecord) => {
    setAttendanceRecords((prev) => {
      // If record already exists for faculty on date, replace with new check-out or updated record
      const index = prev.findIndex((r) => r.facultyId === newRecord.facultyId && r.date === newRecord.date);
      if (index !== -1) {
        const copy = [...prev];
        copy[index] = newRecord;
        saveAttendanceToStorage(copy);
        return copy;
      }
      const updated = [newRecord, ...prev];
      saveAttendanceToStorage(updated);
      return updated;
    });
  };

  // Manual mark override for faculty
  const handleManualMark = async (faculty: Faculty) => {
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId: faculty.id,
          similarityScore: 0.99,
          detectionConfidence: 1.0,
          deviceSource: 'WEB_KIOSK',
          verificationMethod: 'MANUAL_OVERRIDE',
          mode: 'AUTO',
        }),
      });
      const data = await res.json();
      if (data.record) {
        handleAttendanceMarked(data.record);
        biometricAudio.playSuccessChime();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Explicit Check-Out handler
  const handleCheckOut = async (recordId: string, facultyId: string) => {
    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, facultyId }),
      });
      const data = await res.json();
      if (data.record) {
        handleAttendanceMarked(data.record);
        biometricAudio.playSuccessChime();
      }
    } catch (err) {
      console.error('Error during check-out:', err);
    }
  };

  // Save settings handler
  const handleSaveSettings = async (updated: SystemSettings) => {
    setSettings(updated);
    saveSettingsToStorage(updated);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {
      // Ignore
    }
  };

  // Timings Admin Key Gate handlers (never autofilled, verified via API)
  const handleRequestOpenSettings = () => {
    setTimingAdminKey('');
    setTimingAuthError(null);
    setIsTimingAuthOpen(true);
  };

  const handleCloseTimingAuth = () => {
    setIsTimingAuthOpen(false);
    setTimingAdminKey('');
    setTimingAuthError(null);
  };

  const handleVerifyTimingAdminKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = timingAdminKey.trim();
    if (!cleanKey) {
      setTimingAuthError('Admin key is required to configure timings.');
      return;
    }

    setIsVerifyingTimingKey(true);
    setTimingAuthError(null);

    try {
      const res = await fetch('/api/admin/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: cleanKey, admin_key: cleanKey }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.valid) {
        setIsTimingAuthOpen(false);
        setTimingAdminKey('');
        setTimingAuthError(null);
        setIsSettingsOpen(true);
      } else {
        setTimingAuthError('Access Denied: Invalid Admin Key. Please check the admin_key in your .env file.');
      }
    } catch {
      // Offline fallback: check default key or session auth key
      const sessionKey = sessionStorage.getItem('adic_admin_key');
      if (cleanKey === 'admin123' || (sessionKey && cleanKey === sessionKey)) {
        setIsTimingAuthOpen(false);
        setTimingAdminKey('');
        setTimingAuthError(null);
        setIsSettingsOpen(true);
      } else {
        setTimingAuthError('Verification failed. Invalid Admin Key.');
      }
    } finally {
      setIsVerifyingTimingKey(false);
    }
  };

  // If system is locked, render the Admin Gate screen
  if (!isAuthenticated) {
    return <AdminGate onUnlock={handleUnlock} />;
  }

  const todayIST = getISTDateString();
  const presentTodayCount = attendanceRecords.filter((r) => r.date === todayIST).length;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 overflow-x-hidden w-full max-w-full ${
      theme === 'dark' 
        ? 'bg-slate-950 text-slate-100 bg-cyber-dots selection:bg-cyan-500 selection:text-black' 
        : 'bg-slate-50 text-slate-900 selection:bg-cyan-500 selection:text-white'
    }`}>
      {/* Top Bar Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={handleRequestOpenSettings}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        enrolledCount={facultyList.length}
        presentTodayCount={presentTodayCount}
        settings={settings}
        onLockSystem={handleLockSystem}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {activeTab === 'scanner' && (
          <LiveScanner
            facultyList={facultyList}
            attendanceRecords={attendanceRecords}
            onAttendanceMarked={handleAttendanceMarked}
            settings={settings}
            onOpenSettings={handleRequestOpenSettings}
            onNavigateToEnroll={() => setActiveTab('faculty')}
            theme={theme}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceManagement
            attendanceRecords={attendanceRecords}
            facultyList={facultyList}
            onRefresh={fetchAttendance}
            onManualMark={handleManualMark}
            onCheckOut={handleCheckOut}
            theme={theme}
          />
        )}

        {activeTab === 'faculty' && (
          <FacultyEnrollment
            facultyList={facultyList}
            onFacultyAdded={handleFacultyAdded}
            onFacultyDeleted={handleFacultyDeleted}
            onFacultyUpdated={handleFacultyUpdated}
            settings={settings}
            theme={theme}
          />
        )}

        {activeTab === 'dashboard' && (
          <BiometricDashboard
            facultyList={facultyList}
            attendanceRecords={attendanceRecords}
            settings={settings}
            theme={theme}
          />
        )}
      </main>

      {/* Futuristic Footer */}
      <footer className={`border-t px-4 lg:px-8 py-4 text-xs font-mono mt-auto transition-colors ${
        theme === 'dark'
          ? 'border-slate-900 bg-slate-950/80 text-slate-500'
          : 'border-slate-200 bg-white text-slate-600 shadow-inner'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-semibold'}>ADIC Face App Neural Biometric System v2.4</span>
            <span className={theme === 'dark' ? 'text-slate-700' : 'text-slate-300'}>·</span>
            <span>Wider Face YOLO11 + Buffalo_l ONNX Architecture</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>attendance.db Locked (Single Mark/Day)</span>
            <span className={theme === 'dark' ? 'text-slate-700' : 'text-slate-300'}>·</span>
            <span>Check-In & Check-Out Enabled</span>
            <span className={theme === 'dark' ? 'text-slate-700' : 'text-slate-300'}>·</span>
            <span>Hugging Face & Raspberry Pi Ready</span>
          </div>
        </div>
      </footer>

      {/* Timings Admin Key Verification Modal */}
      {isTimingAuthOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-2xl p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Admin Authorization Required</h3>
                  <p className="text-[11px] text-slate-400">Enter Admin Key to configure College Timings & Rules</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseTimingAuth}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyTimingAdminKey} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                  Admin Key (.env: <code className="text-cyan-400">admin_key</code>)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    value={timingAdminKey}
                    onChange={(e) => {
                      setTimingAdminKey(e.target.value);
                      if (timingAuthError) setTimingAuthError(null);
                    }}
                    placeholder="Enter admin key..."
                    autoComplete="new-password"
                    autoFocus
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 outline-none transition-all"
                  />
                </div>
              </div>

              {timingAuthError && (
                <div className="text-xs text-rose-400 flex items-center gap-2 p-2.5 bg-rose-950/40 border border-rose-800/40 rounded-xl font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{timingAuthError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseTimingAuth}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingTimingKey}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isVerifyingTimingKey ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Unlock Timings</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* System Settings Modal */}
      <SystemSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
