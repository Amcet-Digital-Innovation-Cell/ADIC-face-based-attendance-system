#!/usr/bin/env python3
"""
AetherFace Raspberry Pi Edge Attendance Client
Supports Raspberry Pi 4 / 5 with Pi Camera Module v2/v3 or USB Webcam.
Includes hardware GPIO buzzer, green/red LED indicators.
"""

import time
import requests
import cv2
from datetime import datetime

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
    BUZZER_PIN = 18
    GREEN_LED_PIN = 23
    RED_LED_PIN = 24

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(BUZZER_PIN, GPIO.OUT)
    GPIO.setup(GREEN_LED_PIN, GPIO.OUT)
    GPIO.setup(RED_LED_PIN, GPIO.OUT)
except ImportError:
    GPIO_AVAILABLE = False
    print("[WARN] RPi.GPIO not available. Emulation mode active.")

# Change this to your deployed Hugging Face Space URL
API_SERVER_URL = "http://localhost:3000/api/recognize-and-mark"

def trigger_success_hardware(name):
    print(f"[SUCCESS] Attendance verified for {name}")
    if GPIO_AVAILABLE:
        GPIO.output(GREEN_LED_PIN, GPIO.HIGH)
        GPIO.output(BUZZER_PIN, GPIO.HIGH)
        time.sleep(0.08)
        GPIO.output(BUZZER_PIN, GPIO.LOW)
        time.sleep(0.05)
        GPIO.output(BUZZER_PIN, GPIO.HIGH)
        time.sleep(0.12)
        GPIO.output(BUZZER_PIN, GPIO.LOW)
        time.sleep(1.0)
        GPIO.output(GREEN_LED_PIN, GPIO.LOW)

def trigger_already_marked_hardware():
    print("[ALERT] Attendance already recorded today for this faculty member.")
    if GPIO_AVAILABLE:
        GPIO.output(RED_LED_PIN, GPIO.HIGH)
        GPIO.output(BUZZER_PIN, GPIO.HIGH)
        time.sleep(0.2)
        GPIO.output(BUZZER_PIN, GPIO.LOW)
        time.sleep(1.0)
        GPIO.output(RED_LED_PIN, GPIO.LOW)

def run_pi_kiosk():
    print("=" * 60)
    print("⚡ AETHERFACE RASPBERRY PI HARDWARE CLIENT ACTIVE")
    print(f"Target API Endpoint: {API_SERVER_URL}")
    print("=" * 60)

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    if not cap.isOpened():
        print("[ERROR] Cannot access Pi Camera / USB Webcam.")
        return

    last_scan_time = 0
    SCAN_COOLDOWN_SEC = 2.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.1)
                continue

            current_time = time.time()
            if current_time - last_scan_time > SCAN_COOLDOWN_SEC:
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                try:
                    files = {'file': ('frame.jpg', buffer.tobytes(), 'image/jpeg')}
                    response = requests.post(API_SERVER_URL, files=files, timeout=3.0)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("recognized"):
                            name = data.get("faculty_name", "Staff")
                            if data.get("already_marked"):
                                trigger_already_marked_hardware()
                            else:
                                trigger_success_hardware(name)
                            last_scan_time = current_time
                except Exception as err:
                    print(f"[SYNC ERROR] Network unreachable: {err}")

            time.sleep(0.05)
    except KeyboardInterrupt:
        print("[SHUTDOWN] Stopping Pi Kiosk.")
    finally:
        cap.release()
        if GPIO_AVAILABLE:
            GPIO.cleanup()

if __name__ == "__main__":
    run_pi_kiosk()
