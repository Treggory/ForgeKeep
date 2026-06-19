"use client";

import { useEffect, useRef, useState } from "react";

// Uses the native BarcodeDetector API when the device supports it (Android
// Chrome, some others). Everywhere else (notably iOS Safari), it falls back to
// manual entry. The manual field is always available so the feature never dead-
// ends. A scanning library polyfill can be dropped in later behind the same UI.

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    const hasDetector =
      typeof window !== "undefined" && "BarcodeDetector" in window;
    setSupported(hasDetector);
    if (!hasDetector) return;

    let cancelled = false;
    const detector = new (window as any).BarcodeDetector({ formats: FORMATS });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length) {
              const value = codes[0].rawValue as string;
              if (value) {
                stop();
                onDetected(value);
                return;
              }
            }
          } catch {
            // transient decode error; keep scanning
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        setError(
          e?.name === "NotAllowedError"
            ? "Camera permission denied. Enter the barcode manually below."
            : "Couldn't start the camera. Enter the barcode manually below."
        );
      }
    })();

    function stop() {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManual() {
    const v = manual.trim();
    if (v) onDetected(v);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gun/95 p-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-lg">Scan barcode</div>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm">
            Close
          </button>
        </div>

        {supported ? (
          <div className="relative overflow-hidden rounded-xl border border-line bg-black">
            <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-jade/80" />
          </div>
        ) : supported === false ? (
          <div className="card p-4 text-sm text-muted">
            This device can&apos;t scan with the camera. Type the barcode below.
          </div>
        ) : (
          <div className="card h-64 animate-pulse" />
        )}

        {error ? (
          <div className="card mt-3 border-amber/40 bg-amber/10 p-3 text-sm text-amber">
            {error}
          </div>
        ) : null}

        <div className="card mt-4 space-y-2 p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Manual entry</div>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              placeholder="Type or paste a UPC/EAN"
              className="flex-1 rounded-lg border border-line bg-gun px-3 py-2.5 outline-none focus:border-jade"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitManual()}
            />
            <button
              onClick={submitManual}
              disabled={!manual.trim()}
              className="rounded-lg bg-jade px-4 py-2.5 font-semibold text-gun disabled:opacity-50"
            >
              Check
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
