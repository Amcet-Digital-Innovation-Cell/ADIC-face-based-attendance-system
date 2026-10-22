/**
 * faceApiEngine.ts
 *
 * Real face recognition engine using face-api.js.
 * Pipeline: TinyFaceDetector ? FaceLandmark68 ? FaceRecognitionNet (128-dim descriptor)
 *
 * No Gemini API key required. Runs fully in the browser.
 * Model weights are served from /models/face-api/
 */

import * as faceapi from "face-api.js";

let modelsLoaded = false;
let modelsLoading = false;
let modelsLoadError: string | null = null;

export type FaceApiStatus = "idle" | "loading" | "ready" | "error";

type StatusListener = (status: FaceApiStatus, detail?: string) => void;
const statusListeners: StatusListener[] = [];

export function onFaceApiStatus(cb: StatusListener): () => void {
  statusListeners.push(cb);
  return () => {
    const i = statusListeners.indexOf(cb);
    if (i >= 0) statusListeners.splice(i, 1);
  };
}

function emitStatus(status: FaceApiStatus, detail?: string) {
  statusListeners.forEach((cb) => cb(status, detail));
}

const MODEL_URL = "/models/face-api";

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) {
    await new Promise<void>((resolve, reject) => {
      const check = setInterval(() => {
        if (modelsLoaded) { clearInterval(check); resolve(); }
        if (modelsLoadError) { clearInterval(check); reject(new Error(modelsLoadError)); }
      }, 100);
    });
    return;
  }

  modelsLoading = true;
  emitStatus("loading", "Loading face detection models...");

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    modelsLoading = false;
    emitStatus("ready", "Face recognition models loaded");
    console.log("[faceApiEngine] Models loaded from", MODEL_URL);
  } catch (err: unknown) {
    modelsLoading = false;
    const msg = err instanceof Error ? err.message : String(err);
    modelsLoadError = msg;
    emitStatus("error", `Failed to load models: ${msg}`);
    console.error("[faceApiEngine] Load error:", err);
    throw err;
  }
}

export function isFaceApiReady(): boolean {
  return modelsLoaded;
}

const TINY_OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });

export async function extractFaceDescriptor(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | HTMLElement
): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    try { await loadFaceApiModels(); } catch { return null; }
  }
  try {
    const result = await faceapi
      .detectSingleFace(source as HTMLCanvasElement, TINY_OPTS)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) return null;
    return result.descriptor;
  } catch (err) {
    console.warn("[faceApiEngine] extractFaceDescriptor error:", err);
    return null;
  }
}

export async function extractFaceDescriptorFromDataUrl(dataUrl: string): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    try { await loadFaceApiModels(); } catch { return null; }
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const result = await faceapi
          .detectSingleFace(img, TINY_OPTS)
          .withFaceLandmarks()
          .withFaceDescriptor();
        resolve(result ? result.descriptor : null);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export function faceDescriptorDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function distanceToSimilarity(distance: number): number {
  // For L2-normalized 128-dim embeddings: cosine_similarity = 1 - (dist^2)/2
  const cosSim = 1 - (distance * distance) / 2;
  return Math.max(0, Math.min(1, cosSim));
}

export function matchFaceDescriptor(
  queryDescriptor: Float32Array | number[],
  enrolled: Array<{ id: string; descriptor: Float32Array | number[] }>,
  threshold = 0.50
): { id: string; distance: number; similarity: number } | null {
  let bestId = "";
  let bestDist = Infinity;
  for (const entry of enrolled) {
    const dist = faceDescriptorDistance(queryDescriptor, entry.descriptor);
    if (dist < bestDist) { bestDist = dist; bestId = entry.id; }
  }
  if (bestDist <= threshold && bestId) {
    return { id: bestId, distance: bestDist, similarity: distanceToSimilarity(bestDist) };
  }
  return null;
}

export async function detectAllFaces(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement
): Promise<Array<{ x: number; y: number; width: number; height: number; score: number }>> {
  if (!modelsLoaded) return [];
  try {
    const results = await faceapi.detectAllFaces(source, TINY_OPTS);
    return results.map((r) => ({
      x: r.box.x, y: r.box.y, width: r.box.width, height: r.box.height, score: r.score,
    }));
  } catch { return []; }
}
