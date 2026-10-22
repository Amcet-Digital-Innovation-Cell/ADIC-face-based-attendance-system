import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FACULTY_DB_PATH = path.join(DATA_DIR, 'faculty.db.json');
const ATTENDANCE_DB_PATH = path.join(DATA_DIR, 'attendance.db.json');
const SETTINGS_DB_PATH = path.join(DATA_DIR, 'settings.db.json');

interface Faculty {
  id: string;
  staffId: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  photoUrl: string;
  enrolledAt: string;
  embeddingCount: number;
  embedding?: number[];
  faceDescriptor?: number[]; // 128-dim face-api.js CNN descriptor
  status: 'active' | 'on_leave' | 'inactive';
}

interface AttendanceRecord {
  id: string;
  facultyId: string;
  staffId: string;
  facultyName: string;
  department: string;
  date: string;
  timestamp: string;
  formattedTime: string;
  checkInTime?: string;
  checkInTimestamp?: string;
  checkOutTime?: string;
  checkOutTimestamp?: string;
  duration?: string;
  similarityScore: number;
  detectionConfidence: number;
  status: 'PRESENT' | 'LATE' | 'ON_DUTY';
  verificationMethod: 'YOLO_BUFFALO_ONNX' | 'MULTI_FRAME_VOTE' | 'MANUAL_OVERRIDE';
  deviceSource: 'WEB_KIOSK' | 'RASPBERRY_PI_CAM' | 'HF_SPACE_API';
  capturedFrameThumb?: string;
  checkOutFrameThumb?: string;
}

interface SystemSettings {
  yoloConfidence: number;
  buffaloThreshold: number;
  numFramesVote: number;
  minVotingAgreement: number;
  faceMargin: number;
  lowLightEnhanceCLAHE: boolean;
  soundEffects: boolean;
  speechAnnouncements: boolean;
  autoContinuousScan: boolean;
  scanIntervalMs: number;
  collegeStartTime: string;
  lateThresholdTime: string;
  collegeEndTime: string;
  timeZone: string;
  raspberryPiIp: string;
  huggingFaceSpaceUrl: string;
}

type AttendancePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

const DEFAULT_SETTINGS: SystemSettings = {
  yoloConfidence: 0.40,
  buffaloThreshold: 0.60,
  numFramesVote: 5,
  minVotingAgreement: 2,
  faceMargin: 0.25,
  lowLightEnhanceCLAHE: true,
  soundEffects: true,
  speechAnnouncements: true,
  autoContinuousScan: true,
  scanIntervalMs: 1200,
  collegeStartTime: '09:00',
  lateThresholdTime: '09:30',
  collegeEndTime: '16:30',
  timeZone: 'Asia/Kolkata',
  raspberryPiIp: '192.168.1.142:8000',
  huggingFaceSpaceUrl: 'https://huggingface.co/spaces/username/faculty-biometric-attendance',
};

function getISTDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function getISTTimeString(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function getISTTime24(date: Date = new Date()): { hours: number; minutes: number; timeString24: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hours = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const timeString24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { hours, minutes, timeString24 };
}

function calculateAttendanceStatus(
  date: Date = new Date(),
  settings: SystemSettings = DEFAULT_SETTINGS
): 'PRESENT' | 'LATE' {
  const { timeString24 } = getISTTime24(date);
  return timeString24 > settings.lateThresholdTime ? 'LATE' : 'PRESENT';
}

function getWeekBounds(dateStr: string): { startDate: string; endDate: string; label: string } {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const format = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dayNum = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayNum}`;
  };

  const startFormatted = format(monday);
  const endFormatted = format(sunday);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${monday.getDate()} ${monthNames[monday.getMonth()]} - ${sunday.getDate()} ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;
  
  return { startDate: startFormatted, endDate: endFormatted, label };
}

function filterRecordsByPeriod(
  records: AttendanceRecord[],
  period: AttendancePeriod,
  refDate: string = getISTDateString()
): AttendanceRecord[] {
  if (period === 'all') return records;
  if (period === 'daily') return records.filter((r) => r.date === refDate);
  if (period === 'weekly') {
    const { startDate, endDate } = getWeekBounds(refDate);
    return records.filter((r) => r.date >= startDate && r.date <= endDate);
  }
  if (period === 'monthly') {
    const monthKey = refDate.substring(0, 7);
    return records.filter((r) => r.date.startsWith(monthKey));
  }
  if (period === 'yearly') {
    const yearKey = refDate.substring(0, 4);
    return records.filter((r) => r.date.startsWith(yearKey));
  }
  return records;
}

function computePeriodSummary(
  records: AttendanceRecord[],
  facultyList: Faculty[],
  period: AttendancePeriod,
  refDate: string = getISTDateString()
) {
  const periodRecords = filterRecordsByPeriod(records, period, refDate);
  const totalRecords = periodRecords.length;
  const lateCount = periodRecords.filter((r) => r.status === 'LATE').length;
  const onTimeCount = totalRecords - lateCount;
  const checkedOutCount = periodRecords.filter((r) => Boolean(r.checkOutTime)).length;

  let totalMinutes = 0;
  periodRecords.forEach((r) => {
    if (r.duration && r.duration !== '-') {
      const matchH = r.duration.match(/(\d+)h/);
      const matchM = r.duration.match(/(\d+)m/);
      const h = matchH ? parseInt(matchH[1], 10) : 0;
      const m = matchM ? parseInt(matchM[1], 10) : 0;
      totalMinutes += h * 60 + m;
    }
  });

  const totalHoursWorked = Math.round((totalMinutes / 60) * 10) / 10;
  const averageDurationMinutes = totalRecords > 0 ? Math.round(totalMinutes / totalRecords) : 0;
  const punctualityRate = totalRecords > 0 ? Math.round((onTimeCount / totalRecords) * 100) : 100;

  const totalFaculty = facultyList.length;
  let attendanceRate = 0;
  if (period === 'daily') {
    attendanceRate = totalFaculty > 0 ? Math.min(100, Math.round((totalRecords / totalFaculty) * 100)) : 0;
  } else {
    const uniqueAttended = new Set(periodRecords.map((r) => r.facultyId)).size;
    attendanceRate = totalFaculty > 0 ? Math.min(100, Math.round((uniqueAttended / totalFaculty) * 100)) : 0;
  }

  let label = refDate;
  if (period === 'daily') {
    label = `Daily: ${refDate}`;
  } else if (period === 'weekly') {
    const bounds = getWeekBounds(refDate);
    label = `Weekly: ${bounds.label}`;
  } else if (period === 'monthly') {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const parts = refDate.split('-').map(Number);
    label = `${monthNames[parts[1] - 1]} ${parts[0]}`;
  } else if (period === 'yearly') {
    label = `Year ${refDate.substring(0, 4)}`;
  } else {
    label = 'All Historical Records';
  }

  const facultyLeaderboard = facultyList.map((f) => {
    const facRecords = periodRecords.filter((r) => r.facultyId === f.id || r.staffId === f.staffId);
    const daysPresent = facRecords.length;
    const daysLate = facRecords.filter((r) => r.status === 'LATE').length;
    const daysOnTime = daysPresent - daysLate;
    let mins = 0;
    facRecords.forEach((r) => {
      if (r.duration && r.duration !== '-') {
        const matchH = r.duration.match(/(\d+)h/);
        const matchM = r.duration.match(/(\d+)m/);
        const h = matchH ? parseInt(matchH[1], 10) : 0;
        const m = matchM ? parseInt(matchM[1], 10) : 0;
        mins += h * 60 + m;
      }
    });
    return {
      facultyId: f.id,
      staffId: f.staffId,
      name: f.name,
      department: f.department,
      photoUrl: f.photoUrl,
      daysPresent,
      daysLate,
      daysOnTime,
      totalHours: Math.round((mins / 60) * 10) / 10,
    };
  }).sort((a, b) => b.daysPresent - a.daysPresent);

  return {
    period,
    referenceDate: refDate,
    label,
    totalRecords,
    presentCount: totalRecords,
    lateCount,
    onTimeCount,
    checkedOutCount,
    totalHoursWorked,
    averageDurationMinutes,
    punctualityRate,
    attendanceRate,
    facultyLeaderboard,
  };
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

function generateSeedEmbedding(seed: string): number[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const raw: number[] = [];
  let normSq = 0;
  for (let i = 0; i < 512; i++) {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h = (h ^ (h >>> 16)) >>> 0;
    const val = (h / 4294967296) * 2 - 1;
    raw.push(val);
    normSq += val * val;
  }
  const norm = Math.sqrt(normSq) || 1;
  return raw.map((v) => v / norm);
}

if (!fs.existsSync(FACULTY_DB_PATH)) {
  writeJsonFile(FACULTY_DB_PATH, []);
}
if (!fs.existsSync(ATTENDANCE_DB_PATH)) {
  writeJsonFile(ATTENDANCE_DB_PATH, []);
}
if (!fs.existsSync(SETTINGS_DB_PATH)) {
  writeJsonFile(SETTINGS_DB_PATH, DEFAULT_SETTINGS);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function getAdminKey(): string {
  const raw = process.env.admin_key || process.env.ADMIN_KEY || process.env.Admin_Key || 'admin123';
  return String(raw).replace(/^["']|["']$/g, '').trim();
}

  // API Routes
  // 1. Faculty DB Management (/api/faculty)
  app.get('/api/faculty', (req, res) => {
    const faculty = readJsonFile<Faculty[]>(FACULTY_DB_PATH, []);
    res.json({ success: true, count: faculty.length, data: faculty });
  });

  app.post('/api/faculty', (req, res) => {
    const newFaculty = req.body;
    if (!newFaculty.name || !newFaculty.staffId) {
      return res.status(400).json({ success: false, error: 'Name and Staff ID are required.' });
    }
    const faculty = readJsonFile<Faculty[]>(FACULTY_DB_PATH, []);

    // Check duplicate staff ID
    const cleanStaffId = String(newFaculty.staffId).trim().toUpperCase();
    const exists = faculty.find((f: any) => f.staffId.toUpperCase() === cleanStaffId);
    if (exists) {
      return res.status(409).json({ success: false, error: `Staff ID ${cleanStaffId} already exists in faculty.db.` });
    }

    const created: Faculty = {
      id: newFaculty.id || `stt_${cleanStaffId.toLowerCase()}`,
      staffId: cleanStaffId,
      name: newFaculty.name,
      department: newFaculty.department || 'Engineering & Sciences',
      designation: newFaculty.designation || 'Faculty Member',
      email: newFaculty.email || '',
      phone: newFaculty.phone || '',
      photoUrl: newFaculty.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      enrolledAt: new Date().toISOString(),
      embeddingCount: newFaculty.embeddingCount || 1,
      embedding: newFaculty.embedding || generateSeedEmbedding(`faculty_${cleanStaffId}_${newFaculty.name}`),
      faceDescriptor: newFaculty.faceDescriptor || undefined, // persist real 128-dim CNN descriptor
      status: 'active' as const,
    };

    faculty.unshift(created);
    writeJsonFile(FACULTY_DB_PATH, faculty);
    res.status(201).json({ success: true, data: created });
  });

  // Edit Faculty Details (Protected with Admin Key from .env)
  app.put('/api/faculty/:id', (req, res) => {
    const { id } = req.params;
    const rawProvidedKey = 
      req.headers['x-admin-key'] || 
      req.headers['admin-key'] || 
      req.body?.adminKey || 
      req.body?.admin_key || 
      req.query?.adminKey || 
      req.query?.admin_key;

    const providedKey = rawProvidedKey ? String(rawProvidedKey).replace(/^["']|["']$/g, '').trim() : '';
    const expectedKey = getAdminKey();

    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Admin Key. Please check the admin_key setting in your .env file.',
      });
    }

    const updates = req.body || {};
    let faculty = readJsonFile<Faculty[]>(FACULTY_DB_PATH, []);
    const cleanId = String(id).trim().toLowerCase();
    const index = faculty.findIndex(
      (f: any) => String(f.id).toLowerCase() === cleanId || String(f.staffId).toLowerCase() === cleanId
    );

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Faculty record not found in faculty.db.' });
    }

    const existingFaculty = faculty[index];

    // If staffId changed, check uniqueness
    if (updates.staffId) {
      const newStaffId = String(updates.staffId).trim().toUpperCase();
      const duplicate = faculty.find(
        (f: any, i: number) => i !== index && String(f.staffId).toUpperCase() === newStaffId
      );
      if (duplicate) {
        return res.status(409).json({ success: false, error: `Staff ID ${newStaffId} is already in use by another faculty.` });
      }
      existingFaculty.staffId = newStaffId;
    }

    if (updates.name) existingFaculty.name = String(updates.name).trim();
    if (updates.department) existingFaculty.department = String(updates.department).trim();
    if (updates.designation) existingFaculty.designation = String(updates.designation).trim();
    if (updates.email !== undefined) existingFaculty.email = String(updates.email).trim();
    if (updates.phone !== undefined) existingFaculty.phone = String(updates.phone).trim();
    if (updates.photoUrl) existingFaculty.photoUrl = updates.photoUrl;
    if (updates.status) existingFaculty.status = updates.status;
    if (updates.embedding) {
      existingFaculty.embedding = updates.embedding;
      existingFaculty.embeddingCount = (existingFaculty.embeddingCount || 1) + 1;
    }
    if (updates.faceDescriptor) {
      (existingFaculty as any).faceDescriptor = updates.faceDescriptor;
    }

    faculty[index] = existingFaculty;
    writeJsonFile<Faculty[]>(FACULTY_DB_PATH, faculty);

    // Keep attendance log facultyName & staffId in sync
    try {
      const attendance = readJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);
      let modified = false;
      attendance.forEach((rec) => {
        if (rec.facultyId === existingFaculty.id || rec.staffId.toLowerCase() === cleanId) {
          rec.facultyName = existingFaculty.name;
          rec.staffId = existingFaculty.staffId;
          rec.department = existingFaculty.department;
          modified = true;
        }
      });
      if (modified) {
        writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, attendance);
      }
    } catch {
      // Ignore
    }

    res.json({
      success: true,
      data: existingFaculty,
      message: `Faculty ${existingFaculty.name} (${existingFaculty.staffId}) details updated successfully.`,
    });
  });

  app.delete('/api/faculty/:id', (req, res) => {
    const { id } = req.params;
    const rawProvidedKey = 
      req.headers['x-admin-key'] || 
      req.headers['admin-key'] || 
      req.body?.adminKey || 
      req.body?.admin_key || 
      req.query?.adminKey || 
      req.query?.admin_key;

    const providedKey = rawProvidedKey ? String(rawProvidedKey).replace(/^["']|["']$/g, '').trim() : '';
    const expectedKey = getAdminKey();

    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Admin Key. Please check the admin_key setting in your .env file.',
      });
    }

    let faculty = readJsonFile<Faculty[]>(FACULTY_DB_PATH, []);
    const cleanId = String(id).trim().toLowerCase();
    const target = faculty.find(
      (f: any) => String(f.id).toLowerCase() === cleanId || String(f.staffId).toLowerCase() === cleanId
    );

    if (!target) {
      return res.status(404).json({ success: false, error: 'Faculty record not found in faculty.db.' });
    }

    faculty = faculty.filter(
      (f: any) => String(f.id).toLowerCase() !== cleanId && String(f.staffId).toLowerCase() !== cleanId
    );
    writeJsonFile<Faculty[]>(FACULTY_DB_PATH, faculty);
    res.json({ 
      success: true, 
      message: `Faculty ${target.name} (${target.staffId}) permanently removed from faculty.db.` 
    });
  });

  // Verify Admin Key endpoint
  app.post('/api/admin/verify-key', (req, res) => {
    const rawKey = req.body?.adminKey || req.body?.admin_key;
    const providedKey = rawKey ? String(rawKey).replace(/^["']|["']$/g, '').trim() : '';
    const expectedKey = getAdminKey();
    const isValid = Boolean(providedKey && providedKey === expectedKey);
    res.json({ success: true, valid: isValid });
  });

  // 2. Attendance DB Management (/api/attendance) - Daily, Weekly, Monthly, Yearly support
  app.get('/api/attendance', (req, res) => {
    const records = readJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);
    const { 
      date: dateQuery, 
      department, 
      search, 
      period = 'all', 
      startDate, 
      endDate, 
      month, 
      year 
    } = req.query as any;

    let filtered = [...records];

    if (period && period !== 'all') {
      const refDate = (dateQuery as string) || (startDate as string) || getISTDateString();
      if (period === 'daily') {
        filtered = filtered.filter((r) => r.date === refDate);
      } else if (period === 'weekly') {
        const bounds = startDate && endDate ? { startDate, endDate } : getWeekBounds(refDate);
        filtered = filtered.filter((r) => r.date >= bounds.startDate && r.date <= bounds.endDate);
      } else if (period === 'monthly') {
        const monthKey = month || refDate.substring(0, 7);
        filtered = filtered.filter((r) => r.date.startsWith(monthKey));
      } else if (period === 'yearly') {
        const yearKey = year || refDate.substring(0, 4);
        filtered = filtered.filter((r) => r.date.startsWith(yearKey));
      }
    } else if (dateQuery) {
      filtered = filtered.filter((r) => r.date === dateQuery);
    }

    if (department && department !== 'ALL') {
      filtered = filtered.filter((r) => r.department === department);
    }
    if (search && typeof search === 'string') {
      const s = String(search).toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.facultyName.toLowerCase().includes(s) ||
          r.staffId.toLowerCase().includes(s) ||
          r.department.toLowerCase().includes(s)
      );
    }

    res.json({ success: true, count: filtered.length, data: filtered });
  });

  // Dedicated Analytics endpoint for Daily, Weekly, Monthly, Yearly breakdown
  app.get('/api/attendance/analytics', (req, res) => {
    const faculty = readJsonFile<Faculty[]>(FACULTY_DB_PATH, []);
    const records = readJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);
    const { period = 'daily', date = getISTDateString() } = req.query as any;

    const summary = computePeriodSummary(records, faculty, period as AttendancePeriod, String(date));
    res.json({ success: true, ...summary });
  });

  // 3. Mark Attendance (Check-In & Check-Out supported with duration and IST timestamp)
  app.post('/api/attendance/mark', (req, res) => {
    const {
      facultyId,
      similarityScore,
      detectionConfidence,
      deviceSource = 'WEB_KIOSK',
      verificationMethod = 'YOLO_BUFFALO_ONNX',
      capturedFrameThumb,
      mode = 'AUTO', // 'AUTO' | 'CHECK_IN' | 'CHECK_OUT'
    } = req.body;

    if (!facultyId) {
      return res.status(400).json({ success: false, error: 'facultyId is required' });
    }

    const facultyList = readJsonFile<Faculty[]>(FACULTY_DB_PATH, []);
    const cleanReqId = String(facultyId).trim().toLowerCase();
    const faculty = facultyList.find((f: Faculty) => 
      String(f.id).trim().toLowerCase() === cleanReqId || 
      String(f.staffId).trim().toLowerCase() === cleanReqId
    );

    if (!faculty) {
      return res.status(404).json({ success: false, error: 'Faculty not found in database.' });
    }

    const records = readJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);
    const settings = readJsonFile<SystemSettings>(SETTINGS_DB_PATH, DEFAULT_SETTINGS);
    const now = new Date();
    const todayIST = getISTDateString(now); // YYYY-MM-DD in Asia/Kolkata
    const formattedTimeIST = getISTTimeString(now); // hh:mm:ss AM/PM in Asia/Kolkata

    // Check if attendance already marked today in IST for this faculty
    const cleanFacId = String(faculty.id).trim().toLowerCase();
    const cleanStaffId = String(faculty.staffId).trim().toLowerCase();
    const existingIndex = records.findIndex((r: AttendanceRecord) => 
      (String(r.facultyId).trim().toLowerCase() === cleanFacId || 
       String(r.staffId).trim().toLowerCase() === cleanStaffId) && 
      r.date === todayIST
    );
    const existing = existingIndex !== -1 ? records[existingIndex] : null;

    // Helper to compute duration string
    const computeDuration = (startIso: string, endIso: string): string => {
      const startMs = new Date(startIso).getTime();
      const endMs = new Date(endIso).getTime();
      if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return '-';
      const diffM = Math.floor((endMs - startMs) / (1000 * 60));
      const hours = Math.floor(diffM / 60);
      const mins = diffM % 60;
      if (hours === 0) return `${mins}m`;
      return `${hours}h ${mins}m`;
    };

    // Attendance Marking with explicit Check-In & Check-Out state management
    if (mode === 'CHECK_IN') {
      if (existing) {
        return res.status(200).json({
          success: true,
          action: 'ALREADY_CHECKED_IN',
          alreadyMarked: true,
          record: existing,
          message: `Check-In already marked today for ${faculty.name} (${faculty.staffId}) at ${existing.checkInTime || existing.formattedTime} IST.`,
        });
      }
    } else if (mode === 'CHECK_OUT') {
      if (existing) {
        existing.checkOutTime = formattedTimeIST;
        existing.checkOutTimestamp = now.toISOString();
        existing.duration = computeDuration(existing.checkInTimestamp || existing.timestamp, existing.checkOutTimestamp);
        if (capturedFrameThumb) {
          existing.checkOutFrameThumb = capturedFrameThumb;
        }
        records[existingIndex] = existing;
        writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, records);

        return res.json({
          success: true,
          action: 'CHECK_OUT',
          alreadyMarked: false,
          record: existing,
          message: `Check-Out recorded for ${faculty.name} (${faculty.staffId}) at ${formattedTimeIST} IST. Working duration: ${existing.duration}`,
        });
      } else {
        // No check-in record today, create with both
        const status = calculateAttendanceStatus(now, settings);
        const newRecord: AttendanceRecord = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          facultyId: faculty.id,
          staffId: faculty.staffId,
          facultyName: faculty.name,
          department: faculty.department,
          date: todayIST,
          timestamp: now.toISOString(),
          formattedTime: formattedTimeIST,
          checkInTime: formattedTimeIST,
          checkInTimestamp: now.toISOString(),
          checkOutTime: formattedTimeIST,
          checkOutTimestamp: now.toISOString(),
          duration: '0m',
          similarityScore: similarityScore || 0.88,
          detectionConfidence: detectionConfidence || 0.95,
          status,
          verificationMethod,
          deviceSource,
          capturedFrameThumb: capturedFrameThumb || faculty.photoUrl,
        };
        records.unshift(newRecord);
        writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, records);

        return res.status(201).json({
          success: true,
          action: 'CHECK_OUT',
          alreadyMarked: false,
          record: newRecord,
          message: `Check-Out recorded for ${faculty.name} at ${formattedTimeIST} IST`,
        });
      }
    } else {
      // mode === 'AUTO' (Smart Kiosk Detection)
      if (existing) {
        if (existing.checkOutTime) {
          return res.json({
            success: true,
            action: 'COMPLETED',
            alreadyMarked: true,
            record: existing,
            message: `Attendance for ${faculty.name} (${faculty.staffId}) already completed today. In: ${existing.checkInTime} IST | Out: ${existing.checkOutTime} IST (Duration: ${existing.duration}).`,
          });
        }

        // Faculty has checked in, but not checked out yet.
        // As per requirement: Check-In marked only once; Check-Out is recorded ONLY when Check-Out option is selected.
        return res.json({
          success: true,
          action: 'ALREADY_CHECKED_IN',
          alreadyMarked: true,
          record: existing,
          message: `Check-In already recorded today for ${faculty.name} (${faculty.staffId}) at ${existing.checkInTime || existing.formattedTime} IST. Switch to 'Check-Out' mode to record departure.`,
        });
      }
    }

    // New Check-In record
    const status = calculateAttendanceStatus(now, settings);
    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      facultyId: faculty.id,
      staffId: faculty.staffId,
      facultyName: faculty.name,
      department: faculty.department,
      date: todayIST,
      timestamp: now.toISOString(),
      formattedTime: formattedTimeIST,
      checkInTime: formattedTimeIST,
      checkInTimestamp: now.toISOString(),
      checkOutTime: undefined,
      checkOutTimestamp: undefined,
      duration: undefined,
      similarityScore: similarityScore || 0.88,
      detectionConfidence: detectionConfidence || 0.95,
      status,
      verificationMethod,
      deviceSource,
      capturedFrameThumb: capturedFrameThumb || faculty.photoUrl,
    };

    records.unshift(newRecord);
    writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, records);

    res.status(201).json({
      success: true,
      action: 'CHECK_IN',
      alreadyMarked: false,
      record: newRecord,
      message: `Verified Check-In: ${faculty.name} (${faculty.staffId}) marked ${newRecord.status} at ${formattedTimeIST} IST`,
    });
  });

  // 4. Empty DB & Clear Logs Endpoints (Protected with Admin Key)
  app.post('/api/admin/empty-db', (req, res) => {
    const rawProvidedKey = 
      req.headers['x-admin-key'] || 
      req.headers['admin-key'] || 
      req.body?.adminKey || 
      req.body?.admin_key || 
      req.query?.adminKey || 
      req.query?.admin_key;

    const providedKey = rawProvidedKey ? String(rawProvidedKey).replace(/^["']|["']$/g, '').trim() : '';
    const expectedKey = getAdminKey();

    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Admin Key. Please provide the correct admin_key from .env to empty the database.',
      });
    }

    writeJsonFile<Faculty[]>(FACULTY_DB_PATH, []);
    writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);

    res.json({
      success: true,
      message: 'Both faculty database and attendance logs have been completely emptied.',
    });
  });

  app.post('/api/attendance/clear-logs', (req, res) => {
    const rawProvidedKey = 
      req.headers['x-admin-key'] || 
      req.headers['admin-key'] || 
      req.body?.adminKey || 
      req.body?.admin_key || 
      req.query?.adminKey || 
      req.query?.admin_key;

    const providedKey = rawProvidedKey ? String(rawProvidedKey).replace(/^["']|["']$/g, '').trim() : '';
    const expectedKey = getAdminKey();

    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Admin Key.',
      });
    }

    writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);
    res.json({
      success: true,
      message: 'All attendance logs have been cleared successfully.',
    });
  });

  // Delete a single attendance record by ID (requires Admin Key)
  app.delete('/api/attendance/:id', (req, res) => {
    const { id } = req.params;

    const rawProvidedKey =
      req.headers['x-admin-key'] ||
      req.headers['admin-key'] ||
      req.body?.adminKey ||
      req.body?.admin_key;

    const providedKey = rawProvidedKey ? String(rawProvidedKey).replace(/^["']|["']$/g, '').trim() : '';
    const expectedKey = getAdminKey();

    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Admin Key. Provide the correct admin_key from your .env file.',
      });
    }

    const records = readJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);
    const cleanId = String(id).trim().toLowerCase();
    const target = records.find((r: any) => String(r.id).trim().toLowerCase() === cleanId);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Attendance record not found.' });
    }

    const updated = records.filter((r: any) => String(r.id).trim().toLowerCase() !== cleanId);
    writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, updated);

    res.json({
      success: true,
      message: `Attendance record for ${(target as any).facultyName} (${(target as any).date}) has been permanently deleted.`,
    });
  });

  app.delete('/api/attendance/:id', (req, res) => {
    const { id } = req.params;
    const rawProvidedKey = 
      req.headers['x-admin-key'] || 
      req.headers['admin-key'] || 
      req.body?.adminKey || 
      req.body?.admin_key;

    const providedKey = rawProvidedKey ? String(rawProvidedKey).replace(/^["']|["']$/g, '').trim() : '';
    const expectedKey = getAdminKey();

    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin Key.' });
    }

    let records = readJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);
    records = records.filter((r) => r.id !== id);
    writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, records);

    res.json({ success: true, message: 'Attendance record deleted.' });
  });

  // 4. Dedicated Check-Out Endpoint
  app.post('/api/attendance/checkout', (req, res) => {
    const { recordId, facultyId } = req.body || {};
    const records = readJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, []);
    const now = new Date();
    const todayIST = getISTDateString(now);
    const formattedTimeIST = getISTTimeString(now);

    let targetIndex = -1;
    if (recordId) {
      targetIndex = records.findIndex((r) => r.id === recordId);
    } else if (facultyId) {
      const cleanFid = String(facultyId).toLowerCase();
      targetIndex = records.findIndex(
        (r) => (r.facultyId.toLowerCase() === cleanFid || r.staffId.toLowerCase() === cleanFid) && r.date === todayIST
      );
    }

    if (targetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'No active check-in record found to check out for today.',
      });
    }

    const target = records[targetIndex];
    target.checkOutTime = formattedTimeIST;
    target.checkOutTimestamp = now.toISOString();

    const startMs = new Date(target.checkInTimestamp || target.timestamp).getTime();
    const endMs = now.getTime();
    if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
      const diffM = Math.floor((endMs - startMs) / (1000 * 60));
      const hours = Math.floor(diffM / 60);
      const mins = diffM % 60;
      target.duration = hours === 0 ? `${mins}m` : `${hours}h ${mins}m`;
    } else {
      target.duration = '0m';
    }

    records[targetIndex] = target;
    writeJsonFile<AttendanceRecord[]>(ATTENDANCE_DB_PATH, records);

    res.json({
      success: true,
      record: target,
      message: `Check-out recorded for ${target.facultyName} (${target.staffId}) at ${formattedTimeIST} IST. Duration: ${target.duration}`,
    });
  });

  // 4. Analytics & Stats
  app.get('/api/stats', (req, res) => {
    const faculty = readJsonFile<Faculty[]>(FACULTY_DB_PATH, []);
    const records = readJsonFile(ATTENDANCE_DB_PATH, []);
    const todayStr = getISTDateString();

    const todayRecords = records.filter((r: any) => r.date === todayStr);
    const presentCount = todayRecords.length;
    const totalFaculty = faculty.length;
    const lateCount = todayRecords.filter((r: any) => r.status === 'LATE').length;
    const onTimeCount = presentCount - lateCount;
    const rate = totalFaculty > 0 ? Math.round((presentCount / totalFaculty) * 100) : 0;

    // Department breakdown
    const deptMap: Record<string, { total: number; present: number }> = {};
    faculty.forEach((f: any) => {
      if (!deptMap[f.department]) {
        deptMap[f.department] = { total: 0, present: 0 };
      }
      deptMap[f.department].total += 1;
    });

    todayRecords.forEach((r: any) => {
      if (deptMap[r.department]) {
        deptMap[r.department].present += 1;
      }
    });

    const departmentStats = Object.keys(deptMap).map((d) => ({
      department: d,
      totalFaculty: deptMap[d].total,
      presentToday: deptMap[d].present,
      attendanceRate: deptMap[d].total > 0 ? Math.round((deptMap[d].present / deptMap[d].total) * 100) : 0,
    }));

    res.json({
      success: true,
      today: todayStr,
      totalFaculty,
      presentCount,
      absentCount: Math.max(0, totalFaculty - presentCount),
      lateCount,
      onTimeCount,
      attendanceRate: rate,
      departmentStats,
    });
  });

  // 5. System Settings API
  app.get('/api/settings', (req, res) => {
    const settings = readJsonFile(SETTINGS_DB_PATH, DEFAULT_SETTINGS);
    res.json({ success: true, data: settings });
  });

  app.post('/api/settings', (req, res) => {
    const updated = req.body;
    writeJsonFile(SETTINGS_DB_PATH, updated);
    res.json({ success: true, data: updated, message: 'Biometric settings saved.' });
  });

  // Vite Mounting
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ADIC Face App] Attendance Engine Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
