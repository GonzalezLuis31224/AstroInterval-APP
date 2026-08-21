import React, { useState, useRef, useEffect } from 'react';

export function ParameterDial({ 
  label, 
  options, 
  value, 
  onChange, 
  accentClass 
}: { 
  label: string, 
  options: string[], 
  value: string, 
  onChange: (v: string) => void,
  accentClass: string
}) {
  const [isDialOpen, setIsDialOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  
  const timerRef = useRef<any>(null);
  const startPos = useRef({ x: 0, y: 0, index: 0 });
  const currentIndex = options.indexOf(value) >= 0 ? options.indexOf(value) : 0;
  
  const [dragIndex, setDragIndex] = useState(currentIndex);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== undefined) return;
    
    e.target.setPointerCapture(e.pointerId);
    startPos.current = { x: e.clientX, y: e.clientY, index: currentIndex };
    
    timerRef.current = setTimeout(() => {
      setIsDialOpen(true);
      setDragIndex(currentIndex);
      if (navigator.vibrate) navigator.vibrate(50); // initial haptic for dial open
    }, 400); 
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDialOpen) {
      // Dragging up or right increases index (makes it feel natural)
      const deltaY = startPos.current.y - e.clientY;
      const deltaX = e.clientX - startPos.current.x;
      
      const movePixels = deltaY + (deltaX * 0.5); // Favor Y axis a bit more
      
      const pixelsPerStep = 20; 
      let newIndex = startPos.current.index + Math.round(movePixels / pixelsPerStep);
      
      newIndex = Math.max(0, Math.min(options.length - 1, newIndex));
      if (newIndex !== dragIndex) {
        setDragIndex(newIndex);
        onChange(options[newIndex]);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    } else if (timerRef.current) {
      const dist = Math.hypot(e.clientX - startPos.current.x, e.clientY - startPos.current.y);
      if (dist > 15) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.target.releasePointerCapture(e.pointerId);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (!isDialOpen) {
        setIsListOpen(true);
      }
    }
    if (isDialOpen) {
      setIsDialOpen(false);
    }
  };

  // Derive active bg color from accentClass (e.g. "border-red-500" -> "bg-red-500")
  const activeBg = accentClass.replace('border-', 'bg-').split(' ')[0] || 'bg-white';

  return (
    <>
      <div 
        className="flex flex-col gap-1 select-none touch-none"
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <label className="text-xs font-bold opacity-70 uppercase tracking-wider">{label}</label>
        <div className={`p-3 rounded-lg border-2 text-center font-bold bg-neutral-900/50 cursor-pointer shadow-sm active:scale-95 transition-transform ${accentClass} ${isDialOpen ? 'ring-2 ring-current scale-95' : ''}`}>
          {value || '-'}
        </div>
        <div className="text-[10px] opacity-40 text-center -mt-1 tracking-widest">MANTENER</div>
      </div>

      {/* DIAL OVERLAY */}
      {isDialOpen && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center overflow-hidden">
           <div className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300" />
           
           <div className="relative w-full h-full flex items-center justify-center">
             {/* Center indicator */}
             <div className="absolute w-20 h-20 border-2 border-white/20 rounded-full flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] ${activeBg}`} />
             </div>
             
             {options.map((opt, i) => {
               const offset = i - dragIndex;
               
               if (Math.abs(offset) > 12) return null;
               
               // Calculate position on a circle
               // Let's place the active item at the top (0 degrees)
               const angleDeg = offset * 18; 
               const angleRad = (angleDeg * Math.PI) / 180;
               const radius = 140; // Size of the arc
               
               const x = Math.sin(angleRad) * radius;
               const y = -Math.cos(angleRad) * radius;
               
               const isActive = offset === 0;
               
               return (
                 <div 
                   key={i}
                   className={`absolute transition-all duration-100 ease-out text-center flex flex-col items-center justify-center
                     ${isActive ? 'text-white font-black scale-125' : 'text-neutral-400 opacity-60 scale-90'}`}
                   style={{
                     transform: `translate(${x}px, ${y}px) rotate(${angleDeg}deg)`,
                     width: 80,
                     height: 40,
                     textShadow: isActive ? '0px 0px 10px rgba(255,255,255,0.5)' : 'none'
                   }}
                 >
                   <div className="text-lg">{opt}</div>
                   {isActive && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${activeBg}`} />}
                   {!isActive && <div className="w-0.5 h-1.5 bg-current mt-1 opacity-50" />}
                 </div>
               )
             })}
           </div>
           
           <div className="absolute bottom-10 text-white/50 text-sm font-medium tracking-widest uppercase animate-pulse">
             Desliza para ajustar
           </div>
        </div>
      )}

      {/* FULL LIST MODAL FOR CLICK */}
      {isListOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsListOpen(false)} />
          <div className="relative bg-neutral-900 border border-neutral-700 w-full sm:w-80 rounded-2xl max-h-[70vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/90 backdrop-blur z-10 sticky top-0">
              <h3 className="font-bold text-lg">{label}</h3>
              <button onClick={() => setIsListOpen(false)} className="text-neutral-400 hover:text-white p-2 rounded-full bg-neutral-800 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-3 flex flex-col gap-2">
              {options.map(opt => {
                const isSelected = opt === value;
                return (
                  <button 
                    key={opt}
                    onClick={() => {
                      onChange(opt);
                      setIsListOpen(false);
                    }}
                    className={`p-4 rounded-xl text-left transition-all ${
                      isSelected 
                        ? `${activeBg} text-black font-bold shadow-lg scale-[1.02]` 
                        : 'bg-neutral-800/50 hover:bg-neutral-800 text-white font-medium hover:scale-[1.02]'
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
