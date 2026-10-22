# ⚡ ADIC Face App - AI Biometric Faculty Attendance System

> **High-performance, edge-capable biometric face recognition attendance kiosk for college faculty and educational institutions. Features real-time face tracking, automatic check-in/check-out calculation, Indian Standard Time (IST) synchronization, anti-duplicate controls, admin-secured log deletion, and cloud sync readiness.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Vercel Ready](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Core Architecture & Capabilities](#core-architecture--capabilities)
- [Project Structure](#project-structure)
- [Quick Start Guide](#quick-start-guide)
- [Configuration & Environment Variables](#configuration--environment-variables)
- [Admin Security & Log Deletion](#admin-security--log-deletion)
- [Firebase Cloud Sync Integration Guide](#firebase-cloud-sync-integration-guide)
  - [Step 1: Firebase Project Setup](#step-1-firebase-project-setup)
  - [Step 2: Environment Variables](#step-2-environment-variables)
  - [Step 3: Firestore Schema](#step-3-firestore-schema)
  - [Step 4: Implementation Code Example](#step-4-implementation-code-example)
- [Vercel Deployment Guide](#vercel-deployment-guide)
- [Database Files (faculty.db & attendance.db)](#database-files-facultydb--attendancedb)
- [Scan Modes & Biometric Engine](#scan-modes--biometric-engine)
- [Unknown Person Detection](#unknown-person-detection)
- [REST API Reference](#rest-api-reference)
- [Contributing & Open Source Development](#contributing--open-source-development)
- [License](#license)

---

## Overview

**ADIC Face App** is an intelligent biometric kiosk application engineered for university campuses, research departments, and schools. Running directly in modern web browsers or edge devices (such as Raspberry Pi 4/5 or local kiosks), ADIC Face App captures live webcam frames and performs real-time face detection and matching against an enrolled faculty directory.

### Key Highlights
- **Zero Mandatory External API Dependencies**: Facial recognition executes client-side via optimized neural network weights (Face-API.js with SSD MobileNet V1 & 128-dimensional facial embeddings) and can optionally connect to high-dimensional YOLO / Buffalo ONNX pipelines.
- **Strict Single Attendance per Day**: A faculty member's check-in is logged once per day (IST). Subsequent detections within the same day are recognized but prevent duplicate entries.
- **Explicit Check-Out Workflow**: Check-in happens automatically on face identification; check-out is triggered on request, calculating accurate working hours (`Xh Ym`).
- **Granular Security Controls**: Both single-record deletion and bulk history purge require a verified `admin_key` matching the environment configuration.
- **Offline & Cloud Hybrid**: Operates completely offline with local JSON databases (`faculty.db`, `attendance.db`) and browser `localStorage`, with turn-key support for Firebase Firestore cloud synchronization.

---

## Core Architecture & Capabilities

```
┌────────────────────────────────────────────────────────────────────────┐
│                          AETHERFACE KIOSK                              │
├───────────────────────────────┬────────────────────────────────────────┤
│     CLIENT (React 19 + Vite)  │         SERVER (Node.js + Express)     │
│  - Real-Time Live Webcam      │  - REST API Endpoints                  │
│  - Face-API.js Neural Nets    │  - JSON Storage (faculty.db,           │
│  - Bounding Box Tracking      │    attendance.db, settings.db)         │
│  - Offline LocalStorage Cache │  - Admin Authentication Verification   │
│  - Biometric Sound Feedback   │  - Hardware GPIO Hooks (Raspberry Pi)  │
└───────────────┬───────────────┴───────────────────┬────────────────────┘
                │                                   │
                ▼                                   ▼
      [ Vercel / Edge SPA ]               [ Firebase / Cloud DB ]
   (Deploys frontend anywhere)          (Syncs logs to Firestore)
```

---

## Project Structure

```
aetherface/
├── .env                  # Local secret configuration (ignored by git)
├── .env.example          # Environment variable template
├── .gitignore            # Git exclusion rules for node_modules, logs, secrets
├── vercel.json           # Vercel deployment and SPA routing configuration
├── package.json          # Dependencies and build scripts
├── vite.config.ts        # Vite build tool and dev server configuration
├── tsconfig.json         # TypeScript compiler configuration
├── server.ts             # Express backend server with REST endpoints
├── faculty.db            # Enrolled faculty JSON database
├── attendance.db         # Attendance logs JSON database
├── public/
│   └── models/           # Face-API neural network model weights
│       ├── ssd_mobilenetv1_model-weights_manifest.json
│       ├── face_landmark_68_model-weights_manifest.json
│       └── face_recognition_model-weights_manifest.json
└── src/
    ├── App.tsx                    # Main app container & security gate
    ├── main.tsx                   # React application entry point
    ├── index.css                  # TailwindCSS design system & animations
    ├── types/
    │   └── biometric.ts           # TypeScript interfaces & data contracts
    ├── services/
    │   ├── biometricEngine.ts     # Euclidean distance, IST time, formatters
    │   ├── faceRecognition.ts    # Model loader, face matcher, tensor utils
    │   └── biometricAudio.ts      # Sound synthesis for scan confirmation
    └── components/
        ├── LiveScanner.tsx        # High-FPS face tracker & bounding boxes
        ├── AttendanceManagement.tsx# Attendance register, filters, admin delete
        ├── FacultyManagement.tsx   # Enrollment modal, photo upload, delete
        ├── Dashboard.tsx          # Real-time department metrics & KPIs
        ├── RaspberryPiHardware.tsx# Edge pinout & hardware integration guide
        └── SystemSettings.tsx     # College hours, grace period, thresholds
```

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- A working **Webcam** (USB or integrated)

### 1. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/Amcet-Digital-Innovation-Cell/ADIC-face-based-attendance-system.git
cd aetherface
npm install
```

### 2. Configure Environment
Copy the sample environment file to `.env`:
```bash
cp .env.example .env
```
Open `.env` and configure your admin key:
```env
admin_key="admin123"
PORT=3000
```

### 3. Run Development Server
Start the unified Express API + Vite hot-reloading dev server:
```bash
npm run dev
```
Navigate to **`http://localhost:3000`** in your browser.

### 4. Build for Production
To build the optimized static production bundle:
```bash
npm run build
```
To run the production server:
```bash
npm start
```

---

## Configuration & Environment Variables

Create or edit your `.env` file in the project root:

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `admin_key` | **Yes** | `admin123` | Password required to unlock the kiosk, delete attendance logs, purge registers, and delete faculty. |
| `PORT` | No | `3000` | Port on which the local Express server listens. |
| `APP_URL` | No | `http://localhost:3000` | Base URL used for API calls and CORS origin checks. |
| `FIREBASE_PROJECT_ID` | Optional | — | Firebase project ID for cloud log syncing. |
| `FIREBASE_CLIENT_EMAIL`| Optional | — | Service account email from Firebase IAM credentials. |
| `FIREBASE_PRIVATE_KEY` | Optional | — | Private RSA key from Firebase service account credentials. |

---

## Admin Security & Log Deletion

ADIC Face App implements strict access control for critical operations:

### 1. System Lock Gate
Upon opening the application, the kiosk enters a locked state. Entering the authorized `admin_key` unlocks the dashboard, scanner, and management modules.

### 2. Single Attendance Log Deletion
In **Attendance Logs** (`AttendanceManagement.tsx`):
1. Each record in the table includes a **Trash (🗑️)** icon button.
2. Clicking the delete icon opens a secure modal confirming the faculty name, date, and check-in timestamp.
3. The administrator **must enter the `admin_key`** to authorize the deletion.
4. The frontend sends `DELETE /api/attendance/:id` with the `x-admin-key` header.
5. The record is permanently deleted from `attendance.db`, and the table updates immediately.

### 3. Bulk History Purge
The **Clear History** button also prompts for the `admin_key` before wiping all records in `attendance.db`.

---

## Firebase Cloud Sync Integration Guide

If you plan to store attendance logs in **Google Firebase Cloud Firestore**, follow these steps:

### Step 1: Firebase Project Setup
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and name it (e.g., `aetherface-attendance`).
3. In the sidebar, navigate to **Build > Firestore Database** and click **Create database**.
4. Choose **Start in production mode** (or test mode for initial development) and select your preferred region.
5. In **Project Settings > Service Accounts**, click **Generate new private key**. Download the resulting JSON file.

### Step 2: Environment Variables
Add the service account credentials to your `.env` file (or Vercel Environment Variables):

```env
# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID="aetherface-prod"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xyz@aetherface-prod.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
```

### Step 3: Firestore Schema
Attendance logs are written to the `attendance_logs` collection:

```json
{
  "id": "att_1729602400000_1234",
  "facultyId": "fac_01",
  "facultyName": "Dr. Sarah Mitchell",
  "staffId": "FAC-CS-001",
  "department": "Computer Science",
  "date": "2026-10-22",
  "checkInTime": "09:05:12",
  "checkOutTime": "17:15:30",
  "duration": "8h 10m",
  "status": "PRESENT",
  "similarityScore": 0.94,
  "detectionConfidence": 0.98,
  "verificationMethod": "FACE_API_SSD",
  "deviceSource": "KIOSK-MAIN-01",
  "timestamp": 1729602400000,
  "createdAt": "2026-10-22T03:35:12.000Z"
}
```

### Step 4: Implementation Code Example
To connect Firebase in `server.ts` or as a background service:

```bash
npm install firebase-admin
```

Create `services/firebaseService.ts`:
```typescript
import admin from 'firebase-admin';

if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.apps.length ? admin.firestore() : null;

export async function syncRecordToFirebase(record: any) {
  if (!db) return;
  try {
    await db.collection('attendance_logs').doc(record.id).set(record, { merge: true });
    console.log(`[Firebase] Successfully synced record ${record.id}`);
  } catch (error) {
    console.error('[Firebase] Sync failed:', error);
  }
}
```

---

## Vercel Deployment Guide

ADIC Face App is configured for deployment to **Vercel** as a high-speed Single Page Application (SPA).

### Method A: Deploy via GitHub (Recommended)
1. Push your repository to GitHub.
2. Log in to [Vercel](https://vercel.com/) and click **Add New > Project**.
3. Import your `aetherface` repository.
4. Vercel automatically detects the Vite framework using `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. In **Environment Variables**, add:
   - `admin_key`: your secure admin password (e.g., `admin123`)
6. Click **Deploy**.

### Method B: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Client-Side Fallback Behavior on Vercel
When deployed on Vercel's static edge network without a separate Node.js server:
- The React application runs entirely in the browser.
- All face-api models are loaded directly from the `/models` directory in the static bundle.
- Attendance records and faculty profiles are stored and updated in `localStorage` with full CRUD support.
- If you pair Vercel with Firebase (see above), attendance logs automatically stream to Firestore in real time.

---

## Database Files (`faculty.db` & `attendance.db`)

ADIC Face App uses human-readable JSON files for reliable zero-maintenance local persistence:

### `faculty.db`
Stores registered faculty profiles, department data, and 128-dimensional facial embedding vectors:
```json
[
  {
    "id": "fac_01",
    "name": "Dr. Sarah Mitchell",
    "staffId": "FAC-CS-001",
    "department": "Computer Science",
    "email": "sarah.mitchell@college.edu",
    "photoUrl": "data:image/jpeg;base64,...",
    "descriptor": [0.045, -0.112, 0.089, ...],
    "enrolledDate": "2026-10-21"
  }
]
```

### `attendance.db`
Stores all chronological check-ins and check-outs:
```json
[
  {
    "id": "att_1729602400000",
    "facultyId": "fac_01",
    "facultyName": "Dr. Sarah Mitchell",
    "staffId": "FAC-CS-001",
    "department": "Computer Science",
    "date": "2026-10-22",
    "checkInTime": "09:05:12",
    "checkOutTime": "17:15:30",
    "duration": "8h 10m",
    "status": "PRESENT",
    "similarityScore": 0.94,
    "detectionConfidence": 0.98,
    "verificationMethod": "FACE_API_SSD",
    "deviceSource": "WEBCAM-KIOSK"
  }
]
```

---

## Scan Modes & Biometric Engine

ADIC Face App supports three operational modes in the **Live Scanner**:

1. **Continuous Real-Time Mode (Recommended)**:
   - Evaluates video frames continuously (approx. 5 to 15 frames per second).
   - Identifies faces, draws color-coded bounding boxes, and automatically marks check-in when confidence criteria are met.
2. **Interval Auto-Pulse Mode**:
   - Pulses face recognition at a configurable interval (1s to 5s) to conserve CPU/battery on mobile or tablet kiosks.
3. **Manual Snapshot Mode**:
   - Freezes the live video feed on demand and evaluates the captured still frame.

### Verification Thresholds
- **Confidence Threshold**: Default `0.60` (minimum face detection confidence).
- **Recognition Distance**: Euclidean distance `< 0.50` (corresponds to >85% facial feature match).
- **Late Threshold**: Configurable via Settings (e.g., `09:15:00 IST`). Check-ins after this time receive the `LATE` status badge.

---

## Unknown Person Detection

When an unregistered person stands in front of the camera:
- The system detects the face bounding box and displays a prominent **`UNKNOWN`** badge.
- Live similarity match confidence is shown (e.g., `UNKNOWN (42.1%)`).
- The bounding box turns amber/red to indicate that the identity is unrecognized.
- No false attendance is marked in `attendance.db`.
- The kiosk can be configured to sound an alert chime.

---

## REST API Reference

### Faculty Endpoints
- `GET /api/faculty`: Returns array of all enrolled faculty.
- `POST /api/faculty`: Enrolls a new faculty member with face descriptor.
- `DELETE /api/faculty/:id`: Deletes a faculty member. *Requires `admin_key` in header `x-admin-key` or body.*

### Attendance Endpoints
- `GET /api/attendance`: Returns array of attendance logs. Supports query parameters `?date=YYYY-MM-DD` and `?period=daily|weekly|monthly`.
- `POST /api/attendance/mark`: Marks check-in for a faculty member. Rejects duplicate check-in on the same date.
- `POST /api/attendance/checkout`: Records check-out time and calculates working duration.
- `DELETE /api/attendance/:id`: **Deletes a specific attendance log record.** *Requires `admin_key` in header `x-admin-key` or body.*
- `POST /api/attendance/clear-logs`: **Clears all attendance logs.** *Requires `admin_key` in body.*

### Settings Endpoints
- `GET /api/settings`: Returns operational settings (college timings, thresholds).
- `POST /api/settings`: Updates operational settings.

---

## Contributing & Open Source Development

We welcome contributions from the open source community!

### Setting Up a Development Workflow
1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Run TypeScript checks to verify type integrity:
   ```bash
   npm run lint
   ```
3. Test your changes locally on Chrome and Firefox to verify webcam and canvas compatibility.
4. Commit your changes with clear semantic messages:
   ```bash
   git commit -m "feat(attendance): add department-level CSV export filter"
   ```
5. Push to your branch and open a Pull Request.

### Code Style Guidelines
- Use TypeScript for all new components and utilities.
- Do not hardcode secrets or API keys; always read from `process.env` or `import.meta.env`.
- Ensure all dates and timestamps respect Indian Standard Time (IST) formatting conventions (`Asia/Kolkata`).

---

## License

This project is licensed under the [MIT License](LICENSE). You are free to modify, distribute, and deploy ADIC Face App for personal, educational, or commercial use.
