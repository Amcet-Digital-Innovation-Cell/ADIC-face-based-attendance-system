import React, { useState } from 'react';
import { 
  Download, Terminal, FileCode, CheckCircle2, Copy, 
  ExternalLink, Layers, Cpu, ShieldCheck, Sparkles 
} from 'lucide-react';
import { generateHuggingFaceZip, FASTAPI_APP_PY, HF_REQUIREMENTS_TXT, HF_DOCKERFILE, HF_README_MD, DOWNLOAD_MODELS_PY, ENV_EXAMPLE_CONTENT } from '../services/hfExporter';

export const HuggingFaceDeploy: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<'app.py' | 'requirements.txt' | 'Dockerfile' | 'download_models.py' | '.env.example' | 'README.md'>('app.py');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const fileContents = {
    'app.py': FASTAPI_APP_PY,
    'download_models.py': DOWNLOAD_MODELS_PY,
    '.env.example': ENV_EXAMPLE_CONTENT,
    'requirements.txt': HF_REQUIREMENTS_TXT,
    'Dockerfile': HF_DOCKERFILE,
    'README.md': HF_README_MD,
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      const blob = await generateHuggingFaceZip();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'adic-face-app-huggingface-space.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate zip:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(fileContents[selectedFile]);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Sparkles className="w-4 h-4" />
              <span>HUGGING FACE SPACES DEPLOYMENT HUB</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100">
              FastAPI + Optimized ONNX Runtime Architecture
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Designed as a lightweight, low-latency microservice for Hugging Face Spaces. Uses asynchronous image processing, detached model storage, and standalone SQLite for <code>faculty.db</code> and <code>attendance.db</code>.
            </p>
          </div>

          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="flex items-center gap-2 px-5 py-3 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 rounded-xl shadow-lg shadow-cyan-400/20 transition-all whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Packaging Repository...' : 'Download Space Package (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* Production Architecture Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200">ONNX Runtime Optimization</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Exports YOLO11 face weights and Buffalo_l recognition models to ONNX format. Eliminates bulky PyTorch dependencies and reduces container memory to under 500MB on Hugging Face CPU tiers.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200">Asynchronous Frame Pipeline</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            FastAPI <code>async def</code> endpoints handle camera frame decoding and 5-frame voting consensus concurrently without blocking the main event loop.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200">Single-Mark Constraint Lock</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Database enforces <code>UNIQUE(faculty_id, date)</code> in SQLite. Prevents multiple registrations on the same calendar day while storing exact timestamps.
          </p>
        </div>
      </div>

      {/* Step-by-Step Deployment Instructions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>Quick 3-Minute Deployment to Hugging Face</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-cyan-400 font-bold block">STEP 1: Create Space</span>
            <p className="text-slate-400 font-sans text-[11px]">
              Go to <a href="https://huggingface.co/new-space" target="_blank" rel="noreferrer" className="text-cyan-400 underline">huggingface.co/new-space</a>. Choose <strong>Docker</strong> as the Space SDK and select <strong>Blank</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-cyan-400 font-bold block">STEP 2: Clone & Extract</span>
            <p className="text-slate-400 font-sans text-[11px]">
              Download the ZIP package using the button above and extract the files directly into your cloned Hugging Face repository directory.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-cyan-400 font-bold block">STEP 3: Push & Launch</span>
            <p className="text-slate-400 font-sans text-[11px]">
              Run <code>git add . && git commit -m "Deploy ADIC Face App" && git push</code>. Hugging Face builds and launches the FastAPI container automatically!
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Code Viewer Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-0">
        <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">Repository Files</span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(['app.py', 'download_models.py', '.env.example', 'requirements.txt', 'Dockerfile', 'README.md'] as const).map((filename) => (
              <button
                key={filename}
                onClick={() => setSelectedFile(filename)}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                  selectedFile === filename
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {filename}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700"
          >
            {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy Content'}</span>
          </button>
        </div>

        <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto max-h-[480px]">
          <pre className="text-slate-300 leading-relaxed whitespace-pre">
            {fileContents[selectedFile]}
          </pre>
        </div>
      </div>
    </div>
  );
};
