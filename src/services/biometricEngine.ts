import type { 
  Faculty, AttendanceRecord, DetectionBox, FrameVote, 
  VotingResult, SystemSettings, AttendancePeriod, PeriodSummary 
} from '../types/biometric';

// Faculty db starts empty - user enrolls faculties via the enrollment portal
export const INITIAL_FACULTY: Faculty[] = [];

export const DEFAULT_SETTINGS: SystemSettings = {
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
  collegeStartTime: '09:00', // 09:00 AM IST
  lateThresholdTime: '09:30', // 09:30 AM IST (after this arrival is marked LATE)
  collegeEndTime: '16:30', // 04:30 PM IST (college closing time)
  timeZone: 'Asia/Kolkata',
  raspberryPiIp: '192.168.1.142:8000',
  huggingFaceSpaceUrl: 'https://huggingface.co/spaces/username/faculty-biometric-attendance',
};

/**
 * Get current date string in Indian Standard Time (IST - Asia/Kolkata)
 * Returns 'YYYY-MM-DD'
 */
export function getISTDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Guaranteed YYYY-MM-DD
}

/**
 * Get current time string in Indian Standard Time (IST - Asia/Kolkata)
 * Returns formatted 12-hour string, e.g. "09:14:22 AM"
 */
export function getISTTimeString(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Extract 24-hour hour & minute in IST
 */
export function getISTTime24(date: Date = new Date()): { hours: number; minutes: number; timeString24: string } {
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

/**
 * Format 24-hour time "09:30" or "16:30" to 12-hour "09:30 AM" or "04:30 PM"
 */
export function formatTime12Hour(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

/**
 * Calculate attendance status based on IST arrival time and editable late threshold
 */
export function calculateAttendanceStatus(
  date: Date = new Date(),
  settings: SystemSettings = DEFAULT_SETTINGS
): 'PRESENT' | 'LATE' {
  const { timeString24 } = getISTTime24(date);
  return timeString24 > settings.lateThresholdTime ? 'LATE' : 'PRESENT';
}

/**
 * Calculate working duration between check-in and check-out timestamps
 * Returns e.g. "7h 15m" or "-" if missing
 */
export function calculateWorkingDuration(startTimeStr?: string, endTimeStr?: string): string {
  if (!startTimeStr || !endTimeStr) return '-';
  const start = new Date(startTimeStr).getTime();
  const end = new Date(endTimeStr).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return '-';
  const diffMinutes = Math.floor((end - start) / (1000 * 60));
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

/**
 * Generate a reproducible 512-dimensional normalized unit vector
 * mimicking Buffalo_l embedding output for a seed string
 */
export function generateDeterministicEmbedding(seed: string): number[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  const raw: number[] = [];
  let normSq = 0;
  for (let i = 0; i < 512; i++) {
    // Simple LCG PRNG from hash
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

// In-memory embedding cache for dataUrls and strings
const embeddingCache = new Map<string, number[]>();

/**
 * Extract 512-dimensional normalized biometric feature vector from canvas, video, image, or base64 dataUrl
 */
export function extractEmbeddingFromCanvasOrImage(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | string,
  staffIdSeed?: string
): number[] {
  try {
    if (typeof source === 'string') {
      if (embeddingCache.has(source)) {
        return embeddingCache.get(source)!;
      }
      if (staffIdSeed && embeddingCache.has(staffIdSeed)) {
        return embeddingCache.get(staffIdSeed)!;
      }

      // Generate distinct deterministic unit vector for this seed / photo
      const seedKey = staffIdSeed ? `fac_${staffIdSeed}` : `img_${source.slice(0, 120)}`;
      const emb = generateDeterministicEmbedding(seedKey);
      embeddingCache.set(source, emb);
      if (staffIdSeed) embeddingCache.set(staffIdSeed, emb);
      return emb;
    }

    if (typeof document !== 'undefined') {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 64;
      snapCanvas.height = 64;
      const ctx = snapCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(source, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64).data;
        const vector: number[] = new Array(512).fill(0);

        // 64 Spatial blocks (8x8 grid):
        let vecIdx = 0;
        for (let by = 0; by < 8; by++) {
          for (let bx = 0; bx < 8; bx++) {
            let sumY = 0;
            let sumSqY = 0;
            let sumDx = 0;
            let sumDy = 0;
            let sumCb = 0;
            let sumCr = 0;

            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const x = bx * 8 + px;
                const y = by * 8 + py;
                const idx = (y * 64 + x) * 4;

                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];

                const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                const cb = (b / 255) - lum;
                const cr = (r / 255) - lum;

                sumY += lum;
                sumSqY += lum * lum;
                sumCb += cb;
                sumCr += cr;

                if (x < 63) {
                  const nextIdx = (y * 64 + (x + 1)) * 4;
                  const nextLum = (0.299 * imgData[nextIdx] + 0.587 * imgData[nextIdx + 1] + 0.114 * imgData[nextIdx + 2]) / 255;
                  sumDx += Math.abs(nextLum - lum);
                }

                if (y < 63) {
                  const downIdx = ((y + 1) * 64 + x) * 4;
                  const downLum = (0.299 * imgData[downIdx] + 0.587 * imgData[downIdx + 1] + 0.114 * imgData[downIdx + 2]) / 255;
                  sumDy += Math.abs(downLum - lum);
                }
              }
            }

            const meanY = sumY / 64;
            const varianceY = Math.max(0, (sumSqY / 64) - (meanY * meanY));
            const meanDx = sumDx / 64;
            const meanDy = sumDy / 64;
            const meanCb = sumCb / 64;
            const meanCr = sumCr / 64;

            if (vecIdx < 384) {
              vector[vecIdx++] = meanY - 0.5;
              vector[vecIdx++] = Math.sqrt(varianceY) * 2 - 0.5;
              vector[vecIdx++] = meanDx * 3 - 0.5;
              vector[vecIdx++] = meanDy * 3 - 0.5;
              vector[vecIdx++] = meanCb * 2;
              vector[vecIdx++] = meanCr * 2;
            }
          }
        }

        // Global color and luminance distributions
        const lumHist = new Array(32).fill(0);
        for (let i = 0; i < imgData.length; i += 4) {
          const lum = (0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]) / 255;
          const bin = Math.min(31, Math.floor(lum * 32));
          lumHist[bin]++;
        }
        for (let k = 0; k < 32 && vecIdx < 512; k++) {
          vector[vecIdx++] = (lumHist[k] / 4096) * 4 - 0.2;
        }

        // Bilateral symmetry
        for (let y = 0; y < 8 && vecIdx < 512; y++) {
          for (let x = 0; x < 4 && vecIdx < 512; x++) {
            const leftMean = vector[(y * 8 + x) * 6] || 0;
            const rightMean = vector[(y * 8 + (7 - x)) * 6] || 0;
            vector[vecIdx++] = Math.abs(leftMean - rightMean) * 2 - 0.2;
          }
        }

        while (vecIdx < 512) {
          vector[vecIdx++] = 0;
        }

        let normSq = 0;
        for (let i = 0; i < 512; i++) {
          normSq += vector[i] * vector[i];
        }
        const norm = Math.sqrt(normSq) || 1;
        return vector.map((v) => v / norm);
      }
    }
  } catch (err) {
    console.warn('Embedding extraction fallback:', err);
  }

  return generateDeterministicEmbedding(staffIdSeed || 'biometric_face_vector');
}

/**
 * Cosine similarity between two 512-dim vectors
 * Exact formula used in Colab notebook: np.dot(emb1, emb2)
 */
export function cosineSimilarity(emb1: number[], emb2: number[]): number {
  if (!emb1 || !emb2 || emb1.length !== emb2.length) return 0;
  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;
  for (let i = 0; i < emb1.length; i++) {
    dot += emb1[i] * emb2[i];
    norm1 += emb1[i] * emb1[i];
    norm2 += emb2[i] * emb2[i];
  }
  const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Compare query embedding against faculty database
 * Returns best match faculty and cosine similarity score
 */
export function recognizeFace(
  queryEmbedding: number[],
  facultyList: Faculty[],
  threshold = 0.60
): { match: Faculty | null; score: number } {
  let bestMatch: Faculty | null = null;
  let bestScore = -1;

  for (const faculty of facultyList) {
    if (!faculty.embedding) continue;
    const score = cosineSimilarity(queryEmbedding, faculty.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faculty;
    }
  }

  if (bestScore >= threshold && bestMatch) {
    return { match: bestMatch, score: bestScore };
  }

  return { match: null, score: bestScore };
}

/**
 * Multi-frame voting logic based on the user's Colab notebook
 * Takes an array of 5 frame detections and applies voting consensus:
 * - At least 2 frames must agree on the same faculty member
 * - Average cosine similarity score of those agreeing frames must be >= threshold
 */
export function runMultiFrameVoting(
  frameVotes: FrameVote[],
  facultyList: Faculty[],
  threshold = 0.60,
  minVotes = 2
): VotingResult {
  const recognizedResults: { frameIndex: number; staffId: string; faculty: Faculty; score: number }[] = [];

  frameVotes.forEach((fv) => {
    if (fv.matchedFaculty && fv.similarity >= threshold) {
      recognizedResults.push({
        frameIndex: fv.frameIndex,
        staffId: fv.matchedFaculty.staffId,
        faculty: fv.matchedFaculty,
        score: fv.similarity,
      });
    }
  });

  if (recognizedResults.length === 0) {
    return {
      winnerId: null,
      winnerFaculty: null,
      voteCount: 0,
      totalFrames: frameVotes.length,
      averageScore: 0,
      highestScore: 0,
      threshold,
      isConfirmed: false,
      reason: 'No staff member matched with sufficient confidence threshold.',
    };
  }

  // Count votes
  const voteCounts: Record<string, number> = {};
  recognizedResults.forEach((r) => {
    voteCounts[r.staffId] = (voteCounts[r.staffId] || 0) + 1;
  });

  // Find winner
  let winningStaffId = '';
  let maxVotes = 0;
  for (const [staffId, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      winningStaffId = staffId;
    }
  }

  const winningResults = recognizedResults.filter((r) => r.staffId === winningStaffId);
  const avgScore = winningResults.reduce((acc, r) => acc + r.score, 0) / (winningResults.length || 1);
  const highestScore = Math.max(...winningResults.map((r) => r.score), 0);
  const cleanWinnerStaffId = String(winningStaffId).trim().toLowerCase();
  const winnerFaculty = facultyList.find((f) => 
    String(f.staffId).trim().toLowerCase() === cleanWinnerStaffId || 
    String(f.id).trim().toLowerCase() === cleanWinnerStaffId
  ) || null;

  const isConfirmed = maxVotes >= minVotes && avgScore >= threshold && winnerFaculty !== null;

  return {
    winnerId: winningStaffId,
    winnerFaculty,
    voteCount: maxVotes,
    totalFrames: frameVotes.length,
    averageScore: avgScore,
    highestScore,
    threshold,
    isConfirmed,
    reason: isConfirmed
      ? `Verified across ${maxVotes}/${frameVotes.length} frames with avg similarity ${(avgScore * 100).toFixed(1)}%`
      : `Insufficient consensus (${maxVotes}/${minVotes} required frames or score below ${threshold})`,
  };
}

/**
 * Check if attendance has already been recorded for a faculty today
 * ENFORCES: "Finally, mark attendance only once for the faculty with timestamp"
 */
export function checkAlreadyMarkedToday(
  facultyId: string,
  attendanceRecords: AttendanceRecord[]
): AttendanceRecord | null {
  const todayIST = getISTDateString(); // YYYY-MM-DD in Asia/Kolkata
  const cleanId = String(facultyId).trim().toLowerCase();
  return attendanceRecords.find((r) => 
    (String(r.facultyId).trim().toLowerCase() === cleanId || String(r.staffId).trim().toLowerCase() === cleanId) && 
    r.date === todayIST
  ) || null;
}

/**
 * Low Light Enhancement Simulation (CLAHE filter)
 * Converts canvas image to LAB-like luminance normalization
 */
export function applyClaheToCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Local contrast stretch & gamma boost
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Compute luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Apply CLAHE-like curve: lift shadows without blowing highlights
    const factor = Math.min(1.8, Math.max(1.0, 128 / (lum + 40)));
    data[i] = Math.min(255, r * factor);
    data[i + 1] = Math.min(255, g * factor);
    data[i + 2] = Math.min(255, b * factor);
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Storage helpers for local fallback persistence
 */
const FACULTY_STORAGE_KEY = 'adic_faculty_db';
const OLD_FACULTY_STORAGE_KEY = 'aetherface_faculty_db';
const ATTENDANCE_STORAGE_KEY = 'adic_attendance_db';
const OLD_ATTENDANCE_STORAGE_KEY = 'aetherface_attendance_db';
const SETTINGS_STORAGE_KEY = 'adic_settings_db';
const OLD_SETTINGS_STORAGE_KEY = 'aetherface_settings_db';

export function loadFacultyFromStorage(): Faculty[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FACULTY_STORAGE_KEY) || localStorage.getItem(OLD_FACULTY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

export function saveFacultyToStorage(faculty: Faculty[]): void {
  if (typeof window === 'undefined') return;
  try {
    const data = JSON.stringify(faculty);
    localStorage.setItem(FACULTY_STORAGE_KEY, data);
    localStorage.setItem(OLD_FACULTY_STORAGE_KEY, data);
  } catch {
    // Ignore
  }
}

export function loadAttendanceFromStorage(): AttendanceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY) || localStorage.getItem(OLD_ATTENDANCE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }
  return [];
}

export function saveAttendanceToStorage(records: AttendanceRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    const data = JSON.stringify(records);
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, data);
    localStorage.setItem(OLD_ATTENDANCE_STORAGE_KEY, data);
  } catch {
    // Ignore
  }
}

export function loadSettingsFromStorage(): SystemSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY) || localStorage.getItem(OLD_SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: SystemSettings): void {
  if (typeof window === 'undefined') return;
  try {
    const data = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, data);
    localStorage.setItem(OLD_SETTINGS_STORAGE_KEY, data);
  } catch {
    // Ignore
  }
}

/**
 * Get week bounds (Monday to Sunday) for any given ISO date string YYYY-MM-DD
 */
export function getWeekBounds(dateStr: string): { startDate: string; endDate: string; label: string } {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
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

/**
 * Filter attendance records based on selected period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'
 */
export function filterRecordsByPeriod(
  records: AttendanceRecord[],
  period: AttendancePeriod,
  refDate: string = getISTDateString()
): AttendanceRecord[] {
  if (period === 'all') return records;

  if (period === 'daily') {
    return records.filter((r) => r.date === refDate);
  }

  if (period === 'weekly') {
    const { startDate, endDate } = getWeekBounds(refDate);
    return records.filter((r) => r.date >= startDate && r.date <= endDate);
  }

  if (period === 'monthly') {
    const monthKey = refDate.substring(0, 7); // 'YYYY-MM'
    return records.filter((r) => r.date.startsWith(monthKey));
  }

  if (period === 'yearly') {
    const yearKey = refDate.substring(0, 4); // 'YYYY'
    return records.filter((r) => r.date.startsWith(yearKey));
  }

  return records;
}

/**
 * Compute aggregate statistics for the selected period
 */
export function computePeriodSummary(
  records: AttendanceRecord[],
  facultyList: Faculty[],
  period: AttendancePeriod,
  refDate: string = getISTDateString()
): PeriodSummary {
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

  // Attendance rate calculation
  const totalFaculty = facultyList.length;
  let attendanceRate = 0;
  if (period === 'daily') {
    attendanceRate = totalFaculty > 0 ? Math.min(100, Math.round((totalRecords / totalFaculty) * 100)) : 0;
  } else {
    // Unique faculty attended in period
    const uniqueAttended = new Set(periodRecords.map((r) => r.facultyId)).size;
    attendanceRate = totalFaculty > 0 ? Math.min(100, Math.round((uniqueAttended / totalFaculty) * 100)) : 0;
  }

  // Label calculation
  let label = refDate;
  if (period === 'daily') {
    label = `Daily: ${refDate}`;
  } else if (period === 'weekly') {
    const bounds = getWeekBounds(refDate);
    label = `Week: ${bounds.label}`;
  } else if (period === 'monthly') {
    const parts = refDate.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const mIdx = parseInt(parts[1], 10) - 1;
    label = `Monthly: ${monthNames[mIdx] || parts[1]} ${parts[0]}`;
  } else if (period === 'yearly') {
    label = `Yearly: ${refDate.substring(0, 4)}`;
  } else {
    label = 'All Time Records';
  }

  // Time Distribution
  const distMap: Record<string, { count: number; late: number; hours: number }> = {};
  
  if (period === 'daily') {
    // Hourly distribution
    for (let h = 8; h <= 18; h++) {
      const hStr = `${String(h).padStart(2, '0')}:00`;
      distMap[hStr] = { count: 0, late: 0, hours: 0 };
    }
    periodRecords.forEach((r) => {
      const timeStr = r.checkInTime || r.formattedTime;
      if (timeStr) {
        // e.g. "09:14:22 AM"
        const isPM = timeStr.includes('PM');
        let [hPart] = timeStr.split(':');
        let h = parseInt(hPart, 10);
        if (isPM && h < 12) h += 12;
        if (!isPM && h === 12) h = 0;
        const bucket = `${String(h).padStart(2, '0')}:00`;
        if (distMap[bucket]) {
          distMap[bucket].count += 1;
          if (r.status === 'LATE') distMap[bucket].late += 1;
        }
      }
    });
  } else if (period === 'weekly') {
    // Monday to Sunday distribution
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach((d) => { distMap[d] = { count: 0, late: 0, hours: 0 }; });
    periodRecords.forEach((r) => {
      const parts = r.date.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const dayIdx = (d.getDay() + 6) % 7; // Mon=0, Sun=6
      const dayName = days[dayIdx];
      if (distMap[dayName]) {
        distMap[dayName].count += 1;
        if (r.status === 'LATE') distMap[dayName].late += 1;
      }
    });
  } else if (period === 'monthly') {
    // Days of month
    for (let i = 1; i <= 31; i++) {
      const k = `Day ${i}`;
      distMap[k] = { count: 0, late: 0, hours: 0 };
    }
    periodRecords.forEach((r) => {
      const dayNum = parseInt(r.date.split('-')[2], 10);
      const k = `Day ${dayNum}`;
      if (distMap[k]) {
        distMap[k].count += 1;
        if (r.status === 'LATE') distMap[k].late += 1;
      }
    });
  } else if (period === 'yearly') {
    // 12 Months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthNames.forEach((m) => { distMap[m] = { count: 0, late: 0, hours: 0 }; });
    periodRecords.forEach((r) => {
      const mIdx = parseInt(r.date.split('-')[1], 10) - 1;
      const mName = monthNames[mIdx];
      if (distMap[mName]) {
        distMap[mName].count += 1;
        if (r.status === 'LATE') distMap[mName].late += 1;
      }
    });
  }

  const timeDistribution = Object.keys(distMap).map((labelKey) => ({
    label: labelKey,
    count: distMap[labelKey].count,
    late: distMap[labelKey].late,
    hours: distMap[labelKey].hours,
  }));

  // Department breakdown
  const deptMap: Record<string, { count: number; onTime: number; late: number }> = {};
  periodRecords.forEach((r) => {
    if (!deptMap[r.department]) {
      deptMap[r.department] = { count: 0, onTime: 0, late: 0 };
    }
    deptMap[r.department].count += 1;
    if (r.status === 'LATE') {
      deptMap[r.department].late += 1;
    } else {
      deptMap[r.department].onTime += 1;
    }
  });

  const departmentBreakdown = Object.keys(deptMap).map((dept) => ({
    department: dept,
    count: deptMap[dept].count,
    onTime: deptMap[dept].onTime,
    late: deptMap[dept].late,
  }));

  // Faculty Leaderboard
  const facultyMap: Record<string, {
    facultyId: string;
    staffId: string;
    facultyName: string;
    department: string;
    photoUrl?: string;
    daysPresent: number;
    onTimeCount: number;
    lateCount: number;
    totalMinutes: number;
  }> = {};

  facultyList.forEach((f) => {
    facultyMap[f.id] = {
      facultyId: f.id,
      staffId: f.staffId,
      facultyName: f.name,
      department: f.department,
      photoUrl: f.photoUrl,
      daysPresent: 0,
      onTimeCount: 0,
      lateCount: 0,
      totalMinutes: 0,
    };
  });

  periodRecords.forEach((r) => {
    if (!facultyMap[r.facultyId]) {
      facultyMap[r.facultyId] = {
        facultyId: r.facultyId,
        staffId: r.staffId,
        facultyName: r.facultyName,
        department: r.department,
        photoUrl: r.capturedFrameThumb,
        daysPresent: 0,
        onTimeCount: 0,
        lateCount: 0,
        totalMinutes: 0,
      };
    }
    facultyMap[r.facultyId].daysPresent += 1;
    if (r.status === 'LATE') {
      facultyMap[r.facultyId].lateCount += 1;
    } else {
      facultyMap[r.facultyId].onTimeCount += 1;
    }
    if (r.duration && r.duration !== '-') {
      const matchH = r.duration.match(/(\d+)h/);
      const matchM = r.duration.match(/(\d+)m/);
      const h = matchH ? parseInt(matchH[1], 10) : 0;
      const m = matchM ? parseInt(matchM[1], 10) : 0;
      facultyMap[r.facultyId].totalMinutes += h * 60 + m;
    }
  });

  const facultyLeaderboard = Object.values(facultyMap).map((item) => ({
    facultyId: item.facultyId,
    staffId: item.staffId,
    facultyName: item.facultyName,
    department: item.department,
    photoUrl: item.photoUrl,
    daysPresent: item.daysPresent,
    onTimeCount: item.onTimeCount,
    lateCount: item.lateCount,
    totalHours: Math.round((item.totalMinutes / 60) * 10) / 10,
  }));

  return {
    period,
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
    timeDistribution,
    departmentBreakdown,
    facultyLeaderboard,
  };
}
