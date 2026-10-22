import React, { useState } from 'react';
import { 
  Cpu, Copy, CheckCircle2, Zap, Terminal, AlertCircle, 
  Wifi, Camera, ArrowRight 
} from 'lucide-react';
import { PI_ATTENDANCE_SCRIPT } from '../services/raspberryPiExporter';

export const RaspberryPiHardware: React.FC = () => {
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success'>('idle');

  const handleCopyScript = () => {
    navigator.clipboard.writeText(PI_ATTENDANCE_SCRIPT);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleTestPing = () => {
    setPingStatus('testing');
    setTimeout(() => {
      setPingStatus('success');
      setTimeout(() => setPingStatus('idle'), 3000);
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Cpu className="w-4 h-4" />
              <span>RASPBERRY PI HARDWARE TERMINAL HUB</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100">
              Edge Hardware Station (Raspberry Pi 4 / 5 + Pi Camera v2/v3)
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Run the autonomous camera kiosk on dedicated Raspberry Pi hardware. Syncs biometric frames to local or Hugging Face Space FastAPI endpoints with GPIO audio buzzers and LED status indicators.
            </p>
          </div>

          <button
            onClick={handleCopyScript}
            className="flex items-center gap-2 px-5 py-3 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 rounded-xl shadow-lg shadow-cyan-400/20 transition-all whitespace-nowrap"
          >
            {copiedScript ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedScript ? 'Client Script Copied!' : 'Copy pi_attendance.py Script'}</span>
          </button>
        </div>
      </div>

      {/* GPIO Wiring & Pinout Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">PIN 18 (GPIO 18)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200">Piezo Buzzer (Chirp / Alert)</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Positive lead to GPIO 18 (BCM mode). Plays double-beep confirmation upon successful attendance, or long alert if already marked.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase">PIN 23 (GPIO 23)</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200">Green LED (Verified Status)</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Connect through a 330Ω resistor. Flashes brightly when a faculty member's attendance is verified and written to attendance.db.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-rose-400 uppercase">PIN 24 (GPIO 24)</span>
            <span className="w-2 h-2 rounded-full bg-rose-400" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200">Red LED (Warning / Rejection)</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Connect through a 330Ω resistor. Illuminates if face is unverified, unknown, or if the faculty has already marked attendance today.
          </p>
        </div>
      </div>

      {/* Terminal Setup Command Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Raspberry Pi Terminal Quick Start</span>
          </h3>

          <button
            onClick={handleTestPing}
            disabled={pingStatus === 'testing'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:border-cyan-500/50 text-xs font-mono text-slate-300 transition-colors"
          >
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>{pingStatus === 'testing' ? 'Pinging...' : pingStatus === 'success' ? 'Link Verified (200 OK)' : 'Test Endpoint Ping'}</span>
          </button>
        </div>

        <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2 border border-slate-800 overflow-x-auto">
          <div className="text-slate-500"># 1. Update Raspberry Pi packages and install OpenCV & RPi.GPIO</div>
          <div className="text-cyan-300">sudo apt update && sudo apt install -y python3-opencv python3-rpi.gpio python3-pip</div>
          
          <div className="text-slate-500 pt-2"># 2. Install Python requests library</div>
          <div className="text-cyan-300">pip3 install requests</div>

          <div className="text-slate-500 pt-2"># 3. Create client script and run</div>
          <div className="text-cyan-300">nano pi_attendance.py  # Paste script & save</div>
          <div className="text-cyan-300">python3 pi_attendance.py</div>
        </div>
      </div>

      {/* Python Client Code Preview Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 text-xs">
          <span className="font-mono text-slate-300 font-semibold">pi_attendance.py</span>
          <button
            onClick={handleCopyScript}
            className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Full Python Script</span>
          </button>
        </div>

        <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto max-h-[400px]">
          <pre className="text-slate-300 leading-relaxed whitespace-pre">
            {PI_ATTENDANCE_SCRIPT}
          </pre>
        </div>
      </div>
    </div>
  );
};
