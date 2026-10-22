---
title: AetherFace Faculty Biometric Attendance System
emoji: 👁️
colorFrom: cyan
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# AetherFace: AI Biometric Faculty Attendance System
High-performance, production-ready biometric attendance kiosk & management system designed for Hugging Face Spaces & Raspberry Pi edge terminals.

### Core Features:
1. **Full-Stack UI & FastAPI ONNX Engine**: Complete React SPA with dark/light themes served on port 7860 alongside production FastAPI backend.
2. **Multi-Faculty Auto-Detection**: Supports 1 to 100+ enrolled faculties with instant candidate recognition and automatic attendance logging.
3. **Multi-Frame Consensus Voting**: Dynamic burst capture (configurable to 3, 5, or 7 frames in real-time) with majority voting threshold.
4. **Faculty Enrollment Burst**: Real-time webcam multi-frame capture reflecting system settings immediately.
5. **IST Timezone & Timings Enforcement**: Official college timings (start, late cutoff, end hours) with single daily check-in and check-out tracking.
6. **Admin Key Security**: Protected editing and deletion of faculty records from `.env` (`admin_key`), with empty-by-default inputs.
7. **Production SQLite & JSON Storage**: High-reliability persistence in `faculty.db` and `attendance.db`.

### How to Deploy to Hugging Face Spaces:
1. Create a new Space on Hugging Face (choose **Docker** SDK).
2. Set **Space hardware** (Free CPU works smoothly).
3. Upload all files from the `huggingface_space/` directory (including `Dockerfile`, `app.py`, `requirements.txt`, and `dist/`).
4. (Optional) In Space Settings > Variables and secrets, add `admin_key` secret for your custom admin passcode.
5. Your Space will build and be immediately accessible at `https://huggingface.co/spaces/<your-username>/<your-space-name>`!
