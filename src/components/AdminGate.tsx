import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Key, ArrowRight, Eye, EyeOff, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { getISTTimeString } from '../services/biometricEngine';

interface AdminGateProps {
  onUnlock: (verifiedKey: string) => void;
}

export const AdminGate: React.FC<AdminGateProps> = ({ onUnlock }) => {
  const [keyInput, setKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [istTime, setIstTime] = useState<string>(getISTTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setIstTime(getISTTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = keyInput.trim();

    if (!cleanKey) {
      setErrorMsg('Please enter the admin key to unlock the system.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: cleanKey, admin_key: cleanKey }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.valid) {
        onUnlock(cleanKey);
      } else {
        setErrorMsg('Access Denied: Invalid Admin Key. Please verify the admin_key setting in your .env file.');
      }
    } catch {
      // Offline fallback: if default key matches
      if (cleanKey === 'admin123') {
        onUnlock(cleanKey);
      } else {
        setErrorMsg('Verification failed. Invalid Admin Key.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 bg-cyber-dots relative selection:bg-cyan-500 selection:text-black">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Lock Card */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/50 space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <img
              src="/logo.png"
              alt="ADIC Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain shadow-xl border border-cyan-400/40 p-1.5 bg-slate-950/80"
            />
          </div>

          <div className="space-y-0.5">
            <h1
              style={{ fontFamily: "'Orbitron', sans-serif" }}
              className="text-lg sm:text-xl font-bold tracking-wider text-slate-100"
            >
              ADIC <span className="text-cyan-400">FACE APP</span>
            </h1>
            <p className="text-xs text-cyan-400/90 font-mono uppercase tracking-wider">
              Faculty Biometric Attendance System
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-cyan-500/30 text-sm sm:text-base font-mono font-bold text-emerald-400 shadow-sm">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>IST: {istTime}</span>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-cyan-300 font-mono text-[11px]">
            <Lock className="w-3.5 h-3.5" />
            <span>ADMINISTRATIVE PORTAL GATEWAY</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            System access is restricted. Please enter the authorized <strong>admin_key</strong> configured in your project's <code>.env</code> file to enter.
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-medium text-slate-300">
              Admin Key <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Key className="w-4 h-4 text-cyan-400" />
              </div>
              <input
                type={showKey ? 'text' : 'password'}
                autoFocus
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Enter admin key from .env (e.g. admin123)..."
                className="w-full pl-9 pr-10 py-3 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono transition-all min-h-[46px]"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading || !keyInput.trim()}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-cyan-400/25 flex items-center justify-center gap-2 min-h-[46px]"
            >
              {isLoading ? (
                <span>Verifying Security Key...</span>
              ) : (
                <>
                  <span>Unlock & Open System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Hint */}
        <div className="pt-2 border-t border-slate-800/80 text-center">
          <p className="text-[11px] font-mono text-slate-500">
            Default key from .env: <span className="text-cyan-400 font-bold">admin123</span>
          </p>
        </div>
      </div>

      {/* Subtle system specs */}
      <div className="mt-6 text-center text-[11px] font-mono text-slate-600">
        <span>YOLO11 Face Localization · Buffalo Embedding 512-dim · IST Synchronized</span>
      </div>
    </div>
  );
};
