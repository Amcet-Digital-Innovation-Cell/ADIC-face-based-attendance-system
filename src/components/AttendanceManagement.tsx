import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, Search, Download, Calendar, Filter, 
  CheckCircle2, Clock, AlertTriangle, ArrowUpDown, RefreshCw, UserCheck, Shield,
  LogOut, ArrowRightCircle, Hourglass, Check, ChevronLeft, ChevronRight,
  CalendarDays, BarChart2, Eye, Camera, X, Trash2, ShieldAlert
} from 'lucide-react';
import { AttendanceRecord, Faculty, AttendancePeriod, PeriodSummary } from '../types/biometric';
import { 
  getISTDateString, getISTTimeString, formatTime12Hour, 
  getWeekBounds, filterRecordsByPeriod, computePeriodSummary 
} from '../services/biometricEngine';

interface AttendanceManagementProps {
  attendanceRecords: AttendanceRecord[];
  facultyList: Faculty[];
  onRefresh: () => void;
  onManualMark: (faculty: Faculty) => void;
  onCheckOut?: (recordId: string, facultyId: string) => Promise<void> | void;
  theme?: 'dark' | 'light';
}

export const AttendanceManagement: React.FC<AttendanceManagementProps> = ({
  attendanceRecords,
  facultyList,
  onRefresh,
  onManualMark,
  onCheckOut,
  theme = 'dark',
}) => {
  const todayIST = getISTDateString();
  const [period, setPeriod] = useState<AttendancePeriod>('daily');
  const [referenceDate, setReferenceDate] = useState<string>(todayIST);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [viewingPhotoRecord, setViewingPhotoRecord] = useState<AttendanceRecord | null>(null);
  const [showClearLogsModal, setShowClearLogsModal] = useState<boolean>(false);
  const [clearAdminKey, setClearAdminKey] = useState<string>('');
  const [clearError, setClearError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  // Per-record delete state
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null);
  const [deleteAdminKey, setDeleteAdminKey] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    facultyList.forEach((f) => set.add(f.department));
    return ['ALL', ...Array.from(set)];
  }, [facultyList]);

  // Compute Period Analytics
  const periodSummary: PeriodSummary = useMemo(() => {
    return computePeriodSummary(attendanceRecords, facultyList, period, referenceDate);
  }, [attendanceRecords, facultyList, period, referenceDate]);

  // Filter records by period, department, status, and search term
  const filteredRecords = useMemo(() => {
    const byPeriod = filterRecordsByPeriod(attendanceRecords, period, referenceDate);

    return byPeriod.filter((rec) => {
      // Department filter
      if (selectedDept !== 'ALL' && rec.department !== selectedDept) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL' && rec.status !== selectedStatus) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          rec.facultyName.toLowerCase().includes(q) ||
          rec.staffId.toLowerCase().includes(q) ||
          rec.department.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [attendanceRecords, period, referenceDate, selectedDept, selectedStatus, searchTerm]);

  // Absent faculty for the selected date (in daily mode)
  const absentFaculty = useMemo(() => {
    if (period !== 'daily') return [];
    const markedFacultyIds = new Set(
      attendanceRecords.filter((r) => r.date === referenceDate).map((r) => r.facultyId)
    );
    return facultyList.filter((f) => !markedFacultyIds.has(f.id));
  }, [attendanceRecords, facultyList, period, referenceDate]);

  // Navigation handlers for referenceDate based on period
  const handlePrevPeriod = () => {
    const [y, m, d] = referenceDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    if (period === 'daily') {
      dateObj.setDate(dateObj.getDate() - 1);
    } else if (period === 'weekly') {
      dateObj.setDate(dateObj.getDate() - 7);
    } else if (period === 'monthly') {
      dateObj.setMonth(dateObj.getMonth() - 1);
    } else if (period === 'yearly') {
      dateObj.setFullYear(dateObj.getFullYear() - 1);
    }

    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    setReferenceDate(`${ny}-${nm}-${nd}`);
  };

  const handleNextPeriod = () => {
    const [y, m, d] = referenceDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    if (period === 'daily') {
      dateObj.setDate(dateObj.getDate() + 1);
    } else if (period === 'weekly') {
      dateObj.setDate(dateObj.getDate() + 7);
    } else if (period === 'monthly') {
      dateObj.setMonth(dateObj.getMonth() + 1);
    } else if (period === 'yearly') {
      dateObj.setFullYear(dateObj.getFullYear() + 1);
    }

    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    setReferenceDate(`${ny}-${nm}-${nd}`);
  };

  const handleResetToCurrent = () => {
    setReferenceDate(todayIST);
  };

  // Trigger Check-Out
  const handleCheckOutRecord = async (recordId: string, facultyId: string) => {
    if (!onCheckOut) return;
    setCheckingOutId(recordId);
    try {
      await onCheckOut(recordId, facultyId);
    } finally {
      setCheckingOutId(null);
    }
  };

  // Clear attendance logs with Admin Key verification
  const handleClearLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearAdminKey.trim()) {
      setClearError('Please enter your admin key.');
      return;
    }
    setIsClearing(true);
    setClearError(null);
    try {
      const res = await fetch('/api/attendance/clear-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': clearAdminKey.trim(),
        },
        body: JSON.stringify({ adminKey: clearAdminKey.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setShowClearLogsModal(false);
        setClearAdminKey('');
        onRefresh();
      } else {
        setClearError(data.error || 'Invalid Admin Key. Check admin_key in .env');
      }
    } catch {
      setClearError('Server error clearing attendance logs.');
    } finally {
      setIsClearing(false);
    }
  };

  // Delete a single attendance record (requires admin key)
  const handleDeleteRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    if (!deleteAdminKey.trim()) { setDeleteError('Admin key is required.'); return; }
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/attendance/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': deleteAdminKey.trim() },
        body: JSON.stringify({ adminKey: deleteAdminKey.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDeleteTarget(null); setDeleteAdminKey('');
        onRefresh();
      } else {
        setDeleteError(data.error || 'Invalid admin key. Check admin_key in .env');
      }
    } catch { setDeleteError('Server error while deleting record.'); }
    finally { setIsDeleting(false); }
  };

  // Export CSV filtered by selected period
  const handleExportCSV = () => {
    const headers = [
      'Record ID',
      'Staff ID',
      'Faculty Name',
      'Department',
      'IST Date',
      'Check-In Time (IST)',
      'Check-Out Time (IST)',
      'Working Duration',
      'Status',
      'Similarity Score',
      'Detection Confidence',
      'Verification Engine',
      'Device Source',
    ];

    const rows = filteredRecords.map((r) => [
      r.id,
      r.staffId,
      `"${r.facultyName.replace(/"/g, '""')}"`,
      `"${r.department.replace(/"/g, '""')}"`,
      r.date,
      r.checkInTime || r.formattedTime,
      r.checkOutTime || 'In Campus',
      r.duration || 'In Progress',
      r.status,
      r.similarityScore,
      r.detectionConfidence,
      r.verificationMethod,
      r.deviceSource,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ADIC_Face_App_Attendance_${period.toUpperCase()}_${referenceDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <ClipboardCheck className="w-4 h-4 text-cyan-400" />
              <span>OFFICIAL ATTENDANCE REGISTER & AUDIT TRAIL</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100">
              Faculty Attendance Database (IST)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Data stored permanently per day. Available on Daily, Weekly, Monthly, and Yearly intervals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors min-h-[40px]"
              title="Refresh database records"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors shadow-lg shadow-emerald-500/20 min-h-[40px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {period.toUpperCase()} CSV ({filteredRecords.length})</span>
            </button>

            <button
              onClick={() => {
                setShowClearLogsModal(true);
                setClearAdminKey('');
                setClearError(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30 rounded-lg transition-colors min-h-[40px]"
              title="Clear all attendance logs (Requires Admin Key)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {/* Period Selector Tabs: Daily, Weekly, Monthly, Yearly, All */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setPeriod('daily')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                period === 'daily'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>📅 Daily</span>
            </button>

            <button
              onClick={() => setPeriod('weekly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                period === 'weekly'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>📆 Weekly</span>
            </button>

            <button
              onClick={() => setPeriod('monthly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                period === 'monthly'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>🗓️ Monthly</span>
            </button>

            <button
              onClick={() => setPeriod('yearly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                period === 'yearly'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>📊 Yearly</span>
            </button>

            <button
              onClick={() => setPeriod('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                period === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>All Logs</span>
            </button>
          </div>

          {/* Period Navigator with Prev / Next and Active Label */}
          {period !== 'all' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPeriod}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                title="Previous Period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-semibold text-slate-200 flex items-center gap-2">
                <span className="text-cyan-400">{periodSummary.label}</span>
                {referenceDate !== todayIST && (
                  <button
                    onClick={handleResetToCurrent}
                    className="text-[10px] text-cyan-400 underline hover:text-cyan-300 ml-1"
                  >
                    Reset to Today
                  </button>
                )}
              </div>

              <button
                onClick={handleNextPeriod}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                title="Next Period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {period === 'daily' && (
                <input
                  type="date"
                  value={referenceDate}
                  onChange={(e) => e.target.value && setReferenceDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Period Analytics KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{period.toUpperCase()} Verified Entries</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
              {periodSummary.totalRecords}
            </span>
            <span className="text-xs text-slate-500 font-mono">sessions</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            {periodSummary.checkedOutCount} Checked Out ({periodSummary.totalRecords - periodSummary.checkedOutCount} In Campus)
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Total Working Hours</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-cyan-300">
              {periodSummary.totalHoursWorked}h
            </span>
            <span className="text-xs text-slate-500 font-mono">logged</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            Avg: {periodSummary.averageDurationMinutes} min / faculty
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Punctuality / On-Time</span>
            <UserCheck className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-teal-300">
              {periodSummary.punctualityRate}%
            </span>
            <span className="text-xs text-slate-500 font-mono">on-time</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            {periodSummary.onTimeCount} on-time · {periodSummary.lateCount} late
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Coverage / Attendance</span>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-purple-300">
              {periodSummary.attendanceRate}%
            </span>
            <span className="text-xs text-slate-500 font-mono">rate</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            Across {facultyList.length} enrolled faculty
          </p>
        </div>
      </div>

      {/* Weekly & Monthly Distribution Graphic Bar (when in Weekly or Monthly) */}
      {(period === 'weekly' || period === 'monthly' || period === 'yearly') && periodSummary.timeDistribution.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              <span>{period.toUpperCase()} Attendance Distribution Breakdown</span>
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              Showing entries across {period} intervals
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-12 gap-2 pt-1">
            {periodSummary.timeDistribution.map((item, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border text-center font-mono space-y-1 transition-all ${
                  item.count > 0
                    ? 'bg-slate-950 border-cyan-500/30 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-600'
                }`}
              >
                <div className="text-[10px] text-slate-400 font-bold truncate">{item.label}</div>
                <div className={`text-sm sm:text-base font-bold ${item.count > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {item.count}
                </div>
                {item.late > 0 && (
                  <div className="text-[9px] text-amber-400">
                    {item.late} Late
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
          <div className="sm:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search faculty name, staff ID, department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 min-h-[38px]"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 min-h-[38px]"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'ALL' ? 'All Departments' : d}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 min-h-[38px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present (On-Time)</option>
              <option value="LATE">Late Arrival</option>
            </select>
          </div>
        </div>
      </div>

      {/* Attendance Records: Desktop Table & Mobile Cards */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-cyan-400" />
              <span>attendance.db Official Register (IST)</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Showing {filteredRecords.length} records for {periodSummary.label}
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 font-bold">
            {filteredRecords.length} records
          </span>
        </div>

        {/* Mobile View: Cards Layout (< 768px) */}
        <div className="block md:hidden divide-y divide-slate-800/80 p-2">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No attendance records logged for {periodSummary.label}.
            </div>
          ) : (
            filteredRecords.map((rec) => (
              <div key={rec.id} className="p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingPhotoRecord(rec)}
                      className="relative group shrink-0"
                      title="Click to view live camera capture"
                    >
                      <img
                        src={rec.capturedFrameThumb || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                        alt={rec.facultyName}
                        className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500/60 shadow-md"
                      />
                      <span className="absolute bottom-0 right-0 bg-slate-950/80 p-0.5 rounded text-[8px] text-cyan-300">
                        <Camera className="w-2.5 h-2.5" />
                      </span>
                    </button>
                    <div>
                      <div className="font-semibold text-xs text-slate-200">{rec.facultyName}</div>
                      <span className="text-xs font-mono text-cyan-400 font-bold">{rec.staffId}</span>
                      <div className="text-[10px] text-slate-400">{rec.department.split('&')[0]}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] border ${
                      rec.status === 'PRESENT'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>

                {/* Check In & Check Out Details Grid with Prominent Time Size */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[9px] font-sans">CHECK-IN (IST)</span>
                    <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                      {rec.checkInTime || rec.formattedTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-sans">CHECK-OUT (IST)</span>
                    {rec.checkOutTime ? (
                      <span className="text-sm sm:text-base font-mono font-bold text-purple-300">
                        {rec.checkOutTime}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span>In Campus</span>
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-sans">DURATION</span>
                    <span className="text-sm sm:text-base font-mono font-bold text-slate-100">
                      {rec.duration || 'In Progress'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-sans">DATE</span>
                    <span className="text-sm sm:text-base font-mono font-bold text-cyan-300">{rec.date}</span>
                  </div>
                </div>

                {/* Check-Out Action Button for Mobile */}
                {!rec.checkOutTime && onCheckOut && (
                  <button
                    onClick={() => handleCheckOutRecord(rec.id, rec.facultyId)}
                    disabled={checkingOutId === rec.id}
                    className="w-full py-2 px-3 text-xs font-semibold text-purple-200 bg-purple-950/50 hover:bg-purple-900/50 border border-purple-500/40 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-purple-400" />
                    <span>{checkingOutId === rec.id ? 'Recording...' : 'Record Check-Out Now'}</span>
                  </button>
                )}
                {/* Delete record button (mobile) */}
                <button
                  onClick={() => { setDeleteTarget(rec); setDeleteAdminKey(''); setDeleteError(null); }}
                  className="w-full py-1.5 px-3 text-xs font-medium text-rose-300 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-500/25 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>Delete Record</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
              <tr>
                <th className="py-3 px-3">Live Snapshot</th>
                <th className="py-3 px-3">Staff ID</th>
                <th className="py-3 px-3">Faculty Member</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Date (IST)</th>
                <th className="py-3 px-3">Check-In Time</th>
                <th className="py-3 px-3">Check-Out Time</th>
                <th className="py-3 px-3">Working Duration</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-500">
                    No attendance records logged for {periodSummary.label}.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Live Camera Snapshot Thumbnail */}
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setViewingPhotoRecord(rec)}
                        className="relative group block"
                        title="View high-resolution live camera capture"
                      >
                        <img
                          src={rec.capturedFrameThumb || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                          alt={rec.facultyName}
                          className="w-10 h-10 rounded-lg object-cover border-2 border-emerald-500/50 group-hover:border-cyan-400 transition-colors shadow-sm"
                        />
                        <span className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                          <Eye className="w-3.5 h-3.5 text-white" />
                        </span>
                      </button>
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-cyan-400">
                      {rec.staffId}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-200">{rec.facultyName}</div>
                      <span className="text-[10px] text-slate-500 font-mono">Sim: {((rec.similarityScore || 0.94) * 100).toFixed(1)}%</span>
                    </td>

                    <td className="py-3 px-3 text-slate-400 text-xs truncate max-w-[140px]">
                      {rec.department}
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <span className="text-slate-300 font-semibold">{rec.date}</span>
                    </td>

                    {/* Uniform Prominent Check-In Time */}
                    <td className="py-3 px-3 font-mono">
                      <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                        {rec.checkInTime || rec.formattedTime}
                      </span>
                    </td>

                    {/* Uniform Prominent Check-Out Time */}
                    <td className="py-3 px-3 font-mono">
                      {rec.checkOutTime ? (
                        <span className="text-sm sm:text-base font-mono font-bold text-purple-300">
                          {rec.checkOutTime}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 font-sans">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          <span>In Campus</span>
                        </span>
                      )}
                    </td>

                    {/* Uniform Prominent Working Duration */}
                    <td className="py-3 px-3 font-mono">
                      <span className="text-sm sm:text-base font-mono font-bold text-slate-100">
                        {rec.duration || '-'}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-mono font-semibold text-[10px] border ${
                          rec.status === 'PRESENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {rec.status === 'PRESENT' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{rec.status}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!rec.checkOutTime && onCheckOut && (
                          <button
                            onClick={() => handleCheckOutRecord(rec.id, rec.facultyId)}
                            disabled={checkingOutId === rec.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-200 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <LogOut className="w-3.5 h-3.5 text-purple-400" />
                            <span>{checkingOutId === rec.id ? 'Recording...' : 'Check-Out'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => { setDeleteTarget(rec); setDeleteAdminKey(''); setDeleteError(null); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 rounded-lg transition-colors"
                          title="Delete this attendance record (requires admin key)"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Absent Faculty Section in Daily Mode */}
      {period === 'daily' && absentFaculty.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Not Yet Logged for {referenceDate} ({absentFaculty.length})</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {absentFaculty.map((f) => (
              <div
                key={f.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={f.photoUrl}
                    alt={f.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate">{f.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {f.staffId} · {f.department.split('&')[0]}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onManualMark(f)}
                  className="px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 rounded-md transition-colors shrink-0"
                >
                  Mark
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Camera Snapshot Viewer Modal */}
      {viewingPhotoRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">
                  Live Camera Captured Portrait
                </h3>
              </div>
              <button
                onClick={() => setViewingPhotoRecord(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-square rounded-xl overflow-hidden border-2 border-emerald-500/50 bg-black flex items-center justify-center shadow-lg">
              <img
                src={viewingPhotoRecord.capturedFrameThumb || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
                alt={viewingPhotoRecord.facultyName}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Faculty:</span>
                <span className="font-bold text-slate-200">{viewingPhotoRecord.facultyName} ({viewingPhotoRecord.staffId})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">IST Date:</span>
                <span className="text-cyan-300 font-bold">{viewingPhotoRecord.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Check-In Time:</span>
                <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                  {viewingPhotoRecord.checkInTime || viewingPhotoRecord.formattedTime} IST
                </span>
              </div>
              {viewingPhotoRecord.checkOutTime && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Check-Out Time:</span>
                  <span className="text-sm sm:text-base font-mono font-bold text-purple-300">
                    {viewingPhotoRecord.checkOutTime} IST
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Device Source:</span>
                <span className="text-slate-300">{viewingPhotoRecord.deviceSource}</span>
              </div>
            </div>

            <button
              onClick={() => setViewingPhotoRecord(null)}
              className="w-full py-2.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors"
            >
              Close Snapshot Viewer
            </button>
          </div>
        </div>
      )}

      {/* Clear Attendance Logs Modal */}
      {showClearLogsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  Clear All Attendance Logs
                </h3>
              </div>
              <button
                onClick={() => setShowClearLogsModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action will permanently wipe all attendance records from <code className="text-rose-400 font-mono">attendance.db</code>. Registered faculty members will not be affected.
            </p>

            <form onSubmit={handleClearLogs} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Enter Admin Key to Confirm (.env: admin_key)
                </label>
                <input
                  type="password"
                  value={clearAdminKey}
                  onChange={(e) => setClearAdminKey(e.target.value)}
                  placeholder="Enter admin key..."
                  autoComplete="new-password"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              {clearError && (
                <div className="text-xs text-rose-400 flex items-center gap-1.5 p-2 bg-rose-950/40 border border-rose-800/40 rounded-lg font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{clearError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearLogsModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClearing}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/30 disabled:opacity-40"
                >
                  {isClearing ? 'Clearing Logs...' : 'Yes, Clear Attendance Logs'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Record Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm sm:text-base font-bold text-slate-100">Delete Attendance Record</h3>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="p-1 rounded text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-3.5 text-xs font-mono space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Faculty:</span><span className="text-slate-200 font-bold">{deleteTarget.facultyName} ({deleteTarget.staffId})</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date:</span><span className="text-cyan-300 font-bold">{deleteTarget.date}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Check-In:</span><span className="text-emerald-400 font-bold">{deleteTarget.checkInTime || deleteTarget.formattedTime} IST</span></div>
              {deleteTarget.checkOutTime && <div className="flex justify-between"><span className="text-slate-500">Check-Out:</span><span className="text-purple-300 font-bold">{deleteTarget.checkOutTime} IST</span></div>}
            </div>

            <p className="text-xs text-rose-200 leading-relaxed">⚠️ This action permanently removes this attendance record from <code className="text-rose-400">attendance.db</code> and cannot be undone.</p>

            <form onSubmit={handleDeleteRecord} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Admin Key Required (.env: admin_key)</label>
                <input
                  type="password"
                  value={deleteAdminKey}
                  onChange={(e) => setDeleteAdminKey(e.target.value)}
                  placeholder="Enter admin key to confirm..."
                  autoComplete="new-password"
                  autoFocus
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>
              {deleteError && (
                <div className="text-xs text-rose-400 flex items-center gap-1.5 p-2 bg-rose-950/40 border border-rose-800/40 rounded-lg font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium">Cancel</button>
                <button type="submit" disabled={isDeleting} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/30 disabled:opacity-40">
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
