import React, { useState, useEffect, useRef } from 'react';
import { X, Target, RotateCcw, Check, Sparkles, AlertCircle, Compass, SlidersHorizontal, HelpCircle } from 'lucide-react';

interface BubbleLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRedMode: boolean;
}

export function BubbleLevelModal({ isOpen, onClose, isRedMode }: BubbleLevelModalProps) {
  // States
  const [pitch, setPitch] = useState(0); // Eje X (adelante / atrás)
  const [roll, setRoll] = useState(0);   // Eje Y (izquierda / derecha)
  const [rawHeading, setRawHeading] = useState(0); // Rumbo del sensor (0° = Norte)
  const [calibratedOffset, setCalibratedOffset] = useState({ pitch: 0, roll: 0 });
  const [invertHeading, setInvertHeading] = useState(() => {
    return localStorage.getItem('astro_compass_invert') === 'true';
  });
  const [compassOffset, setCompassOffset] = useState(() => {
    const saved = localStorage.getItem('astro_compass_offset');
    return saved ? parseFloat(saved) : 0;
  });
  const [showCompassCalib, setShowCompassCalib] = useState(false);
  const [permissionState, setPermissionState] = useState<'granted' | 'prompt' | 'denied'>('prompt');
  const [hasVibrated, setHasVibrated] = useState(false);

  // High precision filtering refs
  const smoothedRef = useRef({ pitch: 0, roll: 0, heading: 0 });
  const lastRenderTime = useRef(0);

  // Toggle inverted heading calculation
  const toggleInvertHeading = () => {
    const next = !invertHeading;
    setInvertHeading(next);
    localStorage.setItem('astro_compass_invert', String(next));
  };

  // Save compass offset in localStorage
  const updateCompassOffset = (offset: number) => {
    const normalized = (offset % 360 + 360) % 360;
    setCompassOffset(normalized);
    localStorage.setItem('astro_compass_offset', normalized.toString());
  };

  // Request sensor permissions (iOS / Android Chrome)
  const requestOrientationPermission = async () => {
    if (typeof (DeviceOrientationEvent as any) !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setPermissionState('granted');
        } else {
          setPermissionState('denied');
        }
      } catch (e) {
        setPermissionState('denied');
      }
    } else {
      setPermissionState('granted');
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (typeof (DeviceOrientationEvent as any) !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      setPermissionState('prompt');
    } else {
      setPermissionState('granted');
    }

    let hasReceivedAbsolute = false;

    const processHeading = (detected: number | null) => {
      if (detected === null || isNaN(detected)) return;
      
      const screenAngle = (window.screen?.orientation?.angle) || (Number((window as any).orientation) || 0);
      let adjusted = (detected + screenAngle + 360) % 360;

      let currentH = smoothedRef.current.heading;
      let diff = ((adjusted - currentH + 540) % 360) - 180;
      smoothedRef.current.heading = (currentH + diff * 0.18 + 360) % 360;
    };

    const handleAbsoluteOrientation = (e: any) => {
      if (typeof e.alpha === 'number' && !isNaN(e.alpha)) {
        hasReceivedAbsolute = true;
        // In absolute orientation on Android:
        const rawAlpha = invertHeading ? e.alpha : (360 - e.alpha);
        processHeading(rawAlpha);
      }
    };

    const handleOrientation = (e: any) => {
      // 1. Update pitch (beta) with high viscosity damping for precision
      if (typeof e.beta === 'number' && !isNaN(e.beta)) {
        let rawBeta = e.beta;
        if (rawBeta > 90) rawBeta = 180 - rawBeta;
        if (rawBeta < -90) rawBeta = -180 - rawBeta;
        smoothedRef.current.pitch = smoothedRef.current.pitch * 0.88 + rawBeta * 0.12;
      }

      // 2. Update roll (gamma) with high viscosity damping for precision
      if (typeof e.gamma === 'number' && !isNaN(e.gamma)) {
        smoothedRef.current.roll = smoothedRef.current.roll * 0.88 + e.gamma * 0.12;
      }

      // 3. Compass heading (iOS uses webkitCompassHeading directly; Android uses alpha if absolute didn't fire)
      if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
        const heading = invertHeading ? (360 - e.webkitCompassHeading) : e.webkitCompassHeading;
        processHeading(heading);
      } else if (!hasReceivedAbsolute && typeof e.alpha === 'number' && !isNaN(e.alpha)) {
        const rawAlpha = invertHeading ? e.alpha : (360 - e.alpha);
        processHeading(rawAlpha);
      }

      const now = performance.now();
      if (now - lastRenderTime.current > 20) { // ~50 FPS
        lastRenderTime.current = now;
        setPitch(smoothedRef.current.pitch);
        setRoll(smoothedRef.current.roll);
        setRawHeading(smoothedRef.current.heading);
      }
    };

    // Always register the standard deviceorientation event
    window.addEventListener('deviceorientation', handleOrientation, true);
    
    // Also attach to deviceorientationabsolute if available
    let hasAbsoluteListener = false;
    if ('ondeviceorientationabsolute' in window) {
      (window as any).addEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
      hasAbsoluteListener = true;
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (hasAbsoluteListener) {
        (window as any).removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
      }
    };
  }, [isOpen, invertHeading]);

  if (!isOpen) return null;

  // Effective angles with calibration/tare offset subtracted
  const effectivePitch = pitch - calibratedOffset.pitch;
  const effectiveRoll = roll - calibratedOffset.roll;

  // Effective Heading after applying manual / local calibration offset
  const effectiveHeading = (rawHeading + compassOffset + 360) % 360;

  // Total tilt angle from horizontal zero
  const totalTilt = Math.sqrt(effectivePitch * effectivePitch + effectiveRoll * effectiveRoll);
  const isLevel = totalTilt <= 0.25; // High precision astrophotography threshold (0.25°)

  // Vibration on level snap
  if (isLevel && !hasVibrated) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([25, 35, 25]); } catch (e) { }
    }
    setHasVibrated(true);
  } else if (!isLevel && hasVibrated) {
    setHasVibrated(false);
  }

  // Visual deflection mapping:
  const maxDegrees = 3.5;
  const maxPixelRadius = 72; // Fitted for compass degree ring

  const clampedXRatio = Math.max(-1, Math.min(1, effectiveRoll / maxDegrees));
  const clampedYRatio = Math.max(-1, Math.min(1, -effectivePitch / maxDegrees));

  const offsetXPixels = clampedXRatio * maxPixelRadius;
  const offsetYPixels = clampedYRatio * maxPixelRadius;

  const resetCalibration = () => setCalibratedOffset({ pitch: 0, roll: 0 });
  const calibrateCurrent = () => setCalibratedOffset({ pitch, roll });

  // Calibrate North: Align current heading to true 0°
  const setNorthHere = () => {
    const diff = (360 - rawHeading) % 360;
    updateCompassOffset(diff);
  };

  const resetNorth = () => {
    updateCompassOffset(0);
  };

  const getCardinal = (deg: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((deg % 360) / 22.5)) % 16;
    return directions[index];
  };

  // Generate 10-degree tick marks and numbers for SVG Compass Dial
  const degreeSteps = Array.from({ length: 36 }, (_, i) => i * 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-3xl border p-4 sm:p-5 flex flex-col items-center gap-3.5 sm:gap-4 shadow-2xl relative select-none max-h-[95vh] overflow-y-auto ${
        isRedMode 
          ? 'bg-neutral-950/95 border-red-900/60 text-red-500 shadow-red-950/40' 
          : 'bg-neutral-900/95 border-neutral-700/60 text-white shadow-black/80'
      }`}>
        
        {/* HEADER */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isRedMode ? 'bg-red-950/80 border border-red-800/40' : 'bg-neutral-800/80 border border-neutral-700/40'}`}>
              <Compass className={`w-5 h-5 ${isRedMode ? 'text-red-400' : 'text-cyan-400'}`} />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-wide">Nivel y Brújula Polar</h3>
              <p className="text-[11px] opacity-60">Alineación del trípode con dial de grados</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCompassCalib(!showCompassCalib)}
              className={`p-2 rounded-xl border transition-colors ${
                showCompassCalib
                  ? (isRedMode ? 'bg-red-900/60 border-red-600 text-white' : 'bg-cyan-950/80 border-cyan-500 text-cyan-300')
                  : (isRedMode ? 'border-red-900 hover:bg-red-900/40 text-red-400' : 'border-neutral-700 hover:bg-neutral-800 text-neutral-300')
              }`}
              title="Calibrar Brújula y Declinación"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-full border transition-colors ${
                isRedMode 
                  ? 'border-red-900 hover:bg-red-900/40 text-red-400' 
                  : 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CALIBRATION PANEL (EXPANDABLE) */}
        {showCompassCalib && (
          <div className={`w-full p-3.5 rounded-2xl border flex flex-col gap-2.5 text-xs animate-in slide-in-from-top-2 duration-150 ${
            isRedMode ? 'bg-red-950/50 border-red-800 text-red-300' : 'bg-neutral-800/80 border-neutral-700 text-neutral-200'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                Ajuste de Rumbo / Declinación
              </span>
              <span className="font-mono text-cyan-400">
                {compassOffset >= 0 ? `+${Math.round(compassOffset)}°` : `${Math.round(compassOffset)}°`}
              </span>
            </div>
            
            <p className="text-[11px] opacity-75">
              Si tu brújula apunta en otra dirección (desfase magnético o sensor), apunta el móvil hacia el Norte y pulsa "Fijar Norte Aquí (0°)".
            </p>

            <button
              onClick={setNorthHere}
              className={`w-full py-2 px-3 rounded-xl font-bold text-center border shadow-md flex items-center justify-center gap-2 ${
                isRedMode ? 'bg-red-700 text-black border-red-500 hover:bg-red-600' : 'bg-cyan-500 text-black border-cyan-400 hover:bg-cyan-400'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Fijar Posición Actual como Norte (0°)</span>
            </button>

            {/* PRESETS DE AJUSTE RÁPIDO */}
            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              <button
                onClick={() => updateCompassOffset(compassOffset - 90)}
                className={`py-1.5 px-2 rounded-lg border font-mono font-bold text-center ${
                  isRedMode ? 'bg-red-900/40 border-red-800 hover:bg-red-900/80' : 'bg-neutral-700/60 border-neutral-600 hover:bg-neutral-700'
                }`}
                title="Girar 90° a la izquierda"
              >
                -90°
              </button>
              <button
                onClick={() => updateCompassOffset(compassOffset - 5)}
                className={`py-1.5 px-2 rounded-lg border font-mono font-bold text-center ${
                  isRedMode ? 'bg-red-900/40 border-red-800 hover:bg-red-900/80' : 'bg-neutral-700/60 border-neutral-600 hover:bg-neutral-700'
                }`}
              >
                -5°
              </button>
              <button
                onClick={() => updateCompassOffset(compassOffset + 5)}
                className={`py-1.5 px-2 rounded-lg border font-mono font-bold text-center ${
                  isRedMode ? 'bg-red-900/40 border-red-800 hover:bg-red-900/80' : 'bg-neutral-700/60 border-neutral-600 hover:bg-neutral-700'
                }`}
              >
                +5°
              </button>
              <button
                onClick={() => updateCompassOffset(compassOffset + 90)}
                className={`py-1.5 px-2 rounded-lg border font-mono font-bold text-center ${
                  isRedMode ? 'bg-red-900/40 border-red-800 hover:bg-red-900/80' : 'bg-neutral-700/60 border-neutral-600 hover:bg-neutral-700'
                }`}
                title="Girar 90° a la derecha"
              >
                +90°
              </button>
            </div>

            {/* INVERTIR SENTIDO DE GIRO & RESTABLECER */}
            <div className="flex items-center justify-between pt-1 border-t border-current/10">
              <button
                onClick={toggleInvertHeading}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                  invertHeading 
                    ? (isRedMode ? 'bg-red-800 text-white border-red-600' : 'bg-cyan-800 text-white border-cyan-600')
                    : (isRedMode ? 'border-red-900/60 hover:bg-red-900/40' : 'border-neutral-700 hover:bg-neutral-700')
                }`}
              >
                {invertHeading ? '🔄 Sentido: Invertido' : '🔄 Sentido: Normal'}
              </button>

              {compassOffset !== 0 && (
                <button
                  onClick={resetNorth}
                  className="py-1 text-[11px] underline opacity-70 hover:opacity-100"
                >
                  Restablecer (0° offset)
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 text-[10px] opacity-60 pt-1 border-t border-current/10">
              <HelpCircle className="w-3 h-3 shrink-0" />
              <span>Tip: Mueve el móvil en el aire trazando un 8 para calibrar el magnetómetro interno.</span>
            </div>
          </div>
        )}

        {/* PERMISSION BANNER (iOS) */}
        {permissionState === 'prompt' && (
          <div className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs gap-3 ${
            isRedMode ? 'bg-red-950/60 border-red-800 text-red-300' : 'bg-cyan-950/50 border-cyan-800 text-cyan-200'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Se requiere permiso del sensor</span>
            </div>
            <button
              onClick={requestOrientationPermission}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs shrink-0 ${
                isRedMode ? 'bg-red-700 text-black' : 'bg-cyan-500 text-black'
              }`}
            >
              Habilitar
            </button>
          </div>
        )}

        {/* BRÚJULA CON DIAL GRADUADO DE 360° + NIVEL DE BURBUJA */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
          
          {/* DIAL VECTORIAL GIRATORIO CON GRADOS NUMÉRICOS (SVG) */}
          <div 
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: `rotate(${-effectiveHeading}deg)`
            }}
          >
            <svg viewBox="0 0 320 320" className="w-full h-full">
              {/* Aro exterior graduado */}
              <circle 
                cx="160" 
                cy="160" 
                r="156" 
                fill="none" 
                stroke={isRedMode ? 'rgba(185, 28, 28, 0.4)' : 'rgba(115, 115, 115, 0.4)'} 
                strokeWidth="1.5" 
              />
              <circle 
                cx="160" 
                cy="160" 
                r="126" 
                fill="none" 
                stroke={isRedMode ? 'rgba(185, 28, 28, 0.25)' : 'rgba(115, 115, 115, 0.25)'} 
                strokeWidth="1" 
                strokeDasharray="2 2"
              />

              {/* Marcas de grados (cada 10°) y números cada 30° */}
              {degreeSteps.map((deg) => {
                const isCardinal = deg % 90 === 0;
                const isMajor = deg % 30 === 0;
                const isIntercardinal = deg % 45 === 0 && !isCardinal;

                // Ticks
                const tickInnerR = isCardinal ? 138 : isMajor ? 144 : 149;
                const tickOuterR = 156;

                // Label
                let label = '';
                if (deg === 0) label = 'N';
                else if (deg === 90) label = 'E';
                else if (deg === 180) label = 'S';
                else if (deg === 270) label = 'W';
                else if (isIntercardinal) {
                  if (deg === 45) label = 'NE';
                  if (deg === 135) label = 'SE';
                  if (deg === 225) label = 'SW';
                  if (deg === 315) label = 'NW';
                } else if (isMajor) {
                  label = `${deg}°`;
                }

                return (
                  <g key={deg} transform={`rotate(${deg} 160 160)`}>
                    {/* Tick line */}
                    <line
                      x1="160"
                      y1={320 - tickOuterR}
                      x2="160"
                      y2={320 - tickInnerR}
                      stroke={
                        deg === 0 
                          ? '#ef4444' 
                          : isCardinal 
                            ? (isRedMode ? '#f87171' : '#ffffff') 
                            : isMajor 
                              ? (isRedMode ? '#b91c1c' : '#a3a3a3') 
                              : (isRedMode ? '#7f1d1d' : '#525252')
                      }
                      strokeWidth={deg === 0 ? 3 : isCardinal ? 2 : isMajor ? 1.5 : 1}
                    />

                    {/* Text Label */}
                    {label && (
                      <text
                        x="160"
                        y={isCardinal ? "24" : isIntercardinal ? "27" : "28"}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={
                          deg === 0 
                            ? '#ef4444' 
                            : isCardinal 
                              ? (isRedMode ? '#fca5a5' : '#38bdf8') 
                              : isIntercardinal 
                                ? (isRedMode ? '#ef4444' : '#94a3b8') 
                                : (isRedMode ? '#991b1b' : '#737373')
                        }
                        fontSize={isCardinal ? "15" : isIntercardinal ? "9" : "9.5"}
                        fontWeight={isCardinal ? "900" : isIntercardinal ? "700" : "600"}
                        fontFamily="ui-monospace, monospace"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* PUNTERO SUPERIOR DE RUMBO FIJO (LUBBER LINE) */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-20">
            <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[9px] ${
              isRedMode ? 'border-t-red-400 drop-shadow-[0_0_6px_#ef4444]' : 'border-t-cyan-400 drop-shadow-[0_0_6px_#38bdf8]'
            }`} />
            <div className="w-1 h-3 bg-current opacity-80" />
          </div>

          {/* CONTENEDOR DEL NIVEL DE BURBUJA (CENTRO CRISTALINO) */}
          <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center">
            
            <div className={`absolute inset-0 rounded-full border-4 backdrop-blur-xl transition-all duration-300 ${
              isLevel
                ? (isRedMode ? 'border-red-500 shadow-[0_0_45px_rgba(239,68,68,0.5)]' : 'border-emerald-400 shadow-[0_0_45px_rgba(52,211,153,0.45)]')
                : (isRedMode ? 'border-red-900/80 bg-gradient-to-b from-red-950/40 via-black to-neutral-950 shadow-inner' : 'border-neutral-700/80 bg-gradient-to-b from-neutral-800/50 via-neutral-900/80 to-black shadow-inner')
            }`}
            style={{
              boxShadow: isLevel 
                ? (isRedMode ? 'inset 0 0 30px rgba(239,68,68,0.3), 0 0 35px rgba(239,68,68,0.5)' : 'inset 0 0 30px rgba(52,211,153,0.25), 0 0 35px rgba(52,211,153,0.4)')
                : 'inset 0 4px 20px rgba(0,0,0,0.8), 0 8px 32px rgba(0,0,0,0.6)'
            }}>

              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none" />
              <div className="absolute -top-1 left-1/4 right-1/4 h-5 rounded-full bg-gradient-to-b from-white/20 to-transparent blur-[2px] pointer-events-none" />

              {/* Anillos de grados concéntricos */}
              <div className={`absolute inset-5 rounded-full border border-dashed transition-colors ${
                isRedMode ? 'border-red-800/40' : 'border-neutral-600/40'
              }`}>
                <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-mono opacity-40">2.5°</span>
              </div>
              <div className={`absolute inset-12 rounded-full border border-dashed transition-colors ${
                isRedMode ? 'border-red-700/50' : 'border-neutral-500/50'
              }`}>
                <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-mono opacity-40">1.0°</span>
              </div>
              <div className={`absolute inset-18 rounded-full border-2 transition-all duration-300 ${
                isLevel
                  ? (isRedMode ? 'border-red-400 bg-red-600/25 animate-pulse' : 'border-emerald-400 bg-emerald-500/25 animate-pulse')
                  : (isRedMode ? 'border-red-600/60' : 'border-cyan-500/50')
              }`} />

              {/* Eje X */}
              <div className={`absolute top-1/2 left-2 right-2 h-[1px] -translate-y-1/2 pointer-events-none transition-colors ${
                isLevel ? (isRedMode ? 'bg-red-400' : 'bg-emerald-400/80') : (isRedMode ? 'bg-red-800/60' : 'bg-neutral-600/60')
              }`}>
                <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-[1px] h-2 bg-current opacity-60" />
                <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-[1px] h-2 bg-current opacity-60" />
              </div>

              {/* Eje Y */}
              <div className={`absolute left-1/2 top-2 bottom-2 w-[1px] -translate-x-1/2 pointer-events-none transition-colors ${
                isLevel ? (isRedMode ? 'bg-red-400' : 'bg-emerald-400/80') : (isRedMode ? 'bg-red-800/60' : 'bg-neutral-600/60')
              }`}>
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[1px] w-2 bg-current opacity-60" />
                <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 h-[1px] w-2 bg-current opacity-60" />
              </div>

              {/* Punto Central */}
              <div className={`absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
                isLevel ? (isRedMode ? 'bg-red-400 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-400 shadow-[0_0_8px_#34d399]') : (isRedMode ? 'bg-red-600' : 'bg-cyan-400')
              }`} />

              {/* Burbuja Cristalina Apple Liquid Glass (WWDC Style) */}
              <div 
                className="absolute top-1/2 left-1/2 w-8 h-8 rounded-full pointer-events-none flex items-center justify-center"
                style={{
                  transform: `translate(calc(-50% + ${offsetXPixels}px), calc(-50% + ${offsetYPixels}px))`,
                  transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                  filter: isLevel
                    ? (isRedMode 
                        ? 'drop-shadow(0 0 16px rgba(239, 68, 68, 0.85)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))' 
                        : 'drop-shadow(0 0 18px rgba(52, 211, 153, 0.85)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))')
                    : (isRedMode
                        ? 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 8px rgba(239, 68, 68, 0.35))'
                        : 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 10px rgba(56, 189, 248, 0.4))')
                }}
              >
                {/* 1. Cuerpo Principal de Vidrio Líquido (Liquid Glass Surface) */}
                <div 
                  className="w-full h-full rounded-full relative overflow-hidden flex items-center justify-center transition-all duration-300"
                  style={{
                    backdropFilter: 'blur(10px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                    background: isLevel
                      ? (isRedMode
                          ? 'radial-gradient(circle at 35% 25%, rgba(254, 202, 202, 0.8) 0%, rgba(239, 68, 68, 0.4) 40%, rgba(153, 27, 27, 0.6) 80%, rgba(69, 10, 10, 0.9) 100%)'
                          : 'radial-gradient(circle at 35% 25%, rgba(209, 250, 229, 0.8) 0%, rgba(52, 211, 153, 0.4) 40%, rgba(16, 185, 129, 0.6) 80%, rgba(6, 78, 59, 0.9) 100%)')
                      : (isRedMode
                          ? 'radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.75) 0%, rgba(254, 202, 202, 0.3) 30%, rgba(185, 28, 28, 0.25) 70%, rgba(127, 29, 29, 0.6) 100%)'
                          : 'radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.8) 0%, rgba(224, 242, 254, 0.35) 30%, rgba(56, 189, 248, 0.2) 70%, rgba(12, 74, 110, 0.65) 100%)'),
                    border: isLevel
                      ? (isRedMode ? '1px solid rgba(254, 202, 202, 0.9)' : '1px solid rgba(209, 250, 229, 0.95)')
                      : '1px solid rgba(255, 255, 255, 0.65)',
                    boxShadow: isLevel
                      ? (isRedMode 
                          ? 'inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(153,27,27,0.7), inset 0 0 10px rgba(239,68,68,0.5)' 
                          : 'inset 0 1px 2px rgba(255,255,255,0.95), inset 0 -2px 4px rgba(5,150,105,0.7), inset 0 0 10px rgba(52,211,153,0.5)')
                      : 'inset 0 1.5px 3px rgba(255, 255, 255, 0.85), inset 0 -1.5px 3px rgba(0, 0, 0, 0.5), inset 0 0 8px rgba(255, 255, 255, 0.25)'
                  }}
                >
                  {/* 2. Prisma Óptico / Aberración Cromática (Borde Iridiscente Estilo Apple) */}
                  <div 
                    className="absolute inset-0 rounded-full opacity-40 mix-blend-overlay pointer-events-none"
                    style={{
                      background: 'conic-gradient(from 45deg, rgba(255,0,128,0.5), rgba(0,255,255,0.5), rgba(255,255,0,0.5), rgba(255,0,128,0.5))'
                    }}
                  />

                  {/* 3. Brillo Especular Superior Curvo (Top-Left Glossy Bevel) */}
                  <div 
                    className="absolute top-[2px] left-[3px] w-4 h-2 rounded-full pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 60%, transparent 100%)',
                      transform: 'rotate(-25deg)',
                      filter: 'blur(0.2px)'
                    }}
                  />

                  {/* 4. Reflejo Caústico Secundario Inferior (Bottom Rim Reflection) */}
                  <div 
                    className="absolute bottom-[1.5px] right-[2.5px] w-3 h-1.5 rounded-full pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.7) 0%, transparent 100%)',
                      transform: 'rotate(-25deg)',
                      filter: 'blur(0.4px)'
                    }}
                  />

                  {/* 5. Núcleo Fluido de Precisión */}
                  <div 
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      isLevel 
                        ? (isRedMode ? 'bg-white shadow-[0_0_6px_#ffffff]' : 'bg-white shadow-[0_0_6px_#ffffff]')
                        : 'bg-white/60 shadow-[0_0_3px_rgba(255,255,255,0.6)]'
                    }`} 
                  />
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* LECTURA NUMÉRICA EXACTA (PITCH, RUMBO, ROLL) */}
        <div className="w-full grid grid-cols-3 gap-2 text-center">
          <div className={`p-2.5 rounded-2xl border transition-colors ${
            isRedMode ? 'bg-red-950/30 border-red-900/50' : 'bg-neutral-800/40 border-neutral-700/50'
          }`}>
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-60 block mb-0.5">Pitch (X)</span>
            <span className={`text-sm sm:text-base font-mono font-bold ${
              Math.abs(effectivePitch) <= 0.2 ? (isRedMode ? 'text-red-400' : 'text-emerald-400') : 'text-current'
            }`}>
              {effectivePitch >= 0 ? `+${effectivePitch.toFixed(1)}°` : `${effectivePitch.toFixed(1)}°`}
            </span>
          </div>

          <div className={`p-2.5 rounded-2xl border transition-all ${
            isRedMode ? 'bg-red-950/40 border-red-900/60' : 'bg-neutral-800/60 border-neutral-700/60'
          }`}>
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-60 block mb-0.5">Rumbo (Norte)</span>
            <span className="text-sm sm:text-base font-mono font-bold flex items-center justify-center gap-1 text-cyan-400">
              <span className={`font-extrabold ${Math.round(effectiveHeading) === 0 || Math.round(effectiveHeading) === 360 ? 'text-red-500' : (isRedMode ? 'text-red-300' : 'text-white')}`}>
                {getCardinal(effectiveHeading)}
              </span>
              <span>{Math.round(effectiveHeading)}°</span>
            </span>
          </div>

          <div className={`p-2.5 rounded-2xl border transition-colors ${
            isRedMode ? 'bg-red-950/30 border-red-900/50' : 'bg-neutral-800/40 border-neutral-700/50'
          }`}>
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-60 block mb-0.5">Roll (Y)</span>
            <span className={`text-sm sm:text-base font-mono font-bold ${
              Math.abs(effectiveRoll) <= 0.2 ? (isRedMode ? 'text-red-400' : 'text-emerald-400') : 'text-current'
            }`}>
              {effectiveRoll >= 0 ? `+${effectiveRoll.toFixed(1)}°` : `${effectiveRoll.toFixed(1)}°`}
            </span>
          </div>
        </div>

        {/* BADGE DE ESTADO */}
        <div className={`w-full py-2 px-4 rounded-xl text-center text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 ${
          isLevel 
            ? (isRedMode ? 'bg-red-900/80 text-white border border-red-500 shadow-lg animate-pulse' : 'bg-emerald-500 text-neutral-950 shadow-[0_0_20px_rgba(52,211,153,0.4)]')
            : (isRedMode ? 'bg-red-950/40 text-red-400/80 border border-red-900/40' : 'bg-neutral-800/60 text-neutral-400 border border-neutral-700/40')
        }`}>
          {isLevel ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span>TRÍPODE NIVELADO A {totalTilt.toFixed(1)}°</span>
            </>
          ) : (
            <span>Inclinación: {totalTilt.toFixed(1)}° (Centra la burbuja)</span>
          )}
        </div>

        {/* TARA / CALIBRACIÓN DE INCLINACIÓN Y NORTE */}
        <div className="w-full flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-current/10 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={calibrateCurrent}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 font-medium transition-colors ${
                isRedMode ? 'border-red-900/60 hover:bg-red-950 text-red-400' : 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
              }`}
              title="Ajusta el cero si tu teléfono tiene un módulo de cámaras saliente"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Tara Nivel</span>
            </button>

            <button
              onClick={setNorthHere}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 font-medium transition-colors ${
                isRedMode ? 'border-red-900/60 hover:bg-red-950 text-red-400' : 'border-neutral-700 hover:bg-neutral-800 text-cyan-300'
              }`}
              title="Apunta hacia el Norte o Polar y pulsa para fijar 0°"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Fijar Norte (0°)</span>
            </button>
          </div>

          {(calibratedOffset.pitch !== 0 || calibratedOffset.roll !== 0 || compassOffset !== 0) && (
            <button
              onClick={() => {
                resetCalibration();
                resetNorth();
              }}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors ${
                isRedMode ? 'border-red-900/60 hover:bg-red-950 text-red-400' : 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
              }`}
              title="Restablecer calibración de nivel y rumbo a valores de fábrica"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
