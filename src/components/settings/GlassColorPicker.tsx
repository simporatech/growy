import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface GlassColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}

interface HSV {
  h: number; // 0..360
  s: number; // 0..100
  v: number; // 0..100
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hexToHsv(hex: string): HSV {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { h: 155, s: 38, v: 95 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h, s, v };
}

function hsvToHex({ h, s, v }: HSV): string {
  const sNorm = s / 100;
  const vNorm = v / 100;
  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h < 60) [rPrime, gPrime, bPrime] = [c, x, 0];
  else if (h < 120) [rPrime, gPrime, bPrime] = [x, c, 0];
  else if (h < 180) [rPrime, gPrime, bPrime] = [0, c, x];
  else if (h < 240) [rPrime, gPrime, bPrime] = [0, x, c];
  else if (h < 300) [rPrime, gPrime, bPrime] = [x, 0, c];
  else [rPrime, gPrime, bPrime] = [c, 0, x];

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
}

export function GlassColorPicker({ value, onChange, label }: GlassColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [hexDraft, setHexDraft] = useState(value.toUpperCase());

  const containerRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g., clicking a preset swatch)
  useEffect(() => {
    setHsv(hexToHsv(value));
    setHexDraft(value.toUpperCase());
  }, [value]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const commitHsv = useCallback(
    (next: HSV) => {
      setHsv(next);
      const nextHex = hsvToHex(next);
      setHexDraft(nextHex.toUpperCase());
      onChange(nextHex);
    },
    [onChange]
  );

  const updateFromPad = useCallback(
    (clientX: number, clientY: number) => {
      const rect = padRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const v = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100);
      commitHsv({ ...hsv, s, v });
    },
    [hsv, commitHsv]
  );

  const updateFromHue = useCallback(
    (clientX: number) => {
      const rect = hueRef.current?.getBoundingClientRect();
      if (!rect) return;
      const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360);
      commitHsv({ ...hsv, h });
    },
    [hsv, commitHsv]
  );

  const handlePadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPad(e.clientX, e.clientY);
  };

  const handlePadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFromPad(e.clientX, e.clientY);
  };

  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromHue(e.clientX);
  };

  const handleHuePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFromHue(e.clientX);
  };

  const handleHexInput = (raw: string) => {
    const cleaned = raw.startsWith('#') ? raw : `#${raw}`;
    setHexDraft(cleaned.toUpperCase());
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      setHsv(hexToHsv(cleaned));
      onChange(cleaned.toLowerCase());
    }
  };

  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

  return (
    <div ref={containerRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={label}
        className="inline-flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-2 hover:border-white/[0.18] active:scale-[0.98] transition-all"
      >
        <span className="text-xs font-medium text-[#A3A3A3]">{label}</span>
        <span
          className="h-5 w-5 rounded-lg border border-white/20 shrink-0"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-xs text-white/90 uppercase tabular-nums">
          {value}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="absolute right-0 top-full mt-2.5 z-50 w-64 rounded-2xl bg-[#242426]/95 backdrop-blur-2xl border border-white/[0.12] p-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)]"
          >
            {/* 2D Saturation / Brightness Pad */}
            <div
              ref={padRef}
              onPointerDown={handlePadPointerDown}
              onPointerMove={handlePadPointerMove}
              className="relative h-36 w-full rounded-xl overflow-hidden cursor-crosshair touch-none select-none border border-white/[0.08]"
              style={{ backgroundColor: hueColor }}
            >
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to right, #FFFFFF, transparent)' }}
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, #000000, transparent)' }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                style={{
                  left: `${hsv.s}%`,
                  top: `${100 - hsv.v}%`,
                  backgroundColor: value,
                }}
              />
            </div>

            {/* Hue Spectrum Slider */}
            <div
              ref={hueRef}
              onPointerDown={handleHuePointerDown}
              onPointerMove={handleHuePointerMove}
              className="relative mt-3.5 h-3.5 w-full rounded-full cursor-pointer touch-none select-none border border-white/[0.1]"
              style={{
                background:
                  'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 h-4.5 w-4.5 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  backgroundColor: hueColor,
                }}
              />
            </div>

            {/* Editable Hex Input */}
            <div className="mt-3.5 flex items-center gap-2.5">
              <span
                className="h-8 w-8 shrink-0 rounded-xl border border-white/[0.12]"
                style={{ backgroundColor: value }}
              />
              <input
                type="text"
                maxLength={7}
                value={hexDraft}
                onChange={(e) => handleHexInput(e.target.value)}
                aria-label="Hex color code"
                className="focus-dynamic-accent w-full rounded-xl bg-black/30 border border-white/[0.08] px-3 py-1.5 font-mono text-xs uppercase text-white outline-none transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

