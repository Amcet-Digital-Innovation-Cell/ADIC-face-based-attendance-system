import React, { useState, useMemo } from 'react';
import { 
  BarChart3, CheckCircle2, Clock, Users, ShieldAlert, 
  Activity, ArrowUpRight, TrendingUp, Cpu, Server, Database,
  Calendar, CalendarDays, BarChart2, Shield, UserCheck
} from 'lucide-react';
import { Faculty, AttendanceRecord, SystemSettings, AttendancePeriod, PeriodSummary } from '../types/biometric';
import { 
  getISTDateString, getISTTimeString, formatTime12Hour, 
  computePeriodSummary 
} from '../services/biometricEngine';

interface BiometricDashboardProps {
  facultyList: Faculty[];
  attendanceRecords: AttendanceRecord[];
  settings: SystemSettings;
  theme?: 'dark' | 'light';
}

export const BiometricDashboard: React.FC<BiometricDashboardProps> = ({
  facultyList,
  attendanceRecords,
  settings,
  theme = 'dark',
}) => {
  const todayIST = getISTDateString();
  const [dashboardPeriod, setDashboardPeriod] = useState<AttendancePeriod>('daily');

  // Compute stats dynamically for Daily, Weekly, Monthly, or Yearly
  const periodSummary: PeriodSummary = useMemo(() => {
    return computePeriodSummary(attendanceRecords, facultyList, dashboardPeriod, todayIST);
  }, [attendanceRecords, facultyList, dashboardPeriod, todayIST]);

  const totalFaculty = facultyList.length;
  const presentCount = periodSummary.presentCount;
  const absentCount = Math.max(0, totalFaculty - (dashboardPeriod === 'daily' ? presentCount : new Set(periodSummary.facultyLeaderboard.filter(f => f.daysPresent > 0).map(f => f.facultyId)).size));
  const lateCount = periodSummary.lateCount;
  const onTimeCount = periodSummary.onTimeCount;
  const attendanceRate = periodSummary.attendanceRate;

  return (
    <div className="space-y-6">
      {/* Top Welcome Card with Live IST & Period Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/40 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>LIVE IST TELEMETRY & ATTENDANCE INTELLIGENCE</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100">
              Faculty Attendance Analytics Dashboard
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              College Hours: <strong className="text-sm sm:text-base font-mono font-bold text-slate-100">{formatTime12Hour(settings.collegeStartTime)} - {formatTime12Hour(settings.collegeEndTime)}</strong> IST. Late threshold: <strong className="text-sm sm:text-base font-mono font-bold text-amber-400">&gt; {formatTime12Hour(settings.lateThresholdTime)}</strong> IST.
            </p>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 font-mono text-xs">
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">ACTIVE PERIOD</span>
              <span className="text-sm sm:text-base font-mono font-bold text-cyan-300">
                {periodSummary.label}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">LATE THRESHOLD</span>
              <span className="text-sm sm:text-base font-mono font-bold text-amber-400">
                &gt; {formatTime12Hour(settings.lateThresholdTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Period Switcher */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setDashboardPeriod('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                dashboardPeriod === 'daily'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Daily Analytics</span>
            </button>

            <button
              onClick={() => setDashboardPeriod('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                dashboardPeriod === 'weekly'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Weekly Trend</span>
            </button>

            <button
              onClick={() => setDashboardPeriod('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                dashboardPeriod === 'monthly'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Monthly Overview</span>
            </button>

            <button
              onClick={() => setDashboardPeriod('yearly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                dashboardPeriod === 'yearly'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Yearly Archive</span>
            </button>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Total Working Hours in Period: <strong className="text-sm sm:text-base font-mono font-bold text-emerald-400">{periodSummary.totalHoursWorked}h</strong>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Attendance Rate ({dashboardPeriod.toUpperCase()})</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">{attendanceRate}%</span>
            <span className="text-xs text-slate-500 font-mono">{dashboardPeriod}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Verified Sessions</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-cyan-300">{presentCount}</span>
            <span className="text-xs text-slate-500 font-mono">records</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono">
            {periodSummary.checkedOutCount} Checked Out ({presentCount - periodSummary.checkedOutCount} Active)
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>On-Time Arrival</span>
            <Clock className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-teal-300">{onTimeCount}</span>
            <span className="text-xs text-slate-500 font-mono">({periodSummary.punctualityRate}%)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono">Before {formatTime12Hour(settings.lateThresholdTime)}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Late Check-in</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">{lateCount}</span>
            <span className="text-xs text-slate-500 font-mono">sessions</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono">After {formatTime12Hour(settings.lateThresholdTime)}</p>
        </div>
      </div>

      {/* Main Analysis: Department Rates & Hardware Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Attendance Performance */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Department Attendance Breakdown ({dashboardPeriod.toUpperCase()})</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">Live IST Sync</span>
          </div>

          {periodSummary.departmentBreakdown.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No faculty departments logged in this period.
            </div>
          ) : (
            <div className="space-y-3.5">
              {periodSummary.departmentBreakdown.map((d) => {
                const totalInDept = facultyList.filter(f => f.department === d.department).length || 1;
                const deptRate = Math.min(100, Math.round((d.count / (totalInDept * (dashboardPeriod === 'daily' ? 1 : 4))) * 100));
                return (
                  <div key={d.department} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium truncate max-w-[260px]">
                        {d.department}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400">
                          {d.count} sessions ({d.onTime} on-time)
                        </span>
                        <span className="text-cyan-400 font-bold min-w-[36px] text-right">
                          {d.late > 0 ? `${d.late} Late` : '100% On-Time'}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${Math.max(10, Math.min(100, (d.onTime / (d.count || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Faculty Leaderboard for period */}
          {periodSummary.facultyLeaderboard.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Faculty Attendance Scorecard ({dashboardPeriod.toUpperCase()})</span>
              </h4>
              <div className="space-y-2">
                {periodSummary.facultyLeaderboard.map((f) => (
                  <div
                    key={f.facultyId}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={f.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                        alt={f.facultyName}
                        className="w-8 h-8 rounded-full object-cover border border-cyan-500/40 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">{f.facultyName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{f.staffId} · {f.department}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right font-mono">
                      <div>
                        <span className="text-slate-500 block text-[9px]">SESSIONS</span>
                        <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">{f.daysPresent}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">HOURS</span>
                        <span className="text-sm sm:text-base font-mono font-bold text-cyan-300">{f.totalHours}h</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Engine Telemetry & Pipeline Status */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Biometric Engine & Storage Status</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">YOLO Face Detector</span>
                <span className="text-emerald-400 font-bold">READY (ONNX)</span>
              </div>
              <p className="text-[11px] text-slate-500 font-sans">
                Real-time continuous auto-capture enabled with {(settings.yoloConfidence * 100).toFixed(0)}% confidence gate.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Buffalo Feature Extractor</span>
                <span className="text-emerald-400 font-bold">READY (512-dim)</span>
              </div>
              <p className="text-[11px] text-slate-500 font-sans">
                Cosine threshold: {(settings.buffaloThreshold * 100).toFixed(0)}%. Consensus: {settings.numFramesVote} frames.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">attendance.db Storage</span>
                <span className="text-emerald-400 font-bold">DAILY PERMANENT</span>
              </div>
              <p className="text-[11px] text-slate-500 font-sans">
                Stored daily in attendance.db.json. Queries available on Daily, Weekly, Monthly, and Yearly basis.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">College Schedule</span>
                <span className="text-sm sm:text-base font-mono font-bold text-cyan-400">
                  {formatTime12Hour(settings.collegeStartTime)} - {formatTime12Hour(settings.collegeEndTime)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-sans">
                Late flagged after <strong className="text-amber-400">{formatTime12Hour(settings.lateThresholdTime)} IST</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
