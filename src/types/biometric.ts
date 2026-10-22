export interface Faculty {
  id: string; // e.g. "stt001"
  staffId: string; // e.g. "STT001"
  name: string; // e.g. "Dr. Prajan Kumar"
  department: string; // e.g. "Computer Science & Engineering"
  designation: string; // e.g. "Associate Professor"
  email: string;
  phone: string;
  photoUrl: string;
  enrolledAt: string;
  embeddingCount: number;
  embedding?: number[]; // legacy 512-dim pixel embedding (fallback)
  faceDescriptor?: number[]; // real 128-dim face-api.js CNN descriptor (preferred)
  status: 'active' | 'on_leave' | 'inactive';
}

export interface AttendanceRecord {
  id: string;
  facultyId: string;
  staffId: string;
  facultyName: string;
  department: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string of initial check-in
  formattedTime: string; // Check-in time e.g. "09:14:22 AM"
  checkInTime?: string; // e.g. "09:14:22 AM"
  checkInTimestamp?: string;
  checkOutTime?: string; // e.g. "04:30:15 PM"
  checkOutTimestamp?: string;
  duration?: string; // e.g. "7h 15m"
  similarityScore: number; // e.g. 0.8845
  detectionConfidence: number; // e.g. 0.94
  status: 'PRESENT' | 'LATE' | 'ON_DUTY';
  verificationMethod: 'YOLO_BUFFALO_ONNX' | 'MULTI_FRAME_VOTE' | 'MANUAL_OVERRIDE';
  deviceSource: 'WEB_KIOSK' | 'RASPBERRY_PI_CAM' | 'HF_SPACE_API';
  capturedFrameThumb?: string;
  checkOutFrameThumb?: string;
}

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label?: string;
  similarity?: number;
  matchedFaculty?: Faculty | null;
}

export interface FrameVote {
  frameIndex: number;
  timestamp: number;
  detected: boolean;
  box?: DetectionBox;
  matchedFaculty?: Faculty | null;
  similarity: number;
}

export interface VotingResult {
  winnerId: string | null;
  winnerFaculty: Faculty | null;
  voteCount: number;
  totalFrames: number;
  averageScore: number;
  highestScore: number;
  threshold: number;
  isConfirmed: boolean;
  reason?: string;
}

export interface SystemSettings {
  yoloConfidence: number; // default 0.40
  buffaloThreshold: number; // default 0.60
  numFramesVote: number; // default 5
  minVotingAgreement: number; // default 2
  faceMargin: number; // default 0.25 (25% expansion around face box)
  lowLightEnhanceCLAHE: boolean; // default true
  soundEffects: boolean; // default true
  speechAnnouncements: boolean; // default true
  autoContinuousScan: boolean; // default false
  scanIntervalMs: number; // default 1200
  collegeStartTime: string; // e.g. "09:00" (IST)
  lateThresholdTime: string; // e.g. "09:30" (IST)
  collegeEndTime: string; // e.g. "16:30" (IST)
  timeZone: string; // "Asia/Kolkata"
  raspberryPiIp: string;
  huggingFaceSpaceUrl: string;
}

export interface DepartmentStat {
  department: string;
  totalFaculty: number;
  presentToday: number;
  attendanceRate: number;
}

export type AttendancePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export interface PeriodSummary {
  period: AttendancePeriod;
  label: string;
  totalRecords: number;
  presentCount: number;
  lateCount: number;
  onTimeCount: number;
  checkedOutCount: number;
  totalHoursWorked: number;
  averageDurationMinutes: number;
  punctualityRate: number;
  attendanceRate: number;
  timeDistribution: { label: string; count: number; late: number; hours: number }[];
  departmentBreakdown: { department: string; count: number; onTime: number; late: number }[];
  facultyLeaderboard: {
    facultyId: string;
    staffId: string;
    facultyName: string;
    department: string;
    photoUrl?: string;
    daysPresent: number;
    onTimeCount: number;
    lateCount: number;
    totalHours: number;
  }[];
}
