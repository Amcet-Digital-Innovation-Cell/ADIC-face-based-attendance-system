import React, { useState } from 'react';
import { 
  X, Sliders, Shield, Zap, Moon, Volume2, 
  RotateCcw, Check, Sparkles, Clock, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { SystemSettings } from '../types/biometric';
import { DEFAULT_SETTINGS, formatTime12Hour } from '../services/biometricEngine';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSave: (updated: SystemSettings) => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    setFormData(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              College Hours & Biometric Parameters
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-mono">
          {/* Section 1: Editable College Timings in IST */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-100 flex items-center gap-1.5 font-sans">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>College Timings (Indian Standard Time - IST)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                UTC+05:30
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* College Start Time */}
              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px] font-sans">
                  College Opens
                </label>
                <input
                  type="time"
                  value={formData.collegeStartTime}
                  onChange={(e) => setFormData({ ...formData, collegeStartTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400 min-h-[38px]"
                />
                <span className="text-[10px] text-cyan-400 font-mono block">
                  {formatTime12Hour(formData.collegeStartTime)}
                </span>
              </div>

              {/* Late Threshold Time */}
              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px] font-sans">
                  Late After Time
                </label>
                <input
                  type="time"
                  value={formData.lateThresholdTime}
                  onChange={(e) => setFormData({ ...formData, lateThresholdTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-amber-500/50 rounded-lg text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-400 min-h-[38px]"
                />
                <span className="text-[10px] text-amber-400 font-mono block">
                  {formatTime12Hour(formData.lateThresholdTime)}
                </span>
              </div>

              {/* College End Time */}
              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px] font-sans">
                  College Closes
                </label>
                <input
                  type="time"
                  value={formData.collegeEndTime}
                  onChange={(e) => setFormData({ ...formData, collegeEndTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400 min-h-[38px]"
                />
                <span className="text-[10px] text-cyan-400 font-mono block">
                  {formatTime12Hour(formData.collegeEndTime)}
                </span>
              </div>
            </div>

            {/* Visual Classification Preview Strip */}
            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-sans space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Arrival between {formatTime12Hour(formData.collegeStartTime)} and {formatTime12Hour(formData.lateThresholdTime)} is marked <strong>PRESENT (On-Time)</strong>.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Arrival after {formatTime12Hour(formData.lateThresholdTime)} is flagged as <strong>LATE</strong>.</span>
              </div>
            </div>
          </div>

          {/* Buffalo Cosine Similarity Threshold Slider */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex justify-between items-center text-slate-200">
              <span className="font-semibold flex items-center gap-1.5 font-sans">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Buffalo Cosine Similarity Match Threshold</span>
              </span>
              <span className="text-cyan-400 font-bold">
                {(formData.buffaloThreshold * 100).toFixed(0)}% (Score: {formData.buffaloThreshold.toFixed(2)})
              </span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.90"
              step="0.05"
              value={formData.buffaloThreshold}
              onChange={(e) => setFormData({ ...formData, buffaloThreshold: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer h-2"
            />
            <p className="text-[10px] text-slate-500 font-sans">
              Face matches above this similarity score are accepted as verified. Default: 0.60 (60%).
            </p>
          </div>

          {/* YOLO Detection Confidence Slider */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex justify-between items-center text-slate-200">
              <span className="font-semibold flex items-center gap-1.5 font-sans">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>YOLO Face Confidence Filter</span>
              </span>
              <span className="text-cyan-400 font-bold">
                {(formData.yoloConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.80"
              step="0.05"
              value={formData.yoloConfidence}
              onChange={(e) => setFormData({ ...formData, yoloConfidence: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer h-2"
            />
            <p className="text-[10px] text-slate-500 font-sans">
              Minimum YOLO11 detection confidence to detect face bounding box. Default: 0.40.
            </p>
          </div>

          {/* Multi-Frame Consensus Voting Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <label className="text-slate-300 font-sans font-semibold block">
                Burst Voting Frames
              </label>
              <select
                value={formData.numFramesVote}
                onChange={(e) => setFormData({ ...formData, numFramesVote: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none min-h-[38px]"
              >
                <option value={3}>3 Frames</option>
                <option value={5}>5 Frames (Colab Recommended)</option>
                <option value={7}>7 Frames</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <label className="text-slate-300 font-sans font-semibold block">
                Required Agreement Votes
              </label>
              <select
                value={formData.minVotingAgreement}
                onChange={(e) => setFormData({ ...formData, minVotingAgreement: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none min-h-[38px]"
              >
                <option value={1}>1 Frame (Quick Scan)</option>
                <option value={2}>2 Frames (Colab Standard)</option>
                <option value={3}>3 Frames (High Security)</option>
              </select>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <label className="flex items-center justify-between cursor-pointer py-1">
              <div className="space-y-0.5">
                <span className="text-slate-200 font-sans font-semibold flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CLAHE Low-Light Enhancement</span>
                </span>
                <span className="text-[10px] text-slate-500 font-sans block">
                  Contrast Limited Adaptive Histogram Equalization in LAB space
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.lowLightEnhanceCLAHE}
                onChange={(e) => setFormData({ ...formData, lowLightEnhanceCLAHE: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-800/80">
              <div className="space-y-0.5">
                <span className="text-slate-200 font-sans font-semibold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Audio Feedback Synthesizer</span>
                </span>
                <span className="text-[10px] text-slate-500 font-sans block">
                  Scan chirps, positive chords, and duplicate alert tones
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.soundEffects}
                onChange={(e) => setFormData({ ...formData, soundEffects: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-800/80">
              <div className="space-y-0.5">
                <span className="text-slate-200 font-sans font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Spoken Voice Name Announcements</span>
                </span>
                <span className="text-[10px] text-slate-500 font-sans block">
                  Voice announcement upon attendance confirmation
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.speechAnnouncements}
                onChange={(e) => setFormData({ ...formData, speechAnnouncements: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-2 px-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Timings</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-md shadow-cyan-400/20 min-h-[40px]"
            >
              {savedSuccess ? <Check className="w-4 h-4 text-black" /> : null}
              <span>{savedSuccess ? 'Saved!' : 'Save College Timings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
