import React, { useState, useEffect } from 'react';
import { Camera, ClipboardCheck, Users, BarChart3, Sliders, Volume2, VolumeX, Menu, X, Clock, Lock, Sun, Moon } from 'lucide-react';
import { getISTTimeString, formatTime12Hour } from '../services/biometricEngine';
import { SystemSettings } from '../types/biometric';

interface NavigationProps {
  activeTab: 'scanner' | 'attendance' | 'faculty' | 'dashboard';
  setActiveTab: (tab: 'scanner' | 'attendance' | 'faculty' | 'dashboard') => void;
  onOpenSettings: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  enrolledCount: number;
  presentTodayCount: number;
  settings: SystemSettings;
  onLockSystem?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  isMuted,
  onToggleMute,
  enrolledCount,
  presentTodayCount,
  settings,
  onLockSystem,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [currentISTTime, setCurrentISTTime] = useState<string>(getISTTimeString());

  // Real-time live IST clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentISTTime(getISTTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTabClick = (tab: 'scanner' | 'attendance' | 'faculty' | 'dashboard') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors w-full ${
      theme === 'dark'
        ? 'bg-slate-950/90 border-cyan-950/60 text-slate-100'
        : 'bg-white/95 border-slate-200 text-slate-900 shadow-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Zone 1: Brand Wordmark (Always anchored to the left, never squeezed) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img
            src="/logo.png"
            alt="ADIC Logo"
            className="w-8 h-8 rounded-lg object-contain shadow-md border border-cyan-400/30 bg-slate-950/80 p-0.5 shrink-0"
          />

          <div className="flex items-center gap-2">
            <span
              style={{ fontFamily: "'Orbitron', sans-serif" }}
              className={`text-sm sm:text-base font-bold tracking-wider whitespace-nowrap ${
                theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              ADIC <span className="text-cyan-500">FACE APP</span>
            </span>

            {/* Subtle live clock pill on wide screens */}
            <div className={`hidden 2xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-mono font-bold tracking-tight ${
              theme === 'dark' 
                ? 'bg-slate-900/90 border-slate-800 text-emerald-400' 
                : 'bg-slate-100 border-slate-200 text-emerald-600'
            }`}>
              <Clock className="w-3.5 h-3.5 text-cyan-500" />
              <span>{currentISTTime} IST</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Centered, visible on md: screens and above) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 mx-auto">
          <button
            onClick={() => handleTabClick('scanner')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'scanner'
                ? theme === 'dark'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'bg-cyan-50 text-cyan-800 border border-cyan-300 shadow-sm font-semibold'
                : theme === 'dark'
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-cyan-500" />
            <span>Live Scanner</span>
          </button>

          <button
            onClick={() => handleTabClick('attendance')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'attendance'
                ? theme === 'dark'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'bg-cyan-50 text-cyan-800 border border-cyan-300 shadow-sm font-semibold'
                : theme === 'dark'
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span>Attendance</span>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 ml-0.5">({presentTodayCount})</span>
          </button>

          <button
            onClick={() => handleTabClick('faculty')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'faculty'
                ? theme === 'dark'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'bg-cyan-50 text-cyan-800 border border-cyan-300 shadow-sm font-semibold'
                : theme === 'dark'
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-cyan-500" />
            <span>Faculty DB</span>
            <span className={`text-[10px] font-mono ml-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>({enrolledCount})</span>
          </button>

          <button
            onClick={() => handleTabClick('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? theme === 'dark'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'bg-cyan-50 text-cyan-800 border border-cyan-300 shadow-sm font-semibold'
                : theme === 'dark'
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-500" />
            <span>Analytics</span>
          </button>
        </nav>

        {/* Zone 3: Utility Actions (Right-Anchored, clean and responsive) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live IST clock badge on laptops / desktop */}
          <div className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold tracking-tight shrink-0 ${
            theme === 'dark' 
              ? 'bg-slate-900/80 border-slate-800 text-emerald-400' 
              : 'bg-slate-100 border-slate-200 text-emerald-600'
          }`}>
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
            <span>{currentISTTime} IST</span>
          </div>

          {/* Dark / Light Mode Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className={`p-1.5 sm:p-2 rounded-lg border transition-colors shrink-0 ${
                theme === 'dark'
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 bg-white'
              }`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
          )}

          {/* Audio Sound Toggle */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className={`p-1.5 sm:p-2 rounded-lg border transition-colors shrink-0 ${
              theme === 'dark'
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 bg-white'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-cyan-500" />}
          </button>

          {/* College Timings Settings */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              theme === 'dark'
                ? 'text-slate-200 bg-slate-900 hover:bg-slate-800 border-slate-700/80'
                : 'text-slate-700 bg-white hover:bg-slate-50 border-slate-300 shadow-sm'
            }`}
            title="Configure College Timings & Thresholds"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-500" />
            <span className="hidden lg:inline">Timings</span>
          </button>

          {/* Lock System Button - ALWAYS clearly visible on all screens */}
          {onLockSystem && (
            <button
              onClick={onLockSystem}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold border rounded-lg transition-all shrink-0 shadow-sm ${
                theme === 'dark'
                  ? 'text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border-rose-500/50 hover:border-rose-400'
                  : 'text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border-rose-300'
              }`}
              title="Lock System (Admin Key required to re-open)"
              aria-label="Lock System"
            >
              <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="hidden sm:inline">Lock System</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button (Visible on screens < md) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-1.5 sm:p-2 rounded-lg border shrink-0 ${
              theme === 'dark' ? 'text-slate-300 bg-slate-900 border-slate-800' : 'text-slate-700 bg-white border-slate-200'
            }`}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 text-rose-400" /> : <Menu className="w-4 h-4 text-cyan-500" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Drawer (for screens < md) */}
      {mobileMenuOpen && (
        <div className={`md:hidden px-3 sm:px-5 pb-3 pt-2 border-t space-y-1.5 animate-in slide-in-from-top-2 duration-150 ${
          theme === 'dark' ? 'border-slate-800/80 bg-slate-950/95' : 'border-slate-200 bg-white/95'
        }`}>
          <div className={`px-3 py-1.5 text-xs font-mono rounded-lg mb-2 flex items-center justify-between border ${
            theme === 'dark' ? 'text-slate-400 bg-slate-900/60 border-slate-800' : 'text-slate-600 bg-slate-100 border-slate-200'
          }`}>
            <span>IST Time: <strong className="text-emerald-500">{currentISTTime}</strong></span>
            <span>Late after: <strong className="text-amber-500">{formatTime12Hour(settings.lateThresholdTime)}</strong></span>
          </div>

          <button
            onClick={() => handleTabClick('scanner')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
              activeTab === 'scanner'
                ? theme === 'dark'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-cyan-50 text-cyan-800 border-cyan-300 font-semibold'
                : theme === 'dark'
                ? 'text-slate-300 hover:bg-slate-900 border-transparent'
                : 'text-slate-700 hover:bg-slate-100 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-cyan-500" />
              <span>Live Biometric Scanner</span>
            </div>
          </button>

          <button
            onClick={() => handleTabClick('attendance')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
              activeTab === 'attendance'
                ? theme === 'dark'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-cyan-50 text-cyan-800 border-cyan-300 font-semibold'
                : theme === 'dark'
                ? 'text-slate-300 hover:bg-slate-900 border-transparent'
                : 'text-slate-700 hover:bg-slate-100 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="w-4 h-4 text-cyan-500" />
              <span>Attendance Register</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-500 font-bold">({presentTodayCount} today)</span>
          </button>

          <button
            onClick={() => handleTabClick('faculty')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
              activeTab === 'faculty'
                ? theme === 'dark'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-cyan-50 text-cyan-800 border-cyan-300 font-semibold'
                : theme === 'dark'
                ? 'text-slate-300 hover:bg-slate-900 border-transparent'
                : 'text-slate-700 hover:bg-slate-100 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-cyan-500" />
              <span>Faculty Directory</span>
            </div>
            <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>({enrolledCount} enrolled)</span>
          </button>

          <button
            onClick={() => handleTabClick('dashboard')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
              activeTab === 'dashboard'
                ? theme === 'dark'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-cyan-50 text-cyan-800 border-cyan-300 font-semibold'
                : theme === 'dark'
                ? 'text-slate-300 hover:bg-slate-900 border-transparent'
                : 'text-slate-700 hover:bg-slate-100 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-cyan-500" />
              <span>Biometric Analytics</span>
            </div>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenSettings();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
              theme === 'dark'
                ? 'text-slate-300 hover:bg-slate-900 border-slate-800'
                : 'text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-cyan-500" />
              <span>College Timings & Thresholds</span>
            </div>
          </button>

          {onLockSystem && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLockSystem();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-rose-400" />
                <span>Lock System (Requires Admin Key)</span>
              </div>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
