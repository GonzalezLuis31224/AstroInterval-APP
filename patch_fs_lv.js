import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const oldLV = `<div className={\`aspect-video rounded-xl border flex flex-col items-center justify-center gap-2 overflow-hidden relative \${isRedMode ? 'border-red-900 bg-black' : 'border-neutral-800 bg-neutral-900'}\`}>`;

const newLV = `<div id="liveview-container" className={\`aspect-video rounded-xl border flex flex-col items-center justify-center gap-2 overflow-hidden relative \${isRedMode ? 'border-red-900 bg-black' : 'border-neutral-800 bg-neutral-900'}\`}>
          {liveViewActive && (
            <button 
              onClick={() => {
                 const container = document.getElementById("liveview-container");
                 if (container) {
                    if (document.fullscreenElement) {
                       document.exitFullscreen();
                    } else {
                       container.requestFullscreen().catch(()=>{});
                       if (screen && screen.orientation && screen.orientation.lock) {
                           screen.orientation.lock("landscape").catch(()=>{});
                       }
                    }
                 }
              }}
              className="absolute top-4 right-4 z-20 p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          )}`;

content = content.replace(oldLV, newLV);
fs.writeFileSync('src/App.tsx', content);
