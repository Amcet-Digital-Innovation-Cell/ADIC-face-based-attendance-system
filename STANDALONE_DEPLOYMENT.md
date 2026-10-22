# ADIC Face App: Standalone & Production Deployment Guide

ADIC Face App is an AI-powered face-based biometric attendance system for faculty, using **YOLO Face Detection** and **Buffalo 512-dim Cosine Similarity Face Recognition**.

---

## 1. Biometric Model Structure

Both models are organized in the explicit `model_name.extension` format:

```
models/
├── yolo_face.onnx           # YOLO Face Localization Model
└── buffalo_embedding.onnx   # Buffalo 512-dim Feature Extraction Model
```

To initialize or verify the model files at any time:
```bash
python3 download_models.py
```

---

## 2. Running Standalone & Self-Hosted

You can run ADIC Face App on any server, VPS (Ubuntu/Debian/CentOS), Raspberry Pi, or local developer machine.

### Option A: Full-Stack Web Kiosk (Node.js + Express + React)

1. **Install Node.js (v18+)**:
   ```bash
   node -v
   npm -v
   ```

2. **Configure Environment Variables (`.env`)**:
   Create a `.env` file in the project root:
   ```env
   # Administrative Key required to delete faculty records
   admin_key="admin123"

   # Web Server Port
   PORT=3000
   ```

3. **Install Dependencies & Build**:
   ```bash
   npm install
   npm run build
   ```

4. **Launch Server**:
   ```bash
   # Development mode with Hot Reloading
   npm run dev

   # Production mode
   npm start
   ```
   Open your browser at `http://localhost:3000` (or `http://YOUR_SERVER_IP:3000`).

---

### Option B: Deploying on Hugging Face Spaces

1. Create a new Space on [Hugging Face Spaces](https://huggingface.co/new-space).
2. Set Space SDK to **Docker** (or **Blank**).
3. Push or upload the contents of the `huggingface_space/` directory into your Space repository:
   ```bash
   cd huggingface_space/
   git init
   git remote add origin https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
   git add .
   git commit -m "Deploy ADIC Face App Biometric API"
   git push -u origin main --force
   ```
4. In your Space's **Settings -> Repository secrets**, add:
   - `admin_key`: `your_secure_password`

The FastAPI server starts on port `7860` with real-time Swagger documentation at `/docs`.

---

### Option C: Running on Raspberry Pi Edge Hardware

Hardware Pinout:
- **Pi Camera Module (v2/v3 or USB Webcam)**: Connect to CSI port or USB 3.0
- **Buzzer**: GPIO 18 (Pin 12) + GND
- **Green LED (Verification Success)**: GPIO 23 (Pin 16) + 330Ω Resistor + GND
- **Red LED (Already Marked / Unrecognized)**: GPIO 24 (Pin 18) + 330Ω Resistor + GND

Run the edge client:
```bash
cd huggingface_space/edge_pi
python3 pi_attendance.py --api-url http://YOUR_SERVER_IP:3000/api/attendance/mark
```

---

## 3. Key Operational Rules

1. **Indian Standard Time (IST - Asia/Kolkata, UTC+5:30)**:
   - All attendance timestamps, daily registers, and late checks strictly use IST.
2. **Single Attendance per Day**:
   - Marking attendance more than once on the same date for the same faculty is strictly blocked by `faculty_id + date` constraints in `attendance.db`.
3. **Faculty Deletion Security**:
   - Deleting a faculty member from `faculty.db` requires entering the matching `admin_key` configured in `.env`.
4. **Editable College Schedule**:
   - Configure College Start Time, End Time, and Late Threshold Time via the in-app Settings modal or `/api/settings`.
