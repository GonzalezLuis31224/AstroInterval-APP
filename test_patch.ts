import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Imports
content = content.replace("import { Camera,", "import { Camera, Image as ImageIcon,");
content = content.replace("import { TethrManager } from 'tethr';", "import { TethrManager } from 'tethr';\nimport exifr from 'exifr';");

// 2. State
const stateInjection = `
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<{ url: string; iso: string; aperture: string; shutter: string; hist: number[]; maxHist: number } | null>(null);
  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);

  const fetchLastPhoto = async () => {
    if (!camera) return;
    setIsFetchingPhoto(true);
    try {
      const handles = await (camera as any).getObjectHandles();
      if (!handles || handles.length === 0) {
        alert("No se encontraron fotos en la cámara.");
        setIsFetchingPhoto(false);
        return;
      }
      const lastHandle = handles[handles.length - 1];
      setStatusText("Descargando última foto...");
      
      let buffer = null;
      try {
          const { data } = await (camera as any).device.receiveData({
              opcode: 4106,
              parameters: [lastHandle]
          });
          buffer = data;
      } catch (e) {
          console.log("No thumb, trying full object...", e);
      }
      
      if (!buffer || buffer.byteLength < 1000) {
         buffer = await (camera as any).getObject(lastHandle);
      }
      
      if (buffer) {
          const exif = await exifr.parse(buffer).catch(() => null);
          const iso = exif?.ISO || "N/A";
          const aperture = exif?.FNumber ? \`f/\${exif.FNumber}\` : "N/A";
          const shutter = exif?.ExposureTime ? (exif.ExposureTime < 1 ? \`1/\${Math.round(1/exif.ExposureTime)}\` : \`\${exif.ExposureTime}"\`) : "N/A";
          
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          
          const img = new Image();
          img.onload = () => {
             const canvas = document.createElement('canvas');
             const ctx = canvas.getContext('2d');
             canvas.width = img.width;
             canvas.height = img.height;
             ctx.drawImage(img, 0, 0);
             const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
             const hist = new Array(256).fill(0);
             let maxHist = 0;
             for (let i = 0; i < imgData.length; i += 16) {
                 const r = imgData[i];
                 const g = imgData[i+1];
                 const b = imgData[i+2];
                 const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                 hist[luminance]++;
                 if (hist[luminance] > maxHist) maxHist = hist[luminance];
             }
             setLastPhoto({ url, iso: String(iso), aperture, shutter, hist, maxHist });
             setIsFetchingPhoto(false);
             setStatusText("Listo.");
          };
          img.src = url;
          setGalleryOpen(true);
      }
    } catch (e) {
       console.error(e);
       alert("Error obteniendo la foto: " + (e.message || "Error desconocido"));
       setIsFetchingPhoto(false);
       setStatusText("Error en descarga.");
    }
  };
`;
content = content.replace("const [supportedConfigs, setSupportedConfigs] = useState<{", stateInjection + "\n  const [supportedConfigs, setSupportedConfigs] = useState<{");

// 3. Button
const buttonInjection = `
            <button 
              onClick={fetchLastPhoto}
              className={\`p-2 rounded-full border \${accentClass} transition-all \${isFetchingPhoto ? 'animate-pulse' : ''}\`}
              title="Última Foto (EXIF e Histograma)"
              disabled={!camera || isFetchingPhoto}
            >
              <ImageIcon className="w-5 h-5" />
            </button>
`;
content = content.replace(`<button \n              onClick={toggleFullscreen}`, `${buttonInjection}\n            <button \n              onClick={toggleFullscreen}`);

// 4. Modal
const modalInjection = `
      {galleryOpen && lastPhoto && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
           <button onClick={() => setGalleryOpen(false)} className="absolute top-4 right-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-full text-white font-bold shadow-lg">
              Cerrar
           </button>
           <div className="w-full max-w-4xl flex flex-col gap-4">
               <img src={lastPhoto.url} className="w-full h-auto max-h-[60vh] object-contain rounded-xl border border-neutral-700 bg-neutral-900" />
               <div className="flex flex-col sm:flex-row gap-4 p-4 bg-neutral-900 rounded-xl text-white border border-neutral-800">
                  <div className="flex-1 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-neutral-700 pb-4 sm:pb-0 sm:pr-4">
                     <p className="text-sm opacity-50 mb-2 font-bold tracking-widest uppercase">Parámetros EXIF</p>
                     <p className="font-mono text-xl"><span className="opacity-50 text-sm w-20 inline-block">ISO</span> {lastPhoto.iso}</p>
                     <p className="font-mono text-xl"><span className="opacity-50 text-sm w-20 inline-block">Apertura</span> {lastPhoto.aperture}</p>
                     <p className="font-mono text-xl"><span className="opacity-50 text-sm w-20 inline-block">Veloc.</span> {lastPhoto.shutter}</p>
                  </div>
                  <div className="flex-[2]">
                     <p className="text-sm opacity-50 mb-2 font-bold tracking-widest uppercase">Histograma de Luminancia</p>
                     <div className="w-full h-24 flex items-end justify-between border-b border-neutral-700 pb-1">
                        {lastPhoto.hist.map((val, i) => (
                           <div key={i} className={\`bg-white \${val > 0 ? 'opacity-80' : 'opacity-0'}\`} style={{ width: '100%', height: \`\${Math.max(1, (val / lastPhoto.maxHist) * 100)}%\` }} />
                        ))}
                     </div>
                  </div>
               </div>
           </div>
        </div>
      )}
`;
content = content.replace("</div>\n    </div>\n  );\n}", "</div>\n" + modalInjection + "    </div>\n  );\n}");

fs.writeFileSync('src/App.tsx', content);
